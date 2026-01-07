import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { Customer } from './types';

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
}
