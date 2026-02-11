import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { CustomerRepository } from '@/models/Customer';
import { LocationRepository } from '@/models/Location';
import { SubLocationRepository } from '@/models/SubLocation';
import { EventRepository } from '@/models/Event';
import { getCapacityForDate, getCapacitiesForDateRange } from '@/lib/capacity-utils';

/**
 * GET /api/capacity
 * Get capacity for a specific entity and date/date range
 *
 * Query params:
 * - entityType: 'customer' | 'location' | 'sublocation' | 'event'
 * - entityId: string (ObjectId)
 * - date?: string (YYYY-MM-DD) - single date
 * - startDate?: string (YYYY-MM-DD) - for range queries
 * - endDate?: string (YYYY-MM-DD) - for range queries
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId are required' },
        { status: 400 }
      );
    }

    // Fetch entity based on type
    let entity;
    let config;

    switch (entityType.toLowerCase()) {
      case 'customer':
        entity = await CustomerRepository.findById(entityId);
        config = entity?.capacityConfig;
        break;
      case 'location':
        entity = await LocationRepository.findById(entityId);
        config = entity?.capacityConfig;
        break;
      case 'sublocation':
        entity = await SubLocationRepository.findById(new ObjectId(entityId));
        config = entity?.capacityConfig;
        break;
      case 'event':
        entity = await EventRepository.findById(entityId);
        config = entity?.capacityConfig;
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid entityType' },
          { status: 400 }
        );
    }

    if (!entity) {
      return NextResponse.json(
        { error: 'Entity not found' },
        { status: 404 }
      );
    }

    // Single date query
    if (date) {
      const capacity = getCapacityForDate(config, date);
      return NextResponse.json({
        date,
        capacity,
        bounds: config ? {
          minCapacity: config.minCapacity,
          maxCapacity: config.maxCapacity,
        } : { minCapacity: 0, maxCapacity: 100 },
      });
    }

    // Date range query
    if (startDate && endDate) {
      const capacities = getCapacitiesForDateRange(config, startDate, endDate);
      return NextResponse.json({
        startDate,
        endDate,
        capacities,
        bounds: config ? {
          minCapacity: config.minCapacity,
          maxCapacity: config.maxCapacity,
        } : { minCapacity: 0, maxCapacity: 100 },
      });
    }

    // Return full config if no date specified
    return NextResponse.json({
      capacityConfig: config || {
        minCapacity: 0,
        maxCapacity: 100,
        dailyCapacities: [],
        revenueGoals: [],
      },
    });

  } catch (error) {
    console.error('Error fetching capacity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch capacity' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/capacity
 * Set capacity for a specific entity
 *
 * Body:
 * {
 *   entityType: 'customer' | 'location' | 'sublocation' | 'event',
 *   entityId: string,
 *   date?: string (YYYY-MM-DD) - for single date
 *   startDate?: string (YYYY-MM-DD) - for range
 *   endDate?: string (YYYY-MM-DD) - for range
 *   capacity: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entityType, entityId, date, startDate, endDate, capacity } = body;

    if (!entityType || !entityId || capacity === undefined) {
      return NextResponse.json(
        { error: 'entityType, entityId, and capacity are required' },
        { status: 400 }
      );
    }

    if (typeof capacity !== 'number' || capacity < 0) {
      return NextResponse.json(
        { error: 'capacity must be a non-negative number' },
        { status: 400 }
      );
    }

    let result;

    // Determine if single date or range
    const isSingleDate = date && !startDate && !endDate;
    const isRange = startDate && endDate && !date;

    if (!isSingleDate && !isRange) {
      return NextResponse.json(
        { error: 'Provide either date OR (startDate and endDate)' },
        { status: 400 }
      );
    }

    switch (entityType.toLowerCase()) {
      case 'customer':
        result = isSingleDate
          ? await CustomerRepository.setDailyCapacity(entityId, date, capacity)
          : await CustomerRepository.setCapacityRange(entityId, startDate, endDate, capacity);
        break;
      case 'location':
        result = isSingleDate
          ? await LocationRepository.setDailyCapacity(entityId, date, capacity)
          : await LocationRepository.setCapacityRange(entityId, startDate, endDate, capacity);
        break;
      case 'sublocation':
        result = isSingleDate
          ? await SubLocationRepository.setDailyCapacity(new ObjectId(entityId), date, capacity)
          : await SubLocationRepository.setCapacityRange(new ObjectId(entityId), startDate, endDate, capacity);
        break;
      case 'event':
        result = isSingleDate
          ? await EventRepository.setDailyCapacity(entityId, date, capacity)
          : await EventRepository.setCapacityRange(entityId, startDate, endDate, capacity);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid entityType' },
          { status: 400 }
        );
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to set capacity' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Capacity updated successfully',
      data: result,
    });

  } catch (error: any) {
    console.error('Error setting capacity:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to set capacity' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/capacity
 * Remove capacity override for a specific date
 *
 * Query params:
 * - entityType: 'customer' | 'location' | 'sublocation' | 'event'
 * - entityId: string
 * - date: string (YYYY-MM-DD)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const date = searchParams.get('date');

    if (!entityType || !entityId || !date) {
      return NextResponse.json(
        { error: 'entityType, entityId, and date are required' },
        { status: 400 }
      );
    }

    let result;

    switch (entityType.toLowerCase()) {
      case 'customer':
        result = await CustomerRepository.removeDailyCapacity(entityId, date);
        break;
      case 'location':
        result = await LocationRepository.removeDailyCapacity(entityId, date);
        break;
      case 'sublocation':
        result = await SubLocationRepository.removeDailyCapacity(new ObjectId(entityId), date);
        break;
      case 'event':
        result = await EventRepository.removeDailyCapacity(entityId, date);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid entityType' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: 'Capacity override removed successfully',
      data: result,
    });

  } catch (error) {
    console.error('Error removing capacity:', error);
    return NextResponse.json(
      { error: 'Failed to remove capacity override' },
      { status: 500 }
    );
  }
}
