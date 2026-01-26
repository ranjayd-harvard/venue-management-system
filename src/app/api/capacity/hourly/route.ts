// src/app/api/capacity/hourly/route.ts
// API for managing hourly capacity overrides

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { SubLocationRepository } from '@/models/SubLocation';

/**
 * POST /api/capacity/hourly
 * Set hourly capacity override for a specific sublocation, date, and hour
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subLocationId, date, hour, minCapacity, maxCapacity, defaultCapacity, allocatedCapacity } = body;

    // Validate required fields
    if (!subLocationId || !date || hour === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: subLocationId, date, hour' },
        { status: 400 }
      );
    }

    // Validate hour range
    if (hour < 0 || hour > 23) {
      return NextResponse.json(
        { error: 'Hour must be between 0 and 23' },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Get sublocation to validate against bounds
    const sublocation = await SubLocationRepository.findById(new ObjectId(subLocationId));

    if (!sublocation) {
      return NextResponse.json(
        { error: 'SubLocation not found' },
        { status: 404 }
      );
    }

    // Get sublocation's capacity bounds
    const sublocationMaxCapacity = sublocation.capacityConfig?.maxCapacity || sublocation.maxCapacity || 100;
    const sublocationMinCapacity = sublocation.capacityConfig?.minCapacity || sublocation.minCapacity || 0;

    // Build override object (only include provided fields)
    const override: {
      minCapacity?: number;
      maxCapacity?: number;
      defaultCapacity?: number;
      allocatedCapacity?: number;
    } = {};

    if (minCapacity !== undefined) {
      if (minCapacity < 0) {
        return NextResponse.json(
          { error: 'minCapacity cannot be negative' },
          { status: 400 }
        );
      }
      override.minCapacity = minCapacity;
    }

    if (maxCapacity !== undefined) {
      if (maxCapacity > sublocationMaxCapacity) {
        return NextResponse.json(
          { error: `maxCapacity (${maxCapacity}) cannot exceed sublocation's max capacity (${sublocationMaxCapacity})` },
          { status: 400 }
        );
      }
      if (maxCapacity < 0) {
        return NextResponse.json(
          { error: 'maxCapacity cannot be negative' },
          { status: 400 }
        );
      }
      override.maxCapacity = maxCapacity;
    }

    if (defaultCapacity !== undefined) override.defaultCapacity = defaultCapacity;
    if (allocatedCapacity !== undefined) override.allocatedCapacity = allocatedCapacity;

    // Ensure at least one capacity field is provided
    if (Object.keys(override).length === 0) {
      return NextResponse.json(
        { error: 'At least one capacity field (minCapacity, maxCapacity, defaultCapacity, allocatedCapacity) must be provided' },
        { status: 400 }
      );
    }

    // Set hourly capacity
    const success = await SubLocationRepository.setHourlyCapacity(
      new ObjectId(subLocationId),
      date,
      hour,
      override
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to set hourly capacity. SubLocation may not exist.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Hourly capacity set for ${date} at ${hour}:00`,
      data: {
        subLocationId,
        date,
        hour,
        override
      }
    });

  } catch (error: any) {
    console.error('Error setting hourly capacity:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to set hourly capacity' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/capacity/hourly
 * Remove hourly capacity override(s) for a specific sublocation and date
 * - If 'hour' param is provided: removes single hour override
 * - If 'hour' param is NOT provided: removes ALL hourly overrides for the date (bulk clear)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subLocationId = searchParams.get('subLocationId');
    const date = searchParams.get('date');
    const hourStr = searchParams.get('hour');

    // Validate required fields (subLocationId and date always required)
    if (!subLocationId || !date) {
      return NextResponse.json(
        { error: 'Missing required query parameters: subLocationId, date' },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // If hour is provided, remove single hour override
    if (hourStr !== null) {
      const hour = parseInt(hourStr, 10);

      // Validate hour range
      if (isNaN(hour) || hour < 0 || hour > 23) {
        return NextResponse.json(
          { error: 'Hour must be a number between 0 and 23' },
          { status: 400 }
        );
      }

      // Remove hourly capacity
      const success = await SubLocationRepository.removeHourlyCapacity(
        new ObjectId(subLocationId),
        date,
        hour
      );

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to remove hourly capacity' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Hourly capacity override removed for ${date} at ${hour}:00`
      });
    }

    // Otherwise, remove ALL hourly overrides for the date (bulk clear)
    const success = await SubLocationRepository.removeAllHourlyCapacitiesForDate(
      new ObjectId(subLocationId),
      date
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to clear hourly capacities for date' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `All hourly capacity overrides cleared for ${date}`
    });

  } catch (error: any) {
    console.error('Error removing hourly capacity:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove hourly capacity' },
      { status: 500 }
    );
  }
}
