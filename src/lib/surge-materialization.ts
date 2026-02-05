import { ObjectId } from 'mongodb';
import { SurgeConfig } from '@/models/types';
import { SurgeConfigRepository } from '@/models/SurgeConfig';
import { Ratesheet, TimeWindow } from '@/models/Ratesheet';
import { getDb } from '@/lib/mongodb';

/**
 * Calculate surge multiplier from surge config parameters
 * Uses logarithmic scaling with demand/supply pressure
 */
export function calculateSurgeMultiplier(config: SurgeConfig): number {
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
 * Converts surge config time windows to ratesheet time windows with multiplier
 */
export function generateTimeWindows(
  config: SurgeConfig,
  multiplier: number
): TimeWindow[] {
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
  return config.timeWindows.map(tw => ({
    windowType: 'ABSOLUTE_TIME' as const,
    startTime: tw.startTime || '00:00',
    endTime: tw.endTime || '23:59',
    pricePerHour: multiplier
  }));
}

/**
 * Materialize a surge config into a physical surge ratesheet
 * Creates a DRAFT ratesheet that must be approved before going live
 */
export async function materializeSurgeConfig(
  configId: string | ObjectId,
  userId?: string
): Promise<Ratesheet> {
  const config = await SurgeConfigRepository.findById(configId);
  if (!config) {
    throw new Error(`Surge config not found: ${configId}`);
  }

  console.log('🚀 Materializing surge config:', config.name);

  // Calculate current surge multiplier
  const multiplier = calculateSurgeMultiplier(config);

  // Generate time windows
  const timeWindows = generateTimeWindows(config, multiplier);

  // Calculate demand/supply pressure for snapshot
  const pressure = config.demandSupplyParams.currentDemand / config.demandSupplyParams.currentSupply;

  // Create surge ratesheet
  const db = await getDb();
  const now = new Date();

  const surgeRatesheet: Omit<Ratesheet, '_id'> = {
    name: `SURGE: ${config.name}`,
    description: `Auto-generated surge ratesheet from config ${config._id}`,
    type: 'SURGE_MULTIPLIER',  // CRITICAL: Use SURGE_MULTIPLIER type so backend applies multiplier logic
    appliesTo: config.appliesTo,

    // Priority: Base 10000 + config priority (ensures surge wins over everything)
    priority: 10000 + config.priority,
    conflictResolution: 'PRIORITY',

    // Temporal constraints from config
    effectiveFrom: config.effectiveFrom,
    effectiveTo: config.effectiveTo,

    // Time windows with surge multiplier
    timeWindows,

    // Surge-specific metadata
    surgeConfigId: typeof configId === 'string' ? new ObjectId(configId) : configId,
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
    createdBy: userId || 'system',
    createdAt: now,
    updatedAt: now
  };

  // Insert into ratesheets collection
  const result = await db.collection<Ratesheet>('ratesheets').insertOne(surgeRatesheet as Ratesheet);
  const createdRatesheet = { ...surgeRatesheet, _id: result.insertedId };

  console.log('✅ Created surge ratesheet:', {
    id: result.insertedId.toString(),
    name: createdRatesheet.name,
    priority: createdRatesheet.priority,
    multiplier: multiplier.toFixed(3),
    status: 'DRAFT'
  });

  // Update surge config with reference to materialized ratesheet
  await SurgeConfigRepository.update(configId, {
    materializedRatesheetId: result.insertedId,
    lastMaterialized: now
  });

  return createdRatesheet as Ratesheet;
}

/**
 * Recalculate surge multiplier and create new DRAFT ratesheet
 * Useful when demand/supply changes and multiplier needs updating
 */
export async function recalculateSurgeConfig(
  configId: string | ObjectId
): Promise<{
  oldMultiplier: number;
  newMultiplier: number;
  ratesheet: Ratesheet;
}> {
  const config = await SurgeConfigRepository.findById(configId);
  if (!config) {
    throw new Error(`Surge config not found: ${configId}`);
  }

  console.log('🔄 Recalculating surge config:', config.name);

  // Get old multiplier from existing ratesheet
  let oldMultiplier = 1.0;
  if (config.materializedRatesheetId) {
    const db = await getDb();
    const oldRatesheet = await db.collection<Ratesheet>('ratesheets').findOne({
      _id: config.materializedRatesheetId
    });
    if (oldRatesheet?.surgeMultiplierSnapshot) {
      oldMultiplier = oldRatesheet.surgeMultiplierSnapshot;
    }
  }

  // Calculate new multiplier
  const newMultiplier = calculateSurgeMultiplier(config);

  console.log('📊 Multiplier change:', {
    old: oldMultiplier.toFixed(3),
    new: newMultiplier.toFixed(3),
    delta: ((newMultiplier - oldMultiplier) / oldMultiplier * 100).toFixed(1) + '%'
  });

  // Create new DRAFT ratesheet
  const newRatesheet = await materializeSurgeConfig(configId);

  return {
    oldMultiplier,
    newMultiplier,
    ratesheet: newRatesheet
  };
}

/**
 * Archive/deactivate the materialized surge ratesheet
 * Soft-delete: Sets isActive = false
 */
export async function archiveSurgeRatesheet(
  configId: string | ObjectId
): Promise<boolean> {
  const config = await SurgeConfigRepository.findById(configId);
  if (!config?.materializedRatesheetId) {
    console.log('⚠️ No materialized ratesheet to archive');
    return false;
  }

  const db = await getDb();
  const result = await db.collection<Ratesheet>('ratesheets').updateOne(
    { _id: config.materializedRatesheetId },
    {
      $set: {
        isActive: false,
        updatedAt: new Date()
      }
    }
  );

  console.log('🗑️ Archived surge ratesheet:', {
    configId: config._id?.toString(),
    ratesheetId: config.materializedRatesheetId.toString(),
    modified: result.modifiedCount > 0
  });

  return result.modifiedCount > 0;
}

/**
 * Get the materialized ratesheet for a surge config
 */
export async function getMaterializedRatesheet(
  configId: string | ObjectId
): Promise<{
  ratesheet: Ratesheet | null;
  status: 'none' | 'draft' | 'pending' | 'approved' | 'rejected';
}> {
  const config = await SurgeConfigRepository.findById(configId);
  if (!config?.materializedRatesheetId) {
    return { ratesheet: null, status: 'none' };
  }

  const db = await getDb();
  const ratesheet = await db.collection<Ratesheet>('ratesheets').findOne({
    _id: config.materializedRatesheetId
  });

  if (!ratesheet) {
    return { ratesheet: null, status: 'none' };
  }

  const statusMap: Record<string, 'draft' | 'pending' | 'approved' | 'rejected'> = {
    'DRAFT': 'draft',
    'PENDING_APPROVAL': 'pending',
    'APPROVED': 'approved',
    'REJECTED': 'rejected'
  };

  return {
    ratesheet,
    status: statusMap[ratesheet.approvalStatus] || 'draft'
  };
}
