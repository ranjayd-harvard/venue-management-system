// src/lib/capacity-engine-hourly.ts
// Enhanced capacity engine that evaluates each hour individually
// Mirrors the structure of price-engine-hourly.ts

import { CapacitySheet, TimeCapacityWindow } from '@/models/CapacitySheet';
import { PricingConfig, CapacityConfig } from '@/models/types';
import { getTimeInTimezone, timeToMinutes, isDateInRange } from './timezone-utils';
import { getHourlyCapacityOverride } from './capacity-utils';

export interface HourlyCapacitySegment {
  startTime: Date;
  endTime: Date;
  durationHours: number;
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity: number;
  availableCapacity: number; // maxCapacity - allocatedCapacity
  capacitySheet?: {
    id: string;
    name: string;
    type: string;
    priority: number;
    level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
  };
  source: 'CAPACITYSHEET' | 'DEFAULT_CAPACITY';
  timeWindow?: {
    start: string;
    end: string;
  };
}

export interface HourlyCapacityResult {
  segments: HourlyCapacitySegment[];
  summary: {
    totalHours: number;
    avgMinCapacity: number;
    avgMaxCapacity: number;
    avgDefaultCapacity: number;
    avgAllocatedCapacity: number;
    avgAvailableCapacity: number;
  };
  breakdown: {
    capacitySheetSegments: number;
    defaultCapacitySegments: number;
  };
  decisionLog: Array<{
    hour: number;
    timestamp: string;
    timeSlot: string;
    applicableCapacitySheets: number;
    selectedCapacitySheet?: string;
    capacity: {
      min: number;
      max: number;
      default: number;
      allocated: number;
    };
    source: string;
  }>;
  timezone: string;
}

export interface CapacityContext {
  bookingStart: Date;
  bookingEnd: Date;
  timezone: string;

  // Entity hierarchy
  customerId: string;
  locationId: string;
  subLocationId: string;
  eventId?: string;

  // Capacity sheets (all levels)
  customerCapacitySheets: CapacitySheet[];
  locationCapacitySheets: CapacitySheet[];
  sublocationCapacitySheets: CapacitySheet[];
  eventCapacitySheets?: CapacitySheet[];

  // Default capacity values (fallback)
  customerDefaultCapacity?: {
    min: number;
    max: number;
    default: number;
    allocated: number;
  };
  locationDefaultCapacity?: {
    min: number;
    max: number;
    default: number;
    allocated: number;
  };
  sublocationDefaultCapacity?: {
    min: number;
    max: number;
    default: number;
    allocated: number;
  };
  eventDefaultCapacity?: {
    min: number;
    max: number;
    default: number;
    allocated: number;
  };

  // Sublocation capacity config (contains hourly overrides)
  sublocationCapacityConfig?: CapacityConfig;

  // Pricing config (for timezone and other settings)
  capacityConfig?: PricingConfig;
}

export class HourlyCapacityEngine {
  /**
   * Calculate capacity by evaluating each hour individually
   */
  calculateCapacity(context: CapacityContext): HourlyCapacityResult {
    const segments: HourlyCapacitySegment[] = [];
    const decisionLog: HourlyCapacityResult['decisionLog'] = [];

    // Split booking into hourly segments
    const hourlySlots = this.splitIntoHourlySlots(
      context.bookingStart,
      context.bookingEnd,
      context.timezone
    );

    console.log(`\n🔍 Evaluating ${hourlySlots.length} hourly capacity segments...`);

    // Evaluate each hour independently
    for (const slot of hourlySlots) {
      const segmentResult = this.evaluateHourSegment(slot, context);
      segments.push(segmentResult);

      // Log decision
      decisionLog.push({
        hour: segments.length,
        timestamp: slot.start.toISOString(),
        timeSlot: `${getTimeInTimezone(slot.start, context.timezone)} - ${getTimeInTimezone(slot.end, context.timezone)}`,
        applicableCapacitySheets: segmentResult.source === 'CAPACITYSHEET' ? 1 : 0,
        selectedCapacitySheet: segmentResult.capacitySheet?.name,
        capacity: {
          min: segmentResult.minCapacity,
          max: segmentResult.maxCapacity,
          default: segmentResult.defaultCapacity,
          allocated: segmentResult.allocatedCapacity
        },
        source: segmentResult.source
      });
    }

    // Calculate summary statistics
    const totalHours = segments.reduce((sum, seg) => sum + seg.durationHours, 0);
    const avgMinCapacity = Math.round(segments.reduce((sum, seg) => sum + seg.minCapacity * seg.durationHours, 0) / totalHours);
    const avgMaxCapacity = Math.round(segments.reduce((sum, seg) => sum + seg.maxCapacity * seg.durationHours, 0) / totalHours);
    const avgDefaultCapacity = Math.round(segments.reduce((sum, seg) => sum + seg.defaultCapacity * seg.durationHours, 0) / totalHours);
    const avgAllocatedCapacity = Math.round(segments.reduce((sum, seg) => sum + seg.allocatedCapacity * seg.durationHours, 0) / totalHours);
    const avgAvailableCapacity = Math.round(segments.reduce((sum, seg) => sum + seg.availableCapacity * seg.durationHours, 0) / totalHours);

    const capacitySheetSegments = segments.filter(s => s.source === 'CAPACITYSHEET').length;
    const defaultCapacitySegments = segments.filter(s => s.source === 'DEFAULT_CAPACITY').length;

    return {
      segments,
      summary: {
        totalHours,
        avgMinCapacity,
        avgMaxCapacity,
        avgDefaultCapacity,
        avgAllocatedCapacity,
        avgAvailableCapacity
      },
      breakdown: {
        capacitySheetSegments,
        defaultCapacitySegments
      },
      decisionLog,
      timezone: context.timezone
    };
  }

  /**
   * Split booking period into hourly slots
   */
  private splitIntoHourlySlots(
    start: Date,
    end: Date,
    timezone: string
  ): Array<{ start: Date; end: Date; durationHours: number }> {
    const slots: Array<{ start: Date; end: Date; durationHours: number }> = [];

    let currentTime = new Date(start);

    while (currentTime < end) {
      // Find next hour boundary or booking end
      const nextHour = new Date(currentTime);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(nextHour.getHours() + 1);

      const slotEnd = nextHour > end ? end : nextHour;
      const durationMs = slotEnd.getTime() - currentTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      slots.push({
        start: new Date(currentTime),
        end: new Date(slotEnd),
        durationHours
      });

      currentTime = slotEnd;
    }

    return slots;
  }

  /**
   * Evaluate a single hour segment
   */
  private evaluateHourSegment(
    slot: { start: Date; end: Date; durationHours: number },
    context: CapacityContext
  ): HourlyCapacitySegment {
    // Step 0: Check for HOURLY OVERRIDE first (highest priority)
    const hourlyOverride = this.getHourlyOverride(slot.start, context);
    if (hourlyOverride) {
      // Check if this is a daily override (all 24 hours have the same value)
      const isDailyOverride = this.isDailyOverridePattern(slot.start, context);
      const overrideName = isDailyOverride ? 'Daily Override' : 'Hourly Override';

      return {
        startTime: slot.start,
        endTime: slot.end,
        durationHours: slot.durationHours,
        minCapacity: hourlyOverride.min,
        maxCapacity: hourlyOverride.max,
        defaultCapacity: hourlyOverride.default,
        allocatedCapacity: hourlyOverride.allocated,
        availableCapacity: hourlyOverride.max - hourlyOverride.allocated,
        capacitySheet: {
          id: isDailyOverride ? 'daily-override' : 'hourly-override',
          name: overrideName,
          type: isDailyOverride ? 'DAILY_OVERRIDE' : 'HOURLY_OVERRIDE',
          priority: 999999, // Highest priority
          level: 'SUBLOCATION'
        },
        source: 'CAPACITYSHEET',
        timeWindow: {
          start: `${slot.start.getHours().toString().padStart(2, '0')}:00`,
          end: `${(slot.start.getHours() + 1).toString().padStart(2, '0')}:00`
        }
      };
    }

    // Step 1: Find all applicable capacity sheets for this hour
    const applicableCapacitySheets = this.findApplicableCapacitySheetsForHour(
      slot.start,
      context
    );

    // Step 2: If capacity sheets found, use highest priority
    if (applicableCapacitySheets.length > 0) {
      const selected = applicableCapacitySheets[0]; // Already sorted by priority

      return {
        startTime: slot.start,
        endTime: slot.end,
        durationHours: slot.durationHours,
        minCapacity: selected.capacity.min,
        maxCapacity: selected.capacity.max,
        defaultCapacity: selected.capacity.default,
        allocatedCapacity: selected.capacity.allocated || 0,
        availableCapacity: selected.capacity.max - (selected.capacity.allocated || 0),
        capacitySheet: {
          id: selected.capacitySheet._id!.toString(),
          name: selected.capacitySheet.name,
          type: selected.capacitySheet.type,
          priority: selected.capacitySheet.priority,
          level: selected.level
        },
        source: 'CAPACITYSHEET',
        timeWindow: selected.timeWindow
      };
    }

    // Step 3: Fallback to default capacity values (hierarchy: Event → SubLoc → Loc → Customer)
    const defaultCapacity = this.getDefaultCapacity(context);

    return {
      startTime: slot.start,
      endTime: slot.end,
      durationHours: slot.durationHours,
      minCapacity: defaultCapacity.min,
      maxCapacity: defaultCapacity.max,
      defaultCapacity: defaultCapacity.default,
      allocatedCapacity: defaultCapacity.allocated,
      availableCapacity: defaultCapacity.max - defaultCapacity.allocated,
      source: 'DEFAULT_CAPACITY'
    };
  }

  /**
   * Find all applicable capacity sheets for a specific hour
   */
  private findApplicableCapacitySheetsForHour(
    hourStart: Date,
    context: CapacityContext
  ): Array<{
    capacitySheet: CapacitySheet;
    capacity: {
      min: number;
      max: number;
      default: number;
      allocated: number;
    };
    level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
    timeWindow?: { start: string; end: string };
  }> {
    const applicable: Array<{
      capacitySheet: CapacitySheet;
      capacity: {
        min: number;
        max: number;
        default: number;
        allocated: number;
      };
      level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
      timeWindow?: { start: string; end: string };
    }> = [];

    // Check all capacity sheets (EVENT has highest priority)
    const allCapacitySheets = [
      ...(context.eventCapacitySheets || []).map(cs => ({ cs, level: 'EVENT' as const })),
      ...context.sublocationCapacitySheets.map(cs => ({ cs, level: 'SUBLOCATION' as const })),
      ...context.locationCapacitySheets.map(cs => ({ cs, level: 'LOCATION' as const })),
      ...context.customerCapacitySheets.map(cs => ({ cs, level: 'CUSTOMER' as const })),
    ];

    for (const { cs, level } of allCapacitySheets) {
      // Skip inactive capacity sheets
      if (!cs.isActive) continue;

      // Check date range
      if (!isDateInRange(hourStart, cs.effectiveFrom, cs.effectiveTo || null)) {
        continue;
      }

      // Check time windows for TIME_BASED capacity sheets
      if (cs.type === 'TIME_BASED' && cs.timeWindows) {
        const hourTime = getTimeInTimezone(hourStart, context.timezone);
        const hourMinutes = timeToMinutes(hourTime);

        for (const tw of cs.timeWindows) {
          const startMinutes = timeToMinutes(tw.startTime);
          const endMinutes = timeToMinutes(tw.endTime);

          if (hourMinutes >= startMinutes && hourMinutes < endMinutes) {
            applicable.push({
              capacitySheet: cs,
              capacity: {
                min: tw.minCapacity,
                max: tw.maxCapacity,
                default: tw.defaultCapacity,
                allocated: tw.allocatedCapacity || 0
              },
              level,
              timeWindow: { start: tw.startTime, end: tw.endTime }
            });
            break; // Found matching window
          }
        }
      }

      // Check date ranges for DATE_BASED capacity sheets
      if (cs.type === 'DATE_BASED' && cs.dateRanges) {
        for (const dr of cs.dateRanges) {
          if (hourStart >= dr.startDate && hourStart <= dr.endDate) {
            applicable.push({
              capacitySheet: cs,
              capacity: {
                min: dr.minCapacity,
                max: dr.maxCapacity,
                default: dr.defaultCapacity,
                allocated: dr.allocatedCapacity || 0
              },
              level
            });
            break; // Found matching date range
          }
        }
      }

      // Check event capacity for EVENT_BASED capacity sheets
      if (cs.type === 'EVENT_BASED' && cs.eventCapacity) {
        applicable.push({
          capacitySheet: cs,
          capacity: {
            min: cs.eventCapacity.minCapacity,
            max: cs.eventCapacity.maxCapacity,
            default: cs.eventCapacity.defaultCapacity,
            allocated: cs.eventCapacity.reservedCapacity || 0
          },
          level
        });
      }
    }

    // Sort by hierarchy then priority
    return applicable.sort((a, b) => {
      // Level hierarchy: EVENT (4) > SUBLOCATION (3) > LOCATION (2) > CUSTOMER (1)
      const levelA = a.level === 'EVENT' ? 4 : a.level === 'SUBLOCATION' ? 3 : a.level === 'LOCATION' ? 2 : 1;
      const levelB = b.level === 'EVENT' ? 4 : b.level === 'SUBLOCATION' ? 3 : b.level === 'LOCATION' ? 2 : 1;

      if (levelA !== levelB) {
        return levelB - levelA; // Higher level first
      }

      // Same level: higher priority first
      return b.capacitySheet.priority - a.capacitySheet.priority;
    });
  }

  /**
   * Get default capacity from hierarchy (EVENT > SubLocation > Location > Customer)
   */
  private getDefaultCapacity(context: CapacityContext): {
    min: number;
    max: number;
    default: number;
    allocated: number;
  } {
    // Return the first available default capacity in hierarchy order
    if (context.eventDefaultCapacity) {
      return context.eventDefaultCapacity;
    }

    if (context.sublocationDefaultCapacity) {
      return context.sublocationDefaultCapacity;
    }

    if (context.locationDefaultCapacity) {
      return context.locationDefaultCapacity;
    }

    if (context.customerDefaultCapacity) {
      return context.customerDefaultCapacity;
    }

    // Absolute fallback
    return {
      min: 0,
      max: 100,
      default: 50,
      allocated: 0
    };
  }

  /**
   * Check if all 24 hours for a date have hourly overrides with the same maxCapacity value
   * This indicates a daily/bulk override rather than individual hourly edits
   */
  private isDailyOverridePattern(
    hourStart: Date,
    context: CapacityContext
  ): boolean {
    if (!context.sublocationCapacityConfig || !context.sublocationCapacityConfig.hourlyCapacities) {
      return false;
    }

    const dateStr = hourStart.toISOString().split('T')[0];
    const overridesForDate = context.sublocationCapacityConfig.hourlyCapacities.filter(
      (hc) => hc.date === dateStr
    );

    // Must have exactly 24 overrides (one for each hour)
    if (overridesForDate.length !== 24) {
      return false;
    }

    // Check if all overrides have the same maxCapacity value
    const firstMaxCapacity = overridesForDate[0]?.maxCapacity;
    if (firstMaxCapacity === undefined) {
      return false;
    }

    // All 24 hours must have the same maxCapacity
    return overridesForDate.every((override) => override.maxCapacity === firstMaxCapacity);
  }

  /**
   * Get hourly capacity override for a specific hour
   * Returns null if no override exists for this date/hour
   */
  private getHourlyOverride(
    hourStart: Date,
    context: CapacityContext
  ): { min: number; max: number; default: number; allocated: number } | null {
    if (!context.sublocationCapacityConfig) {
      return null;
    }

    // Get date in YYYY-MM-DD format
    const dateStr = hourStart.toISOString().split('T')[0];
    const hour = hourStart.getHours();

    // Check for hourly override
    const override = getHourlyCapacityOverride(
      context.sublocationCapacityConfig,
      dateStr,
      hour
    );

    if (!override) {
      return null;
    }

    // Get default values as fallback
    const defaultCapacity = this.getDefaultCapacity(context);

    // Return override with fallbacks to default values
    return {
      min: override.minCapacity ?? defaultCapacity.min,
      max: override.maxCapacity ?? defaultCapacity.max,
      default: override.defaultCapacity ?? defaultCapacity.default,
      allocated: override.allocatedCapacity ?? defaultCapacity.allocated
    };
  }
}
