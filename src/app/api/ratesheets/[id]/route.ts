import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET: Fetch single ratesheet
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb();
    const collection = db.collection('ratesheets');

    const ratesheet = await collection.findOne({ _id: new ObjectId(params.id) });

    if (!ratesheet) {
      return NextResponse.json({ error: 'Ratesheet not found' }, { status: 404 });
    }

    return NextResponse.json(ratesheet);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Full update of ratesheet
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb();
    const ratesheets = db.collection('ratesheets');
    const priorityConfigs = db.collection('priority_configs');

    const body = await request.json();
    const {
      name,
      description,
      priority,
      conflictResolution,
      isActive,
      effectiveFrom,
      effectiveTo,
    } = body;

    // Fetch existing ratesheet to determine type
    const existing = await ratesheets.findOne({ _id: new ObjectId(params.id) });
    if (!existing) {
      return NextResponse.json({ error: 'Ratesheet not found' }, { status: 404 });
    }

    // Determine ratesheet type
    let ratesheetType: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
    if (existing.subLocationId) {
      ratesheetType = 'SUBLOCATION';
    } else if (existing.locationId) {
      ratesheetType = 'LOCATION';
    } else {
      ratesheetType = 'CUSTOMER';
    }

    // Validate priority against configured ranges
    if (priority !== undefined) {
      const config = await priorityConfigs.findOne({ type: ratesheetType });
      if (config) {
        if (priority < config.minPriority || priority > config.maxPriority) {
          return NextResponse.json(
            {
              error: `Priority must be between ${config.minPriority} and ${config.maxPriority} for ${ratesheetType} level`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Build update object (only include fields that are provided)
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (conflictResolution !== undefined) updateData.conflictResolution = conflictResolution;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (effectiveFrom !== undefined) updateData.effectiveFrom = new Date(effectiveFrom);
    if (effectiveTo !== undefined) {
      updateData.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
    }

    // Update the ratesheet
    const result = await ratesheets.updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Ratesheet not found' }, { status: 404 });
    }

    // Fetch and return updated ratesheet
    const updated = await ratesheets.findOne({ _id: new ObjectId(params.id) });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/ratesheets/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Partial update (isActive, priority, effectiveTo)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb();
    const ratesheets = db.collection('ratesheets');
    const priorityConfigs = db.collection('priority_configs');

    const body = await request.json();
    const { isActive, priority, effectiveTo } = body;

    // Fetch existing ratesheet to determine type
    const existing = await ratesheets.findOne({ _id: new ObjectId(params.id) });
    if (!existing) {
      return NextResponse.json({ error: 'Ratesheet not found' }, { status: 404 });
    }

    // Determine ratesheet type
    let ratesheetType: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
    if (existing.subLocationId) {
      ratesheetType = 'SUBLOCATION';
    } else if (existing.locationId) {
      ratesheetType = 'LOCATION';
    } else {
      ratesheetType = 'CUSTOMER';
    }

    // Validate priority if provided
    if (priority !== undefined) {
      const config = await priorityConfigs.findOne({ type: ratesheetType });
      if (config) {
        if (priority < config.minPriority || priority > config.maxPriority) {
          return NextResponse.json(
            {
              error: `Priority must be between ${config.minPriority} and ${config.maxPriority} for ${ratesheetType} level`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (isActive !== undefined) updateData.isActive = isActive;
    if (priority !== undefined) updateData.priority = priority;
    if (effectiveTo !== undefined) {
      updateData.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
    }

    // Update the ratesheet
    const result = await ratesheets.updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Ratesheet not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Ratesheet updated successfully' });
  } catch (error: any) {
    console.error('PATCH /api/ratesheets/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove ratesheet
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb();
    const collection = db.collection('ratesheets');

    const result = await collection.deleteOne({ _id: new ObjectId(params.id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Ratesheet not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Ratesheet deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/ratesheets/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
