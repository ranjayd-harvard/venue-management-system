import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { CustomerRepository } from '@/models/Customer';
import { LocationRepository } from '@/models/Location';
import { SubLocationRepository } from '@/models/SubLocation';
import { EventRepository } from '@/models/Event';
import {
  aggregateCapacityForDate,
  aggregateRevenueGoals,
  getCapacityForDate,
} from '@/lib/capacity-utils';

/**
 * GET /api/capacity/aggregate
 * Get aggregated capacity and revenue goals across entities in a hierarchy
 *
 * Query params:
 * - customerId?: string - aggregate all locations under customer
 * - locationId?: string - aggregate all sublocations under location
 * - sublocationId?: string - aggregate all events under sublocation
 * - date: string (YYYY-MM-DD) - date for aggregation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const locationId = searchParams.get('locationId');
    const sublocationId = searchParams.get('sublocationId');
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { error: 'date is required' },
        { status: 400 }
      );
    }

    // Determine aggregation level
    if (customerId) {
      // Aggregate all locations under this customer
      const customer = await CustomerRepository.findById(customerId);
      if (!customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }

      const locations = await LocationRepository.findByCustomerId(customerId);
      const configs = locations.map(loc => loc.capacityConfig);

      // Add customer's own config
      configs.push(customer.capacityConfig);

      const totalCapacity = aggregateCapacityForDate(configs, date);
      const totalGoals = aggregateRevenueGoals(configs, date);

      return NextResponse.json({
        entityType: 'customer',
        entityId: customerId,
        date,
        totalCapacity,
        totalGoals,
        breakdown: {
          customer: {
            name: customer.name,
            capacity: getCapacityForDate(customer.capacityConfig, date),
          },
          locations: locations.map(loc => ({
            id: loc._id?.toString(),
            name: loc.name,
            capacity: getCapacityForDate(loc.capacityConfig, date),
          })),
        },
      });
    }

    if (locationId) {
      // Aggregate all sublocations under this location
      const location = await LocationRepository.findById(locationId);
      if (!location) {
        return NextResponse.json(
          { error: 'Location not found' },
          { status: 404 }
        );
      }

      const sublocations = await SubLocationRepository.findByLocationId(new ObjectId(locationId));
      const configs = sublocations.map(sub => sub.capacityConfig);

      // Add location's own config
      configs.push(location.capacityConfig);

      const totalCapacity = aggregateCapacityForDate(configs, date);
      const totalGoals = aggregateRevenueGoals(configs, date);

      return NextResponse.json({
        entityType: 'location',
        entityId: locationId,
        date,
        totalCapacity,
        totalGoals,
        breakdown: {
          location: {
            name: location.name,
            capacity: getCapacityForDate(location.capacityConfig, date),
          },
          sublocations: sublocations.map(sub => ({
            id: sub._id?.toString(),
            label: sub.label,
            capacity: getCapacityForDate(sub.capacityConfig, date),
          })),
        },
      });
    }

    if (sublocationId) {
      // Aggregate all events under this sublocation
      const sublocation = await SubLocationRepository.findById(new ObjectId(sublocationId));
      if (!sublocation) {
        return NextResponse.json(
          { error: 'Sublocation not found' },
          { status: 404 }
        );
      }

      const events = await EventRepository.findBySubLocation(sublocationId);
      const configs = events.map(evt => evt.capacityConfig);

      // Add sublocation's own config
      configs.push(sublocation.capacityConfig);

      const totalCapacity = aggregateCapacityForDate(configs, date);
      const totalGoals = aggregateRevenueGoals(configs, date);

      return NextResponse.json({
        entityType: 'sublocation',
        entityId: sublocationId,
        date,
        totalCapacity,
        totalGoals,
        breakdown: {
          sublocation: {
            label: sublocation.label,
            capacity: getCapacityForDate(sublocation.capacityConfig, date),
          },
          events: events.map(evt => ({
            id: evt._id?.toString(),
            name: evt.name,
            capacity: getCapacityForDate(evt.capacityConfig, date),
          })),
        },
      });
    }

    return NextResponse.json(
      { error: 'Provide one of: customerId, locationId, or sublocationId' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error aggregating capacity:', error);
    return NextResponse.json(
      { error: 'Failed to aggregate capacity' },
      { status: 500 }
    );
  }
}
