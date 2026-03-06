// src/app/api/capacity/inventory-status/physical/route.ts
// Manual Physical Status Update API
// Allows operators to update the physical status counts for a SubLocation

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { SubLocationRepository } from '@/models/SubLocation';
import { PhysicalStatusCounts } from '@/models/types';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { subLocationId, counts, updatedBy } = body;

    if (!subLocationId || !counts) {
      return NextResponse.json(
        { error: 'Missing required fields: subLocationId, counts' },
        { status: 400 }
      );
    }

    // Validate counts structure
    const { free, occupied, occupiedUnconfirmed, unknown } = counts;
    if (
      typeof free !== 'number' ||
      typeof occupied !== 'number' ||
      typeof occupiedUnconfirmed !== 'number' ||
      typeof unknown !== 'number'
    ) {
      return NextResponse.json(
        { error: 'counts must include free, occupied, occupiedUnconfirmed, unknown as numbers' },
        { status: 400 }
      );
    }

    // Validate non-negative
    if (free < 0 || occupied < 0 || occupiedUnconfirmed < 0 || unknown < 0) {
      return NextResponse.json(
        { error: 'All counts must be non-negative' },
        { status: 400 }
      );
    }

    const physicalCounts: PhysicalStatusCounts = {
      free,
      occupied,
      occupiedUnconfirmed,
      unknown,
    };

    try {
      const success = await SubLocationRepository.updatePhysicalStatus(
        new ObjectId(subLocationId),
        physicalCounts,
        updatedBy || 'manual',
        'MANUAL'
      );

      if (!success) {
        return NextResponse.json(
          { error: 'SubLocation not found or update failed' },
          { status: 404 }
        );
      }
    } catch (validationError: any) {
      // Catch sum validation error from repository
      return NextResponse.json(
        { error: validationError.message },
        { status: 400 }
      );
    }

    // Fetch the updated sublocation to return the snapshot
    const updated = await SubLocationRepository.findById(new ObjectId(subLocationId));

    return NextResponse.json({
      success: true,
      physicalStatus: updated?.physicalStatus,
    });
  } catch (error: any) {
    console.error('Physical status update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update physical status' },
      { status: 500 }
    );
  }
}
