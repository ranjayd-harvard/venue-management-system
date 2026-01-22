import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { CustomerRepository } from '@/models/Customer';
import { LocationRepository } from '@/models/Location';
import { SubLocationRepository } from '@/models/SubLocation';

interface CapacityMetrics {
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity: number;
}

/**
 * GET /api/capacity/graph-metrics
 * Get capacity metrics for all entities for graph visualization
 *
 * Returns aggregated capacity metrics:
 * - SubLocations: Own capacity config
 * - Locations: Aggregated from sublocations + own config
 * - Customers: Aggregated from locations + own config
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Fetch all entities
    const [customers, locations, sublocations] = await Promise.all([
      CustomerRepository.findAll(),
      LocationRepository.findAll(),
      SubLocationRepository.findAll(),
    ]);

    // Calculate metrics for each entity type
    const sublocationMetrics = new Map<string, CapacityMetrics>();
    const locationMetrics = new Map<string, CapacityMetrics>();
    const customerMetrics = new Map<string, CapacityMetrics>();

    // 1. SubLocation metrics (base level - own config only)
    // Note: SubLocations have both top-level capacity fields AND capacityConfig
    // Prefer top-level fields (minCapacity, maxCapacity, defaultCapacity) over capacityConfig
    sublocations.forEach((sublocation) => {
      const metrics: CapacityMetrics = {
        minCapacity: sublocation.minCapacity ?? sublocation.capacityConfig?.minCapacity ?? 0,
        maxCapacity: sublocation.maxCapacity ?? sublocation.capacityConfig?.maxCapacity ?? 0,
        defaultCapacity: sublocation.defaultCapacity ?? sublocation.capacityConfig?.maxCapacity ?? 0,
        allocatedCapacity: sublocation.allocatedCapacity || 0,
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
        }
      });

      locationMetrics.set(locationId, {
        minCapacity,
        maxCapacity,
        defaultCapacity,
        allocatedCapacity,
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
        }
      });

      customerMetrics.set(customerId, {
        minCapacity,
        maxCapacity,
        defaultCapacity,
        allocatedCapacity,
      });
    });

    // Convert Maps to objects for JSON response
    const response = {
      date,
      customers: Object.fromEntries(customerMetrics),
      locations: Object.fromEntries(locationMetrics),
      sublocations: Object.fromEntries(sublocationMetrics),
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
