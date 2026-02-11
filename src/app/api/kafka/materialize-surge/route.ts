import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * POST /api/kafka/materialize-surge
 * Manually materialize surge ratesheets from active surge configs
 * Updates surge configs with latest demand data and creates DRAFT ratesheets
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subLocationId, locationId, configId } = body;

    const db = await getDb();

    // Find surge configs to materialize
    let query: any = { isActive: true };

    if (configId) {
      // Specific config ID
      query._id = new ObjectId(configId);
    } else if (subLocationId) {
      // All configs for a sublocation or its location
      query.$or = [
        { 'appliesTo.level': 'SUBLOCATION', 'appliesTo.entityId': new ObjectId(subLocationId) }
      ];
      if (locationId) {
        query.$or.push({ 'appliesTo.level': 'LOCATION', 'appliesTo.entityId': new ObjectId(locationId) });
      }
    } else {
      return NextResponse.json(
        { error: 'Must provide configId, subLocationId, or locationId' },
        { status: 400 }
      );
    }

    const configs = await db.collection('surge_configs').find(query).toArray();

    if (configs.length === 0) {
      return NextResponse.json(
        { error: 'No active surge configs found' },
        { status: 404 }
      );
    }

    console.log(`🔥 Materializing ${configs.length} surge configs`);

    const results = [];

    for (const config of configs) {
      // Get latest demand data for this config
      const demandData = await getLatestDemandData(db, config);

      if (demandData) {
        // Update surge config with latest demand data
        const updatedParams = {
          currentDemand: demandData.bookingsCount,
          currentSupply: config.demandSupplyParams?.currentSupply || (demandData.availableCapacity / 10),
          historicalAvgPressure: demandData.historicalAvgPressure
        };

        await db.collection('surge_configs').updateOne(
          { _id: config._id },
          {
            $set: {
              demandSupplyParams: updatedParams,
              updatedAt: new Date()
            }
          }
        );

        console.log(`✅ Updated surge config: ${config.name}`, updatedParams);
      }

      // For predictive surge: Only supersede ratesheets with FUTURE overlapping time windows
      // Keep historical ratesheets (past time windows) as APPROVED for analysis
      const now = new Date();

      // Find existing ratesheets for this surge config
      const existingRatesheets = await db.collection('ratesheets').find({
        surgeConfigId: config._id,
        approvalStatus: { $in: ['DRAFT', 'APPROVED'] }
      }).toArray();

      const overlappingIds = [];
      for (const existing of existingRatesheets) {
        // Check if this ratesheet's effectiveTo is in the FUTURE
        const existingEffectiveTo = existing.effectiveTo ? new Date(existing.effectiveTo) : null;

        if (existingEffectiveTo && existingEffectiveTo > now) {
          // Only supersede future ratesheets
          overlappingIds.push(existing._id);
          console.log(`🔄 Will supersede future ratesheet: ${existing.name} (ends: ${existingEffectiveTo.toISOString()})`);
        } else {
          console.log(`✅ Keeping historical ratesheet: ${existing.name} (ended: ${existingEffectiveTo?.toISOString() || 'N/A'})`);
        }
      }

      // Supersede only overlapping FUTURE ratesheets
      let deactivateResult = { modifiedCount: 0 };
      if (overlappingIds.length > 0) {
        deactivateResult = await db.collection('ratesheets').updateMany(
          { _id: { $in: overlappingIds } },
          {
            $set: {
              approvalStatus: 'SUPERSEDED',
              isActive: false,
              supersededAt: new Date(),
              supersededReason: 'Replaced by newer surge prediction'
            }
          }
        );
      }

      if (deactivateResult.modifiedCount > 0) {
        console.log(`🗑️  Superseded ${deactivateResult.modifiedCount} future ratesheets`);
      }

      // Materialize new ratesheet with demand data
      const ratesheet = await materializeSurgeConfig(db, config._id, demandData);

      results.push({
        configId: config._id.toString(),
        configName: config.name,
        ratesheetId: ratesheet._id.toString(),
        multiplier: ratesheet.surgeMultiplierSnapshot,
        status: ratesheet.approvalStatus,
        demand: config.demandSupplyParams?.currentDemand,
        supply: config.demandSupplyParams?.currentSupply
      });
    }

    return NextResponse.json({
      success: true,
      message: `Materialized ${results.length} surge ratesheets`,
      ratesheets: results
    });

  } catch (error) {
    console.error('Error materializing surge configs:', error);
    return NextResponse.json(
      { error: 'Failed to materialize surge configs', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get latest demand data for a surge config
 */
async function getLatestDemandData(db: any, config: any): Promise<any | null> {
  const entityId = config.appliesTo.entityId;
  const level = config.appliesTo.level;

  let query: any = {};

  if (level === 'SUBLOCATION') {
    query.subLocationId = entityId.toString();
  } else if (level === 'LOCATION') {
    query.locationId = entityId.toString();
  }

  console.log('🔍 Searching demand_history with query:', JSON.stringify(query));

  // Get most recent demand_history record
  const demandHistory = await db.collection('demand_history')
    .find(query)
    .sort({ timestamp: -1 })
    .limit(1)
    .toArray();

  console.log('📊 Found demand_history records:', demandHistory.length);
  if (demandHistory[0]) {
    console.log('✅ Latest demand data:', {
      subLocationId: demandHistory[0].subLocationId,
      hour: demandHistory[0].hour,
      bookingsCount: demandHistory[0].bookingsCount
    });
  } else {
    console.log('❌ No demand_history found for query:', query);
  }

  return demandHistory[0] || null;
}

/**
 * Calculate surge multiplier from surge config parameters
 */
function calculateSurgeMultiplier(config: any): number {
  const { demandSupplyParams, surgeParams } = config;

  if (!demandSupplyParams || !surgeParams) {
    return 1.0;
  }

  // Calculate current demand/supply pressure ratio
  const currentPressure = demandSupplyParams.currentDemand / demandSupplyParams.currentSupply;

  // Calculate historical pressure using the same formula (demand/supply)
  // historicalAvgPressure from demand_history uses bookingsCount/(capacity/100)
  // We need to normalize it to match our supply calculation (capacity/10)
  // So: historicalPressure_normalized = historicalAvgPressure / 10
  const historicalPressure = demandSupplyParams.historicalAvgPressure / 10;

  // Normalize current pressure against historical
  const normalizedPressure = currentPressure / historicalPressure;

  // Apply logarithmic surge factor
  // Formula: 1 + alpha * log(normalizedPressure)
  const rawFactor = 1 + surgeParams.alpha * Math.log(normalizedPressure);

  // Clamp to min/max bounds
  const surgeFactor = Math.max(
    surgeParams.minMultiplier,
    Math.min(surgeParams.maxMultiplier, rawFactor)
  );

  console.log('🔥 Surge Multiplier Calculation:', {
    demand: demandSupplyParams.currentDemand,
    supply: demandSupplyParams.currentSupply,
    currentPressure: currentPressure.toFixed(2),
    historicalAvgRaw: demandSupplyParams.historicalAvgPressure,
    historicalPressure: historicalPressure.toFixed(2),
    normalized: normalizedPressure.toFixed(2),
    rawFactor: rawFactor.toFixed(3),
    finalMultiplier: surgeFactor.toFixed(3)
  });

  return surgeFactor;
}

/**
 * Generate time windows for surge ratesheet
 * For dynamic demand-driven surge, create a 1-hour window for the NEXT hour (predictive)
 */
function generateTimeWindows(config: any, multiplier: number, demandData?: any): any[] {
  // If demand data is provided (dynamic surge), create 1-hour window for NEXT hour
  // This allows predictive surge pricing based on current demand
  if (demandData && demandData.hour) {
    const hourDate = new Date(demandData.hour);
    const nextHour = (hourDate.getUTCHours() + 1) % 24; // NEXT hour
    const endHour = (nextHour + 1) % 24;

    const startTime = `${String(nextHour).padStart(2, '0')}:00`;
    const endTime = `${String(endHour).padStart(2, '0')}:00`;

    console.log(`📅 Predictive surge: Demand at ${hourDate.getUTCHours()}:00 → Surge for ${nextHour}:00-${endHour}:00`);

    return [{
      windowType: 'ABSOLUTE_TIME',
      startTime,
      endTime,
      pricePerHour: multiplier
    }];
  }

  // Otherwise, use config's time windows (static surge)
  if (!config.timeWindows || config.timeWindows.length === 0) {
    return [{
      windowType: 'ABSOLUTE_TIME',
      startTime: '00:00',
      endTime: '23:59',
      pricePerHour: multiplier
    }];
  }

  return config.timeWindows.map((tw: any) => ({
    windowType: 'ABSOLUTE_TIME',
    startTime: tw.startTime || '00:00',
    endTime: tw.endTime || '23:59',
    pricePerHour: multiplier
  }));
}

/**
 * Materialize a surge config into a physical surge ratesheet
 */
async function materializeSurgeConfig(db: any, configId: ObjectId, demandData?: any): Promise<any> {
  const config = await db.collection('surge_configs').findOne({ _id: configId });
  if (!config) {
    throw new Error(`Surge config not found: ${configId}`);
  }

  console.log('🚀 Materializing surge config:', config.name);

  // Calculate current surge multiplier
  const multiplier = calculateSurgeMultiplier(config);

  // Generate time windows (use demand hour if available)
  const timeWindows = generateTimeWindows(config, multiplier, demandData);

  // Calculate demand/supply pressure for snapshot
  const pressure = config.demandSupplyParams.currentDemand / config.demandSupplyParams.currentSupply;

  // Create surge ratesheet
  const now = new Date();

  // Determine effective dates based on demand data or config
  let effectiveFrom: Date;
  let effectiveTo: Date;

  if (demandData && demandData.hour) {
    // For predictive surge, create ratesheet for NEXT hour
    // Set effective period to cover the next hour only
    const demandDate = new Date(demandData.hour);
    const nextHour = (demandDate.getUTCHours() + 1) % 24;

    // Start from next hour
    effectiveFrom = new Date(demandDate);
    effectiveFrom.setUTCHours(nextHour, 0, 0, 0);

    // End after next hour
    effectiveTo = new Date(effectiveFrom);
    effectiveTo.setUTCHours(effectiveTo.getUTCHours() + 1, 0, 0, 0);

    console.log('📅 Predictive surge ratesheet effective period:', {
      demandHour: demandData.hour,
      predictionHour: `${nextHour}:00`,
      effectiveFrom: effectiveFrom.toISOString(),
      effectiveTo: effectiveTo.toISOString()
    });
  } else {
    // Use config dates for static surge
    effectiveFrom = config.effectiveFrom;
    effectiveTo = config.effectiveTo;
  }

  const surgeRatesheet = {
    name: `SURGE: ${config.name}`,
    description: demandData ? `Dynamic surge for ${demandData.hour}` : `Manual materialization from config ${config._id}`,
    type: 'SURGE_MULTIPLIER',
    appliesTo: config.appliesTo,

    // Priority: Base 10000 + config priority
    priority: 10000 + config.priority,
    conflictResolution: 'PRIORITY',

    // Temporal constraints (demand hour or config dates)
    effectiveFrom,
    effectiveTo,

    // Time windows with surge multiplier
    timeWindows,

    // Surge-specific metadata
    surgeConfigId: configId,
    surgeMultiplierSnapshot: multiplier,
    demandSupplySnapshot: {
      demand: config.demandSupplyParams.currentDemand,
      supply: config.demandSupplyParams.currentSupply,
      pressure,
      timestamp: now
    },

    // Start as DRAFT
    approvalStatus: 'DRAFT',
    isActive: false,

    // Metadata
    createdBy: 'manual-materialization',
    createdAt: now,
    updatedAt: now
  };

  // Insert into ratesheets collection
  const result = await db.collection('ratesheets').insertOne(surgeRatesheet);
  const createdRatesheet = { ...surgeRatesheet, _id: result.insertedId };

  console.log('✅ Created surge ratesheet:', {
    id: result.insertedId.toString(),
    name: createdRatesheet.name,
    multiplier: multiplier.toFixed(3),
    status: 'DRAFT'
  });

  // Update surge config with reference to materialized ratesheet
  await db.collection('surge_configs').updateOne(
    { _id: configId },
    {
      $set: {
        materializedRatesheetId: result.insertedId,
        lastMaterialized: now,
        updatedAt: now
      }
    }
  );

  return createdRatesheet;
}
