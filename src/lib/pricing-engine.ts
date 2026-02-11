// src/lib/pricing-engine.ts
// 🔧 FIXED VERSION: Ratesheets ALWAYS override default rates

import { ObjectId } from 'mongodb';

interface TimeWindow {
  startTime: string;
  endTime: string;
  pricePerHour: number;
}

interface DurationRule {
  durationHours: number;
  totalPrice: number;
  description: string;
}

interface Ratesheet {
  _id: ObjectId | string;
  subLocationId?: ObjectId | string;
  locationId?: ObjectId | string;
  customerId?: ObjectId | string;
  eventId?: ObjectId | string;
  name: string;
  description?: string;
  type: 'TIMING_BASED' | 'DURATION_BASED' | 'SURGE_MULTIPLIER';
  priority: number;
  conflictResolution: 'PRIORITY' | 'HIGHEST_PRICE' | 'LOWEST_PRICE';
  isActive: boolean;
  effectiveFrom: Date | string;
  effectiveTo?: Date | string;
  timeWindows?: TimeWindow[];
  durationRules?: DurationRule[];
  surgeMultiplierSnapshot?: number;
}

interface DefaultRate {
  level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
  hourlyRate: number;
  entityId: string;
}

interface PricingContext {
  customerId: string;
  locationId: string;
  subLocationId: string;
  eventId?: string;
  startDateTime: Date;
  endDateTime: Date;
}

interface DecisionLogEntry {
  timestamp: string;
  step: string;
  action: string;
  details: any;
  result?: any;
}

interface PricingBreakdown {
  startDateTime: string;
  endDateTime: string;
  pricePerHour: number;
  hours: number;
  subtotal: number;
  ratesheetId: string;
  ratesheetName: string;
  appliedRule: string;
}

interface PricingResult {
  totalPrice: number;
  breakdown: PricingBreakdown[];
  currency: string;
  decisionLog: DecisionLogEntry[];
  ratesheetsSummary: {
    total: number;
    evaluated: number;
    applicable: number;
    selected: number;
  };
}

/**
 * 🔧 CRITICAL FIX: Ratesheets now ALWAYS override default rates
 *
 * PRIORITY ORDER (FIXED):
 * 1. ANY active ratesheet (Event/SubLocation/Location/Customer) - by hierarchy and priority
 * 2. Default rates (ONLY if NO ratesheets found) - by hierarchy
 *
 * HIERARCHY (Highest to Lowest):
 * - EVENT: 4000-4999 (Overrides all other levels for specific events)
 * - SUBLOCATION: 3000-3999
 * - LOCATION: 2000-2999
 * - CUSTOMER: 1000-1999
 *
 * BUG FIX: Default rates at SubLocation level were overriding Customer-level ratesheets
 * NEW: Ratesheets ALWAYS win, defaults are true fallback
 */
export class PricingEngine {
  private decisionLog: DecisionLogEntry[] = [];

  private log(step: string, action: string, details: any, result?: any) {
    this.decisionLog.push({
      timestamp: new Date().toISOString(),
      step,
      action,
      details,
      result,
    });
  }

  /**
   * Main calculation method
   */
  async calculatePrice(
    context: PricingContext,
    ratesheets: Ratesheet[],
    defaultRates: DefaultRate[]
  ): Promise<PricingResult> {
    this.decisionLog = [];
    this.log('START', 'Begin pricing calculation', {
      context,
      availableRatesheets: ratesheets.length,
      availableDefaultRates: defaultRates.length,
    });

    // Step 1: Filter active ratesheets
    const activeRatesheets = ratesheets.filter(rs => rs.isActive);
    this.log('FILTER', 'Filter active ratesheets', {
      total: ratesheets.length,
      active: activeRatesheets.length,
      inactive: ratesheets.length - activeRatesheets.length,
    });

    // Step 2: Find applicable ratesheets (by date range and entity)
    const applicableRatesheets = this.filterApplicableRatesheets(
      activeRatesheets,
      context
    );

    this.log('APPLICABLE', 'Found applicable ratesheets', {
      count: applicableRatesheets.length,
      ratesheets: applicableRatesheets.map(rs => ({
        name: rs.name,
        type: this.getRatesheetLevel(rs),
        priority: rs.priority,
      })),
    });

    // Step 3: 🔥 KEY FIX - Try ratesheets FIRST
    if (applicableRatesheets.length > 0) {
      this.log('DECISION', 'Ratesheets found - using ratesheet pricing', {
        message: 'Ignoring default rates (ratesheets take precedence)',
        count: applicableRatesheets.length,
      });
      
      return this.calculateWithRatesheets(context, applicableRatesheets);
    }

    // Step 4: 🔥 FALLBACK - Only use default rates if NO ratesheets
    this.log('DECISION', 'No ratesheets found - falling back to default rates', {
      message: 'Using default rate hierarchy',
    });

    return this.calculateWithDefaultRates(context, defaultRates);
  }

  /**
   * Filter ratesheets that apply to the booking
   */
  private filterApplicableRatesheets(
    ratesheets: Ratesheet[],
    context: PricingContext
  ): Ratesheet[] {
    const applicable: Ratesheet[] = [];

    for (const rs of ratesheets) {
      // Check entity match
      const entityMatch = this.checkEntityMatch(rs, context);
      if (!entityMatch) {
        this.log('FILTER', 'Ratesheet entity mismatch', {
          ratesheet: rs.name,
          reason: 'Does not apply to selected customer/location/sublocation',
        });
        continue;
      }

      // Check date range
      const effectiveFrom = new Date(rs.effectiveFrom);
      const effectiveTo = rs.effectiveTo ? new Date(rs.effectiveTo) : null;

      const bookingStart = context.startDateTime;
      const bookingEnd = context.endDateTime;

      // Check if booking overlaps with ratesheet validity period
      const isValidFrom = bookingStart >= effectiveFrom || bookingEnd >= effectiveFrom;
      const isValidTo = !effectiveTo || bookingStart <= effectiveTo;

      if (!isValidFrom || !isValidTo) {
        this.log('FILTER', 'Ratesheet date range mismatch', {
          ratesheet: rs.name,
          effectiveFrom: effectiveFrom.toISOString(),
          effectiveTo: effectiveTo?.toISOString() || 'indefinite',
          bookingStart: bookingStart.toISOString(),
          bookingEnd: bookingEnd.toISOString(),
          reason: 'Booking outside ratesheet validity period',
        });
        continue;
      }

      this.log('FILTER', 'Ratesheet applicable', {
        ratesheet: rs.name,
        level: this.getRatesheetLevel(rs),
        priority: rs.priority,
      });

      applicable.push(rs);
    }

    return applicable;
  }

  /**
   * Check if ratesheet applies to the given entity hierarchy
   */
  private checkEntityMatch(rs: Ratesheet, context: PricingContext): boolean {
    // Event-specific ratesheet (highest priority)
    if (rs.eventId) {
      return context.eventId !== undefined && rs.eventId.toString() === context.eventId;
    }

    // SubLocation-specific ratesheet
    if (rs.subLocationId) {
      return rs.subLocationId.toString() === context.subLocationId;
    }

    // Location-specific ratesheet
    if (rs.locationId) {
      return rs.locationId.toString() === context.locationId;
    }

    // Customer-wide ratesheet
    if (rs.customerId) {
      return rs.customerId.toString() === context.customerId;
    }

    return false;
  }

  /**
   * Get ratesheet hierarchy level
   */
  private getRatesheetLevel(rs: Ratesheet): 'EVENT' | 'SUBLOCATION' | 'LOCATION' | 'CUSTOMER' {
    if (rs.eventId) return 'EVENT';
    if (rs.subLocationId) return 'SUBLOCATION';
    if (rs.locationId) return 'LOCATION';
    return 'CUSTOMER';
  }

  /**
   * Calculate pricing using ratesheets
   */
  private async calculateWithRatesheets(
    context: PricingContext,
    applicableRatesheets: Ratesheet[]
  ): Promise<PricingResult> {
    // Sort by hierarchy and priority
    const sorted = this.sortRatesheetsByPriority(applicableRatesheets);

    this.log('SORT', 'Sorted ratesheets by priority', {
      order: sorted.map(rs => ({
        name: rs.name,
        level: this.getRatesheetLevel(rs),
        priority: rs.priority,
      })),
    });

    // Generate hourly breakdown
    const breakdown: PricingBreakdown[] = [];
    let currentTime = new Date(context.startDateTime);
    const endTime = new Date(context.endDateTime);

    while (currentTime < endTime) {
      const nextHour = new Date(currentTime.getTime() + 60 * 60 * 1000);
      const segmentEnd = nextHour > endTime ? endTime : nextHour;
      
      const hours = (segmentEnd.getTime() - currentTime.getTime()) / (1000 * 60 * 60);

      // Select best ratesheet for this time segment
      const { ratesheet, price } = this.selectRatesheetForTimeSegment(
        sorted,
        currentTime,
        segmentEnd
      );

      breakdown.push({
        startDateTime: currentTime.toISOString(),
        endDateTime: segmentEnd.toISOString(),
        pricePerHour: price,
        hours: parseFloat(hours.toFixed(2)),
        subtotal: parseFloat((price * hours).toFixed(2)),
        ratesheetId: ratesheet._id.toString(),
        ratesheetName: ratesheet.name,
        appliedRule: `${this.getRatesheetLevel(ratesheet)} Priority ${ratesheet.priority}`,
      });

      currentTime = nextHour;
    }

    const totalPrice = breakdown.reduce((sum, b) => sum + b.subtotal, 0);

    return {
      totalPrice: parseFloat(totalPrice.toFixed(2)),
      breakdown,
      currency: 'USD',
      decisionLog: this.decisionLog,
      ratesheetsSummary: {
        total: applicableRatesheets.length,
        evaluated: applicableRatesheets.length,
        applicable: applicableRatesheets.length,
        selected: breakdown.length,
      },
    };
  }

  /**
   * Calculate pricing using default rates (fallback only)
   */
  private async calculateWithDefaultRates(
    context: PricingContext,
    defaultRates: DefaultRate[]
  ): Promise<PricingResult> {
    // Find best default rate by hierarchy (Event > SubLocation > Location > Customer)
    let selectedRate: DefaultRate | undefined;

    if (context.eventId) {
      selectedRate = defaultRates.find(
        r => r.level === 'EVENT' && r.entityId === context.eventId
      );
    }

    if (!selectedRate) {
      selectedRate = defaultRates.find(
        r => r.level === 'SUBLOCATION' && r.entityId === context.subLocationId
      );
    }

    if (!selectedRate) {
      selectedRate = defaultRates.find(
        r => r.level === 'LOCATION' && r.entityId === context.locationId
      );
    }

    if (!selectedRate) {
      selectedRate = defaultRates.find(
        r => r.level === 'CUSTOMER' && r.entityId === context.customerId
      );
    }

    if (!selectedRate) {
      throw new Error('No default rates configured');
    }

    this.log('DEFAULT_RATE', 'Using default rate', {
      level: selectedRate.level,
      rate: selectedRate.hourlyRate,
      reason: 'No applicable ratesheets found',
    });

    const hours =
      (context.endDateTime.getTime() - context.startDateTime.getTime()) / (1000 * 60 * 60);
    const totalPrice = selectedRate.hourlyRate * hours;

    return {
      totalPrice: parseFloat(totalPrice.toFixed(2)),
      breakdown: [
        {
          startDateTime: context.startDateTime.toISOString(),
          endDateTime: context.endDateTime.toISOString(),
          pricePerHour: selectedRate.hourlyRate,
          hours: parseFloat(hours.toFixed(2)),
          subtotal: parseFloat(totalPrice.toFixed(2)),
          ratesheetId: 'default',
          ratesheetName: 'Default Rate',
          appliedRule: `${selectedRate.level} Default`,
        },
      ],
      currency: 'USD',
      decisionLog: this.decisionLog,
      ratesheetsSummary: {
        total: 0,
        evaluated: 0,
        applicable: 0,
        selected: 0,
      },
    };
  }

  /**
   * Sort ratesheets by hierarchy and priority
   */
  private sortRatesheetsByPriority(ratesheets: Ratesheet[]): Ratesheet[] {
    return [...ratesheets].sort((a, b) => {
      // First, sort by hierarchy level (Event > SubLocation > Location > Customer)
      const levelA = this.getRatesheetLevel(a);
      const levelB = this.getRatesheetLevel(b);

      const levelPriority = { EVENT: 4, SUBLOCATION: 3, LOCATION: 2, CUSTOMER: 1 };
      if (levelPriority[levelA] !== levelPriority[levelB]) {
        return levelPriority[levelB] - levelPriority[levelA];
      }

      // Within same level, sort by priority (higher first)
      return b.priority - a.priority;
    });
  }

  /**
   * Select best ratesheet for a specific time segment
   * Handles SURGE_MULTIPLIER by applying multiplier to base price
   */
  private selectRatesheetForTimeSegment(
    sortedRatesheets: Ratesheet[],
    startTime: Date,
    endTime: Date
  ): { ratesheet: Ratesheet; price: number } {
    const timeStr = startTime.toTimeString().substring(0, 5); // HH:mm
    let surgeMultiplier: number | null = null;
    let surgeRatesheet: Ratesheet | null = null;

    // First pass: Check for SURGE_MULTIPLIER
    for (const rs of sortedRatesheets) {
      if (rs.type === 'SURGE_MULTIPLIER' && rs.timeWindows) {
        for (const tw of rs.timeWindows) {
          if (timeStr >= tw.startTime && timeStr < tw.endTime) {
            surgeMultiplier = tw.pricePerHour; // This is actually the multiplier
            surgeRatesheet = rs;
            this.log('SURGE_FOUND', 'Found applicable surge multiplier', {
              ratesheet: rs.name,
              timeWindow: `${tw.startTime}-${tw.endTime}`,
              multiplier: surgeMultiplier,
            });
            break;
          }
        }
        if (surgeMultiplier) break;
      }
    }

    // Second pass: Find base price (skip surge ratesheets)
    for (const rs of sortedRatesheets) {
      if (rs.type === 'SURGE_MULTIPLIER') continue; // Skip surge, already processed

      if (rs.type === 'TIMING_BASED' && rs.timeWindows) {
        for (const tw of rs.timeWindows) {
          if (timeStr >= tw.startTime && timeStr < tw.endTime) {
            const basePrice = tw.pricePerHour;
            const finalPrice = surgeMultiplier ? basePrice * surgeMultiplier : basePrice;

            this.log('TIME_MATCH', 'Found matching time window', {
              ratesheet: rs.name,
              timeWindow: `${tw.startTime}-${tw.endTime}`,
              basePrice,
              surgeMultiplier: surgeMultiplier || 1.0,
              finalPrice,
            });

            // Return surge ratesheet if surge is active, otherwise base ratesheet
            return {
              ratesheet: surgeRatesheet || rs,
              price: finalPrice
            };
          }
        }
      }
    }

    // Fallback: No matching time window found
    // Try to find ANY time window from non-surge ratesheets as base price
    let fallbackPrice = 0;
    let fallbackRatesheet: Ratesheet | null = null;

    for (const rs of sortedRatesheets) {
      if (rs.type !== 'SURGE_MULTIPLIER' && rs.timeWindows && rs.timeWindows.length > 0) {
        // Use first available time window from this ratesheet as base
        fallbackPrice = rs.timeWindows[0].pricePerHour;
        fallbackRatesheet = rs;
        break;
      }
    }

    // If still no price found, use a default base rate
    if (fallbackPrice === 0) {
      fallbackPrice = 10; // $10/hr as absolute fallback
      this.log('FALLBACK', 'No ratesheet price found, using default base rate', {
        defaultBaseRate: fallbackPrice,
      });
    }

    const finalPrice = surgeMultiplier ? fallbackPrice * surgeMultiplier : fallbackPrice;

    this.log('FALLBACK', 'No matching time window, using fallback price', {
      ratesheet: fallbackRatesheet?.name || 'default',
      basePrice: fallbackPrice,
      surgeMultiplier: surgeMultiplier || 1.0,
      finalPrice,
    });

    return {
      ratesheet: surgeRatesheet || fallbackRatesheet || sortedRatesheets[0],
      price: finalPrice
    };
  }
}
