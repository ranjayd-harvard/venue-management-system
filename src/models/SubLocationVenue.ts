import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { SubLocationVenue } from './types';

export class SubLocationVenueRepository {
  private static COLLECTION = 'sublocation_venues';

  static async create(subLocationId: string | ObjectId, venueId: string | ObjectId): Promise<SubLocationVenue> {
    const db = await getDb();
    const now = new Date();
    
    const subLocationObjectId = typeof subLocationId === 'string' ? new ObjectId(subLocationId) : subLocationId;
    const venueObjectId = typeof venueId === 'string' ? new ObjectId(venueId) : venueId;
    
    const newSubLocationVenue: Omit<SubLocationVenue, '_id'> = {
      subLocationId: subLocationObjectId,
      venueId: venueObjectId,
      createdAt: now,
    };

    const result = await db.collection<SubLocationVenue>(this.COLLECTION).insertOne(newSubLocationVenue as SubLocationVenue);
    return { ...newSubLocationVenue, _id: result.insertedId };
  }

  static async findBySubLocationId(subLocationId: string | ObjectId): Promise<SubLocationVenue[]> {
    const db = await getDb();
    const objectId = typeof subLocationId === 'string' ? new ObjectId(subLocationId) : subLocationId;
    return db.collection<SubLocationVenue>(this.COLLECTION).find({ subLocationId: objectId }).toArray();
  }

  static async findByVenueId(venueId: string | ObjectId): Promise<SubLocationVenue[]> {
    const db = await getDb();
    const objectId = typeof venueId === 'string' ? new ObjectId(venueId) : venueId;
    return db.collection<SubLocationVenue>(this.COLLECTION).find({ venueId: objectId }).toArray();
  }

  static async exists(subLocationId: string | ObjectId, venueId: string | ObjectId): Promise<boolean> {
    const db = await getDb();
    const subLocationObjectId = typeof subLocationId === 'string' ? new ObjectId(subLocationId) : subLocationId;
    const venueObjectId = typeof venueId === 'string' ? new ObjectId(venueId) : venueId;
    
    const result = await db.collection<SubLocationVenue>(this.COLLECTION).findOne({
      subLocationId: subLocationObjectId,
      venueId: venueObjectId,
    });
    
    return result !== null;
  }

  static async delete(subLocationId: string | ObjectId, venueId: string | ObjectId): Promise<boolean> {
    const db = await getDb();
    const subLocationObjectId = typeof subLocationId === 'string' ? new ObjectId(subLocationId) : subLocationId;
    const venueObjectId = typeof venueId === 'string' ? new ObjectId(venueId) : venueId;
    
    const result = await db.collection<SubLocationVenue>(this.COLLECTION).deleteOne({
      subLocationId: subLocationObjectId,
      venueId: venueObjectId,
    });
    
    return result.deletedCount > 0;
  }

  static async deleteBySubLocationId(subLocationId: string | ObjectId): Promise<number> {
    const db = await getDb();
    const objectId = typeof subLocationId === 'string' ? new ObjectId(subLocationId) : subLocationId;
    const result = await db.collection<SubLocationVenue>(this.COLLECTION).deleteMany({ subLocationId: objectId });
    return result.deletedCount;
  }

  static async deleteByVenueId(venueId: string | ObjectId): Promise<number> {
    const db = await getDb();
    const objectId = typeof venueId === 'string' ? new ObjectId(venueId) : venueId;
    const result = await db.collection<SubLocationVenue>(this.COLLECTION).deleteMany({ venueId: objectId });
    return result.deletedCount;
  }

  static async findAll(): Promise<SubLocationVenue[]> {
    const db = await getDb();
    return db.collection<SubLocationVenue>(this.COLLECTION).find({}).toArray();
  }
}
