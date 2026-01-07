import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { Location } from './types';

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
}
