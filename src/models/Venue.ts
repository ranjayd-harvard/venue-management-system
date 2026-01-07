import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { Venue } from './types';

export class VenueRepository {
  private static COLLECTION = 'venues';

  static async create(venue: Omit<Venue, '_id' | 'createdAt' | 'updatedAt'>): Promise<Venue> {
    const db = await getDb();
    const now = new Date();
    
    const newVenue: Omit<Venue, '_id'> = {
      ...venue,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection<Venue>(this.COLLECTION).insertOne(newVenue as Venue);
    return { ...newVenue, _id: result.insertedId };
  }

  static async findById(id: string | ObjectId): Promise<Venue | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return db.collection<Venue>(this.COLLECTION).findOne({ _id: objectId });
  }

  static async findAll(): Promise<Venue[]> {
    const db = await getDb();
    return db.collection<Venue>(this.COLLECTION).find({}).toArray();
  }

  static async findByLocationId(locationId: string | ObjectId): Promise<Venue[]> {
    const db = await getDb();
    const objectId = typeof locationId === 'string' ? new ObjectId(locationId) : locationId;
    
    // Find all venue IDs associated with this location
    const locationVenues = await db.collection('location_venues')
      .find({ locationId: objectId })
      .toArray();
    
    const venueIds = locationVenues.map(lv => lv.venueId);
    
    // Return all venues with those IDs
    return db.collection<Venue>(this.COLLECTION)
      .find({ _id: { $in: venueIds } })
      .toArray();
  }

  static async findBySubLocationId(subLocationId: string | ObjectId): Promise<Venue[]> {
    const db = await getDb();
    const objectId = typeof subLocationId === 'string' ? new ObjectId(subLocationId) : subLocationId;
    
    // Find all venue IDs associated with this sub-location
    const subLocationVenues = await db.collection('sublocation_venues')
      .find({ subLocationId: objectId })
      .toArray();
    
    const venueIds = subLocationVenues.map(slv => slv.venueId);
    
    if (venueIds.length === 0) {
      return [];
    }
    
    // Return all venues with those IDs
    return db.collection<Venue>(this.COLLECTION)
      .find({ _id: { $in: venueIds } })
      .toArray();
  }

  static async update(id: string | ObjectId, updates: Partial<Venue>): Promise<Venue | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    
    const result = await db.collection<Venue>(this.COLLECTION).findOneAndUpdate(
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
    const result = await db.collection<Venue>(this.COLLECTION).deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }
}
