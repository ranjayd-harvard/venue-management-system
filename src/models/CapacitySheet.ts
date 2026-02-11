import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export type CapacitySheetType = 'TIME_BASED' | 'DATE_BASED' | 'EVENT_BASED';
export type ConflictResolution = 'PRIORITY' | 'HIGHEST_CAPACITY' | 'LOWEST_CAPACITY';
export type RecurrencePattern = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface TimeCapacityWindow {
  startTime: string; // HH:mm format (24-hour)
  endTime: string;   // HH:mm format (24-hour)
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity?: number; // Optional: pre-allocated for this window
}

export interface DateCapacityRange {
  startDate: Date;
  endDate: Date;
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity?: number;
}

export interface EventCapacityRule {
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  reservedCapacity?: number; // Capacity reserved specifically for this event
}

export interface RecurrenceRule {
  pattern: RecurrencePattern;
  daysOfWeek?: DayOfWeek[]; // For WEEKLY pattern
  dayOfMonth?: number;       // For MONTHLY pattern (1-31)
  customExpression?: string; // Cron-like expression for CUSTOM
}

export interface CapacitySheet {
  _id?: ObjectId;

  // Identity
  name: string;
  description?: string;

  // Type and Scope
  type: CapacitySheetType;

  // Hierarchy application (can be Customer, Location, SubLocation, or Event level)
  appliesTo: {
    level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
    entityId: ObjectId;
  };

  // Priority and Conflicts
  priority: number; // Higher number = higher priority
  conflictResolution: ConflictResolution;

  // Date Validity
  effectiveFrom: Date;
  effectiveTo?: Date; // Optional, null means indefinite

  // Recurrence (for recurring patterns like "every weekend")
  recurrence?: RecurrenceRule;

  // Capacity Rules (one or more of these based on type)
  timeWindows?: TimeCapacityWindow[];     // For TIME_BASED
  dateRanges?: DateCapacityRange[];       // For DATE_BASED
  eventCapacity?: EventCapacityRule;      // For EVENT_BASED

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

export interface CapacityQuery {
  subLocationId: ObjectId;
  locationId: ObjectId;
  customerId: ObjectId;
  eventId?: ObjectId;
  startDateTime: Date;
  endDateTime: Date;
}

export interface CapacityResult {
  subLocationId: ObjectId;
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity: number;
  availableCapacity: number;
  breakdown: Array<{
    startDateTime: Date;
    endDateTime: Date;
    hours: number;
    minCapacity: number;
    maxCapacity: number;
    defaultCapacity: number;
    allocatedCapacity: number;
    availableCapacity: number;
    capacitySheetId?: ObjectId;
    capacitySheetName?: string;
    appliedRule: string; // Description of which rule was applied
  }>;
}

export class CapacitySheetRepository {
  static async getCollection() {
    const db = await getDb();
    return db.collection<CapacitySheet>('capacitysheets');
  }

  static async findAll(): Promise<CapacitySheet[]> {
    const collection = await this.getCollection();
    return collection.find({}).sort({ priority: -1 }).toArray();
  }

  static async findById(id: ObjectId): Promise<CapacitySheet | null> {
    const collection = await this.getCollection();
    return collection.findOne({ _id: id });
  }

  // Find all capacity sheets applicable to a SubLocation (including inherited from Location and Customer)
  static async findApplicableCapacitySheets(
    subLocationId: ObjectId,
    locationId: ObjectId,
    customerId: ObjectId,
    startDateTime: Date,
    endDateTime?: Date,
    eventId?: ObjectId
  ): Promise<CapacitySheet[]> {
    const collection = await this.getCollection();

    // If no endDateTime provided, use startDateTime for backwards compatibility
    const effectiveEnd = endDateTime || startDateTime;

    console.log('[findApplicableCapacitySheets] Input:', {
      subLocationId: subLocationId.toString(),
      locationId: locationId.toString(),
      customerId: customerId.toString(),
      eventId: eventId?.toString(),
      startDateTime,
      endDateTime: effectiveEnd
    });

    const entityConditions: any[] = [
      { 'appliesTo.level': 'SUBLOCATION', 'appliesTo.entityId': subLocationId },
      { 'appliesTo.level': 'LOCATION', 'appliesTo.entityId': locationId },
      { 'appliesTo.level': 'CUSTOMER', 'appliesTo.entityId': customerId }
    ];

    // Add event condition if eventId is provided
    if (eventId) {
      entityConditions.push({ 'appliesTo.level': 'EVENT', 'appliesTo.entityId': eventId });
    }

    const query = {
      $and: [
        // Must be active and approved
        { isActive: true },
        { approvalStatus: 'APPROVED' },

        // Must apply to this SubLocation, Location, Customer, or Event
        { $or: entityConditions },

        // Must overlap with booking period
        // CapacitySheet overlaps if: sheet.start <= booking.end AND sheet.end >= booking.start
        {
          $or: [
            // Case 1: CapacitySheet has no end date (indefinite)
            {
              effectiveFrom: { $lte: effectiveEnd },
              effectiveTo: { $exists: false }
            },
            {
              effectiveFrom: { $lte: effectiveEnd },
              effectiveTo: null
            },
            // Case 2: CapacitySheet has end date - check for overlap
            {
              effectiveFrom: { $lte: effectiveEnd },
              effectiveTo: { $gte: startDateTime }
            }
          ]
        }
      ]
    };

    console.log('[findApplicableCapacitySheets] Query:', JSON.stringify(query, null, 2));

    const results = await collection.find(query).sort({ priority: -1 }).toArray();

    console.log(`[findApplicableCapacitySheets] Found ${results.length} capacity sheets`);
    results.forEach(cs => {
      console.log(`  - ${cs.name}: effectiveFrom=${cs.effectiveFrom}, effectiveTo=${cs.effectiveTo}, priority=${cs.priority}, level=${cs.appliesTo.level}`);
    });

    return results;
  }

  static async findByEntityId(entityId: ObjectId): Promise<CapacitySheet[]> {
    const collection = await this.getCollection();
    return collection.find({
      'appliesTo.entityId': entityId
    }).sort({ priority: -1 }).toArray();
  }

  static async findByLevel(level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT'): Promise<CapacitySheet[]> {
    const collection = await this.getCollection();
    return collection.find({
      'appliesTo.level': level
    }).sort({ priority: -1 }).toArray();
  }

  static async findPendingApproval(): Promise<CapacitySheet[]> {
    const collection = await this.getCollection();
    return collection.find({
      approvalStatus: 'PENDING_APPROVAL'
    }).toArray();
  }

  static async create(capacitySheet: Omit<CapacitySheet, '_id' | 'createdAt' | 'updatedAt'>): Promise<ObjectId> {
    const collection = await this.getCollection();
    const now = new Date();
    const result = await collection.insertOne({
      ...capacitySheet,
      createdAt: now,
      updatedAt: now,
    } as CapacitySheet);
    return result.insertedId;
  }

  static async update(id: ObjectId, updates: Partial<CapacitySheet>): Promise<boolean> {
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

  // Activate/Deactivate methods
  static async activate(id: ObjectId): Promise<boolean> {
    return this.update(id, { isActive: true });
  }

  static async deactivate(id: ObjectId): Promise<boolean> {
    return this.update(id, { isActive: false });
  }
}
