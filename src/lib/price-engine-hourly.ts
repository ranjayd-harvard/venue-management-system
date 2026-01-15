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
    level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
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
  
  // Ratesheets (all levels)
  customerRatesheets: RateSheet[];
  locationRatesheets: RateSheet[];
  sublocationRatesheets: RateSheet[];
  
  // Default rates (fallback)
  customerDefaultRate?: number;
  locationDefaultRate?: number;
  sublocationDefaultRate?: number;
  
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
    
    // Step 2: If ratesheets found, use highest priority
    if (applicableRatesheets.length > 0) {
      const selected = applicableRatesheets[0]; // Already sorted by priority
      
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
    level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
    timeWindow?: { start: string; end: string };
  }> {
    const applicable: Array<{
      ratesheet: RateSheet;
      pricePerHour: number;
      level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
      timeWindow?: { start: string; end: string };
    }> = [];
    
    // Check all ratesheets
    const allRatesheets = [
      ...context.sublocationRatesheets.map(rs => ({ rs, level: 'SUBLOCATION' as const })),
      ...context.locationRatesheets.map(rs => ({ rs, level: 'LOCATION' as const })),
      ...context.customerRatesheets.map(rs => ({ rs, level: 'CUSTOMER' as const })),
    ];
    
    for (const { rs, level } of allRatesheets) {
      // Skip inactive ratesheets
      if (!rs.isActive) continue;
      
      // Check date range
      if (!isDateInRange(hourStart, rs.effectiveFrom, rs.effectiveTo || null)) {
        continue;
      }
      
      // Check time windows for TIMING_BASED ratesheets
      if (rs.type === 'TIMING_BASED' && rs.timeWindows) {
        const hourTime = getTimeInTimezone(hourStart, context.timezone);
        const hourMinutes = timeToMinutes(hourTime);
        
        for (const tw of rs.timeWindows) {
          const startMinutes = timeToMinutes(tw.startTime);
          const endMinutes = timeToMinutes(tw.endTime);
          
          if (hourMinutes >= startMinutes && hourMinutes < endMinutes) {
            applicable.push({
              ratesheet: rs,
              pricePerHour: tw.pricePerHour,
              level,
              timeWindow: { start: tw.startTime, end: tw.endTime }
            });
            break; // Found matching window
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
    
    // Sort by hierarchy then priority
    return applicable.sort((a, b) => {
      // Level hierarchy: SUBLOCATION (3) > LOCATION (2) > CUSTOMER (1)
      const levelA = a.level === 'SUBLOCATION' ? 3 : a.level === 'LOCATION' ? 2 : 1;
      const levelB = b.level === 'SUBLOCATION' ? 3 : b.level === 'LOCATION' ? 2 : 1;
      
      if (levelA !== levelB) {
        return levelB - levelA; // Higher level first
      }
      
      // Same level: higher priority first
      return b.ratesheet.priority - a.ratesheet.priority;
    });
  }

  /**
   * Get default rate from hierarchy
   */
  private getDefaultRate(context: PricingContext): number {
    return context.sublocationDefaultRate 
      || context.locationDefaultRate 
      || context.customerDefaultRate 
      || 0;
  }
}
