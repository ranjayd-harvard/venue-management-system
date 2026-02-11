// src/app/api/capacity/calculate/route.ts
// Capacity calculator using hourly evaluation

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { HourlyCapacityEngine, CapacityContext, HourlyCapacitySegment } from '@/lib/capacity-engine-hourly';
import { TimezoneSettingsRepository } from '@/models/TimezoneSettings';
import { resolveOperatingHoursFromEntities } from '@/lib/operating-hours';

// Allocation breakdown interface
interface AllocationBreakdown {
  totalCapacity: number;
  allocated: {
    total: number;
    transient: number;
    events: number;
    reserved: number;
  };
  unallocated: {
    total: number;
    unavailable: number;
    readyToUse: number;
  };
  percentages: {
    transient: number;
    events: number;
    reserved: number;
    unavailable: number;
    readyToUse: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subLocationId, eventId, startTime, endTime, timezone: requestTimezone } = body;

    if (!subLocationId || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields: subLocationId, startTime, endTime' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Get sublocation
    const sublocation = await db.collection('sublocations').findOne({
      _id: new ObjectId(subLocationId)
    });

    if (!sublocation) {
      return NextResponse.json(
        { error: 'SubLocation not found' },
        { status: 404 }
      );
    }

    // Get location
    const location = await db.collection('locations').findOne({
      _id: new ObjectId(sublocation.locationId)
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Get customer
    const customer = await db.collection('customers').findOne({
      _id: new ObjectId(location.customerId)
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Get timezone (hierarchy: Request → SubLocation → Location → Customer → System)
    const timezone = requestTimezone || await TimezoneSettingsRepository.getTimezoneForEntity(
      'SUBLOCATION',
      subLocationId
    );

    // Fetch all capacity sheets for hierarchy
    const customerCapacitySheets = await db.collection('capacitysheets').find({
      'appliesTo.level': 'CUSTOMER',
      'appliesTo.entityId': new ObjectId(customer._id),
      isActive: true,
      approvalStatus: 'APPROVED'
    }).toArray();

    const locationCapacitySheets = await db.collection('capacitysheets').find({
      'appliesTo.level': 'LOCATION',
      'appliesTo.entityId': new ObjectId(location._id),
      isActive: true,
      approvalStatus: 'APPROVED'
    }).toArray();

    const sublocationCapacitySheets = await db.collection('capacitysheets').find({
      'appliesTo.level': 'SUBLOCATION',
      'appliesTo.entityId': new ObjectId(sublocation._id),
      isActive: true,
      approvalStatus: 'APPROVED'
    }).toArray();

    // Fetch EVENT capacity sheets for ALL active events that overlap with the booking period
    // This ensures event-specific capacity is always applied when booking falls within an event
    const bookingStartDate = new Date(startTime);
    const bookingEndDate = new Date(endTime);

    // Find all active events that overlap with the booking time
    const overlappingEvents = await db.collection('events').find({
      isActive: true,
      // Event must not end before booking starts AND must not start after booking ends
      endDate: { $gte: bookingStartDate },
      startDate: { $lte: bookingEndDate }
    }).toArray();

    // Fetch capacity sheets for all overlapping events
    const eventCapacitySheets = overlappingEvents.length > 0
      ? await db.collection('capacitysheets').find({
          'appliesTo.level': 'EVENT',
          'appliesTo.entityId': { $in: overlappingEvents.map(e => e._id) },
          isActive: true,
          approvalStatus: 'APPROVED'
        }).toArray()
      : [];

    // Get pricing config (for timezone settings)
    let pricingConfig = await db.collection('pricing_configs').findOne({});

    if (!pricingConfig) {
      console.log('⚠️  Pricing config not found, creating default...');

      // Create default config
      const defaultConfig = {
        customerPriorityRange: { min: 1000, max: 1999 },
        locationPriorityRange: { min: 2000, max: 2999 },
        sublocationPriorityRange: { min: 3000, max: 3999 },
        defaultTimezone: 'America/Detroit',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('pricing_configs').insertOne(defaultConfig);
      pricingConfig = defaultConfig;

      console.log('✅ Created default pricing config');
    }

    // Resolve operating hours from entity hierarchy
    const operatingHoursResolution = resolveOperatingHoursFromEntities([
      { name: customer.name, operatingHours: customer.operatingHours },
      { name: location.name, operatingHours: location.operatingHours },
      { name: sublocation.label, operatingHours: sublocation.operatingHours },
    ]);

    // if (operatingHoursResolution.hasOperatingHours) {
    //   console.log(`\n🕐 [CAPACITY API] Operating hours resolved from hierarchy`);
    // }

    // Build capacity context
    const context: CapacityContext = {
      bookingStart: new Date(startTime),
      bookingEnd: new Date(endTime),
      timezone,

      customerId: customer._id.toString(),
      locationId: location._id.toString(),
      subLocationId: sublocation._id.toString(),
      eventId: eventId ? eventId : undefined,

      customerCapacitySheets: customerCapacitySheets as any[],
      locationCapacitySheets: locationCapacitySheets as any[],
      sublocationCapacitySheets: sublocationCapacitySheets as any[],
      eventCapacitySheets: eventCapacitySheets as any[],

      customerDefaultCapacity: {
        min: customer.minCapacity || 0,
        max: customer.maxCapacity || 100,
        default: customer.defaultCapacity || 50,
        allocated: customer.allocatedCapacity || 0,
      },
      locationDefaultCapacity: {
        min: location.minCapacity || 0,
        max: location.maxCapacity || 100,
        default: location.defaultCapacity || 50,
        allocated: location.allocatedCapacity || 0,
      },
      sublocationDefaultCapacity: {
        min: sublocation.minCapacity || 0,
        max: sublocation.maxCapacity || 100,
        default: sublocation.defaultCapacity || 50,
        allocated: sublocation.allocatedCapacity || 0,
      },

      // Include sublocation capacity config for hourly overrides
      sublocationCapacityConfig: sublocation.capacityConfig as any,

      capacityConfig: pricingConfig as any,

      // Operating hours (only if defined in hierarchy)
      operatingHours: operatingHoursResolution.hasOperatingHours ? {
        schedule: operatingHoursResolution.mergedSchedule,
        blackouts: operatingHoursResolution.mergedBlackouts,
      } : undefined,
    };

    // Calculate capacity using hourly engine
    const engine = new HourlyCapacityEngine();
    const result = engine.calculateCapacity(context);

    // Compute allocation breakdown
    const allocationBreakdown = computeAllocationBreakdown(
      result.segments,
      sublocation.capacityConfig?.defaultCapacities,
      sublocation.maxCapacity
    );

    // Enhance segments with per-segment allocation breakdown
    const enhancedSegments = result.segments.map(segment => {
      const segmentBreakdown = computeSegmentBreakdown(
        segment,
        sublocation.capacityConfig?.defaultCapacities
      );
      return {
        ...segment,
        breakdown: segmentBreakdown,
      };
    });

    // Return enhanced result
    return NextResponse.json({
      ...result,
      segments: enhancedSegments,
      allocationBreakdown,
      metadata: {
        customer: customer.name,
        location: location.name,
        sublocation: sublocation.label,
        timezone: result.timezone,
        overlappingEvents: overlappingEvents.map(e => ({
          id: e._id.toString(),
          name: e.name,
          startDate: e.startDate,
          endDate: e.endDate
        })),
        capacitySheetSummary: {
          total: customerCapacitySheets.length + locationCapacitySheets.length + sublocationCapacitySheets.length + eventCapacitySheets.length,
          customer: customerCapacitySheets.length,
          location: locationCapacitySheets.length,
          sublocation: sublocationCapacitySheets.length,
          event: eventCapacitySheets.length
        }
      }
    });

  } catch (error: any) {
    console.error('Capacity calculation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate capacity' },
      { status: 500 }
    );
  }
}

// Compute allocation breakdown from segments or stored defaultCapacities
function computeAllocationBreakdown(
  segments: HourlyCapacitySegment[],
  defaultCapacities?: {
    allocated: { transient: number; events: number; reserved: number };
    unallocated: { unavailable: number; readyToUse: number };
  },
  sublocationMaxCapacity?: number
): AllocationBreakdown {
  // Priority 1: Use stored defaultCapacities if available
  if (defaultCapacities && defaultCapacities.allocated && defaultCapacities.unallocated) {
    const { allocated, unallocated } = defaultCapacities;
    const totalCapacity = sublocationMaxCapacity ||
      (allocated.transient + allocated.events + allocated.reserved + unallocated.unavailable + unallocated.readyToUse);

    const allocatedTotal = allocated.transient + allocated.events + allocated.reserved;
    const unallocatedTotal = unallocated.unavailable + unallocated.readyToUse;

    const safeTotal = totalCapacity > 0 ? totalCapacity : 100;
    const percentages = {
      transient: Math.round((allocated.transient / safeTotal) * 100),
      events: Math.round((allocated.events / safeTotal) * 100),
      reserved: Math.round((allocated.reserved / safeTotal) * 100),
      unavailable: Math.round((unallocated.unavailable / safeTotal) * 100),
      readyToUse: Math.round((unallocated.readyToUse / safeTotal) * 100),
    };

    // Ensure percentages sum to ~100%
    const percentSum = percentages.transient + percentages.events + percentages.reserved + percentages.unavailable + percentages.readyToUse;
    if (percentSum !== 100 && percentSum > 0) {
      percentages.readyToUse += (100 - percentSum);
    }

    return {
      totalCapacity,
      allocated: {
        total: allocatedTotal,
        transient: allocated.transient,
        events: allocated.events,
        reserved: allocated.reserved,
      },
      unallocated: {
        total: unallocatedTotal,
        unavailable: unallocated.unavailable,
        readyToUse: unallocated.readyToUse,
      },
      percentages,
    };
  }

  // Fallback: Compute from segments
  const totalHours = segments.reduce((sum, seg) => sum + seg.durationHours, 0);
  let totalMaxCapacity = 0;
  let eventCapacity = 0;
  let transientCapacity = 0;
  let unavailableCapacity = 0;
  let readyToUseCapacity = 0;

  for (const segment of segments) {
    const weight = segment.durationHours;

    if (segment.source === 'OPERATING_HOURS' && segment.isAvailable === false) {
      const potentialMax = segment.maxCapacity || 100;
      unavailableCapacity += potentialMax * weight;
      totalMaxCapacity += potentialMax * weight;
      continue;
    }

    totalMaxCapacity += segment.maxCapacity * weight;

    if (segment.capacitySheet?.level === 'EVENT') {
      eventCapacity += segment.allocatedCapacity * weight;
    } else {
      transientCapacity += segment.allocatedCapacity * weight;
    }

    readyToUseCapacity += (segment.maxCapacity - segment.allocatedCapacity) * weight;
  }

  const avgTotalCapacity = totalHours > 0 ? Math.round(totalMaxCapacity / totalHours) : (sublocationMaxCapacity || 100);
  const avgEventCapacity = totalHours > 0 ? Math.round(eventCapacity / totalHours) : 0;
  const avgTransientCapacity = totalHours > 0 ? Math.round(transientCapacity / totalHours) : 0;
  const avgUnavailableCapacity = totalHours > 0 ? Math.round(unavailableCapacity / totalHours) : 0;
  const avgReadyToUseCapacity = totalHours > 0 ? Math.round(readyToUseCapacity / totalHours) : 0;

  const allocatedTotal = avgEventCapacity + avgTransientCapacity;
  const unallocatedTotal = avgUnavailableCapacity + avgReadyToUseCapacity;

  const safeTotal = avgTotalCapacity > 0 ? avgTotalCapacity : 100;
  const percentages = {
    transient: Math.round((avgTransientCapacity / safeTotal) * 100),
    events: Math.round((avgEventCapacity / safeTotal) * 100),
    reserved: 0,
    unavailable: Math.round((avgUnavailableCapacity / safeTotal) * 100),
    readyToUse: Math.round((avgReadyToUseCapacity / safeTotal) * 100),
  };

  const percentSum = percentages.transient + percentages.events + percentages.reserved + percentages.unavailable + percentages.readyToUse;
  if (percentSum !== 100 && percentSum > 0) {
    percentages.readyToUse += (100 - percentSum);
  }

  return {
    totalCapacity: avgTotalCapacity,
    allocated: {
      total: allocatedTotal,
      transient: avgTransientCapacity,
      events: avgEventCapacity,
      reserved: 0,
    },
    unallocated: {
      total: unallocatedTotal,
      unavailable: avgUnavailableCapacity,
      readyToUse: avgReadyToUseCapacity,
    },
    percentages,
  };
}

// Per-segment allocation breakdown
// -9 indicates unknown/not applicable for that hour
interface SegmentBreakdown {
  transient: number;
  events: number;
  reserved: number;
  unavailable: number;
  readyToUse: number;
  isOverride: boolean; // true if this hour has specific override values
}

function computeSegmentBreakdown(
  segment: HourlyCapacitySegment,
  defaultCapacities?: {
    allocated: { transient: number; events: number; reserved: number };
    unallocated: { unavailable: number; readyToUse: number };
  }
): SegmentBreakdown {
  const UNKNOWN = -9;

  // If segment is unavailable (outside operating hours or blackout)
  if (segment.source === 'OPERATING_HOURS' && segment.isAvailable === false) {
    return {
      transient: 0,
      events: 0,
      reserved: 0,
      unavailable: segment.maxCapacity || 0,
      readyToUse: 0,
      isOverride: true,
    };
  }

  // If segment has a capacity sheet override
  if (segment.source === 'CAPACITYSHEET' && segment.capacitySheet) {
    const isEventBased = segment.capacitySheet.level === 'EVENT';

    return {
      transient: isEventBased ? 0 : segment.allocatedCapacity,
      events: isEventBased ? segment.allocatedCapacity : 0,
      reserved: UNKNOWN, // Reserved not tracked per-hour
      unavailable: 0,
      readyToUse: segment.availableCapacity,
      isOverride: true,
    };
  }

  // Use default capacities if available
  if (defaultCapacities && defaultCapacities.allocated && defaultCapacities.unallocated) {
    return {
      transient: defaultCapacities.allocated.transient,
      events: defaultCapacities.allocated.events,
      reserved: defaultCapacities.allocated.reserved,
      unavailable: defaultCapacities.unallocated.unavailable,
      readyToUse: defaultCapacities.unallocated.readyToUse,
      isOverride: false,
    };
  }

  // Fallback: derive from segment allocatedCapacity
  return {
    transient: segment.allocatedCapacity,
    events: 0,
    reserved: UNKNOWN,
    unavailable: 0,
    readyToUse: segment.availableCapacity,
    isOverride: false,
  };
}
