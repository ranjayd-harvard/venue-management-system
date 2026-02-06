import { getDb } from '../lib/mongodb';
import { ObjectId } from 'mongodb';

interface DemandMetric {
  subLocationId: string;
  locationId?: string;
  hour: string;
  bookingsCount: number;
  demandPressure: number;
  historicalAvgPressure: number;
  availableCapacity: number;
}

/**
 * Update surge configs with new demand data and auto-materialize ratesheets
 */
export async function updateSurgeConfigDemand(metric: DemandMetric): Promise<void> {
  const db = await getDb();

  // Find all active surge configs for this sublocation or its location
  const configs = await db.collection('surge_configs').find({
    isActive: true,
    $or: [
      { 'appliesTo.level': 'SUBLOCATION', 'appliesTo.entityId': new ObjectId(metric.subLocationId) },
      { 'appliesTo.level': 'LOCATION', 'appliesTo.entityId': metric.locationId ? new ObjectId(metric.locationId) : null }
    ]
  }).toArray();

  if (configs.length === 0) {
    console.log('⚠️  No active surge configs found for sublocation:', metric.subLocationId);
    return;
  }

  console.log(`🔥 Found ${configs.length} surge configs to update`);

  for (const config of configs) {
    // Update demand/supply parameters
    // Supply stays manual as per user requirements - only update demand
    const updatedParams = {
      currentDemand: metric.bookingsCount,
      currentSupply: config.demandSupplyParams?.currentSupply || (metric.availableCapacity / 10), // Keep existing or normalize
      historicalAvgPressure: metric.historicalAvgPressure
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

    console.log(`✅ Updated surge config: ${config.name}`, {
      demand: updatedParams.currentDemand,
      supply: updatedParams.currentSupply,
      historical: updatedParams.historicalAvgPressure.toFixed(2)
    });

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
      console.log(`🗑️  Superseded ${deactivateResult.modifiedCount} future ratesheets for config ${config.name}`);
    }

    // AUTO-MATERIALIZE: Create new surge ratesheet for NEXT hour (predictive)
    try {
      const ratesheet = await materializeSurgeConfig(config._id, metric);

      console.log(`🔥 Auto-materialized surge ratesheet:`, {
        configId: config._id.toString(),
        ratesheetId: ratesheet._id?.toString(),
        multiplier: ratesheet.surgeMultiplierSnapshot?.toFixed(3),
        status: ratesheet.approvalStatus,
        demandHour: metric.hour
      });

    } catch (error) {
      console.error('❌ Failed to materialize surge config:', error);
    }
  }
}

/**
 * Calculate surge multiplier from surge config parameters
 */
function calculateSurgeMultiplier(config: any): number {
  const { demandSupplyParams, surgeParams } = config;

  // Calculate demand/supply pressure ratio
  const pressure = demandSupplyParams.currentDemand / demandSupplyParams.currentSupply;

  // Normalize against historical average
  const normalizedPressure = pressure / demandSupplyParams.historicalAvgPressure;

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
    pressure: pressure.toFixed(2),
    historicalAvg: demandSupplyParams.historicalAvgPressure,
    normalized: normalizedPressure.toFixed(2),
    rawFactor: rawFactor.toFixed(3),
    finalMultiplier: surgeFactor.toFixed(3),
    bounds: `[${surgeParams.minMultiplier}, ${surgeParams.maxMultiplier}]`
  });

  return surgeFactor;
}

/**
 * Generate time windows for surge ratesheet
 * For predictive surge, create a 1-hour window for the NEXT hour
 */
function generateTimeWindows(config: any, multiplier: number, demandMetric?: DemandMetric): any[] {
  // If demand metric is provided (predictive surge), create 1-hour window for NEXT hour
  if (demandMetric && demandMetric.hour) {
    const hourDate = new Date(demandMetric.hour);
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

  // If no time windows specified, apply 24/7
  if (!config.timeWindows || config.timeWindows.length === 0) {
    return [{
      windowType: 'ABSOLUTE_TIME',
      startTime: '00:00',
      endTime: '23:59',
      pricePerHour: multiplier
    }];
  }

  // Map surge config time windows to ratesheet time windows
  return config.timeWindows.map((tw: any) => ({
    windowType: 'ABSOLUTE_TIME',
    startTime: tw.startTime || '00:00',
    endTime: tw.endTime || '23:59',
    pricePerHour: multiplier
  }));
}

/**
 * Materialize a surge config into a physical surge ratesheet for NEXT hour (predictive)
 * Creates a DRAFT ratesheet that must be approved before going live
 */
async function materializeSurgeConfig(configId: ObjectId, demandMetric?: DemandMetric): Promise<any> {
  const db = await getDb();

  const config = await db.collection('surge_configs').findOne({ _id: configId });
  if (!config) {
    throw new Error(`Surge config not found: ${configId}`);
  }

  console.log('🚀 Materializing surge config for NEXT hour:', config.name);

  // Calculate current surge multiplier
  const multiplier = calculateSurgeMultiplier(config);

  // Generate time windows for NEXT hour (predictive)
  const timeWindows = generateTimeWindows(config, multiplier, demandMetric);

  // Calculate demand/supply pressure for snapshot
  const pressure = config.demandSupplyParams.currentDemand / config.demandSupplyParams.currentSupply;

  // Create surge ratesheet
  const now = new Date();

  // Determine effective dates based on predictive surge logic
  let effectiveFrom: Date;
  let effectiveTo: Date;

  if (demandMetric && demandMetric.hour) {
    // For predictive surge, create ratesheet for NEXT hour
    const demandDate = new Date(demandMetric.hour);
    const nextHour = (demandDate.getUTCHours() + 1) % 24;

    // Start from next hour
    effectiveFrom = new Date(demandDate);
    effectiveFrom.setUTCHours(nextHour, 0, 0, 0);

    // End after next hour
    effectiveTo = new Date(effectiveFrom);
    effectiveTo.setUTCHours(effectiveTo.getUTCHours() + 1, 0, 0, 0);

    console.log('📅 Predictive surge ratesheet effective period:', {
      demandHour: demandMetric.hour,
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
    description: demandMetric ? `Predictive surge for ${new Date(demandMetric.hour).toISOString()}` : `Auto-generated surge ratesheet from config ${config._id}`,
    type: 'SURGE_MULTIPLIER',  // CRITICAL: Use SURGE_MULTIPLIER type
    appliesTo: config.appliesTo,

    // Priority: Base 10000 + config priority (ensures surge wins over everything)
    priority: 10000 + config.priority,
    conflictResolution: 'PRIORITY',

    // Temporal constraints (predictive for next hour or static from config)
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

    // Start as DRAFT (requires approval)
    approvalStatus: 'DRAFT',
    isActive: false,  // DRAFT ratesheets are not active until approved

    // Metadata
    createdBy: 'kafka-consumer',
    createdAt: now,
    updatedAt: now
  };

  // Insert into ratesheets collection
  const result = await db.collection('ratesheets').insertOne(surgeRatesheet);
  const createdRatesheet = { ...surgeRatesheet, _id: result.insertedId };

  console.log('✅ Created surge ratesheet:', {
    id: result.insertedId.toString(),
    name: createdRatesheet.name,
    priority: createdRatesheet.priority,
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
