import { Db, ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { SubLocation } from './types';
import {
  setCapacityForDate,
  setCapacityForDateRange,
  setRevenueGoal,
  removeCapacityForDate,
  removeRevenueGoal,
  setHourlyCapacityOverride,
  removeHourlyCapacityOverride,
  removeAllHourlyCapacityOverridesForDate
} from '@/lib/capacity-utils';

export class SubLocationRepository {
  static async getCollection() {
    const db = await getDb();
    return db.collection<SubLocation>('sublocations');
  }

  static async findAll(): Promise<SubLocation[]> {
    const collection = await this.getCollection();
    return collection.find({}).toArray();
  }

  static async findById(id: ObjectId): Promise<SubLocation | null> {
    const collection = await this.getCollection();
    return collection.findOne({ _id: id });
  }

  static async findByLocationId(locationId: ObjectId): Promise<SubLocation[]> {
    const collection = await this.getCollection();
    return collection.find({ locationId }).toArray();
  }

  static async create(subLocation: Omit<SubLocation, '_id' | 'createdAt' | 'updatedAt'>): Promise<ObjectId> {
    const collection = await this.getCollection();
    const now = new Date();
    const result = await collection.insertOne({
      ...subLocation,
      createdAt: now,
      updatedAt: now,
    } as SubLocation);
    return result.insertedId;
  }

  static async update(id: ObjectId, updates: Partial<SubLocation>): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { _id: id },
      { 
        $set: { 
          ...updates, 
          updatedAt: new Date() 
        } 
      }
    );
    return result.modifiedCount > 0;
  }

  static async delete(id: ObjectId): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  // Find active, pricing-enabled sublocations
  static async findActiveWithPricing(): Promise<SubLocation[]> {
    const collection = await this.getCollection();
    return collection.find({
      isActive: true,
      pricingEnabled: true
    }).toArray();
  }

  // ===== CAPACITY & REVENUE GOAL METHODS =====

  /**
   * Updates capacity configuration bounds
   */
  static async updateCapacityBounds(
    id: ObjectId,
    minCapacity: number,
    maxCapacity: number
  ): Promise<boolean> {
    const collection = await this.getCollection();
    const result = await collection.updateOne(
      { _id: id },
      {
        $set: {
          'capacityConfig.minCapacity': minCapacity,
          'capacityConfig.maxCapacity': maxCapacity,
          updatedAt: new Date(),
        },
      }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Sets capacity for a specific date
   */
  static async setDailyCapacity(
    id: ObjectId,
    date: string,
    capacity: number
  ): Promise<boolean> {
    const sublocation = await this.findById(id);
    if (!sublocation) return false;

    const config = sublocation.capacityConfig || {
      minCapacity: 0,
      maxCapacity: 100,
      dailyCapacities: [],
      revenueGoals: [],
    };

    setCapacityForDate(config, date, capacity);

    return this.update(id, { capacityConfig: config });
  }

  /**
   * Sets capacity for a date range
   */
  static async setCapacityRange(
    id: ObjectId,
    startDate: string,
    endDate: string,
    capacity: number
  ): Promise<boolean> {
    const sublocation = await this.findById(id);
    if (!sublocation) return false;

    const config = sublocation.capacityConfig || {
      minCapacity: 0,
      maxCapacity: 100,
      dailyCapacities: [],
      revenueGoals: [],
    };

    setCapacityForDateRange(config, startDate, endDate, capacity);

    return this.update(id, { capacityConfig: config });
  }

  /**
   * Removes capacity override for a specific date
   */
  static async removeDailyCapacity(
    id: ObjectId,
    date: string
  ): Promise<boolean> {
    const sublocation = await this.findById(id);
    if (!sublocation || !sublocation.capacityConfig) return true;

    const config = sublocation.capacityConfig;
    removeCapacityForDate(config, date);

    return this.update(id, { capacityConfig: config });
  }

  /**
   * Sets revenue goal for a date range
   */
  static async setRevenueGoal(
    id: ObjectId,
    startDate: string,
    endDate: string,
    dailyGoal: number,
    weeklyGoal?: number,
    monthlyGoal?: number,
    revenueGoalType?: 'max' | 'allocated' | 'custom'
  ): Promise<boolean> {
    const sublocation = await this.findById(id);
    if (!sublocation) return false;

    const config = sublocation.capacityConfig || {
      minCapacity: 0,
      maxCapacity: 100,
      dailyCapacities: [],
      revenueGoals: [],
    };

    setRevenueGoal(config, startDate, endDate, dailyGoal, weeklyGoal, monthlyGoal, revenueGoalType);

    return this.update(id, { capacityConfig: config });
  }

  /**
   * Removes revenue goal for a specific date range
   */
  static async removeRevenueGoal(
    id: ObjectId,
    startDate: string,
    endDate: string
  ): Promise<boolean> {
    const sublocation = await this.findById(id);
    if (!sublocation || !sublocation.capacityConfig) return true;

    const config = sublocation.capacityConfig;
    removeRevenueGoal(config, startDate, endDate);

    return this.update(id, { capacityConfig: config });
  }

  // ===== HOURLY CAPACITY METHODS =====

  /**
   * Sets hourly capacity override for a specific date and hour
   */
  static async setHourlyCapacity(
    id: ObjectId,
    date: string,
    hour: number,
    override: {
      minCapacity?: number;
      maxCapacity?: number;
      defaultCapacity?: number;
      allocatedCapacity?: number;
    }
  ): Promise<boolean> {
    const sublocation = await this.findById(id);
    if (!sublocation) return false;

    const config = sublocation.capacityConfig || {
      minCapacity: 0,
      maxCapacity: 100,
      dailyCapacities: [],
      revenueGoals: [],
    };

    setHourlyCapacityOverride(config, date, hour, override);

    return this.update(id, { capacityConfig: config });
  }

  /**
   * Removes hourly capacity override for a specific date and hour
   */
  static async removeHourlyCapacity(
    id: ObjectId,
    date: string,
    hour: number
  ): Promise<boolean> {
    const sublocation = await this.findById(id);
    if (!sublocation || !sublocation.capacityConfig) return true;

    const config = sublocation.capacityConfig;
    removeHourlyCapacityOverride(config, date, hour);

    return this.update(id, { capacityConfig: config });
  }

  /**
   * Removes all hourly capacity overrides for a specific date
   */
  static async removeAllHourlyCapacitiesForDate(
    id: ObjectId,
    date: string
  ): Promise<boolean> {
    const sublocation = await this.findById(id);
    if (!sublocation || !sublocation.capacityConfig) return true;

    const config = sublocation.capacityConfig;
    removeAllHourlyCapacityOverridesForDate(config, date);

    return this.update(id, { capacityConfig: config });
  }
}
