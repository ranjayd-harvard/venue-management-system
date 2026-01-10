import { ObjectId } from 'mongodb';
import { 
  Ratesheet, 
  RatesheetRepository, 
  PricingQuery, 
  PricingResult,
  TimeWindow,
  DurationRule,
  ConflictResolution
} from '@/models/Ratesheet';
import { SubLocationRepository } from '@/models/SubLocation';

interface TimeSlot {
  startDateTime: Date;
  endDateTime: Date;
  applicableRatesheets: Ratesheet[];
}

export class PricingEngine {
  /**
   * Calculate price for a given sublocation and time range
   */
  static async calculatePrice(query: PricingQuery): Promise<PricingResult> {
    const { subLocationId, startDateTime, endDateTime } = query;

    // Fetch sublocation to get location ID and check if pricing is enabled
    const sublocation = await SubLocationRepository.findById(subLocationId);
    if (!sublocation) {
      throw new Error('SubLocation not found');
    }

    if (!sublocation.pricingEnabled || !sublocation.isActive) {
      throw new Error('Pricing is not enabled for this SubLocation');
    }

    // Get all applicable ratesheets
    const ratesheets = await RatesheetRepository.findApplicableRatesheets(
      subLocationId,
      sublocation.locationId,
      startDateTime
    );

    if (ratesheets.length === 0) {
      // No ratesheets found, use default rate if available
      if (sublocation.defaultHourlyRate) {
        return this.calculateDefaultPrice(query, sublocation.defaultHourlyRate);
      }
      throw new Error('No applicable ratesheets found and no default rate set');
    }

    // Split the time range into hourly slots
    const timeSlots = this.generateTimeSlots(startDateTime, endDateTime);

    // Calculate price for each time slot
    const breakdown: PricingResult['breakdown'] = [];
    let totalPrice = 0;

    for (const slot of timeSlots) {
      const slotRatesheets = this.filterRatesheetsForSlot(ratesheets, slot.startDateTime);
      
      if (slotRatesheets.length === 0) {
        // Use default rate for this slot
        if (sublocation.defaultHourlyRate) {
          const hours = this.calculateHours(slot.startDateTime, slot.endDateTime);
          const subtotal = sublocation.defaultHourlyRate * hours;
          totalPrice += subtotal;
          
          breakdown.push({
            startDateTime: slot.startDateTime,
            endDateTime: slot.endDateTime,
            pricePerHour: sublocation.defaultHourlyRate,
            hours,
            subtotal,
            ratesheetId: new ObjectId(), // Placeholder for default
            ratesheetName: 'Default Rate',
            appliedRule: 'Default hourly rate'
          });
        }
        continue;
      }

      // Resolve conflicts and pick the winning ratesheet
      const winningRatesheet = this.resolveConflict(slotRatesheets);
      
      // Calculate price for this slot using the winning ratesheet
      const slotPrice = this.calculateSlotPrice(
        winningRatesheet,
        slot.startDateTime,
        slot.endDateTime
      );

      totalPrice += slotPrice.subtotal;
      breakdown.push({
        ...slotPrice,
        ratesheetId: winningRatesheet._id!,
        ratesheetName: winningRatesheet.name
      });
    }

    return {
      subLocationId,
      totalPrice,
      breakdown,
      currency: 'USD' // TODO: Make this configurable
    };
  }

  /**
   * Generate hourly time slots from start to end
   */
  private static generateTimeSlots(start: Date, end: Date): TimeSlot[] {
    const slots: TimeSlot[] = [];
    let currentSlotStart = new Date(start);

    while (currentSlotStart < end) {
      const currentSlotEnd = new Date(currentSlotStart);
      currentSlotEnd.setHours(currentSlotEnd.getHours() + 1);

      // Don't go beyond the end time
      if (currentSlotEnd > end) {
        currentSlotEnd.setTime(end.getTime());
      }

      slots.push({
        startDateTime: new Date(currentSlotStart),
        endDateTime: new Date(currentSlotEnd),
        applicableRatesheets: []
      });

      currentSlotStart = currentSlotEnd;
    }

    return slots;
  }

  /**
   * Filter ratesheets that apply to a specific time slot
   */
  private static filterRatesheetsForSlot(
    ratesheets: Ratesheet[],
    slotTime: Date
  ): Ratesheet[] {
    return ratesheets.filter(rs => {
      // Check effective date range
      if (rs.effectiveFrom > slotTime) return false;
      if (rs.effectiveTo && rs.effectiveTo < slotTime) return false;

      // Check recurrence pattern
      if (rs.recurrence) {
        return this.matchesRecurrence(rs.recurrence, slotTime);
      }

      return true;
    });
  }

  /**
   * Check if a date matches a recurrence pattern
   */
  private static matchesRecurrence(
    recurrence: Ratesheet['recurrence'],
    date: Date
  ): boolean {
    if (!recurrence || recurrence.pattern === 'NONE') return true;

    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

    switch (recurrence.pattern) {
      case 'DAILY':
        return true;
      
      case 'WEEKLY':
        return recurrence.daysOfWeek?.includes(dayOfWeek as any) || false;
      
      case 'MONTHLY':
        return date.getDate() === recurrence.dayOfMonth;
      
      case 'YEARLY':
        // Check if month and day match
        return true; // TODO: Implement proper yearly recurrence
      
      case 'CUSTOM':
        // TODO: Implement cron-like expression parsing
        return true;
      
      default:
        return true;
    }
  }

  /**
   * Resolve conflicts when multiple ratesheets apply
   */
  private static resolveConflict(ratesheets: Ratesheet[]): Ratesheet {
    if (ratesheets.length === 1) return ratesheets[0];

    // Group by conflict resolution strategy
    const primaryStrategy = ratesheets[0].conflictResolution;

    switch (primaryStrategy) {
      case 'PRIORITY':
        // Already sorted by priority (descending), return first
        return ratesheets[0];

      case 'HIGHEST_PRICE':
        return this.selectByPrice(ratesheets, 'HIGHEST');

      case 'LOWEST_PRICE':
        return this.selectByPrice(ratesheets, 'LOWEST');

      default:
        return ratesheets[0]; // Fallback to priority
    }
  }

  /**
   * Select ratesheet by price (highest or lowest)
   */
  private static selectByPrice(
    ratesheets: Ratesheet[],
    mode: 'HIGHEST' | 'LOWEST'
  ): Ratesheet {
    let selected = ratesheets[0];
    let selectedPrice = this.getAveragePrice(ratesheets[0]);

    for (let i = 1; i < ratesheets.length; i++) {
      const currentPrice = this.getAveragePrice(ratesheets[i]);
      
      if (mode === 'HIGHEST' && currentPrice > selectedPrice) {
        selected = ratesheets[i];
        selectedPrice = currentPrice;
      } else if (mode === 'LOWEST' && currentPrice < selectedPrice) {
        selected = ratesheets[i];
        selectedPrice = currentPrice;
      }
    }

    return selected;
  }

  /**
   * Get average price from a ratesheet (for comparison)
   */
  private static getAveragePrice(ratesheet: Ratesheet): number {
    if (ratesheet.type === 'TIMING_BASED' && ratesheet.timeWindows) {
      const prices = ratesheet.timeWindows.map(tw => tw.pricePerHour);
      return prices.reduce((a, b) => a + b, 0) / prices.length;
    }

    if (ratesheet.type === 'DURATION_BASED' && ratesheet.durationRules) {
      const prices = ratesheet.durationRules.map(dr => dr.totalPrice / dr.durationHours);
      return prices.reduce((a, b) => a + b, 0) / prices.length;
    }

    return 0;
  }

  /**
   * Calculate price for a specific slot using a ratesheet
   */
  private static calculateSlotPrice(
    ratesheet: Ratesheet,
    startDateTime: Date,
    endDateTime: Date
  ): Omit<PricingResult['breakdown'][0], 'ratesheetId' | 'ratesheetName'> {
    const hours = this.calculateHours(startDateTime, endDateTime);
    const slotTime = startDateTime.toTimeString().slice(0, 5); // HH:mm

    if (ratesheet.type === 'TIMING_BASED' && ratesheet.timeWindows) {
      // Find matching time window
      const matchingWindow = ratesheet.timeWindows.find(tw => 
        this.timeInWindow(slotTime, tw.startTime, tw.endTime)
      );

      if (matchingWindow) {
        return {
          startDateTime,
          endDateTime,
          pricePerHour: matchingWindow.pricePerHour,
          hours,
          subtotal: matchingWindow.pricePerHour * hours,
          appliedRule: `${tw.startTime} - ${tw.endTime} @ $${matchingWindow.pricePerHour}/hr`
        };
      }
    }

    if (ratesheet.type === 'DURATION_BASED' && ratesheet.durationRules) {
      // For duration-based, find the closest matching rule
      const rule = ratesheet.durationRules[0]; // TODO: Better matching logic
      const pricePerHour = rule.totalPrice / rule.durationHours;

      return {
        startDateTime,
        endDateTime,
        pricePerHour,
        hours,
        subtotal: pricePerHour * hours,
        appliedRule: rule.description || `${rule.durationHours}-hour package`
      };
    }

    // Fallback
    return {
      startDateTime,
      endDateTime,
      pricePerHour: 0,
      hours,
      subtotal: 0,
      appliedRule: 'No matching rule'
    };
  }

  /**
   * Check if a time falls within a window
   */
  private static timeInWindow(time: string, start: string, end: string): boolean {
    return time >= start && time < end;
  }

  /**
   * Calculate hours between two dates
   */
  private static calculateHours(start: Date, end: Date): number {
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Calculate price using default hourly rate
   */
  private static calculateDefaultPrice(
    query: PricingQuery,
    defaultRate: number
  ): PricingResult {
    const hours = this.calculateHours(query.startDateTime, query.endDateTime);
    const subtotal = defaultRate * hours;

    return {
      subLocationId: query.subLocationId,
      totalPrice: subtotal,
      breakdown: [{
        startDateTime: query.startDateTime,
        endDateTime: query.endDateTime,
        pricePerHour: defaultRate,
        hours,
        subtotal,
        ratesheetId: new ObjectId(),
        ratesheetName: 'Default Rate',
        appliedRule: 'Default hourly rate'
      }],
      currency: 'USD'
    };
  }
}
