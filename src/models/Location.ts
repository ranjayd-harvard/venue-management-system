import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { Location } from './types';
import {
  setCapacityForDate,
  setCapacityForDateRange,
  setRevenueGoal,
  removeCapacityForDate,
  removeRevenueGoal
} from '@/lib/capacity-utils';

export class LocationRepository {
  private static COLLECTION = 'locations';

  static async create(location: Omit<Location, '_id' | 'createdAt' | 'updatedAt'>): Promise<Location> {
    const db = await getDb();
    const now = new Date();
    
    const newLocation: Omit<Location, '_id'> = {
      ...location,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection<Location>(this.COLLECTION).insertOne(newLocation as Location);
    return { ...newLocation, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<Location | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return db.collection<Location>(this.COLLECTION).findOne({ _id: objectId });
  }

  static async findByCustomerId(customerId: string | ObjectId): Promise<Location[]> {
    const db = await getDb();
    const objectId = typeof customerId === 'string' ? new ObjectId(customerId) : customerId;
    return db.collection<Location>(this.COLLECTION).find({ customerId: objectId }).toArray();
  }

  static async findAll(): Promise<Location[]> {
    const db = await getDb();
    return db.collection<Location>(this.COLLECTION).find({}).toArray();
  }

  static async update(id: string | ObjectId, updates: Partial<Location>): Promise<Location | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    
    const result = await db.collection<Location>(this.COLLECTION).findOneAndUpdate(
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

  static async delete(id: string | ObjectId): Promise<boolean> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await db.collection<Location>(this.COLLECTION).deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }

  // ===== CAPACITY & REVENUE GOAL METHODS =====

  /**
   * Updates capacity configuration bounds
   */
  static async updateCapacityBounds(
    id: string | ObjectId,
    minCapacity: number,
    maxCapacity: number
  ): Promise<Location | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await db.collection<Location>(this.COLLECTION).findOneAndUpdate(
      { _id: objectId },
      {
        $set: {
          'capacityConfig.minCapacity': minCapacity,
          'capacityConfig.maxCapacity': maxCapacity,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  /**
   * Sets capacity for a specific date
   */
  static async setDailyCapacity(
    id: string | ObjectId,
    date: string,
    capacity: number
  ): Promise<Location | null> {
    const location = await this.findById(id);
    if (!location) return null;

    const config = location.capacityConfig || {
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
    id: string | ObjectId,
    startDate: string,
    endDate: string,
    capacity: number
  ): Promise<Location | null> {
    const location = await this.findById(id);
    if (!location) return null;

    const config = location.capacityConfig || {
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
    id: string | ObjectId,
    date: string
  ): Promise<Location | null> {
    const location = await this.findById(id);
    if (!location || !location.capacityConfig) return location;

    const config = location.capacityConfig;
    removeCapacityForDate(config, date);

    return this.update(id, { capacityConfig: config });
  }

  /**
   * Sets revenue goal for a date range
   */
  static async setRevenueGoal(
    id: string | ObjectId,
    startDate: string,
    endDate: string,
    dailyGoal: number
  ): Promise<Location | null> {
    const location = await this.findById(id);
    if (!location) return null;

    const config = location.capacityConfig || {
      minCapacity: 0,
      maxCapacity: 100,
      dailyCapacities: [],
      revenueGoals: [],
    };

    setRevenueGoal(config, startDate, endDate, dailyGoal);

    return this.update(id, { capacityConfig: config });
  }

  /**
   * Removes revenue goal for a specific date range
   */
  static async removeRevenueGoal(
    id: string | ObjectId,
    startDate: string,
    endDate: string
  ): Promise<Location | null> {
    const location = await this.findById(id);
    if (!location || !location.capacityConfig) return location;

    const config = location.capacityConfig;
    removeRevenueGoal(config, startDate, endDate);

    return this.update(id, { capacityConfig: config });
  }
}
