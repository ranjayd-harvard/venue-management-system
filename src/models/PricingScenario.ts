import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { PricingScenario } from './types';

export class PricingScenarioRepository {
  private static COLLECTION = 'pricing_scenarios';

  /**
   * Create a new pricing scenario
   */
  static async create(scenario: Omit<PricingScenario, '_id' | 'createdAt' | 'updatedAt'>): Promise<PricingScenario> {
    const db = await getDb();
    const now = new Date();

    const newScenario: Omit<PricingScenario, '_id'> = {
      ...scenario,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection<PricingScenario>(this.COLLECTION).insertOne(newScenario as PricingScenario);
    return { ...newScenario, _id: result.insertedId };
  }

  /**
   * Find scenario by ID
   */
  static async findById(id: string | ObjectId): Promise<PricingScenario | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return db.collection<PricingScenario>(this.COLLECTION).findOne({ _id: objectId });
  }

  /**
   * Find all scenarios
   */
  static async findAll(): Promise<PricingScenario[]> {
    const db = await getDb();
    return db.collection<PricingScenario>(this.COLLECTION).find({}).toArray();
  }

  /**
   * Find scenarios by hierarchy level and entity ID
   */
  static async findByAppliesTo(
    level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT',
    entityId: string | ObjectId
  ): Promise<PricingScenario[]> {
    const db = await getDb();
    const objectId = typeof entityId === 'string' ? new ObjectId(entityId) : entityId;

    return db.collection<PricingScenario>(this.COLLECTION).find({
      'appliesTo.level': level,
      'appliesTo.entityId': objectId,
    }).toArray();
  }

  /**
   * Find all scenarios applicable to a sublocation (hierarchical)
   * Returns scenarios at SUBLOCATION, LOCATION, and CUSTOMER levels
   */
  static async findBySubLocation(subLocationId: string | ObjectId): Promise<PricingScenario[]> {
    const db = await getDb();
    const subLocObjectId = typeof subLocationId === 'string' ? new ObjectId(subLocationId) : subLocationId;

    // Get sublocation to traverse up the hierarchy
    const sublocation = await db.collection('sublocations').findOne({ _id: subLocObjectId });
    if (!sublocation) return [];

    // Get location to get customer
    const location = await db.collection('locations').findOne({ _id: sublocation.locationId });
    if (!location) return [];

    const customerId = location.customerId;
    const locationId = sublocation.locationId;

    // Find scenarios at all hierarchy levels
    const scenarios = await db.collection<PricingScenario>(this.COLLECTION).find({
      $or: [
        { 'appliesTo.level': 'CUSTOMER', 'appliesTo.entityId': customerId },
        { 'appliesTo.level': 'LOCATION', 'appliesTo.entityId': locationId },
        { 'appliesTo.level': 'SUBLOCATION', 'appliesTo.entityId': subLocObjectId },
      ],
    }).toArray();

    return scenarios;
  }

  /**
   * Update scenario (partial updates)
   */
  static async update(id: string | ObjectId, updates: Partial<PricingScenario>): Promise<PricingScenario | null> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await db.collection<PricingScenario>(this.COLLECTION).findOneAndUpdate(
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

  /**
   * Delete scenario
   */
  static async delete(id: string | ObjectId): Promise<boolean> {
    const db = await getDb();
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await db.collection<PricingScenario>(this.COLLECTION).deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }

  /**
   * Toggle scenario active status
   */
  static async toggleActive(id: string | ObjectId): Promise<PricingScenario | null> {
    const scenario = await this.findById(id);
    if (!scenario) return null;

    return this.update(id, { isActive: !scenario.isActive });
  }

  /**
   * Find active scenarios only
   */
  static async findActive(): Promise<PricingScenario[]> {
    const db = await getDb();
    return db.collection<PricingScenario>(this.COLLECTION).find({ isActive: true }).toArray();
  }

  /**
   * Find scenarios by tag
   */
  static async findByTag(tag: string): Promise<PricingScenario[]> {
    const db = await getDb();
    return db.collection<PricingScenario>(this.COLLECTION).find({ tags: tag }).toArray();
  }
}
