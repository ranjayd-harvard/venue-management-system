// src/app/api/capacity/allocation/route.ts
// Capacity allocation breakdown API

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { HourlyCapacityEngine, CapacityContext, HourlyCapacitySegment } from '@/lib/capacity-engine-hourly';
import { TimezoneSettingsRepository } from '@/models/TimezoneSettings';
import { resolveOperatingHoursFromEntities } from '@/lib/operating-hours';

export interface AllocationBreakdown {
  subLocationId: string;
  subLocationLabel: string;
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
  metadata: {
    totalHours: number;
    availableHours: number;
    unavailableHours: number;
    timezone: string;
    startTime: string;
    endTime: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subLocationId, startTime, endTime, timezone: requestTimezone } = body;

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

    // Get timezone
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

    // Fetch EVENT capacity sheets for overlapping events
    const bookingStartDate = new Date(startTime);
    const bookingEndDate = new Date(endTime);

    const overlappingEvents = await db.collection('events').find({
      isActive: true,
      endDate: { $gte: bookingStartDate },
      startDate: { $lte: bookingEndDate }
    }).toArray();

    const eventCapacitySheets = overlappingEvents.length > 0
      ? await db.collection('capacitysheets').find({
          'appliesTo.level': 'EVENT',
          'appliesTo.entityId': { $in: overlappingEvents.map(e => e._id) },
          isActive: true,
          approvalStatus: 'APPROVED'
        }).toArray()
      : [];

    // Resolve operating hours from entity hierarchy
    const operatingHoursResolution = resolveOperatingHoursFromEntities([
      { name: customer.name, operatingHours: customer.operatingHours },
      { name: location.name, operatingHours: location.operatingHours },
      { name: sublocation.label, operatingHours: sublocation.operatingHours },
    ]);

    // Build capacity context
    const context: CapacityContext = {
      bookingStart: new Date(startTime),
      bookingEnd: new Date(endTime),
      timezone,

      customerId: customer._id.toString(),
      locationId: location._id.toString(),
      subLocationId: sublocation._id.toString(),

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

      sublocationCapacityConfig: sublocation.capacityConfig as any,

      operatingHours: operatingHoursResolution.hasOperatingHours ? {
        schedule: operatingHoursResolution.mergedSchedule,
        blackouts: operatingHoursResolution.mergedBlackouts,
      } : undefined,
    };

    // Calculate capacity using hourly engine
    const engine = new HourlyCapacityEngine();
    const result = engine.calculateCapacity(context);

    // Compute allocation breakdown from segments
    const breakdown = computeAllocationBreakdown(
      result.segments,
      sublocation._id.toString(),
      sublocation.label,
      timezone,
      startTime,
      endTime,
      sublocation.capacityConfig?.defaultCapacities,
      sublocation.maxCapacity
    );

    return NextResponse.json(breakdown);

  } catch (error: any) {
    console.error('Allocation calculation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate allocation' },
      { status: 500 }
    );
  }
}

function computeAllocationBreakdown(
  segments: HourlyCapacitySegment[],
  subLocationId: string,
  subLocationLabel: string,
  timezone: string,
  startTime: string,
  endTime: string,
  defaultCapacities?: {
    allocated: { transient: number; events: number; reserved: number };
    unallocated: { unavailable: number; readyToUse: number };
  },
  sublocationMaxCapacity?: number
): AllocationBreakdown {
  // Calculate time-based metadata from segments
  let availableHours = 0;
  let unavailableHours = 0;

  for (const segment of segments) {
    const weight = segment.durationHours;
    if (segment.source === 'OPERATING_HOURS' && segment.isAvailable === false) {
      unavailableHours += weight;
    } else {
      availableHours += weight;
    }
  }

  const totalHours = segments.reduce((sum, seg) => sum + seg.durationHours, 0);

  // Priority 1: Use stored defaultCapacities if available (matches capacity-settings page)
  if (defaultCapacities && defaultCapacities.allocated && defaultCapacities.unallocated) {
    const { allocated, unallocated } = defaultCapacities;
    const totalCapacity = sublocationMaxCapacity ||
      (allocated.transient + allocated.events + allocated.reserved + unallocated.unavailable + unallocated.readyToUse);

    const allocatedTotal = allocated.transient + allocated.events + allocated.reserved;
    const unallocatedTotal = unallocated.unavailable + unallocated.readyToUse;

    // Calculate percentages
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
      subLocationId,
      subLocationLabel,
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
      metadata: {
        totalHours,
        availableHours,
        unavailableHours,
        timezone,
        startTime,
        endTime,
      },
    };
  }

  // Fallback: Compute from segments (for sublocations without stored defaultCapacities)
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

  // Normalize to per-hour averages
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
    subLocationId,
    subLocationLabel,
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
    metadata: {
      totalHours,
      availableHours,
      unavailableHours,
      timezone,
      startTime,
      endTime,
    },
  };
}
