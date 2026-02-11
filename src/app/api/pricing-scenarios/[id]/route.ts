import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { PricingScenarioRepository } from '@/models/PricingScenario';
import { getDb } from '@/lib/mongodb';

/**
 * GET: Fetch a single pricing scenario by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid scenario ID' },
        { status: 400 }
      );
    }

    const scenario = await PricingScenarioRepository.findById(id);

    if (!scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }

    // Enrich with entity metadata
    const db = await getDb();
    const { level, entityId } = scenario.appliesTo;
    let entityInfo: any = {};

    try {
      if (level === 'CUSTOMER') {
        const customer = await db.collection('customers').findOne({ _id: new ObjectId(entityId) });
        if (customer) {
          entityInfo = { customer: { _id: customer._id, name: customer.name } };
        }
      } else if (level === 'LOCATION') {
        const location = await db.collection('locations').findOne({ _id: new ObjectId(entityId) });
        if (location) {
          entityInfo = { location: { _id: location._id, name: location.name, city: location.city } };
        }
      } else if (level === 'SUBLOCATION') {
        const sublocation = await db.collection('sublocations').findOne({ _id: new ObjectId(entityId) });
        if (sublocation) {
          entityInfo = { sublocation: { _id: sublocation._id, label: sublocation.label } };
        }
      } else if (level === 'EVENT') {
        const event = await db.collection('events').findOne({ _id: new ObjectId(entityId) });
        if (event) {
          entityInfo = { event: { _id: event._id, name: event.name, startDate: event.startDate, endDate: event.endDate } };
        }
      }
    } catch (error) {
      console.error('Failed to enrich scenario:', error);
    }

    return NextResponse.json({ ...scenario, ...entityInfo });
  } catch (error) {
    console.error('Failed to fetch scenario:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scenario' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update a pricing scenario (partial updates)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid scenario ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, description, config, isActive, tags, appliesTo } = body;

    // Build updates object (only include provided fields)
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (config !== undefined) updates.config = config;
    if (isActive !== undefined) updates.isActive = isActive;
    if (tags !== undefined) updates.tags = tags;

    // Handle appliesTo updates (convert entityId to ObjectId)
    if (appliesTo !== undefined) {
      if (!appliesTo.level || !appliesTo.entityId) {
        return NextResponse.json(
          { error: 'appliesTo.level and appliesTo.entityId are required' },
          { status: 400 }
        );
      }

      const validLevels = ['CUSTOMER', 'LOCATION', 'SUBLOCATION', 'EVENT'];
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
      let collectionName = '';
      if (appliesTo.level === 'CUSTOMER') collectionName = 'customers';
      else if (appliesTo.level === 'LOCATION') collectionName = 'locations';
      else if (appliesTo.level === 'SUBLOCATION') collectionName = 'sublocations';
      else if (appliesTo.level === 'EVENT') collectionName = 'events';

      const entity = await db.collection(collectionName).findOne({ _id: updates.appliesTo.entityId });
      if (!entity) {
        return NextResponse.json(
          { error: `${appliesTo.level} with ID ${appliesTo.entityId} not found` },
          { status: 404 }
        );
      }
    }

    const updatedScenario = await PricingScenarioRepository.update(id, updates);

    if (!updatedScenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Scenario updated successfully',
      scenario: updatedScenario,
    });
  } catch (error) {
    console.error('Failed to update scenario:', error);
    return NextResponse.json(
      { error: 'Failed to update scenario' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete a pricing scenario
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid scenario ID' },
        { status: 400 }
      );
    }

    const deleted = await PricingScenarioRepository.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Scenario deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete scenario:', error);
    return NextResponse.json(
      { error: 'Failed to delete scenario' },
      { status: 500 }
    );
  }
}
