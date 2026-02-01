import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { SurgeConfigRepository } from '@/models/SurgeConfig';
import { getDb } from '@/lib/mongodb';

/**
 * GET: Fetch a single surge config by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid surge config ID' },
        { status: 400 }
      );
    }

    const config = await SurgeConfigRepository.findById(id);

    if (!config) {
      return NextResponse.json(
        { error: 'Surge config not found' },
        { status: 404 }
      );
    }

    // Enrich with entity metadata
    const db = await getDb();
    const { level, entityId } = config.appliesTo;
    let entityInfo: any = {};

    try {
      if (level === 'LOCATION') {
        const location = await db.collection('locations').findOne({ _id: new ObjectId(entityId) });
        if (location) {
          entityInfo = { location: { _id: location._id, name: location.name, city: location.city } };
        }
      } else if (level === 'SUBLOCATION') {
        const sublocation = await db.collection('sublocations').findOne({ _id: new ObjectId(entityId) });
        if (sublocation) {
          entityInfo = { sublocation: { _id: sublocation._id, label: sublocation.label } };
        }
      }
    } catch (error) {
      console.error('Failed to enrich surge config:', error);
    }

    return NextResponse.json({ ...config, ...entityInfo });
  } catch (error) {
    console.error('Failed to fetch surge config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch surge config' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update a surge config (partial updates)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid surge config ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      priority,
      demandSupplyParams,
      surgeParams,
      appliesTo,
      effectiveFrom,
      effectiveTo,
      timeWindows,
      isActive
    } = body;

    // Build updates object (only include provided fields)
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (priority !== undefined) updates.priority = priority;
    if (demandSupplyParams !== undefined) {
      // Validate demand/supply params
      if (demandSupplyParams.currentDemand < 0 || demandSupplyParams.currentSupply <= 0) {
        return NextResponse.json(
          { error: 'Invalid demand/supply parameters' },
          { status: 400 }
        );
      }
      if (demandSupplyParams.historicalAvgPressure <= 0) {
        return NextResponse.json(
          { error: 'historicalAvgPressure must be greater than 0' },
          { status: 400 }
        );
      }
      updates.demandSupplyParams = demandSupplyParams;
    }
    if (surgeParams !== undefined) {
      // Validate surge params
      if (surgeParams.alpha !== undefined && (surgeParams.alpha < 0.1 || surgeParams.alpha > 1.0)) {
        return NextResponse.json(
          { error: 'alpha must be between 0.1 and 1.0' },
          { status: 400 }
        );
      }
      if (surgeParams.minMultiplier !== undefined && (surgeParams.minMultiplier < 0.5 || surgeParams.minMultiplier > 1.0)) {
        return NextResponse.json(
          { error: 'minMultiplier must be between 0.5 and 1.0' },
          { status: 400 }
        );
      }
      if (surgeParams.maxMultiplier !== undefined && (surgeParams.maxMultiplier < 1.0 || surgeParams.maxMultiplier > 3.0)) {
        return NextResponse.json(
          { error: 'maxMultiplier must be between 1.0 and 3.0' },
          { status: 400 }
        );
      }
      updates.surgeParams = surgeParams;
    }
    if (effectiveFrom !== undefined) updates.effectiveFrom = new Date(effectiveFrom);
    if (effectiveTo !== undefined) updates.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
    if (timeWindows !== undefined) updates.timeWindows = timeWindows;
    if (isActive !== undefined) updates.isActive = isActive;

    // Handle appliesTo updates (convert entityId to ObjectId)
    if (appliesTo !== undefined) {
      if (!appliesTo.level || !appliesTo.entityId) {
        return NextResponse.json(
          { error: 'appliesTo.level and appliesTo.entityId are required' },
          { status: 400 }
        );
      }

      const validLevels = ['SUBLOCATION', 'LOCATION'];
      if (!validLevels.includes(appliesTo.level)) {
        return NextResponse.json(
          { error: `appliesTo.level must be one of: ${validLevels.join(', ')}` },
          { status: 400 }
        );
      }

      try {
        updates.appliesTo = {
          level: appliesTo.level,
          entityId: new ObjectId(appliesTo.entityId),
        };
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid entityId format' },
          { status: 400 }
        );
      }

      // Verify entity exists
      const db = await getDb();
      const collectionName = appliesTo.level === 'LOCATION' ? 'locations' : 'sublocations';
      const entity = await db.collection(collectionName).findOne({ _id: updates.appliesTo.entityId });

      if (!entity) {
        return NextResponse.json(
          { error: `${appliesTo.level} with ID ${appliesTo.entityId} not found` },
          { status: 404 }
        );
      }
    }

    const updatedConfig = await SurgeConfigRepository.update(id, updates);

    if (!updatedConfig) {
      return NextResponse.json(
        { error: 'Surge config not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Surge config updated successfully',
      config: updatedConfig,
    });
  } catch (error) {
    console.error('Failed to update surge config:', error);
    return NextResponse.json(
      { error: 'Failed to update surge config' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete a surge config
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid surge config ID' },
        { status: 400 }
      );
    }

    const deleted = await SurgeConfigRepository.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Surge config not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Surge config deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete surge config:', error);
    return NextResponse.json(
      { error: 'Failed to delete surge config' },
      { status: 500 }
    );
  }
}
