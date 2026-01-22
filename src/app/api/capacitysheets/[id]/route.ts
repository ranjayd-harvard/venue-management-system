import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET: Fetch single capacity sheet
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb();
    const collection = db.collection('capacitysheets');

    const capacitySheet = await collection.findOne({ _id: new ObjectId(params.id) });

    if (!capacitySheet) {
      return NextResponse.json({ error: 'Capacity sheet not found' }, { status: 404 });
    }

    return NextResponse.json(capacitySheet);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Full update of capacity sheet
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb();
    const capacitySheets = db.collection('capacitysheets');
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

    // Fetch existing capacity sheet to determine level
    const existing = await capacitySheets.findOne({ _id: new ObjectId(params.id) });
    if (!existing) {
      return NextResponse.json({ error: 'Capacity sheet not found' }, { status: 404 });
    }

    const level = existing.appliesTo.level;

    // Validate priority against configured ranges
    if (priority !== undefined) {
      const config = await priorityConfigs.findOne({ type: level });
      if (config) {
        if (priority < config.minPriority || priority > config.maxPriority) {
          return NextResponse.json(
            {
              error: `Priority must be between ${config.minPriority} and ${config.maxPriority} for ${level} level`,
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

    // Update the capacity sheet
    const result = await capacitySheets.updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Capacity sheet not found' }, { status: 404 });
    }

    // Fetch and return updated capacity sheet
    const updated = await capacitySheets.findOne({ _id: new ObjectId(params.id) });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/capacitysheets/[id] error:', error);
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
    const capacitySheets = db.collection('capacitysheets');
    const priorityConfigs = db.collection('priority_configs');

    const body = await request.json();
    const { isActive, priority, effectiveTo } = body;

    // Fetch existing capacity sheet to determine level
    const existing = await capacitySheets.findOne({ _id: new ObjectId(params.id) });
    if (!existing) {
      return NextResponse.json({ error: 'Capacity sheet not found' }, { status: 404 });
    }

    const level = existing.appliesTo.level;

    // Validate priority if provided
    if (priority !== undefined) {
      const config = await priorityConfigs.findOne({ type: level });
      if (config) {
        if (priority < config.minPriority || priority > config.maxPriority) {
          return NextResponse.json(
            {
              error: `Priority must be between ${config.minPriority} and ${config.maxPriority} for ${level} level`,
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

    // Update the capacity sheet
    const result = await capacitySheets.updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Capacity sheet not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Capacity sheet updated successfully' });
  } catch (error: any) {
    console.error('PATCH /api/capacitysheets/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove capacity sheet
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb();
    const collection = db.collection('capacitysheets');

    const result = await collection.deleteOne({ _id: new ObjectId(params.id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Capacity sheet not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Capacity sheet deleted successfully' });
  } catch (error: any) {
    console.error('DELETE /api/capacitysheets/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
