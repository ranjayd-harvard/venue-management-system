import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { PricingScenarioRepository } from '@/models/PricingScenario';

/**
 * GET: Fetch all pricing scenarios with optional filters
 *
 * Supports hierarchy resolution similar to ratesheets:
 * - Pass subLocationId to get scenarios at sublocation + location + customer levels
 * - Pass locationId to get scenarios at location + customer levels
 * - Pass customerId to get scenarios at customer level only
 * - Pass eventId to get scenarios at event level
 *
 * Query Parameters:
 * - subLocationId: Get scenarios for sublocation (with hierarchy if resolveHierarchy=true)
 * - locationId: Get scenarios for location
 * - customerId: Get scenarios for customer
 * - eventId: Get scenarios for event
 * - resolveHierarchy: If 'true' (default), fetches scenarios from entire hierarchy
 * - includeInactive: Include inactive scenarios (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subLocationId = searchParams.get('subLocationId');
    const locationId = searchParams.get('locationId');
    const customerId = searchParams.get('customerId');
    const eventId = searchParams.get('eventId');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const resolveHierarchy = searchParams.get('resolveHierarchy') !== 'false'; // Default to true

    const db = await getDb();

    let scenarios: any[] = [];
    let hierarchyInfo: any = null;

    // If subLocationId provided with hierarchy resolution
    if (subLocationId && resolveHierarchy) {
      // Get sublocation to find its location
      const sublocation = await db.collection('sublocations').findOne({
        _id: new ObjectId(subLocationId),
      });

      if (!sublocation) {
        return NextResponse.json(
          { error: 'SubLocation not found' },
          { status: 404 }
        );
      }

      // Get location to find its customer
      const location = await db.collection('locations').findOne({
        _id: new ObjectId(sublocation.locationId),
      });

      if (!location) {
        return NextResponse.json(
          { error: 'Location not found' },
          { status: 404 }
        );
      }

      // Store hierarchy info
      hierarchyInfo = {
        customerId: location.customerId.toString(),
        locationId: location._id.toString(),
        subLocationId: sublocation._id.toString(),
      };

      // Get scenarios from all hierarchy levels
      scenarios = await PricingScenarioRepository.findBySubLocation(subLocationId);

    } else if (locationId && resolveHierarchy) {
      // Get location to find its customer
      const location = await db.collection('locations').findOne({
        _id: new ObjectId(locationId),
      });

      if (!location) {
        return NextResponse.json(
          { error: 'Location not found' },
          { status: 404 }
        );
      }

      hierarchyInfo = {
        customerId: location.customerId.toString(),
        locationId: location._id.toString(),
      };

      // Get scenarios at location and customer levels
      const locationScenarios = await PricingScenarioRepository.findByAppliesTo('LOCATION', locationId);
      const customerScenarios = await PricingScenarioRepository.findByAppliesTo('CUSTOMER', location.customerId);
      scenarios = [...locationScenarios, ...customerScenarios];

    } else {
      // Direct query mode - single level only
      if (eventId) {
        scenarios = await PricingScenarioRepository.findByAppliesTo('EVENT', eventId);
      } else if (subLocationId) {
        scenarios = await PricingScenarioRepository.findByAppliesTo('SUBLOCATION', subLocationId);
      } else if (locationId) {
        scenarios = await PricingScenarioRepository.findByAppliesTo('LOCATION', locationId);
      } else if (customerId) {
        scenarios = await PricingScenarioRepository.findByAppliesTo('CUSTOMER', customerId);
      } else {
        // No filters - get all scenarios
        scenarios = await PricingScenarioRepository.findAll();
      }
    }

    // Filter by active status
    if (!includeInactive) {
      scenarios = scenarios.filter(s => s.isActive);
    }

    // Enrich scenarios with entity metadata
    const enrichedScenarios = await Promise.all(
      scenarios.map(async (scenario) => {
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
          console.error(`Failed to enrich scenario ${scenario._id}:`, error);
        }

        return {
          ...scenario,
          ...entityInfo,
        };
      })
    );

    return NextResponse.json(enrichedScenarios);
  } catch (error) {
    console.error('Failed to fetch pricing scenarios:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing scenarios' },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a new pricing scenario
 *
 * Body:
 * {
 *   name: string,
 *   description?: string,
 *   appliesTo: { level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT', entityId: ObjectId },
 *   config: PricingScenarioConfig,
 *   isActive: boolean
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, appliesTo, config, isActive, tags } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Scenario name is required' },
        { status: 400 }
      );
    }

    if (!appliesTo || !appliesTo.level || !appliesTo.entityId) {
      return NextResponse.json(
        { error: 'appliesTo.level and appliesTo.entityId are required' },
        { status: 400 }
      );
    }

    if (!config) {
      return NextResponse.json(
        { error: 'Scenario config is required' },
        { status: 400 }
      );
    }

    // Validate appliesTo.level
    const validLevels = ['CUSTOMER', 'LOCATION', 'SUBLOCATION', 'EVENT'];
    if (!validLevels.includes(appliesTo.level)) {
      return NextResponse.json(
        { error: `appliesTo.level must be one of: ${validLevels.join(', ')}` },
        { status: 400 }
      );
    }

    // Convert entityId to ObjectId
    let entityIdObj: ObjectId;
    try {
      entityIdObj = new ObjectId(appliesTo.entityId);
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

    const entity = await db.collection(collectionName).findOne({ _id: entityIdObj });
    if (!entity) {
      return NextResponse.json(
        { error: `${appliesTo.level} with ID ${appliesTo.entityId} not found` },
        { status: 404 }
      );
    }

    // Create scenario
    const scenario = await PricingScenarioRepository.create({
      name,
      description,
      appliesTo: {
        level: appliesTo.level,
        entityId: entityIdObj,
      },
      config,
      isActive: isActive !== undefined ? isActive : true,
      tags: tags || [],
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (error) {
    console.error('Failed to create pricing scenario:', error);
    return NextResponse.json(
      { error: 'Failed to create pricing scenario' },
      { status: 500 }
    );
  }
}
