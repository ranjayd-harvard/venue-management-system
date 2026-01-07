import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { LocationVenue } from './types';

export class LocationVenueRepository {
  private static COLLECTION = 'location_venues';

  static async create(locationId: string | ObjectId, venueId: string | ObjectId): Promise<LocationVenue> {
    const db = await getDb();
    const now = new Date();
    
    const locationObjectId = typeof locationId === 'string' ? new ObjectId(locationId) : locationId;
    const venueObjectId = typeof venueId === 'string' ? new ObjectId(venueId) : venueId;
    
    const newLocationVenue: Omit<LocationVenue, '_id'> = {
      locationId: locationObjectId,
      venueId: venueObjectId,
      createdAt: now,
    };

    const result = await db.collection<LocationVenue>(this.COLLECTION).insertOne(newLocationVenue as LocationVenue);
    return { ...newLocationVenue, _id: result.insertedId };
  }

  static async findByLocationId(locationId: string | ObjectId): Promise<LocationVenue[]> {
    const db = await getDb();
    const objectId = typeof locationId === 'string' ? new ObjectId(locationId) : locationId;
    return db.collection<LocationVenue>(this.COLLECTION).find({ locationId: objectId }).toArray();
  }

  static async findByVenueId(venueId: string | ObjectId): Promise<LocationVenue[]> {
    const db = await getDb();
    const objectId = typeof venueId === 'string' ? new ObjectId(venueId) : venueId;
    return db.collection<LocationVenue>(this.COLLECTION).find({ venueId: objectId }).toArray();
  }

  static async exists(locationId: string | ObjectId, venueId: string | ObjectId): Promise<boolean> {
    const db = await getDb();
    const locationObjectId = typeof locationId === 'string' ? new ObjectId(locationId) : locationId;
    const venueObjectId = typeof venueId === 'string' ? new ObjectId(venueId) : venueId;
    
    const result = await db.collection<LocationVenue>(this.COLLECTION).findOne({
      locationId: locationObjectId,
      venueId: venueObjectId,
    });
    
    return result !== null;
  }

  static async delete(locationId: string | ObjectId, venueId: string | ObjectId): Promise<boolean> {
    const db = await getDb();
    const locationObjectId = typeof locationId === 'string' ? new ObjectId(locationId) : locationId;
    const venueObjectId = typeof venueId === 'string' ? new ObjectId(venueId) : venueId;
    
    const result = await db.collection<LocationVenue>(this.COLLECTION).deleteOne({
      locationId: locationObjectId,
      venueId: venueObjectId,
    });
    
    return result.deletedCount > 0;
  }

  static async deleteByLocationId(locationId: string | ObjectId): Promise<number> {
    const db = await getDb();
    const objectId = typeof locationId === 'string' ? new ObjectId(locationId) : locationId;
    const result = await db.collection<LocationVenue>(this.COLLECTION).deleteMany({ locationId: objectId });
    return result.deletedCount;
  }

  static async deleteByVenueId(venueId: string | ObjectId): Promise<number> {
    const db = await getDb();
    const objectId = typeof venueId === 'string' ? new ObjectId(venueId) : venueId;
    const result = await db.collection<LocationVenue>(this.COLLECTION).deleteMany({ venueId: objectId });
    return result.deletedCount;
  }
}
