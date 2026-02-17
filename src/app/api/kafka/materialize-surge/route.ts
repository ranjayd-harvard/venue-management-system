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

    const now = new Date();
    const results = [];
    const skipped = [];

    for (const config of configs) {
      // --- Temporal validation ---
      // 1. Check if the config's effective period has expired
      if (config.effectiveTo && new Date(config.effectiveTo) < now) {
        console.log(`⏭️ Skipping ${config.name}: config effective period ended ${new Date(config.effectiveTo).toISOString()}`);
        skipped.push({ configName: config.name, reason: `Config expired on ${new Date(config.effectiveTo).toLocaleDateString()}` });
        continue;
      }

      // 2. Check if today's day-of-week falls within the config's time window daysOfWeek constraints
      if (config.timeWindows && config.timeWindows.length > 0) {
        const todayDow = now.getDay(); // 0=Sun, 6=Sat
        const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const hasActiveWindow = config.timeWindows.some((tw: any) => {
          // Check day-of-week filter
          if (tw.daysOfWeek && tw.daysOfWeek.length > 0 && !tw.daysOfWeek.includes(todayDow)) {
            return false;
          }
          // Check if current time is within the window (or close enough for the next hour)
          const windowEnd = tw.endTime || '23:59';
          return nowTimeStr < windowEnd; // Still has remaining time today
        });

        if (!hasActiveWindow) {
          console.log(`⏭️ Skipping ${config.name}: no active time window for today (day=${todayDow}, time=${nowTimeStr})`);
          skipped.push({ configName: config.name, reason: `No active time window for today (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][todayDow]}, ${nowTimeStr})` });
          continue;
        }
      }

      // Get latest demand data for this config
      const rawDemandData = await getLatestDemandData(db, config);

      // 3. Determine if demand data is usable (recent + would produce a future ratesheet)
      let usableDemandData: any = null;

      if (rawDemandData && rawDemandData.hour) {
        const demandAge = now.getTime() - new Date(rawDemandData.timestamp || rawDemandData.createdAt).getTime();
        const maxAgeMs = 2 * 60 * 60 * 1000; // 2 hours
        const durationHours = config.surgeDurationHours || 1;

        // Check if the demand hour would produce a future effective period
        const demandHour = new Date(rawDemandData.hour);
        const nextHour = (demandHour.getUTCHours() + 1) % 24;
        const effectiveFrom = new Date(demandHour);
        effectiveFrom.setUTCHours(nextHour, 0, 0, 0);
        const effectiveTo = new Date(effectiveFrom.getTime() + durationHours * 60 * 60 * 1000);

        if (demandAge > maxAgeMs) {
          console.log(`⚠️ Demand data for ${config.name} is stale (${Math.round(demandAge / 3600000)}h old), using manual mode`);
        } else if (effectiveTo < now) {
          console.log(`⚠️ Demand data for ${config.name} would produce a past ratesheet (${effectiveFrom.toISOString()} - ${effectiveTo.toISOString()}), using manual mode`);
        } else {
          // Demand data is valid — use it and update surge config
          usableDemandData = rawDemandData;

          const updatedParams = {
            currentDemand: rawDemandData.bookingsCount,
            currentSupply: config.demandSupplyParams?.currentSupply || (rawDemandData.availableCapacity / 10),
            historicalAvgPressure: rawDemandData.historicalAvgPressure
          };

          await db.collection('surge_configs').updateOne(
            { _id: config._id },
            { $set: { demandSupplyParams: updatedParams, updatedAt: new Date() } }
          );

          console.log(`✅ Updated surge config: ${config.name}`, updatedParams);
        }
      }

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

      // Materialize new ratesheet (uses usableDemandData if available, otherwise manual mode with current time)
      const ratesheet = await materializeSurgeConfig(db, config._id, usableDemandData);

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

    // If all configs were skipped, return an error with reasons
    if (results.length === 0 && skipped.length > 0) {
      return NextResponse.json(
        {
          error: 'No surge configs are active for the current period — no ratesheets were materialized',
          skipped
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Materialized ${results.length} surge ratesheet(s)` + (skipped.length > 0 ? `, skipped ${skipped.length}` : ''),
      ratesheets: results,
      ...(skipped.length > 0 && { skipped })
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
 * For demand-driven surge: create a window for the NEXT hour scoped by surgeDurationHours
 * For manual surge: use config's time windows with daysOfWeek preserved
 */
function generateTimeWindows(config: any, multiplier: number, demandData?: any): any[] {
  // PREDICTIVE SURGE: When demand data is provided, create a window for the NEXT hour
  // Duration is controlled by config.surgeDurationHours (default: 1)
  if (demandData && demandData.hour) {
    const durationHours = config.surgeDurationHours || 1;
    const hourDate = new Date(demandData.hour);
    const nextHour = (hourDate.getUTCHours() + 1) % 24;
    const endHour = (nextHour + durationHours) % 24;

    const startTime = `${String(nextHour).padStart(2, '0')}:00`;
    const endTime = `${String(endHour).padStart(2, '0')}:00`;

    console.log(`📅 Predictive surge: Demand at ${hourDate.getUTCHours()}:00 → Surge for ${startTime}-${endTime} (${durationHours}h)`);

    return [{
      windowType: 'ABSOLUTE_TIME',
      startTime,
      endTime,
      pricePerHour: multiplier
    }];
  }

  // MANUAL SURGE: use config's time windows (with daysOfWeek preserved)
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
    pricePerHour: multiplier,
    ...(tw.daysOfWeek && tw.daysOfWeek.length > 0 && { daysOfWeek: tw.daysOfWeek })
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

  // Surge ratesheets are always temporary — duration from config (default: 1 hour)
  const durationHours = config.surgeDurationHours || 1;
  let effectiveFrom: Date;
  let effectiveTo: Date;

  if (demandData && demandData.hour) {
    // PREDICTIVE: start at next hour from the demand observation
    const demandDate = new Date(demandData.hour);
    const nextHour = (demandDate.getUTCHours() + 1) % 24;

    effectiveFrom = new Date(demandDate);
    effectiveFrom.setUTCHours(nextHour, 0, 0, 0);

    console.log('📅 Predictive surge ratesheet effective period:', {
      demandHour: demandData.hour,
      predictionHour: `${nextHour}:00`,
      durationHours,
    });
  } else {
    // MANUAL: start from now (not from config.effectiveFrom which may be in the past)
    effectiveFrom = now;
  }

  effectiveTo = new Date(effectiveFrom.getTime() + durationHours * 60 * 60 * 1000);

  console.log('📅 Surge ratesheet effective period:', {
    mode: demandData ? 'demand-driven' : 'manual',
    durationHours,
    effectiveFrom: effectiveFrom.toISOString(),
    effectiveTo: effectiveTo.toISOString()
  });

  const surgeRatesheet = {
    name: `SURGE: ${config.name}`,
    description: demandData
      ? `Predictive surge for ${demandData.hour} (${durationHours}h)`
      : `Manual surge from ${now.toISOString()} (${durationHours}h)`,
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
