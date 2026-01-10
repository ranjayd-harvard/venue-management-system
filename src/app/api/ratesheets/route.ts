import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { RatesheetRepository, Ratesheet } from '@/models/Ratesheet';

// GET - Fetch all ratesheets or filter by entity
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId');
    const pendingApproval = searchParams.get('pendingApproval');

    let ratesheets;

    if (pendingApproval === 'true') {
      ratesheets = await RatesheetRepository.findPendingApproval();
    } else if (entityId) {
      ratesheets = await RatesheetRepository.findByEntityId(new ObjectId(entityId));
    } else {
      ratesheets = await RatesheetRepository.findAll();
    }

    return NextResponse.json(ratesheets);
  } catch (error: any) {
    console.error('Error fetching ratesheets:', error);
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

    // Validation
    if (!body.name || !body.type || !body.appliesTo) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, appliesTo' },
        { status: 400 }
      );
    }

    // Convert entityId to ObjectId
    const ratesheet: Omit<Ratesheet, '_id' | 'createdAt' | 'updatedAt'> = {
      ...body,
      appliesTo: {
        level: body.appliesTo.level,
        entityId: new ObjectId(body.appliesTo.entityId)
      },
      effectiveFrom: new Date(body.effectiveFrom),
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
      approvalStatus: body.approvalStatus || 'DRAFT',
      isActive: body.isActive !== undefined ? body.isActive : true,
    };

    const id = await RatesheetRepository.create(ratesheet);

    return NextResponse.json({ 
      success: true, 
      id: id.toString() 
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating ratesheet:', error);
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

    // Convert dates if present
    if (updates.effectiveFrom) {
      updates.effectiveFrom = new Date(updates.effectiveFrom);
    }
    if (updates.effectiveTo) {
      updates.effectiveTo = new Date(updates.effectiveTo);
    }

    const success = await RatesheetRepository.update(new ObjectId(id), updates);

    if (!success) {
      return NextResponse.json(
        { error: 'Ratesheet not found or not updated' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating ratesheet:', error);
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

    const success = await RatesheetRepository.delete(new ObjectId(id));

    if (!success) {
      return NextResponse.json(
        { error: 'Ratesheet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting ratesheet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete ratesheet' },
      { status: 500 }
    );
  }
}
