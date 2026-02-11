/**
 * Operating Hours Library
 *
 * Provides utilities for managing operating hours with hierarchical inheritance:
 * - Customer → Location → SubLocation
 * - Day-level override (child's Monday replaces parent's Monday)
 * - Additive blackouts with cancel capability
 */

import {
  OperatingHours,
  WeeklySchedule,
  DayOfWeekKey,
  TimeSlot,
  Blackout,
  ResolvedDaySchedule,
  ResolvedBlackout,
} from '@/models/types';

// ===== CONSTANTS =====

export const DAYS_OF_WEEK: DayOfWeekKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_LABELS: Record<DayOfWeekKey, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

/**
 * Maps JavaScript Date.getDay() (0=Sunday, 6=Saturday) to DayOfWeekKey
 */
const JS_DAY_TO_KEY: Record<number, DayOfWeekKey> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

// ===== 24/7 CONSTANTS AND HELPERS =====

/**
 * A time slot representing a full 24-hour day
 */
export const FULL_DAY_SLOT: TimeSlot = { startTime: '00:00', endTime: '23:59' };

/**
 * A weekly schedule representing 24/7 operation (open all day, every day)
 */
export const SCHEDULE_24_7: WeeklySchedule = {
  monday: [FULL_DAY_SLOT],
  tuesday: [FULL_DAY_SLOT],
  wednesday: [FULL_DAY_SLOT],
  thursday: [FULL_DAY_SLOT],
  friday: [FULL_DAY_SLOT],
  saturday: [FULL_DAY_SLOT],
  sunday: [FULL_DAY_SLOT],
};

/**
 * Check if a time slot represents a full 24-hour day
 */
export function is24HourSlot(slot: TimeSlot): boolean {
  return slot.startTime === '00:00' && slot.endTime === '23:59';
}

/**
 * Check if a day's slots represent 24-hour operation
 */
export function is24HourDay(slots: TimeSlot[] | undefined): boolean {
  return slots?.length === 1 && is24HourSlot(slots[0]) || false;
}

/**
 * Check if a schedule is 24/7 (all days open 24 hours)
 */
export function is24_7Schedule(schedule: WeeklySchedule): boolean {
  return DAYS_OF_WEEK.every(day => is24HourDay(schedule[day]));
}

// ===== TIME UTILITIES =====

/**
 * Convert "HH:MM" time string to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to "HH:MM" format
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Get DayOfWeekKey from a Date object
 */
export function getDayKeyFromDate(date: Date): DayOfWeekKey {
  return JS_DAY_TO_KEY[date.getDay()];
}

/**
 * Format time for display (12-hour format with AM/PM)
 */
export function formatTimeForDisplay(time: string): string {
  const minutes = timeToMinutes(time);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
}

// ===== SCHEDULE MERGING =====

/**
 * Merge parent schedule with child schedule (day-level override)
 * Child's defined days completely replace parent's same day
 *
 * @param parentSchedule - Parent's weekly schedule
 * @param childSchedule - Child's weekly schedule (overrides)
 * @returns Merged schedule
 */
export function mergeSchedules(
  parentSchedule: WeeklySchedule = {},
  childSchedule: WeeklySchedule = {}
): WeeklySchedule {
  const merged: WeeklySchedule = { ...parentSchedule };

  for (const day of DAYS_OF_WEEK) {
    // Child's day definition (including empty array) overrides parent
    if (childSchedule[day] !== undefined) {
      merged[day] = childSchedule[day];
    }
  }

  return merged;
}

/**
 * Merge blackouts from multiple levels (additive with cancel capability)
 * - Child inherits all parent blackouts
 * - Child can add new blackouts
 * - Child can cancel inherited blackout by using same ID with cancelled=true
 * - Child can modify inherited blackout by using same ID with new values
 *
 * @param parentBlackouts - Parent's blackouts
 * @param childBlackouts - Child's blackouts
 * @returns Merged blackouts (excluding cancelled ones)
 */
export function mergeBlackouts(
  parentBlackouts: Blackout[] = [],
  childBlackouts: Blackout[] = []
): Blackout[] {
  const blackoutMap = new Map<string, Blackout>();

  // Add parent blackouts first
  parentBlackouts.forEach((b) => blackoutMap.set(b.id, b));

  // Child can override (same ID) or add new ones
  childBlackouts.forEach((b) => blackoutMap.set(b.id, b));

  // Filter out cancelled blackouts
  return Array.from(blackoutMap.values()).filter((b) => !b.cancelled);
}

// ===== INHERITANCE RESOLUTION =====

interface EntityWithOperatingHours {
  name: string;
  operatingHours?: OperatingHours;
}

/**
 * Resolve operating hours with source tracking for a hierarchy chain
 *
 * @param chain - Array of entities from root to target [Customer, Location?, SubLocation?]
 * @returns Resolved schedules and blackouts with source tracking
 */
export function resolveOperatingHours(
  chain: EntityWithOperatingHours[]
): {
  schedule: ResolvedDaySchedule[];
  blackouts: ResolvedBlackout[];
} {
  // Track which entity defined each day's schedule
  const daySourceMap = new Map<DayOfWeekKey, { slots: TimeSlot[]; source: string }>();

  // Build merged schedule tracking sources
  for (const entity of chain) {
    const schedule = entity.operatingHours?.schedule;
    if (!schedule) continue;

    for (const day of DAYS_OF_WEEK) {
      if (schedule[day] !== undefined) {
        daySourceMap.set(day, {
          slots: schedule[day] || [],
          source: entity.name,
        });
      }
    }
  }

  // Get the target entity (last in chain)
  const targetEntity = chain[chain.length - 1];
  const targetSchedule = targetEntity.operatingHours?.schedule || {};

  // Build resolved day schedules
  const resolvedSchedule: ResolvedDaySchedule[] = DAYS_OF_WEEK.map((day) => {
    const resolved = daySourceMap.get(day);
    const isOwn = targetSchedule[day] !== undefined;
    const hasParentDefinition = !!(resolved && resolved.source !== targetEntity.name);

    return {
      day,
      slots: resolved?.slots || [],
      source: resolved?.source || '',
      isInherited: !isOwn && !!resolved,
      isOverride: isOwn && hasParentDefinition,
      isClosed: !resolved || resolved.slots.length === 0,
    };
  });

  // Build merged blackouts with source tracking
  const blackoutSourceMap = new Map<string, { blackout: Blackout; source: string }>();

  for (const entity of chain) {
    const blackouts = entity.operatingHours?.blackouts || [];
    for (const blackout of blackouts) {
      blackoutSourceMap.set(blackout.id, { blackout, source: entity.name });
    }
  }

  const targetBlackouts = new Set(
    (targetEntity.operatingHours?.blackouts || []).map((b) => b.id)
  );

  const resolvedBlackouts: ResolvedBlackout[] = Array.from(blackoutSourceMap.values())
    .filter(({ blackout }) => !blackout.cancelled)
    .map(({ blackout, source }) => ({
      ...blackout,
      source,
      isInherited: !targetBlackouts.has(blackout.id),
    }));

  return { schedule: resolvedSchedule, blackouts: resolvedBlackouts };
}

// ===== VALIDATION =====

const TIME_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Validate a time string format (HH:MM, 24-hour)
 */
export function isValidTimeFormat(time: string): boolean {
  return TIME_REGEX.test(time);
}

/**
 * Validate a time slot
 * @returns Error message or null if valid
 */
export function validateTimeSlot(slot: TimeSlot): string | null {
  if (!isValidTimeFormat(slot.startTime)) {
    return 'Invalid start time format. Use HH:MM (24-hour)';
  }
  if (!isValidTimeFormat(slot.endTime)) {
    return 'Invalid end time format. Use HH:MM (24-hour)';
  }

  const startMinutes = timeToMinutes(slot.startTime);
  const endMinutes = timeToMinutes(slot.endTime);

  if (endMinutes <= startMinutes) {
    return 'End time must be after start time';
  }

  return null;
}

/**
 * Find overlapping time slots within a day
 * @returns Array of [index1, index2] pairs that overlap
 */
export function findOverlappingSlots(slots: TimeSlot[]): [number, number][] {
  const overlaps: [number, number][] = [];

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];

      const aStart = timeToMinutes(a.startTime);
      const aEnd = timeToMinutes(a.endTime);
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);

      // Overlap if one starts before the other ends
      if (aStart < bEnd && aEnd > bStart) {
        overlaps.push([i, j]);
      }
    }
  }

  return overlaps;
}

/**
 * Validate an entire weekly schedule
 * @returns Array of error messages (empty if valid)
 */
export function validateSchedule(schedule: WeeklySchedule): string[] {
  const errors: string[] = [];

  for (const day of DAYS_OF_WEEK) {
    const slots = schedule[day];
    if (!slots || slots.length === 0) continue;

    // Validate each slot
    for (let i = 0; i < slots.length; i++) {
      const error = validateTimeSlot(slots[i]);
      if (error) {
        errors.push(`${DAY_LABELS[day]} slot ${i + 1}: ${error}`);
      }
    }

    // Check for overlaps
    const overlaps = findOverlappingSlots(slots);
    for (const [i, j] of overlaps) {
      errors.push(
        `${DAY_LABELS[day]}: Slots ${i + 1} and ${j + 1} overlap`
      );
    }
  }

  return errors;
}

/**
 * Validate a blackout entry
 * @returns Error message or null if valid
 */
export function validateBlackout(blackout: Blackout): string | null {
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(blackout.date)) {
    return 'Invalid date format. Use YYYY-MM-DD';
  }

  // Validate the date is real
  const date = new Date(blackout.date);
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }

  // Validate time range if applicable
  if (blackout.type === 'TIME_RANGE') {
    if (!blackout.startTime || !blackout.endTime) {
      return 'Time range requires start and end times';
    }
    if (!isValidTimeFormat(blackout.startTime)) {
      return 'Invalid start time format. Use HH:MM (24-hour)';
    }
    if (!isValidTimeFormat(blackout.endTime)) {
      return 'Invalid end time format. Use HH:MM (24-hour)';
    }
    if (timeToMinutes(blackout.endTime) <= timeToMinutes(blackout.startTime)) {
      return 'End time must be after start time';
    }
  }

  return null;
}

// ===== AVAILABILITY CHECKS =====

/**
 * Check if a specific datetime falls within operating hours
 */
export function isWithinOperatingHours(
  datetime: Date,
  schedule: WeeklySchedule
): boolean {
  const dayKey = getDayKeyFromDate(datetime);
  const daySlots = schedule[dayKey];

  if (!daySlots || daySlots.length === 0) {
    return false; // Closed
  }

  const timeMinutes = datetime.getHours() * 60 + datetime.getMinutes();

  return daySlots.some((slot) => {
    const startMinutes = timeToMinutes(slot.startTime);
    const endMinutes = timeToMinutes(slot.endTime);
    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  });
}

/**
 * Check if a date matches a blackout (considering yearly recurrence)
 */
export function isBlackoutDate(
  date: Date,
  blackouts: Blackout[]
): { isBlackout: boolean; blackout?: Blackout } {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const monthDay = dateStr.substring(5); // MM-DD

  for (const blackout of blackouts) {
    if (blackout.cancelled) continue;

    const blackoutMonthDay = blackout.date.substring(5);

    // Check exact date match
    const exactMatch = blackout.date === dateStr;

    // Check yearly recurring match
    const recurringMatch =
      blackout.recurring?.pattern === 'YEARLY' &&
      blackoutMonthDay === monthDay &&
      (!blackout.recurring.endDate || dateStr <= blackout.recurring.endDate);

    if (exactMatch || recurringMatch) {
      // For FULL_DAY, always a blackout
      if (blackout.type === 'FULL_DAY') {
        return { isBlackout: true, blackout };
      }
    }
  }

  return { isBlackout: false };
}

/**
 * Check if a specific datetime falls within a blackout period
 */
export function isBlackoutTime(
  datetime: Date,
  blackouts: Blackout[]
): { isBlackout: boolean; blackout?: Blackout } {
  const dateStr = datetime.toISOString().split('T')[0];
  const monthDay = dateStr.substring(5);
  const timeMinutes = datetime.getHours() * 60 + datetime.getMinutes();

  for (const blackout of blackouts) {
    if (blackout.cancelled) continue;

    const blackoutMonthDay = blackout.date.substring(5);

    const exactMatch = blackout.date === dateStr;
    const recurringMatch =
      blackout.recurring?.pattern === 'YEARLY' &&
      blackoutMonthDay === monthDay &&
      (!blackout.recurring.endDate || dateStr <= blackout.recurring.endDate);

    if (exactMatch || recurringMatch) {
      if (blackout.type === 'FULL_DAY') {
        return { isBlackout: true, blackout };
      }

      if (
        blackout.type === 'TIME_RANGE' &&
        blackout.startTime &&
        blackout.endTime
      ) {
        const startMinutes = timeToMinutes(blackout.startTime);
        const endMinutes = timeToMinutes(blackout.endTime);
        if (timeMinutes >= startMinutes && timeMinutes < endMinutes) {
          return { isBlackout: true, blackout };
        }
      }
    }
  }

  return { isBlackout: false };
}

// ===== HELPER FUNCTIONS =====

/**
 * Generate a UUID for blackout IDs
 */
export function generateBlackoutId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create a default empty schedule (all days undefined = inherit)
 */
export function createEmptySchedule(): WeeklySchedule {
  return {};
}

/**
 * Create a standard business hours schedule (Mon-Fri 9-5)
 */
export function createDefaultBusinessHours(): WeeklySchedule {
  const businessSlot: TimeSlot[] = [{ startTime: '09:00', endTime: '17:00' }];
  return {
    monday: businessSlot,
    tuesday: businessSlot,
    wednesday: businessSlot,
    thursday: businessSlot,
    friday: businessSlot,
    saturday: [],
    sunday: [],
  };
}

/**
 * Sort time slots by start time
 */
export function sortTimeSlots(slots: TimeSlot[]): TimeSlot[] {
  return [...slots].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );
}

/**
 * Check if a day is defined (has slots, even if empty)
 */
export function isDayDefined(
  schedule: WeeklySchedule,
  day: DayOfWeekKey
): boolean {
  return schedule[day] !== undefined;
}

/**
 * Check if a day is open (has at least one slot)
 */
export function isDayOpen(schedule: WeeklySchedule, day: DayOfWeekKey): boolean {
  const slots = schedule[day];
  return !!slots && slots.length > 0;
}

// ===== ENTITY RESOLUTION FOR PRICING/CAPACITY ENGINES =====

/**
 * Entity with operating hours for resolution
 */
interface EntityWithHours {
  name: string;
  operatingHours?: OperatingHours;
}

/**
 * Resolve operating hours from an entity hierarchy chain.
 * Used by pricing and capacity engines to get merged operating hours.
 *
 * @param entities - Array of entities from root to leaf [Customer, Location, SubLocation]
 * @returns Merged schedule and blackouts
 */
export function resolveOperatingHoursFromEntities(
  entities: EntityWithHours[]
): {
  mergedSchedule: WeeklySchedule;
  mergedBlackouts: Blackout[];
  hasOperatingHours: boolean;
} {
  let mergedSchedule: WeeklySchedule = {};
  let mergedBlackouts: Blackout[] = [];
  let hasAnyHours = false;

  for (const entity of entities) {
    if (entity.operatingHours?.schedule) {
      mergedSchedule = mergeSchedules(mergedSchedule, entity.operatingHours.schedule);
      hasAnyHours = true;
    }
    if (entity.operatingHours?.blackouts) {
      mergedBlackouts = mergeBlackouts(mergedBlackouts, entity.operatingHours.blackouts);
    }
  }

  return {
    mergedSchedule,
    mergedBlackouts,
    hasOperatingHours: hasAnyHours,
  };
}
