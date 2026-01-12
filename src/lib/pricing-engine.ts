import { ObjectId } from 'mongodb';
import { 
  Ratesheet, 
  RatesheetRepository, 
  PricingQuery, 
  PricingResult,
} from '@/models/Ratesheet';
import { SubLocationRepository } from '@/models/SubLocation';

interface DecisionLog {
  timeSlot: {
    start: Date;
    end: Date;
    localTime: string;
  };
  candidateRatesheets: Array<{
    id: string;
    name: string;
    priority: number;
    conflictResolution: string;
    price: number;
    reason: string;
    matchedTimeWindow?: string;
  }>;
  winner: {
    id: string;
    name: string;
    price: number;
    reason: string;
    matchedTimeWindow?: string;
  };
  rejectedRatesheets: Array<{
    id: string;
    name: string;
    price: number;
    reason: string;
  }>;
}

interface EnhancedPricingResult extends PricingResult {
  decisionLog: DecisionLog[];
  ratesheetsSummary: {
    totalConsidered: number;
    totalApplied: number;
    ratesheets: Array<{
      id: string;
      name: string;
      timesApplied: number;
      totalRevenue: number;
      priority: number;
    }>;
  };
}

/**
 * Main pricing calculation function - exported for API routes
 */
export async function calculatePricing(
  subLocationId: ObjectId,
  startDateTime: Date,
  endDateTime: Date,
  timezone?: string
): Promise<EnhancedPricingResult> {
  return PricingEngine.calculatePrice({
    subLocationId,
    startDateTime,
    endDateTime
  }, timezone);
}

export class PricingEngine {
  /**
   * Calculate price for a given sublocation and time range with decision audit
   */
  static async calculatePrice(
    query: PricingQuery,
    timezone: string = 'America/New_York'
  ): Promise<EnhancedPricingResult> {
    const { subLocationId, startDateTime, endDateTime } = query;

    console.log('[PricingEngine] Calculating with timezone:', timezone);
    console.log('[PricingEngine] Start:', startDateTime);
    console.log('[PricingEngine] End:', endDateTime);

    // Fetch sublocation
    const sublocation = await SubLocationRepository.findById(subLocationId);
    if (!sublocation) {
      throw new Error('SubLocation not found');
    }

    if (sublocation.pricingEnabled === false) {
      throw new Error('Pricing is not enabled for this SubLocation');
    }

    if (sublocation.isActive === false) {
      throw new Error('This SubLocation is not active');
    }

    // Get ALL ratesheets for this sublocation (we'll filter by time window later)
    const allRatesheets = await RatesheetRepository.findApplicableRatesheets(
      subLocationId,
      sublocation.locationId,
      startDateTime,
      endDateTime
    );

    console.log(`[PricingEngine] Found ${allRatesheets.length} ratesheets in date range`);
    allRatesheets.forEach(rs => {
      console.log(`  - ${rs.name}: priority=${rs.priority}, windows=${rs.timeWindows?.length || 0}`);
    });

    if (allRatesheets.length === 0) {
      if (sublocation.defaultHourlyRate) {
        console.log(`[PricingEngine] Using default rate: $${sublocation.defaultHourlyRate}/hr`);
        return this.calculateDefaultPrice(query, sublocation.defaultHourlyRate, timezone);
      }
      throw new Error('No applicable ratesheets found and no default rate set');
    }

    // Generate hourly time slots
    const timeSlots = this.generateHourlyTimeSlots(startDateTime, endDateTime, timezone);
    console.log(`[PricingEngine] Generated ${timeSlots.length} hourly time slots`);

    // Calculate price for each hourly slot
    const breakdown: PricingResult['breakdown'] = [];
    const decisionLog: DecisionLog[] = [];
    const ratesheetUsage = new Map<string, { name: string; count: number; revenue: number; priority: number }>();
    let totalPrice = 0;

    for (const slot of timeSlots) {
      // For each slot, find ratesheets that:
      // 1. Cover this DATE (effectiveFrom/To)
      // 2. Have a time window that covers this HOUR
      const candidateRatesheets = this.findRatesheetsForTimeSlot(
        allRatesheets,
        slot.start,
        slot.localTime
      );

      console.log(`[PricingEngine] Slot ${slot.localTime} (${slot.hours.toFixed(2)}h): ${candidateRatesheets.length} candidates`);

      if (candidateRatesheets.length === 0) {
        // No matching ratesheet for this time, use default
        if (sublocation.defaultHourlyRate) {
          const subtotal = sublocation.defaultHourlyRate * slot.hours; // ← Use actual hours
          totalPrice += subtotal;

          breakdown.push({
            startDateTime: slot.start,
            endDateTime: slot.end,
            pricePerHour: sublocation.defaultHourlyRate,
            hours: slot.hours, // ← May be fractional
            subtotal,
            ratesheetId: new ObjectId(),
            ratesheetName: 'Default Rate',
            appliedRule: 'No matching time window'
          });

          decisionLog.push({
            timeSlot: slot,
            candidateRatesheets: [],
            winner: {
              id: 'default',
              name: 'Default Rate',
              price: sublocation.defaultHourlyRate,
              reason: 'No ratesheets match this time slot'
            },
            rejectedRatesheets: []
          });
        }
        continue;
      }

      // Resolve conflict and pick winner
      const { winner, candidates, rejected } = this.resolveConflictWithLog(
        candidateRatesheets,
        slot.start,
        slot.localTime
      );

      const pricePerHour = winner.price;
      const subtotal = pricePerHour * slot.hours; // ← Use actual hours (prorated!)

      totalPrice += subtotal;
      breakdown.push({
        startDateTime: slot.start,
        endDateTime: slot.end,
        pricePerHour,
        hours: slot.hours, // ← May be fractional
        subtotal,
        ratesheetId: winner.ratesheet._id!,
        ratesheetName: winner.ratesheet.name,
        appliedRule: winner.matchedWindow || 'Default rule'
      });

      // Track usage
      const ratesheetId = winner.ratesheet._id!.toString();
      if (ratesheetUsage.has(ratesheetId)) {
        const usage = ratesheetUsage.get(ratesheetId)!;
        usage.count++;
        usage.revenue += subtotal;
      } else {
        ratesheetUsage.set(ratesheetId, {
          name: winner.ratesheet.name,
          count: 1,
          revenue: subtotal,
          priority: winner.ratesheet.priority
        });
      }

      // Log decision
      decisionLog.push({
        timeSlot: slot,
        candidateRatesheets: candidates,
        winner: {
          id: ratesheetId,
          name: winner.ratesheet.name,
          price: pricePerHour,
          reason: winner.reason,
          matchedTimeWindow: winner.matchedWindow
        },
        rejectedRatesheets: rejected
      });
    }

    console.log(`[PricingEngine] Total price: $${totalPrice}`);

    // Build summary
    const ratesheetsSummary = {
      totalConsidered: allRatesheets.length,
      totalApplied: ratesheetUsage.size,
      ratesheets: Array.from(ratesheetUsage.entries()).map(([id, usage]) => ({
        id,
        name: usage.name,
        timesApplied: usage.count,
        totalRevenue: usage.revenue,
        priority: usage.priority
      })).sort((a, b) => b.totalRevenue - a.totalRevenue)
    };

    return {
      subLocationId,
      totalPrice,
      breakdown,
      currency: 'USD',
      decisionLog,
      ratesheetsSummary
    };
  }

  /**
   * Generate hourly time slots with local time tracking
   * Handles partial hours at start/end of booking
   */
  private static generateHourlyTimeSlots(
    start: Date,
    end: Date,
    timezone: string
  ): Array<{ start: Date; end: Date; localTime: string; hours: number }> {
    const slots: Array<{ start: Date; end: Date; localTime: string; hours: number }> = [];
    let currentStart = new Date(start);

    while (currentStart < end) {
      const currentEnd = new Date(currentStart);
      currentEnd.setHours(currentEnd.getHours() + 1);

      if (currentEnd > end) {
        currentEnd.setTime(end.getTime());
      }

      // Calculate actual hours for this slot (may be fractional)
      const durationMs = currentEnd.getTime() - currentStart.getTime();
      const hours = durationMs / (1000 * 60 * 60);

      // Get local time in HH:mm format for matching time windows
      const localTime = currentStart.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      slots.push({
        start: new Date(currentStart),
        end: new Date(currentEnd),
        localTime,
        hours // ← Now includes fractional hours (e.g., 0.5 for 30 minutes)
      });

      currentStart = currentEnd;
    }

    return slots;
  }

  /**
   * Find ratesheets that match a specific time slot
   * Must match both DATE range AND TIME window
   */
  private static findRatesheetsForTimeSlot(
    ratesheets: Ratesheet[],
    slotDateTime: Date,
    slotLocalTime: string
  ): Array<{ ratesheet: Ratesheet; price: number; matchedWindow: string }> {
    const candidates: Array<{ ratesheet: Ratesheet; price: number; matchedWindow: string }> = [];

    for (const rs of ratesheets) {
      // Check if ratesheet covers this DATE
      if (rs.effectiveFrom > slotDateTime) continue;
      if (rs.effectiveTo && rs.effectiveTo < slotDateTime) continue;

      // Check recurrence if applicable
      if (rs.recurrence && !this.matchesRecurrence(rs.recurrence, slotDateTime)) {
        continue;
      }

      // Check if any time window covers this HOUR
      if (rs.type === 'TIMING_BASED' && rs.timeWindows) {
        for (const tw of rs.timeWindows) {
          if (this.timeInWindow(slotLocalTime, tw.startTime, tw.endTime)) {
            candidates.push({
              ratesheet: rs,
              price: tw.pricePerHour,
              matchedWindow: `${tw.startTime} - ${tw.endTime} @ $${tw.pricePerHour}/hr`
            });
            break; // Only match one window per ratesheet per slot
          }
        }
      } else if (rs.type === 'DURATION_BASED' && rs.durationRules && rs.durationRules.length > 0) {
        // For duration-based, use the first rule's effective hourly rate
        const rule = rs.durationRules[0];
        const pricePerHour = rule.totalPrice / rule.durationHours;
        candidates.push({
          ratesheet: rs,
          price: pricePerHour,
          matchedWindow: rule.description || `${rule.durationHours}h package`
        });
      }
    }

    return candidates;
  }

  /**
   * Check if time is within a window (HH:mm format)
   */
  private static timeInWindow(time: string, windowStart: string, windowEnd: string): boolean {
    // All times in HH:mm format (e.g., "09:00", "17:00")
    return time >= windowStart && time < windowEnd;
  }

  /**
   * Check if date matches recurrence pattern
   */
  private static matchesRecurrence(
    recurrence: Ratesheet['recurrence'],
    date: Date
  ): boolean {
    if (!recurrence || recurrence.pattern === 'NONE') return true;

    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const dayOfMonth = date.getDate();

    switch (recurrence.pattern) {
      case 'DAILY':
        return true;
      case 'WEEKLY':
        return recurrence.daysOfWeek?.includes(dayOfWeek as any) || false;
      case 'MONTHLY':
        return dayOfMonth === recurrence.dayOfMonth;
      case 'YEARLY':
        return true;
      default:
        return true;
    }
  }

  /**
   * Resolve conflict with detailed logging
   */
  private static resolveConflictWithLog(
    candidates: Array<{ ratesheet: Ratesheet; price: number; matchedWindow: string }>,
    slotDateTime: Date,
    slotLocalTime: string
  ): {
    winner: { ratesheet: Ratesheet; price: number; reason: string; matchedWindow: string };
    candidates: Array<{ id: string; name: string; priority: number; conflictResolution: string; price: number; reason: string; matchedTimeWindow: string }>;
    rejected: Array<{ id: string; name: string; price: number; reason: string }>;
  } {
    if (candidates.length === 1) {
      const c = candidates[0];
      return {
        winner: {
          ratesheet: c.ratesheet,
          price: c.price,
          reason: 'Only ratesheet matching this time slot',
          matchedWindow: c.matchedWindow
        },
        candidates: [{
          id: c.ratesheet._id!.toString(),
          name: c.ratesheet.name,
          priority: c.ratesheet.priority,
          conflictResolution: c.ratesheet.conflictResolution,
          price: c.price,
          reason: 'Only candidate',
          matchedTimeWindow: c.matchedWindow
        }],
        rejected: []
      };
    }

    // Log all candidates
    const candidateLog = candidates.map(c => ({
      id: c.ratesheet._id!.toString(),
      name: c.ratesheet.name,
      priority: c.ratesheet.priority,
      conflictResolution: c.ratesheet.conflictResolution,
      price: c.price,
      reason: 'Candidate',
      matchedTimeWindow: c.matchedWindow
    }));

    // Sort by priority (descending)
    const sortedCandidates = [...candidates].sort((a, b) => b.ratesheet.priority - a.ratesheet.priority);

    // Use conflict resolution strategy
    const primaryStrategy = sortedCandidates[0].ratesheet.conflictResolution;
    let winner: typeof candidates[0];
    let winReason: string;

    switch (primaryStrategy) {
      case 'PRIORITY':
        winner = sortedCandidates[0];
        winReason = `Highest priority (${winner.ratesheet.priority})`;
        break;

      case 'HIGHEST_PRICE':
        winner = candidates.reduce((max, curr) => curr.price > max.price ? curr : max);
        winReason = `Highest price ($${winner.price}/hr)`;
        break;

      case 'LOWEST_PRICE':
        winner = candidates.reduce((min, curr) => curr.price < min.price ? curr : min);
        winReason = `Lowest price ($${winner.price}/hr)`;
        break;

      default:
        winner = sortedCandidates[0];
        winReason = 'Default to priority';
    }

    // Build rejected list
    const rejected = candidates
      .filter(c => c.ratesheet._id!.toString() !== winner.ratesheet._id!.toString())
      .map(c => {
        let reason = '';
        if (primaryStrategy === 'PRIORITY') {
          reason = `Lower priority (${c.ratesheet.priority} vs ${winner.ratesheet.priority})`;
        } else if (primaryStrategy === 'HIGHEST_PRICE') {
          reason = `Lower price ($${c.price}/hr vs $${winner.price}/hr)`;
        } else if (primaryStrategy === 'LOWEST_PRICE') {
          reason = `Higher price ($${c.price}/hr vs $${winner.price}/hr)`;
        }
        return {
          id: c.ratesheet._id!.toString(),
          name: c.ratesheet.name,
          price: c.price,
          reason
        };
      });

    return {
      winner: {
        ratesheet: winner.ratesheet,
        price: winner.price,
        reason: winReason,
        matchedWindow: winner.matchedWindow
      },
      candidates: candidateLog,
      rejected
    };
  }

  /**
   * Calculate default price
   */
  private static calculateDefaultPrice(
    query: PricingQuery,
    defaultRate: number,
    timezone: string
  ): EnhancedPricingResult {
    const slots = this.generateHourlyTimeSlots(query.startDateTime, query.endDateTime, timezone);
    const totalPrice = slots.length * defaultRate;

    return {
      subLocationId: query.subLocationId,
      totalPrice,
      breakdown: slots.map(slot => ({
        startDateTime: slot.start,
        endDateTime: slot.end,
        pricePerHour: defaultRate,
        hours: 1.0,
        subtotal: defaultRate,
        ratesheetId: new ObjectId(),
        ratesheetName: 'Default Rate',
        appliedRule: 'Default hourly rate'
      })),
      currency: 'USD',
      decisionLog: slots.map(slot => ({
        timeSlot: slot,
        candidateRatesheets: [],
        winner: {
          id: 'default',
          name: 'Default Rate',
          price: defaultRate,
          reason: 'No approved ratesheets found'
        },
        rejectedRatesheets: []
      })),
      ratesheetsSummary: {
        totalConsidered: 0,
        totalApplied: 0,
        ratesheets: []
      }
    };
  }
}

export default PricingEngine;
