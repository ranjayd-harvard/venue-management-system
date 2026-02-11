import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { CustomerRepository } from '@/models/Customer';
import { LocationRepository } from '@/models/Location';
import { SubLocationRepository } from '@/models/SubLocation';
import { EventRepository } from '@/models/Event';

/**
 * PUT /api/capacity/bounds
 * Update capacity bounds (min/max) for a specific entity
 *
 * Body:
 * {
 *   entityType: 'customer' | 'location' | 'sublocation' | 'event',
 *   entityId: string,
 *   minCapacity: number,
 *   maxCapacity: number
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { entityType, entityId, minCapacity, maxCapacity } = body;

    if (!entityType || !entityId || minCapacity === undefined || maxCapacity === undefined) {
      return NextResponse.json(
        { error: 'entityType, entityId, minCapacity, and maxCapacity are required' },
        { status: 400 }
      );
    }

    // Validate bounds
    if (typeof minCapacity !== 'number' || typeof maxCapacity !== 'number') {
      return NextResponse.json(
        { error: 'minCapacity and maxCapacity must be numbers' },
        { status: 400 }
      );
    }

    if (minCapacity < 0) {
      return NextResponse.json(
        { error: 'minCapacity cannot be negative' },
        { status: 400 }
      );
    }

    if (maxCapacity < minCapacity) {
      return NextResponse.json(
        { error: 'maxCapacity must be greater than or equal to minCapacity' },
        { status: 400 }
      );
    }

    let result;

    switch (entityType.toLowerCase()) {
      case 'customer':
        result = await CustomerRepository.updateCapacityBounds(entityId, minCapacity, maxCapacity);
        break;
      case 'location':
        result = await LocationRepository.updateCapacityBounds(entityId, minCapacity, maxCapacity);
        break;
      case 'sublocation':
        result = await SubLocationRepository.updateCapacityBounds(
          new ObjectId(entityId),
          minCapacity,
          maxCapacity
        );
        break;
      case 'event':
        result = await EventRepository.updateCapacityBounds(entityId, minCapacity, maxCapacity);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid entityType' },
          { status: 400 }
        );
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to update capacity bounds' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Capacity bounds updated successfully',
      data: result,
    });

  } catch (error: any) {
    console.error('Error updating capacity bounds:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update capacity bounds' },
      { status: 500 }
    );
  }
}
