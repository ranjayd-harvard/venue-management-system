import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { CustomerRepository } from '@/models/Customer';
import { LocationRepository } from '@/models/Location';
import { SubLocationRepository } from '@/models/SubLocation';
import { EventRepository } from '@/models/Event';

interface AllocationBreakdown {
  transient: number;
  events: number;
  reserved: number;
  unavailable: number;
  readyToUse: number;
}

interface CapacityMetrics {
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity: number;
  allocation?: AllocationBreakdown;
}

/**
 * GET /api/capacity/graph-metrics
 * Get capacity metrics for all entities for graph visualization
 *
 * Returns aggregated capacity metrics:
 * - SubLocations: Own capacity config
 * - Locations: Aggregated from sublocations + own config
 * - Customers: Aggregated from locations + own config
 * - Events: Own capacity config
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Fetch all entities
    const [customers, locations, sublocations, events] = await Promise.all([
      CustomerRepository.findAll(),
      LocationRepository.findAll(),
      SubLocationRepository.findAll(),
      EventRepository.findAll(),
    ]);

    // Calculate metrics for each entity type
    const sublocationMetrics = new Map<string, CapacityMetrics>();
    const locationMetrics = new Map<string, CapacityMetrics>();
    const customerMetrics = new Map<string, CapacityMetrics>();
    const eventMetrics = new Map<string, CapacityMetrics>();

    // 1. SubLocation metrics (base level - own config only)
    // Note: SubLocations have both top-level capacity fields AND capacityConfig
    // Prefer top-level fields (minCapacity, maxCapacity, defaultCapacity) over capacityConfig
    sublocations.forEach((sublocation) => {
      // Get allocation breakdown from capacityConfig.defaultCapacities
      const defaultCapacities = sublocation.capacityConfig?.defaultCapacities;
      const allocation: AllocationBreakdown | undefined = defaultCapacities
        ? {
            transient: defaultCapacities.allocated?.transient ?? 0,
            events: defaultCapacities.allocated?.events ?? 0,
            reserved: defaultCapacities.allocated?.reserved ?? 0,
            unavailable: defaultCapacities.unallocated?.unavailable ?? 0,
            readyToUse: defaultCapacities.unallocated?.readyToUse ?? 0,
          }
        : undefined;

      const metrics: CapacityMetrics = {
        minCapacity: sublocation.minCapacity ?? sublocation.capacityConfig?.minCapacity ?? 0,
        maxCapacity: sublocation.maxCapacity ?? sublocation.capacityConfig?.maxCapacity ?? 0,
        defaultCapacity: sublocation.defaultCapacity ?? sublocation.capacityConfig?.maxCapacity ?? 0,
        allocatedCapacity: sublocation.allocatedCapacity || 0,
        allocation,
      };
      sublocationMetrics.set(sublocation._id!.toString(), metrics);
    });

    // 2. Location metrics (aggregate from sublocations)
    // Locations aggregate capacity from their child sublocations
    locations.forEach((location) => {
      const locationId = location._id!.toString();

      // Initialize aggregation totals
      let minCapacity = 0;
      let maxCapacity = 0;
      let defaultCapacity = 0;
      let allocatedCapacity = 0;
      let hasAllocation = false;
      const aggregatedAllocation: AllocationBreakdown = {
        transient: 0,
        events: 0,
        reserved: 0,
        unavailable: 0,
        readyToUse: 0,
      };

      // Aggregate from child sublocations
      // Handle both string and ObjectId comparison
      const childSublocations = sublocations.filter(
        (sl) => {
          const slLocationId = sl.locationId?.toString();
          return slLocationId === locationId;
        }
      );

      childSublocations.forEach((sublocation) => {
        const slMetrics = sublocationMetrics.get(sublocation._id!.toString());
        if (slMetrics) {
          minCapacity += slMetrics.minCapacity;
          maxCapacity += slMetrics.maxCapacity;
          defaultCapacity += slMetrics.defaultCapacity;
          allocatedCapacity += slMetrics.allocatedCapacity;

          // Aggregate allocation breakdown
          if (slMetrics.allocation) {
            hasAllocation = true;
            aggregatedAllocation.transient += slMetrics.allocation.transient;
            aggregatedAllocation.events += slMetrics.allocation.events;
            aggregatedAllocation.reserved += slMetrics.allocation.reserved;
            aggregatedAllocation.unavailable += slMetrics.allocation.unavailable;
            aggregatedAllocation.readyToUse += slMetrics.allocation.readyToUse;
          }
        }
      });

      locationMetrics.set(locationId, {
        minCapacity,
        maxCapacity,
        defaultCapacity,
        allocatedCapacity,
        allocation: hasAllocation ? aggregatedAllocation : undefined,
      });
    });

    // 3. Customer metrics (aggregate from locations)
    // Customers aggregate capacity from their child locations
    customers.forEach((customer) => {
      const customerId = customer._id!.toString();

      // Initialize aggregation totals
      let minCapacity = 0;
      let maxCapacity = 0;
      let defaultCapacity = 0;
      let allocatedCapacity = 0;
      let hasAllocation = false;
      const aggregatedAllocation: AllocationBreakdown = {
        transient: 0,
        events: 0,
        reserved: 0,
        unavailable: 0,
        readyToUse: 0,
      };

      // Aggregate from child locations
      // Handle both string and ObjectId comparison
      const childLocations = locations.filter(
        (loc) => {
          const locCustomerId = loc.customerId?.toString();
          return locCustomerId === customerId;
        }
      );

      childLocations.forEach((location) => {
        const locMetrics = locationMetrics.get(location._id!.toString());
        if (locMetrics) {
          minCapacity += locMetrics.minCapacity;
          maxCapacity += locMetrics.maxCapacity;
          defaultCapacity += locMetrics.defaultCapacity;
          allocatedCapacity += locMetrics.allocatedCapacity;

          // Aggregate allocation breakdown
          if (locMetrics.allocation) {
            hasAllocation = true;
            aggregatedAllocation.transient += locMetrics.allocation.transient;
            aggregatedAllocation.events += locMetrics.allocation.events;
            aggregatedAllocation.reserved += locMetrics.allocation.reserved;
            aggregatedAllocation.unavailable += locMetrics.allocation.unavailable;
            aggregatedAllocation.readyToUse += locMetrics.allocation.readyToUse;
          }
        }
      });

      customerMetrics.set(customerId, {
        minCapacity,
        maxCapacity,
        defaultCapacity,
        allocatedCapacity,
        allocation: hasAllocation ? aggregatedAllocation : undefined,
      });
    });

    // 4. Event metrics (own capacity config only)
    // Events have their own capacity configuration
    events.forEach((event) => {
      const metrics: CapacityMetrics = {
        minCapacity: event.capacityConfig?.minCapacity ?? 0,
        maxCapacity: event.capacityConfig?.maxCapacity ?? 0,
        defaultCapacity: event.capacityConfig?.maxCapacity ?? 0,
        allocatedCapacity: 0, // Events don't track allocated capacity
      };
      eventMetrics.set(event._id!.toString(), metrics);
    });

    // Convert Maps to objects for JSON response
    const response = {
      date,
      customers: Object.fromEntries(customerMetrics),
      locations: Object.fromEntries(locationMetrics),
      sublocations: Object.fromEntries(sublocationMetrics),
      events: Object.fromEntries(eventMetrics),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching capacity graph metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch capacity metrics' },
      { status: 500 }
    );
  }
}
