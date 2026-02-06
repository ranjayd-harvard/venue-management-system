// src/lib/pricing-engine-hourly.ts
// Enhanced pricing engine that evaluates each hour individually

import { RateSheet, PricingConfig } from '@/models/types';
import { getTimeInTimezone, timeToMinutes, isDateInRange } from './timezone-utils';

export interface HourlySegment {
  startTime: Date;
  endTime: Date;
  durationHours: number;
  pricePerHour: number;
  totalPrice: number;
  ratesheet?: {
    id: string;
    name: string;
    type: string;
    priority: number;
    level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT' | 'SURGE';
  };
  source: 'RATESHEET' | 'DEFAULT_RATE';
  timeWindow?: {
    start: string;
    end: string;
  };
}

export interface HourlyPricingResult {
  segments: HourlySegment[];
  totalPrice: number;
  totalHours: number;
  breakdown: {
    ratesheetSegments: number;
    defaultRateSegments: number;
  };
  decisionLog: Array<{
    hour: number;
    timestamp: string;
    timeSlot: string;
    applicableRatesheets: number;
    selectedRatesheet?: string;
    pricePerHour: number;
    source: string;
  }>;
  timezone: string;
}

export interface PricingContext {
  bookingStart: Date;
  bookingEnd: Date;
  timezone: string;

  // Entity hierarchy
  customerId: string;
  locationId: string;
  subLocationId: string;
  eventId?: string;

  // Booking type flag
  isEventBooking?: boolean; // If true, apply event ratesheets (with grace periods); if false, skip event ratesheets

  // Ratesheets (all levels)
  customerRatesheets: RateSheet[];
  locationRatesheets: RateSheet[];
  sublocationRatesheets: RateSheet[];
  eventRatesheets?: RateSheet[];
  surgeRatesheets?: RateSheet[];

  // Default rates (fallback)
  customerDefaultRate?: number;
  locationDefaultRate?: number;
  sublocationDefaultRate?: number;
  eventDefaultRate?: number;

  // Pricing config
  pricingConfig: PricingConfig;
}

export class HourlyPricingEngine {
  /**
   * Calculate pricing by evaluating each hour individually
   */
  calculatePrice(context: PricingContext): HourlyPricingResult {
    const segments: HourlySegment[] = [];
    const decisionLog: HourlyPricingResult['decisionLog'] = [];
    
    // Split booking into hourly segments
    const hourlySlots = this.splitIntoHourlySlots(
      context.bookingStart,
      context.bookingEnd,
      context.timezone
    );
    
    console.log(`\n🔍 Evaluating ${hourlySlots.length} hourly segments...`);
    
    // Evaluate each hour independently
    for (const slot of hourlySlots) {
      const segmentResult = this.evaluateHourSegment(slot, context);
      segments.push(segmentResult);
      
      // Log decision
      decisionLog.push({
        hour: segments.length,
        timestamp: slot.start.toISOString(),
        timeSlot: `${getTimeInTimezone(slot.start, context.timezone)} - ${getTimeInTimezone(slot.end, context.timezone)}`,
        applicableRatesheets: segmentResult.source === 'RATESHEET' ? 1 : 0,
        selectedRatesheet: segmentResult.ratesheet?.name,
        pricePerHour: segmentResult.pricePerHour,
        source: segmentResult.source
      });
    }
    
    // Calculate totals
    const totalPrice = segments.reduce((sum, seg) => sum + seg.totalPrice, 0);
    const totalHours = segments.reduce((sum, seg) => sum + seg.durationHours, 0);
    
    const ratesheetSegments = segments.filter(s => s.source === 'RATESHEET').length;
    const defaultRateSegments = segments.filter(s => s.source === 'DEFAULT_RATE').length;
    
    return {
      segments,
      totalPrice: Math.round(totalPrice * 100) / 100, // Round to 2 decimals
      totalHours,
      breakdown: {
        ratesheetSegments,
        defaultRateSegments
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
    context: PricingContext
  ): HourlySegment {
    // Step 1: Find all applicable ratesheets for this hour
    const applicableRatesheets = this.findApplicableRatesheetsForHour(
      slot.start,
      context
    );

    // Step 2: Check if SURGE_MULTIPLIER is the winner
    if (applicableRatesheets.length > 0) {
      const selected = applicableRatesheets[0]; // Already sorted by priority

      // Handle SURGE_MULTIPLIER type specially
      if (selected.level === 'SURGE' && selected.ratesheet.type === 'SURGE_MULTIPLIER') {
        // Surge is a multiplier - find the base price (next non-SURGE winner)
        const baseRatesheet = applicableRatesheets.find(rs => rs.level !== 'SURGE');

        let basePrice: number;
        let baseName: string;

        if (baseRatesheet) {
          basePrice = baseRatesheet.pricePerHour;
          baseName = baseRatesheet.ratesheet.name;
        } else {
          // No ratesheet found, use default rate
          basePrice = this.getDefaultRate(context);
          baseName = 'Default Rate';
        }

        // Apply surge multiplier to base price
        const surgeMultiplier = selected.pricePerHour; // This is the multiplier, not absolute price
        const finalPrice = basePrice * surgeMultiplier;

        console.log(`\n🏆 [ENGINE] WINNER for ${slot.start.toISOString()}: SURGE MULTIPLIER`);
        console.log(`[ENGINE]    Surge Config: ${selected.ratesheet.name}`);
        console.log(`[ENGINE]    Base: ${baseName} ($${basePrice.toFixed(2)}/hr)`);
        console.log(`[ENGINE]    Multiplier: ${surgeMultiplier.toFixed(2)}x`);
        console.log(`[ENGINE]    Final Price: $${finalPrice.toFixed(2)}/hr`);

        return {
          startTime: slot.start,
          endTime: slot.end,
          durationHours: slot.durationHours,
          pricePerHour: finalPrice,
          totalPrice: finalPrice * slot.durationHours,
          ratesheet: {
            id: selected.ratesheet._id!.toString(),
            name: selected.ratesheet.name,
            type: selected.ratesheet.type,
            priority: selected.ratesheet.priority,
            level: selected.level
          },
          source: 'RATESHEET',
          timeWindow: selected.timeWindow
        };
      }

      // Regular ratesheet (not surge multiplier)
      // DEBUG: Log the winner
      if (selected.level === 'SURGE') {
        console.log(`\n🏆 [ENGINE] WINNER for ${slot.start.toISOString()}: SURGE ratesheet`);
        console.log(`[ENGINE]    Name: ${selected.ratesheet.name}`);
        console.log(`[ENGINE]    Price: $${selected.pricePerHour.toFixed(2)}/hr`);
        console.log(`[ENGINE]    Priority: ${selected.ratesheet.priority}`);
      } else if (applicableRatesheets.some(rs => rs.level === 'SURGE')) {
        console.log(`\n⚠️ [ENGINE] SURGE ratesheet found but did NOT win for ${slot.start.toISOString()}`);
        console.log(`[ENGINE]    Winner: ${selected.ratesheet.name} (${selected.level}, Priority: ${selected.ratesheet.priority}, $${selected.pricePerHour.toFixed(2)}/hr)`);
        const surgeRatesheet = applicableRatesheets.find(rs => rs.level === 'SURGE');
        if (surgeRatesheet) {
          console.log(`[ENGINE]    SURGE: ${surgeRatesheet.ratesheet.name} (Priority: ${surgeRatesheet.ratesheet.priority}, $${surgeRatesheet.pricePerHour.toFixed(2)}/hr)`);
        }
      }

      return {
        startTime: slot.start,
        endTime: slot.end,
        durationHours: slot.durationHours,
        pricePerHour: selected.pricePerHour,
        totalPrice: selected.pricePerHour * slot.durationHours,
        ratesheet: {
          id: selected.ratesheet._id!.toString(),
          name: selected.ratesheet.name,
          type: selected.ratesheet.type,
          priority: selected.ratesheet.priority,
          level: selected.level
        },
        source: 'RATESHEET',
        timeWindow: selected.timeWindow
      };
    }
    
    // Step 3: Fallback to default rates (hierarchy: SubLoc → Loc → Customer)
    const defaultRate = this.getDefaultRate(context);
    
    return {
      startTime: slot.start,
      endTime: slot.end,
      durationHours: slot.durationHours,
      pricePerHour: defaultRate,
      totalPrice: defaultRate * slot.durationHours,
      source: 'DEFAULT_RATE'
    };
  }

  /**
   * Find all applicable ratesheets for a specific hour
   */
  private findApplicableRatesheetsForHour(
    hourStart: Date,
    context: PricingContext
  ): Array<{
    ratesheet: RateSheet;
    pricePerHour: number;
    level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT' | 'SURGE';
    timeWindow?: { start: string; end: string };
  }> {
    const applicable: Array<{
      ratesheet: RateSheet;
      pricePerHour: number;
      level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT' | 'SURGE';
      timeWindow?: { start: string; end: string };
    }> = [];

    // Check all ratesheets (SURGE has highest priority)
    const allRatesheets = [
      ...(context.surgeRatesheets || []).map(rs => ({ rs, level: 'SURGE' as const })),
      ...(context.eventRatesheets || []).map(rs => ({ rs, level: 'EVENT' as const })),
      ...context.sublocationRatesheets.map(rs => ({ rs, level: 'SUBLOCATION' as const })),
      ...context.locationRatesheets.map(rs => ({ rs, level: 'LOCATION' as const })),
      ...context.customerRatesheets.map(rs => ({ rs, level: 'CUSTOMER' as const })),
    ];

    // DEBUG: Log surge ratesheets
    const surgeCount = context.surgeRatesheets?.length || 0;
    if (surgeCount > 0) {
      console.log(`\n🔥 [ENGINE] Evaluating hour ${hourStart.toISOString()}`);
      console.log(`[ENGINE] Found ${surgeCount} SURGE ratesheet(s) in context`);
      context.surgeRatesheets?.forEach((rs, idx) => {
        console.log(`[ENGINE]   ${idx + 1}. ${rs.name} (Priority: ${rs.priority}, Active: ${rs.isActive})`);
        console.log(`[ENGINE]      Type: ${rs.type}, TimeWindows: ${rs.timeWindows?.length || 0}`);
        console.log(`[ENGINE]      EffectiveFrom: ${rs.effectiveFrom}`);
        console.log(`[ENGINE]      EffectiveTo: ${rs.effectiveTo}`);
      });
    }

    for (const { rs, level } of allRatesheets) {
      // Skip inactive ratesheets
      if (!rs.isActive) {
        if (level === 'SURGE') {
          console.log(`[ENGINE] ❌ Skipping SURGE ${rs.name} - inactive`);
        }
        continue;
      }

      // Check date range
      if (!isDateInRange(hourStart, rs.effectiveFrom, rs.effectiveTo || null)) {
        if (level === 'SURGE') {
          console.log(`[ENGINE] ❌ Skipping SURGE ${rs.name} - date range mismatch`);
          console.log(`[ENGINE]    Hour: ${hourStart.toISOString()}`);
          console.log(`[ENGINE]    Range: ${rs.effectiveFrom} → ${rs.effectiveTo}`);
        }
        continue;
      }

      // Check time windows for TIMING_BASED, TIME_WINDOW (legacy alias), and SURGE_MULTIPLIER ratesheets
      if ((rs.type === 'TIMING_BASED' || rs.type === 'TIME_WINDOW' as any || rs.type === 'SURGE_MULTIPLIER') && rs.timeWindows) {
        if (level === 'SURGE') {
          console.log(`[ENGINE] ✓ SURGE ${rs.name} passed date check, checking ${rs.timeWindows.length} time windows`);
        }
        for (const tw of rs.timeWindows) {
          // CRITICAL: For walk-ins (isEventBooking = false), skip grace periods ($0/hr time windows)
          // This allows event rates to apply but excludes free grace periods
          if (context.isEventBooking === false && tw.pricePerHour === 0 && level === 'EVENT') {
            continue; // Skip this $0/hr grace period time window
          }

          // Check daysOfWeek filter - skip this time window if day doesn't match
          // 0=Sunday, 1=Monday, ..., 6=Saturday
          if (tw.daysOfWeek && tw.daysOfWeek.length > 0) {
            const dayOfWeek = hourStart.getDay();
            if (!tw.daysOfWeek.includes(dayOfWeek)) {
              continue; // Skip this time window - day of week doesn't match
            }
          }

          const windowType = tw.windowType || 'ABSOLUTE_TIME';
          let matches = false;

          if (windowType === 'ABSOLUTE_TIME') {
            // For SURGE_MULTIPLIER ratesheets, use UTC time since surge windows are stored in UTC
            // For other ratesheets, use local timezone
            const hourTime = (rs.type === 'SURGE_MULTIPLIER')
              ? `${hourStart.getUTCHours().toString().padStart(2, '0')}:${hourStart.getUTCMinutes().toString().padStart(2, '0')}`
              : getTimeInTimezone(hourStart, context.timezone);
            const hourMinutes = timeToMinutes(hourTime);
            const startMinutes = timeToMinutes(tw.startTime!);
            const endMinutes = timeToMinutes(tw.endTime!);

            // Handle overnight time windows (e.g., 23:00-00:00)
            if (endMinutes < startMinutes) {
              // Overnight window: matches if time >= startTime OR time < endTime
              matches = hourMinutes >= startMinutes || hourMinutes < endMinutes;
            } else {
              // Same-day window: matches if time >= startTime AND time < endTime
              matches = hourMinutes >= startMinutes && hourMinutes < endMinutes;
            }

            // DEBUG: Log time window matching for surge hours near midnight
            if (level === 'SURGE' && (hourMinutes >= 1320 || hourMinutes < 60)) { // 22:00-01:00 range
              console.log(`\n🔍 [SURGE OVERNIGHT CHECK] ${rs.name}`);
              console.log(`   hourStart:`, hourStart.toISOString());
              console.log(`   timezone:`, context.timezone);
              console.log(`   hourTime:`, hourTime, `(${hourMinutes} min)`);
              console.log(`   window:`, tw.startTime, `-`, tw.endTime, `(${startMinutes}-${endMinutes} min)`);
              console.log(`   overnight:`, endMinutes < startMinutes);
              console.log(`   Match result:`, matches);
            }
          } else {
            // Duration-based logic: match against minutes from ratesheet effectiveFrom
            // For EVENT ratesheets, this is the event start minus grace period before

            // CRITICAL: Check if effectiveFrom is a Date object
            const effectiveFromType = typeof rs.effectiveFrom;
            const effectiveFromIsDate = rs.effectiveFrom instanceof Date;

            console.log(`\n🔍 [DURATION_BASED] Checking ${rs.name} (${level})`);
            console.log(`[DURATION_BASED]   effectiveFrom type: ${effectiveFromType}, isDate: ${effectiveFromIsDate}`);
            console.log(`[DURATION_BASED]   effectiveFrom value:`, rs.effectiveFrom);
            console.log(`[DURATION_BASED]   hourStart:`, hourStart.toISOString());

            const minutesFromRatesheetStart = Math.floor((hourStart.getTime() - rs.effectiveFrom.getTime()) / (1000 * 60));
            const startMinute = tw.startMinute ?? 0;
            const endMinute = tw.endMinute ?? 0;

            console.log(`[DURATION_BASED]   MinutesFromStart: ${minutesFromRatesheetStart}`);
            console.log(`[DURATION_BASED]   Window: ${startMinute}-${endMinute}min`);
            console.log(`[DURATION_BASED]   Rate: $${tw.pricePerHour}/hr`);
            console.log(`[DURATION_BASED]   isEventBooking: ${context.isEventBooking}`);

            matches = minutesFromRatesheetStart >= startMinute && minutesFromRatesheetStart < endMinute;

            console.log(`[DURATION_BASED]   ✓ Matches: ${matches}\n`);
          }

          if (matches) {
            if (level === 'SURGE') {
              console.log(`[ENGINE] ✅ SURGE ${rs.name} MATCHED! Adding to applicable list`);
              console.log(`[ENGINE]    Price: $${tw.pricePerHour.toFixed(2)}/hr`);
              console.log(`[ENGINE]    Window: ${tw.startTime} - ${tw.endTime}`);
            }
            applicable.push({
              ratesheet: rs,
              pricePerHour: tw.pricePerHour,
              level,
              timeWindow: windowType === 'ABSOLUTE_TIME'
                ? { start: tw.startTime!, end: tw.endTime! }
                : { start: `${tw.startMinute}m`, end: `${tw.endMinute}m` }
            });
            break; // Found matching window
          } else if (level === 'SURGE') {
            console.log(`[ENGINE] ❌ SURGE ${rs.name} time window ${tw.startTime}-${tw.endTime} did not match`);
          }
        }
      }
      
      // Check packages for PACKAGE_BASED ratesheets
      if (rs.type === 'PACKAGE_BASED' && rs.packages) {
        // For package-based, we need to know total booking duration
        // This is handled separately in package pricing logic
        // For now, skip in hourly evaluation
        continue;
      }
    }
    
    // Sort by hierarchy then priority, then prefer non-zero rates
    return applicable.sort((a, b) => {
      // Level hierarchy: SURGE (5) > EVENT (4) > SUBLOCATION (3) > LOCATION (2) > CUSTOMER (1)
      const levelA = a.level === 'SURGE' ? 5 : a.level === 'EVENT' ? 4 : a.level === 'SUBLOCATION' ? 3 : a.level === 'LOCATION' ? 2 : 1;
      const levelB = b.level === 'SURGE' ? 5 : b.level === 'EVENT' ? 4 : b.level === 'SUBLOCATION' ? 3 : b.level === 'LOCATION' ? 2 : 1;

      if (levelA !== levelB) {
        return levelB - levelA; // Higher level first
      }

      // Same level: higher priority first
      if (b.ratesheet.priority !== a.ratesheet.priority) {
        return b.ratesheet.priority - a.ratesheet.priority;
      }

      // Same priority: prefer non-zero rates over grace periods ($0/hr)
      // This ensures that when events overlap at the same priority,
      // actual event rates take precedence over grace periods from other events
      if (a.pricePerHour === 0 && b.pricePerHour > 0) {
        return 1; // b comes first (non-zero rate wins)
      }
      if (b.pricePerHour === 0 && a.pricePerHour > 0) {
        return -1; // a comes first (non-zero rate wins)
      }

      // Both zero or both non-zero: maintain insertion order (stable sort)
      return 0;
    });
  }

  /**
   * Get default rate from hierarchy (EVENT > SubLocation > Location > Customer)
   */
  private getDefaultRate(context: PricingContext): number {
    return context.eventDefaultRate
      || context.sublocationDefaultRate
      || context.locationDefaultRate
      || context.customerDefaultRate
      || 0;
  }
}
