import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { RatesheetRepository, Ratesheet } from '@/models/Ratesheet';

// GET - Fetch all ratesheets or filter by entity/sublocation/date
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId');
    const pendingApproval = searchParams.get('pendingApproval');
    const subLocationId = searchParams.get('subLocationId');
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let ratesheets;

    if (subLocationId && (startDate || date)) {
      // NEW: Find ratesheets for specific sublocation within date range
      // This is used by the timeline visualization
      const targetStartDate = startDate ? new Date(startDate) : new Date(date!);
      const targetEndDate = endDate ? new Date(endDate) : targetStartDate;
      
      const collection = await RatesheetRepository.getCollection();
      
      ratesheets = await collection.find({
        $and: [
          // Must match the sublocation (support both old and new data structures)
          {
            $or: [
              { layer: 'SUBLOCATION', entityId: new ObjectId(subLocationId) },
              { 'appliesTo.level': 'SUBLOCATION', 'appliesTo.entityId': new ObjectId(subLocationId) }
            ]
          },
          // Must be active and approved
          {
            isActive: true,
            $or: [
              { approvalStatus: 'APPROVED' },
              { status: 'APPROVED' }
            ]
          },
          // Must overlap with the target date range
          {
            $or: [
              // Case 1: Ratesheet has no end date (indefinite) - just check it starts before range ends
              {
                effectiveFrom: { $lte: targetEndDate },
                effectiveTo: { $exists: false }
              },
              {
                effectiveFrom: { $lte: targetEndDate },
                effectiveTo: null
              },
              // Case 2: Ratesheet has end date - check for overlap
              // Overlaps if: ratesheet starts before range ends AND ratesheet ends after range starts
              {
                effectiveFrom: { $lte: targetEndDate },
                effectiveTo: { $gte: targetStartDate }
              }
            ]
          }
        ]
      }).sort({ priority: -1 }).toArray();
    } else if (pendingApproval === 'true') {
      // Existing: Get pending approval ratesheets
      ratesheets = await RatesheetRepository.findPendingApproval();
    } else if (entityId) {
      // Existing: Get ratesheets by entity ID
      ratesheets = await RatesheetRepository.findByEntityId(new ObjectId(entityId));
    } else {
      // Existing: Get all ratesheets
      ratesheets = await RatesheetRepository.findAll();
    }

    // Map approvalStatus to status for frontend compatibility
    const mappedRatesheets = ratesheets.map((rs: any) => ({
      ...rs,
      _id: rs._id?.toString(),
      status: rs.approvalStatus || rs.status || 'DRAFT',
      entityId: rs.entityId?.toString(),
      locationId: rs.locationId?.toString()
    }));

    return NextResponse.json(mappedRatesheets);
  } catch (error: any) {
    console.error('[API] Error fetching ratesheets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch ratesheets' },
      { status: 500 }
    );
  }
}

// POST - Create new ratesheet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[API] Creating ratesheet:', {
      name: body.name,
      type: body.type,
      layer: body.layer,
      entityId: body.entityId
    });

    // Validation
    if (!body.name || !body.type || !body.layer || !body.entityId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, layer, entityId' },
        { status: 400 }
      );
    }

    // Convert entityId to ObjectId and prepare ratesheet data
    const ratesheet: any = {
      name: body.name,
      description: body.description,
      type: body.type,
      layer: body.layer,
      entityId: new ObjectId(body.entityId),
      priority: body.priority || 50,
      conflictResolution: body.conflictResolution || 'PRIORITY',
      effectiveFrom: new Date(body.effectiveFrom),
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
      recurrence: body.recurrence,
      timeWindows: body.timeWindows,
      durationRules: body.durationRules,
      approvalStatus: body.status || 'DRAFT', // Map status to approvalStatus for DB
      isActive: body.isActive !== undefined ? body.isActive : true,
    };

    console.log('[API] Ratesheet data prepared:', {
      layer: ratesheet.layer,
      entityId: ratesheet.entityId.toString(),
      effectiveFrom: ratesheet.effectiveFrom,
      effectiveTo: ratesheet.effectiveTo,
      timeWindows: ratesheet.timeWindows?.length || 0
    });

    const id = await RatesheetRepository.create(ratesheet);

    console.log('[API] Ratesheet created with ID:', id.toString());

    return NextResponse.json({ 
      success: true, 
      id: id.toString() 
    }, { status: 201 });
  } catch (error: any) {
    console.error('[API] Error creating ratesheet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create ratesheet' },
      { status: 500 }
    );
  }
}

// PATCH - Update ratesheet
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing ratesheet ID' },
        { status: 400 }
      );
    }

    console.log('[API] Updating ratesheet:', id);

    // Convert dates if present
    if (updates.effectiveFrom) {
      updates.effectiveFrom = new Date(updates.effectiveFrom);
    }
    if (updates.effectiveTo) {
      updates.effectiveTo = new Date(updates.effectiveTo);
    }

    // Convert entityId if present
    if (updates.entityId) {
      updates.entityId = new ObjectId(updates.entityId);
    }

    const success = await RatesheetRepository.update(new ObjectId(id), updates);

    if (!success) {
      return NextResponse.json(
        { error: 'Ratesheet not found or not updated' },
        { status: 404 }
      );
    }

    console.log('[API] Ratesheet updated successfully');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error updating ratesheet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update ratesheet' },
      { status: 500 }
    );
  }
}

// DELETE - Delete ratesheet
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing ratesheet ID' },
        { status: 400 }
      );
    }

    console.log('[API] Deleting ratesheet:', id);

    const success = await RatesheetRepository.delete(new ObjectId(id));

    if (!success) {
      return NextResponse.json(
        { error: 'Ratesheet not found' },
        { status: 404 }
      );
    }

    console.log('[API] Ratesheet deleted successfully');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error deleting ratesheet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete ratesheet' },
      { status: 500 }
    );
  }
}
