import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export type RatesheetType = 'DURATION_BASED' | 'TIMING_BASED';
export type ConflictResolution = 'PRIORITY' | 'HIGHEST_PRICE' | 'LOWEST_PRICE';
export type RecurrencePattern = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface TimeWindow {
  startTime: string; // HH:mm format (24-hour)
  endTime: string;   // HH:mm format (24-hour)
  pricePerHour: number;
}

export interface DurationRule {
  durationHours: number; // e.g., 6 for 6-hour blocks
  totalPrice: number;    // Total price for the duration
  description?: string;  // e.g., "6-hour event package"
}

export interface RecurrenceRule {
  pattern: RecurrencePattern;
  daysOfWeek?: DayOfWeek[]; // For WEEKLY pattern
  dayOfMonth?: number;       // For MONTHLY pattern (1-31)
  customExpression?: string; // Cron-like expression for CUSTOM
}

export interface Ratesheet {
  _id?: ObjectId;
  
  // Identity
  name: string;
  description?: string;
  
  // Type and Scope
  type: RatesheetType;
  
  // Hierarchy application (can be Location or SubLocation level)
  appliesTo: {
    level: 'LOCATION' | 'SUBLOCATION';
    entityId: ObjectId; // Location._id or SubLocation._id
  };
  
  // Priority and Conflicts
  priority: number; // Higher number = higher priority
  conflictResolution: ConflictResolution;
  
  // Date Validity
  effectiveFrom: Date;
  effectiveTo?: Date; // Optional, null means indefinite
  
  // Recurrence (for recurring patterns like "every weekend")
  recurrence?: RecurrenceRule;
  
  // Pricing Rules (one of these based on type)
  timeWindows?: TimeWindow[];     // For TIMING_BASED
  durationRules?: DurationRule[]; // For DURATION_BASED
  
  // Metadata
  isActive: boolean;
  createdBy?: string; // User ID or email
  createdAt?: Date;
  updatedAt?: Date;
  
  // Approval Workflow
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
}

export interface PricingQuery {
  subLocationId: ObjectId;
  startDateTime: Date;
  endDateTime: Date;
}

export interface PricingResult {
  subLocationId: ObjectId;
  totalPrice: number;
  breakdown: Array<{
    startDateTime: Date;
    endDateTime: Date;
    pricePerHour: number;
    hours: number;
    subtotal: number;
    ratesheetId: ObjectId;
    ratesheetName: string;
    appliedRule: string; // Description of which rule was applied
  }>;
  currency: string;
}

export class RatesheetRepository {
  static async getCollection() {
    const db = await getDb();
    return db.collection<Ratesheet>('ratesheets');
  }

  static async findAll(): Promise<Ratesheet[]> {
    const collection = await this.getCollection();
    return collection.find({}).sort({ priority: -1 }).toArray();
  }

  static async findById(id: ObjectId): Promise<Ratesheet | null> {
    const collection = await this.getCollection();
    return collection.findOne({ _id: id });
  }

  // Find all ratesheets applicable to a SubLocation (including inherited from Location)
  static async findApplicableRatesheets(
    subLocationId: ObjectId,
    locationId: ObjectId,
    dateTime: Date
  ): Promise<Ratesheet[]> {
    const collection = await this.getCollection();
    
    return collection.find({
      $and: [
        // Must be active and approved
        { isActive: true },
        { approvalStatus: 'APPROVED' },
        
        // Must apply to this SubLocation or its parent Location
        {
          $or: [
            { 'appliesTo.level': 'SUBLOCATION', 'appliesTo.entityId': subLocationId },
            { 'appliesTo.level': 'LOCATION', 'appliesTo.entityId': locationId }
          ]
        },
        
        // Must be within effective date range
        { effectiveFrom: { $lte: dateTime } },
        {
          $or: [
            { effectiveTo: { $exists: false } },
            { effectiveTo: null },
            { effectiveTo: { $gte: dateTime } }
          ]
        }
      ]
    }).sort({ priority: -1 }).toArray();
  }

  static async findByEntityId(entityId: ObjectId): Promise<Ratesheet[]> {
    const collection = await this.getCollection();
    return collection.find({ 
      'appliesTo.entityId': entityId 
    }).sort({ priority: -1 }).toArray();
  }

  static async findPendingApproval(): Promise<Ratesheet[]> {
    const collection = await this.getCollection();
    return collection.find({ 
      approvalStatus: 'PENDING_APPROVAL' 
    }).toArray();
  }

  static async create(ratesheet: Omit<Ratesheet, '_id' | 'createdAt' | 'updatedAt'>): Promise<ObjectId> {
    const collection = await this.getCollection();
    const now = new Date();
    const result = await collection.insertOne({
      ...ratesheet,
      createdAt: now,
      updatedAt: now,
    } as Ratesheet);
    return result.insertedId;
  }

  static async update(id: ObjectId, updates: Partial<Ratesheet>): Promise<boolean> {
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

  // Approval workflow methods
  static async submitForApproval(id: ObjectId): Promise<boolean> {
    return this.update(id, { approvalStatus: 'PENDING_APPROVAL' });
  }

  static async approve(id: ObjectId, approvedBy: string): Promise<boolean> {
    return this.update(id, {
      approvalStatus: 'APPROVED',
      approvedBy,
      approvedAt: new Date()
    });
  }

  static async reject(id: ObjectId, rejectionReason: string): Promise<boolean> {
    return this.update(id, {
      approvalStatus: 'REJECTED',
      rejectionReason
    });
  }
}
