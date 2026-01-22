import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { Event } from './types';
import {
  setCapacityForDate,
  setCapacityForDateRange,
  setRevenueGoal,
  removeCapacityForDate,
  removeRevenueGoal
} from '@/lib/capacity-utils';

export class EventRepository {
  private static COLLECTION = 'events';

  static async create(event: Omit<Event, '_id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    const db = await getDb();
    const now = new Date();

    const newEvent: Omit<Event, '_id'> = {
      ...event,
      startDate: new Date(event.startDate),
      endDate: new Date(event.endDate),
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection<Event>(this.COLLECTION).insertOne(newEvent as Event);
    return { ...newEvent, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<Event | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return db.collection<Event>(this.COLLECTION).findOne({ _id: objectId });
  }

  static async findAll(): Promise<Event[]> {
    const db = await getDb();
    return db.collection<Event>(this.COLLECTION).find({}).sort({ startDate: -1 }).toArray();
  }

  static async findByCustomer(customerId: string | ObjectId): Promise<Event[]> {
    const db = await getDb();
    const objectId = typeof customerId === 'string' ? new ObjectId(customerId) : customerId;
    return db.collection<Event>(this.COLLECTION)
      .find({ customerId: objectId })
      .sort({ startDate: -1 })
      .toArray();
  }

  static async findByLocation(locationId: string | ObjectId): Promise<Event[]> {
    const db = await getDb();
    const objectId = typeof locationId === 'string' ? new ObjectId(locationId) : locationId;
    return db.collection<Event>(this.COLLECTION)
      .find({ locationId: objectId })
      .sort({ startDate: -1 })
      .toArray();
  }

  static async findBySubLocation(subLocationId: string | ObjectId): Promise<Event[]> {
    const db = await getDb();
    const objectId = typeof subLocationId === 'string' ? new ObjectId(subLocationId) : subLocationId;
    return db.collection<Event>(this.COLLECTION)
      .find({ subLocationId: objectId })
      .sort({ startDate: -1 })
      .toArray();
  }

  static async findActiveEvents(): Promise<Event[]> {
    const db = await getDb();
    const now = new Date();
    return db.collection<Event>(this.COLLECTION)
      .find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
      })
      .sort({ startDate: -1 })
      .toArray();
  }

  static async findUpcomingEvents(): Promise<Event[]> {
    const db = await getDb();
    const now = new Date();
    return db.collection<Event>(this.COLLECTION)
      .find({
        isActive: true,
        startDate: { $gt: now }
      })
      .sort({ startDate: 1 })
      .toArray();
  }

  static async update(id: string | ObjectId, updates: Partial<Event>): Promise<Event | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    // Convert date strings to Date objects if present
    const processedUpdates = { ...updates };
    if (processedUpdates.startDate) {
      processedUpdates.startDate = new Date(processedUpdates.startDate);
    }
    if (processedUpdates.endDate) {
      processedUpdates.endDate = new Date(processedUpdates.endDate);
    }

    const result = await db.collection<Event>(this.COLLECTION).findOneAndUpdate(
      { _id: objectId },
      {
        $set: {
          ...processedUpdates,
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
    const result = await db.collection<Event>(this.COLLECTION).deleteOne({ _id: objectId });
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
  ): Promise<Event | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await db.collection<Event>(this.COLLECTION).findOneAndUpdate(
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
  ): Promise<Event | null> {
    const event = await this.findById(id);
    if (!event) return null;

    const config = event.capacityConfig || {
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
  ): Promise<Event | null> {
    const event = await this.findById(id);
    if (!event) return null;

    const config = event.capacityConfig || {
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
  ): Promise<Event | null> {
    const event = await this.findById(id);
    if (!event || !event.capacityConfig) return event;

    const config = event.capacityConfig;
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
  ): Promise<Event | null> {
    const event = await this.findById(id);
    if (!event) return null;

    const config = event.capacityConfig || {
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
  ): Promise<Event | null> {
    const event = await this.findById(id);
    if (!event || !event.capacityConfig) return event;

    const config = event.capacityConfig;
    removeRevenueGoal(config, startDate, endDate);

    return this.update(id, { capacityConfig: config });
  }
}
