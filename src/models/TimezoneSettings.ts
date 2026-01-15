// src/models/TimezoneSettings.ts
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export interface TimezoneSettings {
  _id?: ObjectId;
  entityType: 'SYSTEM' | 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
  entityId?: ObjectId;
  timezone: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export class TimezoneSettingsRepository {
  private static COLLECTION = 'timezone_settings';

  /**
   * Get timezone for an entity (with fallback hierarchy)
   * Order: SubLocation → Location → Customer → System → Default
   */
  static async getTimezoneForEntity(
    entityType: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION',
    entityId: string
  ): Promise<string> {
    const db = await getDb();
    
    // Try to find specific entity timezone
    const entitySetting = await db.collection(this.COLLECTION).findOne({
      entityType,
      entityId: new ObjectId(entityId)
    });
    
    if (entitySetting) {
      return entitySetting.timezone;
    }
    
    // Fallback hierarchy
    if (entityType === 'SUBLOCATION') {
      // Get sublocation to find parent location
      const sublocation = await db.collection('sublocations').findOne({
        _id: new ObjectId(entityId)
      });
      
      if (sublocation?.locationId) {
        return this.getTimezoneForEntity('LOCATION', sublocation.locationId.toString());
      }
    }
    
    if (entityType === 'LOCATION') {
      // Get location to find parent customer
      const location = await db.collection('locations').findOne({
        _id: new ObjectId(entityId)
      });
      
      if (location?.customerId) {
        return this.getTimezoneForEntity('CUSTOMER', location.customerId.toString());
      }
    }
    
    // Fallback to system timezone
    const systemSetting = await db.collection(this.COLLECTION).findOne({
      entityType: 'SYSTEM'
    });
    
    if (systemSetting) {
      return systemSetting.timezone;
    }
    
    // Ultimate fallback
    return 'America/Detroit';
  }

  /**
   * Set timezone for an entity
   */
  static async setTimezone(
    entityType: 'SYSTEM' | 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION',
    timezone: string,
    displayName: string,
    entityId?: string
  ): Promise<TimezoneSettings> {
    const db = await getDb();
    const now = new Date();
    
    const filter = entityId 
      ? { entityType, entityId: new ObjectId(entityId) }
      : { entityType };
    
    const update = {
      $set: {
        timezone,
        displayName,
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now
      }
    };
    
    const result = await db.collection(this.COLLECTION).findOneAndUpdate(
      filter,
      update,
      { upsert: true, returnDocument: 'after' }
    );
    
    return result as TimezoneSettings;
  }

  /**
   * Get all timezone settings
   */
  static async findAll(): Promise<TimezoneSettings[]> {
    const db = await getDb();
    return db.collection(this.COLLECTION).find({}).toArray() as Promise<TimezoneSettings[]>;
  }

  /**
   * Delete timezone setting
   */
  static async delete(entityType: string, entityId?: string): Promise<boolean> {
    const db = await getDb();
    
    const filter = entityId
      ? { entityType, entityId: new ObjectId(entityId) }
      : { entityType };
    
    const result = await db.collection(this.COLLECTION).deleteOne(filter);
    return result.deletedCount > 0;
  }
}