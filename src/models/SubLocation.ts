import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { SubLocation } from './types';

export class SubLocationRepository {
  private static COLLECTION = 'sublocations';

  static async create(subLocation: Omit<SubLocation, '_id' | 'createdAt' | 'updatedAt'>): Promise<SubLocation> {
    const db = await getDb();
    const now = new Date();
    
    const newSubLocation: Omit<SubLocation, '_id'> = {
      ...subLocation,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection<SubLocation>(this.COLLECTION).insertOne(newSubLocation as SubLocation);
    return { ...newSubLocation, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<SubLocation | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return db.collection<SubLocation>(this.COLLECTION).findOne({ _id: objectId });
  }

  static async findByLocationId(locationId: string | ObjectId): Promise<SubLocation[]> {
    const db = await getDb();
    const objectId = typeof locationId === 'string' ? new ObjectId(locationId) : locationId;
    return db.collection<SubLocation>(this.COLLECTION).find({ locationId: objectId }).toArray();
  }

  static async findAll(): Promise<SubLocation[]> {
    const db = await getDb();
    return db.collection<SubLocation>(this.COLLECTION).find({}).toArray();
  }

  static async update(id: string | ObjectId, updates: Partial<SubLocation>): Promise<SubLocation | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    
    const result = await db.collection<SubLocation>(this.COLLECTION).findOneAndUpdate(
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
    const result = await db.collection<SubLocation>(this.COLLECTION).deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }
}
