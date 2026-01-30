import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { SurgeConfigRepository } from '@/models/SurgeConfig';
import { getDb } from '@/lib/mongodb';

/**
 * GET: Fetch all surge configs with optional filters
 *
 * Query Parameters:
 * - subLocationId: Filter by sublocation
 * - locationId: Filter by location
 * - includeInactive: Include inactive configs (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subLocationId = searchParams.get('subLocationId');
    const locationId = searchParams.get('locationId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    let configs: any[] = [];

    if (subLocationId) {
      // Get configs for sublocation (hierarchical)
      const db = await getDb();
      const sublocation = await db.collection('sublocations').findOne({
        _id: new ObjectId(subLocationId),
      });

      if (!sublocation) {
        return NextResponse.json(
          { error: 'SubLocation not found' },
          { status: 404 }
        );
      }

      // Get configs at both sublocation and location levels
      const sublocationConfigs = await SurgeConfigRepository.findByAppliesTo('SUBLOCATION', subLocationId);
      const locationConfigs = await SurgeConfigRepository.findByAppliesTo('LOCATION', sublocation.locationId);
      configs = [...sublocationConfigs, ...locationConfigs];

    } else if (locationId) {
      // Get configs for location
      configs = await SurgeConfigRepository.findByLocation(locationId);

    } else {
      // Get all configs
      configs = await SurgeConfigRepository.findAll();
    }

    // Filter by active status
    if (!includeInactive) {
      configs = configs.filter(c => c.isActive);
    }

    // Enrich with entity metadata
    const db = await getDb();
    const enrichedConfigs = await Promise.all(
      configs.map(async (config) => {
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
          console.error(`Failed to enrich surge config ${config._id}:`, error);
        }

        return {
          ...config,
          ...entityInfo,
        };
      })
    );

    return NextResponse.json(enrichedConfigs);
  } catch (error) {
    console.error('Failed to fetch surge configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch surge configs' },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a new surge pricing configuration
 *
 * Body:
 * {
 *   name: string,
 *   description?: string,
 *   appliesTo: { level: 'SUBLOCATION' | 'LOCATION', entityId: ObjectId },
 *   demandSupplyParams: { currentDemand, currentSupply, historicalAvgPressure },
 *   surgeParams: { alpha, minMultiplier, maxMultiplier, emaAlpha },
 *   effectiveFrom: Date,
 *   effectiveTo?: Date,
 *   timeWindows?: [...],
 *   isActive: boolean
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      appliesTo,
      demandSupplyParams,
      surgeParams,
      effectiveFrom,
      effectiveTo,
      timeWindows,
      isActive
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Surge config name is required' },
        { status: 400 }
      );
    }

    if (!appliesTo || !appliesTo.level || !appliesTo.entityId) {
      return NextResponse.json(
        { error: 'appliesTo.level and appliesTo.entityId are required' },
        { status: 400 }
      );
    }

    if (!demandSupplyParams || !surgeParams) {
      return NextResponse.json(
        { error: 'demandSupplyParams and surgeParams are required' },
        { status: 400 }
      );
    }

    // Validate appliesTo.level
    const validLevels = ['SUBLOCATION', 'LOCATION'];
    if (!validLevels.includes(appliesTo.level)) {
      return NextResponse.json(
        { error: `appliesTo.level must be one of: ${validLevels.join(', ')}` },
        { status: 400 }
      );
    }

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

    // Validate surge params
    if (surgeParams.alpha < 0.1 || surgeParams.alpha > 1.0) {
      return NextResponse.json(
        { error: 'alpha must be between 0.1 and 1.0' },
        { status: 400 }
      );
    }

    if (surgeParams.minMultiplier < 0.5 || surgeParams.minMultiplier > 1.0) {
      return NextResponse.json(
        { error: 'minMultiplier must be between 0.5 and 1.0' },
        { status: 400 }
      );
    }

    if (surgeParams.maxMultiplier < 1.0 || surgeParams.maxMultiplier > 3.0) {
      return NextResponse.json(
        { error: 'maxMultiplier must be between 1.0 and 3.0' },
        { status: 400 }
      );
    }

    if (surgeParams.minMultiplier >= surgeParams.maxMultiplier) {
      return NextResponse.json(
        { error: 'minMultiplier must be less than maxMultiplier' },
        { status: 400 }
      );
    }

    if (surgeParams.emaAlpha < 0.1 || surgeParams.emaAlpha > 0.5) {
      return NextResponse.json(
        { error: 'emaAlpha must be between 0.1 and 0.5' },
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
    const collectionName = appliesTo.level === 'LOCATION' ? 'locations' : 'sublocations';
    const entity = await db.collection(collectionName).findOne({ _id: entityIdObj });

    if (!entity) {
      return NextResponse.json(
        { error: `${appliesTo.level} with ID ${appliesTo.entityId} not found` },
        { status: 404 }
      );
    }

    // Create surge config
    const config = await SurgeConfigRepository.create({
      name,
      description,
      appliesTo: {
        level: appliesTo.level,
        entityId: entityIdObj,
      },
      demandSupplyParams,
      surgeParams,
      effectiveFrom: new Date(effectiveFrom),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
      timeWindows: timeWindows || [],
      isActive: isActive !== undefined ? isActive : true,
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error('Failed to create surge config:', error);
    return NextResponse.json(
      { error: 'Failed to create surge config' },
      { status: 500 }
    );
  }
}
