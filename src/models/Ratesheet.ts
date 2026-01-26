import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export type RatesheetType = 'DURATION_BASED' | 'TIMING_BASED';
export type ConflictResolution = 'PRIORITY' | 'HIGHEST_PRICE' | 'LOWEST_PRICE';
export type RecurrencePattern = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface TimeWindow {
  // Window type: ABSOLUTE_TIME uses clock time, DURATION_BASED uses minutes from booking start
  windowType?: 'ABSOLUTE_TIME' | 'DURATION_BASED'; // Defaults to ABSOLUTE_TIME for backward compatibility

  // Absolute time mode (HH:mm format, 24-hour)
  startTime?: string;
  endTime?: string;

  // Duration-based mode (minutes from booking start)
  startMinute?: number;  // e.g., 0 = booking start, 120 = 2 hours from start
  endMinute?: number;    // e.g., 240 = 4 hours from start

  // Common fields
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
  
  // Hierarchy application (can be Location, SubLocation, or Event level)
  appliesTo: {
    level: 'LOCATION' | 'SUBLOCATION' | 'EVENT';
    entityId: ObjectId; // Location._id or SubLocation._id or Event._id
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
  // Now accepts start AND end date to find all overlapping ratesheets
  static async findApplicableRatesheets(
    subLocationId: ObjectId,
    locationId: ObjectId,
    startDateTime: Date,
    endDateTime?: Date
  ): Promise<Ratesheet[]> {
    const collection = await this.getCollection();
    
    // If no endDateTime provided, use startDateTime for backwards compatibility
    const effectiveEnd = endDateTime || startDateTime;
    
    console.log('[findApplicableRatesheets] Input:', {
      subLocationId: subLocationId.toString(),
      locationId: locationId.toString(),
      startDateTime,
      endDateTime: effectiveEnd
    });
    
    const query = {
      $and: [
        // Must be active and approved
        { isActive: true },
        { approvalStatus: 'APPROVED' },
        
        // Must apply to this SubLocation or its parent Location
        // Support both old and new data structures
        {
          $or: [
            // Old structure: appliesTo.level/entityId
            { 'appliesTo.level': 'SUBLOCATION', 'appliesTo.entityId': subLocationId },
            { 'appliesTo.level': 'LOCATION', 'appliesTo.entityId': locationId },
            // New structure: layer/entityId
            { layer: 'SUBLOCATION', entityId: subLocationId },
            { layer: 'LOCATION', entityId: locationId }
          ]
        },
        
        // Must overlap with booking period
        // Ratesheet overlaps if: ratesheet.start <= booking.end AND ratesheet.end >= booking.start
        {
          $or: [
            // Case 1: Ratesheet has no end date (indefinite)
            {
              effectiveFrom: { $lte: effectiveEnd },
              effectiveTo: { $exists: false }
            },
            {
              effectiveFrom: { $lte: effectiveEnd },
              effectiveTo: null
            },
            // Case 2: Ratesheet has end date - check for overlap
            {
              effectiveFrom: { $lte: effectiveEnd },
              effectiveTo: { $gte: startDateTime }
            }
          ]
        }
      ]
    };
    
    console.log('[findApplicableRatesheets] Query:', JSON.stringify(query, null, 2));
    
    const results = await collection.find(query).sort({ priority: -1 }).toArray();
    
    console.log(`[findApplicableRatesheets] Found ${results.length} ratesheets`);
    results.forEach(rs => {
      console.log(`  - ${rs.name}: effectiveFrom=${rs.effectiveFrom}, effectiveTo=${rs.effectiveTo}, priority=${rs.priority}`);
    });
    
    return results;
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
