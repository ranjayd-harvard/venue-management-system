import { Db, ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export interface SubLocation {
  _id?: ObjectId;
  locationId: ObjectId;
  label: string;
  description?: string;
  allocatedCapacity?: number;
  attributes?: Array<{ key: string; value: string }>;
  
  // Pricing-specific properties
  pricingEnabled: boolean;
  isActive: boolean;
  defaultHourlyRate?: number; // Fallback rate if no ratesheet applies
  
  createdAt?: Date;
  updatedAt?: Date;
}

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
}
