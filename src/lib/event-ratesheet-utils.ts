import { ObjectId } from 'mongodb';
import { Event } from '@/models/types';
import { Ratesheet, RatesheetRepository, TimeWindow } from '@/models/Ratesheet';
import { getDb } from '@/lib/mongodb';

/**
 * Generates or updates an auto-ratesheet for an event with grace periods
 * Creates 3 time windows:
 * 1. Grace period before (if set) - $0/hr
 * 2. Event duration - default hourly rate
 * 3. Grace period after (if set) - $0/hr
 *
 * Priority: 4900-4999 (auto-generated event ratesheets subcategory)
 */
export async function generateEventRatesheet(event: Event): Promise<ObjectId | null> {
  // Event must have _id to create a ratesheet
  if (!event._id) {
    console.log(`[generateEventRatesheet] Event ${event.name} has no _id, skipping ratesheet`);
    return null;
  }

  const graceBefore = event.gracePeriodBefore || 0;
  const graceAfter = event.gracePeriodAfter || 0;
  const hourlyRate = event.defaultHourlyRate || 0;

  // Calculate event duration in minutes
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const eventDurationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

  // Build time windows using DURATION_BASED windowType
  const timeWindows: TimeWindow[] = [];
  let currentMinute = 0;

  // 1. Grace period before (if any)
  if (graceBefore > 0) {
    timeWindows.push({
      windowType: 'DURATION_BASED',
      startMinute: currentMinute,
      endMinute: currentMinute + graceBefore,
      pricePerHour: 0,
    });
    currentMinute += graceBefore;
  }

  // 2. Event duration
  timeWindows.push({
    windowType: 'DURATION_BASED',
    startMinute: currentMinute,
    endMinute: currentMinute + eventDurationMinutes,
    pricePerHour: hourlyRate,
  });
  currentMinute += eventDurationMinutes;

  // 3. Grace period after (if any)
  if (graceAfter > 0) {
    timeWindows.push({
      windowType: 'DURATION_BASED',
      startMinute: currentMinute,
      endMinute: currentMinute + graceAfter,
      pricePerHour: 0,
    });
  }

  const ratesheetName = `Auto-${event.name}`;

  // Check if auto-ratesheet already exists for this event
  const db = await getDb();
  const existingRatesheet = await db.collection<Ratesheet>('ratesheets').findOne({
    name: ratesheetName,
    'appliesTo.level': 'EVENT',
    'appliesTo.entityId': event._id,
  });

  // Auto-generated event ratesheets use priority 4900-4999
  const autoEventPriority = 4900;

  // Calculate effective dates including grace periods
  // Use milliseconds for accurate date arithmetic
  const effectiveFrom = new Date(new Date(event.startDate).getTime() - graceBefore * 60 * 1000);
  const effectiveTo = new Date(new Date(event.endDate).getTime() + graceAfter * 60 * 1000);

  const ratesheetData: Omit<Ratesheet, '_id' | 'createdAt' | 'updatedAt'> = {
    name: ratesheetName,
    description: `Auto-generated ratesheet for event: ${event.name} (${graceBefore}min before + event + ${graceAfter}min after)`,
    type: 'TIMING_BASED',
    appliesTo: {
      level: 'EVENT',
      entityId: event._id as ObjectId,
    },
    priority: autoEventPriority,
    conflictResolution: 'PRIORITY',
    effectiveFrom,
    effectiveTo,
    timeWindows,
    isActive: event.isActive,
    approvalStatus: 'APPROVED', // Auto-approve event ratesheets
    approvedBy: 'system',
    approvedAt: new Date(),
  };

  if (existingRatesheet) {
    // Update existing ratesheet
    await RatesheetRepository.update(existingRatesheet._id!, {
      ...ratesheetData,
      updatedAt: new Date(),
    });
    console.log(`[generateEventRatesheet] Updated auto-ratesheet for event: ${event.name}`);
    return existingRatesheet._id!;
  } else {
    // Create new ratesheet
    const ratesheetId = await RatesheetRepository.create(ratesheetData);
    console.log(`[generateEventRatesheet] Created auto-ratesheet for event: ${event.name}`);
    return ratesheetId;
  }
}

/**
 * Finds the auto-ratesheet for a given event
 */
export async function findEventRatesheet(eventName: string, eventId: ObjectId): Promise<Ratesheet | null> {
  const db = await getDb();
  const ratesheetName = `Auto-${eventName}`;

  return db.collection<Ratesheet>('ratesheets').findOne({
    name: ratesheetName,
    'appliesTo.level': 'EVENT',
    'appliesTo.entityId': eventId,
  });
}

/**
 * Deletes the auto-ratesheet for a given event
 */
export async function deleteEventRatesheet(eventName: string, eventId: ObjectId): Promise<boolean> {
  const db = await getDb();
  const ratesheetName = `Auto-${eventName}`;

  const result = await db.collection<Ratesheet>('ratesheets').deleteOne({
    name: ratesheetName,
    'appliesTo.level': 'EVENT',
    'appliesTo.entityId': eventId,
  });

  return result.deletedCount > 0;
}
