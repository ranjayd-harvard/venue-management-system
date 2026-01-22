import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { Customer, CapacityConfig } from './types';
import {
  setCapacityForDate,
  setCapacityForDateRange,
  setRevenueGoal,
  removeCapacityForDate,
  removeRevenueGoal
} from '@/lib/capacity-utils';

export class CustomerRepository {
  private static COLLECTION = 'customers';

  static async create(customer: Omit<Customer, '_id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const db = await getDb();
    const now = new Date();
    
    const newCustomer: Omit<Customer, '_id'> = {
      ...customer,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection<Customer>(this.COLLECTION).insertOne(newCustomer as Customer);
    return { ...newCustomer, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<Customer | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return db.collection<Customer>(this.COLLECTION).findOne({ _id: objectId });
  }

  static async findAll(): Promise<Customer[]> {
    const db = await getDb();
    return db.collection<Customer>(this.COLLECTION).find({}).toArray();
  }

  static async update(id: string | ObjectId, updates: Partial<Customer>): Promise<Customer | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    
    const result = await db.collection<Customer>(this.COLLECTION).findOneAndUpdate(
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
    const result = await db.collection<Customer>(this.COLLECTION).deleteOne({ _id: objectId });
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
  ): Promise<Customer | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await db.collection<Customer>(this.COLLECTION).findOneAndUpdate(
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
  ): Promise<Customer | null> {
    const customer = await this.findById(id);
    if (!customer) return null;

    const config = customer.capacityConfig || {
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
  ): Promise<Customer | null> {
    const customer = await this.findById(id);
    if (!customer) return null;

    const config = customer.capacityConfig || {
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
  ): Promise<Customer | null> {
    const customer = await this.findById(id);
    if (!customer || !customer.capacityConfig) return customer;

    const config = customer.capacityConfig;
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
  ): Promise<Customer | null> {
    const customer = await this.findById(id);
    if (!customer) return null;

    const config = customer.capacityConfig || {
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
  ): Promise<Customer | null> {
    const customer = await this.findById(id);
    if (!customer || !customer.capacityConfig) return customer;

    const config = customer.capacityConfig;
    removeRevenueGoal(config, startDate, endDate);

    return this.update(id, { capacityConfig: config });
  }
}
