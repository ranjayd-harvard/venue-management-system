import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { SurgeConfig } from './types';

export class SurgeConfigRepository {
  private static COLLECTION = 'surge_configs';

  /**
   * Get default priority for a given level
   * SUBLOCATION: 500-999 (default 700)
   * LOCATION: 300-499 (default 400)
   */
  static getDefaultPriority(level: 'SUBLOCATION' | 'LOCATION'): number {
    return level === 'SUBLOCATION' ? 700 : 400;
  }

  /**
   * Create a new surge pricing configuration
   */
  static async create(config: Omit<SurgeConfig, '_id' | 'createdAt' | 'updatedAt'>): Promise<SurgeConfig> {
    const db = await getDb();
    const now = new Date();

    const newConfig: Omit<SurgeConfig, '_id'> = {
      ...config,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection<SurgeConfig>(this.COLLECTION).insertOne(newConfig as SurgeConfig);
    return { ...newConfig, _id: result.insertedId };
  }

  /**
   * Find surge config by ID
   */
  static async findById(id: string | ObjectId): Promise<SurgeConfig | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return db.collection<SurgeConfig>(this.COLLECTION).findOne({ _id: objectId });
  }

  /**
   * Find all surge configs
   */
  static async findAll(): Promise<SurgeConfig[]> {
    const db = await getDb();
    return db.collection<SurgeConfig>(this.COLLECTION).find({}).toArray();
  }

  /**
   * Find surge configs by hierarchy level and entity ID
   */
  static async findByAppliesTo(
    level: 'SUBLOCATION' | 'LOCATION',
    entityId: string | ObjectId
  ): Promise<SurgeConfig[]> {
    const db = await getDb();
    const objectId = typeof entityId === 'string' ? new ObjectId(entityId) : entityId;

    return db.collection<SurgeConfig>(this.COLLECTION).find({
      'appliesTo.level': level,
      'appliesTo.entityId': objectId,
    }).toArray();
  }

  /**
   * Find active surge configs for a sublocation at a given time
   * Checks effectiveFrom/To dates and timeWindows to determine applicability
   */
  static async findActiveBySubLocation(
    subLocationId: string | ObjectId,
    rangeStart: Date = new Date(),
    rangeEnd?: Date
  ): Promise<SurgeConfig | null> {
    const db = await getDb();
    const subLocObjectId = typeof subLocationId === 'string' ? new ObjectId(subLocationId) : subLocationId;

    // Get sublocation to traverse up the hierarchy
    const sublocation = await db.collection('sublocations').findOne({ _id: subLocObjectId });
    if (!sublocation) {
      console.log('❌ Sublocation not found:', subLocationId);
      return null;
    }

    const locationId = sublocation.locationId;

    console.log('🔍 Searching for surge configs:', {
      subLocationId: subLocObjectId.toString(),
      locationId: locationId?.toString(),
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd?.toISOString() || 'N/A'
    });

    // Build date range query to find configs that overlap the booking time range
    // A surge config overlaps if: effectiveFrom < rangeEnd AND effectiveTo > rangeStart
    const dateRangeQuery = rangeEnd ? [
      // Surge starts before booking ends
      { effectiveFrom: { $lt: rangeEnd } },
      // Surge ends after booking starts (or has no end date)
      {
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gt: rangeStart } },
        ]
      }
    ] : [
      // Fallback to single timestamp check if no rangeEnd provided
      { effectiveFrom: { $lte: rangeStart } },
      {
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: rangeStart } },
        ]
      }
    ];

    // Find all active surge configs at sublocation or location level
    const configs = await db.collection<SurgeConfig>(this.COLLECTION).find({
      isActive: true,
      $and: [
        // Match sublocation or location level
        {
          $or: [
            { 'appliesTo.level': 'SUBLOCATION', 'appliesTo.entityId': subLocObjectId },
            { 'appliesTo.level': 'LOCATION', 'appliesTo.entityId': locationId },
          ]
        },
        // Check date range overlap
        ...dateRangeQuery
      ]
    }).toArray();

    console.log(`🔍 Found ${configs.length} surge configs matching query`);

    if (configs.length === 0) return null;

    // If multiple configs found, sort by priority (highest first)
    // If same priority, prefer SUBLOCATION over LOCATION
    configs.sort((a, b) => {
      // First, compare by priority (higher priority wins)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // If same priority, SUBLOCATION beats LOCATION
      if (a.appliesTo.level === 'SUBLOCATION' && b.appliesTo.level === 'LOCATION') {
        return -1;
      }
      if (a.appliesTo.level === 'LOCATION' && b.appliesTo.level === 'SUBLOCATION') {
        return 1;
      }
      return 0;
    });

    const activeConfig = configs[0];
    console.log(`✅ Selected surge config: ${activeConfig.name} (Priority: ${activeConfig.priority}, Level: ${activeConfig.appliesTo.level})`);

    // Check if current timestamp matches time windows (if specified)
    if (activeConfig.timeWindows && activeConfig.timeWindows.length > 0) {
      const dayOfWeek = timestamp.getDay(); // 0=Sunday, 6=Saturday
      const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`;

      const matchesTimeWindow = activeConfig.timeWindows.some(window => {
        // Check day of week
        if (window.daysOfWeek && window.daysOfWeek.length > 0) {
          if (!window.daysOfWeek.includes(dayOfWeek)) {
            return false;
          }
        }

        // Check time range
        if (window.startTime && window.endTime) {
          if (timeStr < window.startTime || timeStr > window.endTime) {
            return false;
          }
        }

        return true;
      });

      if (!matchesTimeWindow) {
        return null; // No matching time window
      }
    }

    return activeConfig;
  }

  /**
   * Find ALL active surge configs for a sublocation within a time range
   * Returns array sorted by priority (highest first)
   * Used for per-hour surge evaluation in the pricing engine
   */
  static async findAllActiveBySubLocation(
    subLocationId: string | ObjectId,
    rangeStart: Date = new Date(),
    rangeEnd?: Date
  ): Promise<SurgeConfig[]> {
    const db = await getDb();
    const subLocObjectId = typeof subLocationId === 'string' ? new ObjectId(subLocationId) : subLocationId;

    // Get sublocation to traverse up the hierarchy
    const sublocation = await db.collection('sublocations').findOne({ _id: subLocObjectId });
    if (!sublocation) {
      console.log('❌ Sublocation not found:', subLocationId);
      return [];
    }

    const locationId = sublocation.locationId;

    console.log('🔍 Searching for ALL active surge configs:', {
      subLocationId: subLocObjectId.toString(),
      locationId: locationId?.toString(),
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd?.toISOString() || 'N/A'
    });

    // Build date range query to find configs that overlap the booking time range
    const dateRangeQuery = rangeEnd ? [
      // Surge starts before booking ends
      { effectiveFrom: { $lt: rangeEnd } },
      // Surge ends after booking starts (or has no end date)
      {
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gt: rangeStart } },
        ]
      }
    ] : [
      // Fallback to single timestamp check if no rangeEnd provided
      { effectiveFrom: { $lte: rangeStart } },
      {
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: rangeStart } },
        ]
      }
    ];

    // Find all active surge configs at sublocation or location level
    const configs = await db.collection<SurgeConfig>(this.COLLECTION).find({
      isActive: true,
      $and: [
        // Match sublocation or location level
        {
          $or: [
            { 'appliesTo.level': 'SUBLOCATION', 'appliesTo.entityId': subLocObjectId },
            { 'appliesTo.level': 'LOCATION', 'appliesTo.entityId': locationId },
          ]
        },
        // Check date range overlap
        ...dateRangeQuery
      ]
    }).toArray();

    console.log(`🔍 Found ${configs.length} active surge configs`);

    if (configs.length === 0) return [];

    // Sort by priority (highest first), then by hierarchy level
    configs.sort((a, b) => {
      // First, compare by priority (higher priority wins)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // If same priority, SUBLOCATION beats LOCATION
      if (a.appliesTo.level === 'SUBLOCATION' && b.appliesTo.level === 'LOCATION') {
        return -1;
      }
      if (a.appliesTo.level === 'LOCATION' && b.appliesTo.level === 'SUBLOCATION') {
        return 1;
      }
      return 0;
    });

    configs.forEach(config => {
      console.log(`   ✓ ${config.name} (Priority: ${config.priority}, Level: ${config.appliesTo.level})`);
    });

    return configs;
  }

  /**
   * Generate SURGE ratesheets from a surge config for a specific time period
   * Creates hourly time windows with surge-adjusted prices
   */
  static async generateSurgeRatesheets(
    surgeConfig: SurgeConfig,
    baseRatesheets: any[], // Base ratesheets to calculate surge from
    bookingStart: Date,
    bookingEnd: Date
  ): Promise<any[]> {
    const { calculateSurgeFactor, applySurgeToPrice } = await import('@/lib/surge-pricing-engine');

    // Calculate the base surge factor
    const surgeResult = calculateSurgeFactor({
      demand: surgeConfig.demandSupplyParams.currentDemand,
      supply: surgeConfig.demandSupplyParams.currentSupply,
      historicalAvgPressure: surgeConfig.demandSupplyParams.historicalAvgPressure,
      alpha: surgeConfig.surgeParams.alpha,
      minMultiplier: surgeConfig.surgeParams.minMultiplier,
      maxMultiplier: surgeConfig.surgeParams.maxMultiplier,
      emaAlpha: surgeConfig.surgeParams.emaAlpha,
      previousSmoothedPressure: undefined
    });

    console.log('🔥 Generating surge ratesheets with factor:', surgeResult.surge_factor);

    // Generate hourly time windows
    const timeWindows: any[] = [];
    let currentTime = new Date(bookingStart);

    while (currentTime < bookingEnd) {
      const nextHour = new Date(currentTime);
      nextHour.setHours(nextHour.getHours() + 1);

      const hourTimestamp = new Date(currentTime);
      let surgeFactor = surgeResult.surge_factor;

      // Check if this hour matches the surge config's time windows
      if (surgeConfig.timeWindows && surgeConfig.timeWindows.length > 0) {
        const dayOfWeek = hourTimestamp.getDay();
        const timeStr = `${hourTimestamp.getHours().toString().padStart(2, '0')}:${hourTimestamp.getMinutes().toString().padStart(2, '0')}`;

        const matchesWindow = surgeConfig.timeWindows.some(window => {
          // Check day of week
          if (window.daysOfWeek && window.daysOfWeek.length > 0) {
            if (!window.daysOfWeek.includes(dayOfWeek)) {
              return false;
            }
          }

          // Check time range
          if (window.startTime && window.endTime) {
            // Handle overnight ranges (e.g., 19:00 - 07:00)
            if (window.startTime > window.endTime) {
              // Overnight: matches if time >= startTime OR time < endTime
              if (timeStr < window.startTime && timeStr >= window.endTime) {
                return false;
              }
            } else {
              // Same-day: matches if time >= startTime AND time < endTime
              if (timeStr < window.startTime || timeStr >= window.endTime) {
                return false;
              }
            }
          }

          return true;
        });

        // If hour doesn't match any time window, skip creating a surge ratesheet for this hour
        if (!matchesWindow) {
          currentTime = nextHour;
          continue;
        }
      }

      // Create time window for this hour
      const startTimeStr = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
      const endHour = nextHour.getHours();
      const endTimeStr = `${endHour.toString().padStart(2, '0')}:00`;

      timeWindows.push({
        startTime: startTimeStr,
        endTime: endTimeStr,
        pricePerHour: surgeFactor, // Store surge multiplier in pricePerHour for now
        windowType: 'ABSOLUTE_TIME'
      });

      currentTime = nextHour;
    }

    if (timeWindows.length === 0) {
      return []; // No time windows matched, no surge ratesheets needed
    }

    // Create a single SURGE ratesheet with all hourly time windows
    const surgeRatesheet = {
      _id: new ObjectId(),
      name: `SURGE: ${surgeConfig.name}`,
      description: `Auto-generated surge pricing from config: ${surgeConfig.name}`,
      type: 'SURGE_MULTIPLIER', // Special type to indicate this is a multiplier, not absolute price
      appliesTo: surgeConfig.appliesTo,
      priority: 10000, // Very high priority (SURGE level)
      effectiveFrom: bookingStart,
      effectiveTo: bookingEnd,
      timeWindows,
      isActive: true,
      approvalStatus: 'APPROVED', // Auto-approved
      createdAt: new Date(),
      updatedAt: new Date(),
      surgeMultiplier: surgeResult.surge_factor // Store for reference
    };

    console.log(`🔥 Generated surge ratesheet with ${timeWindows.length} hourly windows`);

    return [surgeRatesheet];
  }

  /**
   * Update surge config (partial updates)
   */
  static async update(id: string | ObjectId, updates: Partial<SurgeConfig>): Promise<SurgeConfig | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await db.collection<SurgeConfig>(this.COLLECTION).findOneAndUpdate(
      { _id: objectId },
      {
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  /**
   * Delete surge config
   */
  static async delete(id: string | ObjectId): Promise<boolean> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await db.collection<SurgeConfig>(this.COLLECTION).deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }

  /**
   * Toggle surge config active status
   */
  static async toggleActive(id: string | ObjectId): Promise<SurgeConfig | null> {
    const config = await this.findById(id);
    if (!config) return null;

    return this.update(id, { isActive: !config.isActive });
  }

  /**
   * Find all active surge configs
   */
  static async findActive(): Promise<SurgeConfig[]> {
    const db = await getDb();
    return db.collection<SurgeConfig>(this.COLLECTION).find({ isActive: true }).toArray();
  }

  /**
   * Find surge configs by location (for all sublocations under that location)
   */
  static async findByLocation(locationId: string | ObjectId): Promise<SurgeConfig[]> {
    const db = await getDb();
    const locationObjectId = typeof locationId === 'string' ? new ObjectId(locationId) : locationId;

    // Get all sublocations for this location
    const sublocations = await db.collection('sublocations').find({
      locationId: locationObjectId
    }).toArray();

    const sublocationIds = sublocations.map(s => s._id);

    // Find surge configs at location level or any sublocation level
    return db.collection<SurgeConfig>(this.COLLECTION).find({
      $or: [
        { 'appliesTo.level': 'LOCATION', 'appliesTo.entityId': locationObjectId },
        { 'appliesTo.level': 'SUBLOCATION', 'appliesTo.entityId': { $in: sublocationIds } },
      ],
    }).toArray();
  }
}
