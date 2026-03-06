// src/app/api/capacity/inventory-status/route.ts
// 4-Dimensional Inventory Status API
// Returns full 4D status (CapacityStatus, PhysicalStatus, CommercialStatus, OperationalStatus)

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { InventoryStatusEngine, InventoryStatusContext } from '@/lib/inventory-status-engine';
import { Event, PhysicalStatus, CommercialStatus, PhysicalStatusCounts, CommercialStatusCounts } from '@/models/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subLocationId, timestamp } = body;

    if (!subLocationId) {
      return NextResponse.json(
        { error: 'Missing required field: subLocationId' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const currentTime = timestamp ? new Date(timestamp) : new Date();

    // Get sublocation
    const sublocation = await db.collection('sublocations').findOne({
      _id: new ObjectId(subLocationId),
    });

    if (!sublocation) {
      return NextResponse.json(
        { error: 'SubLocation not found' },
        { status: 404 }
      );
    }

    // Fetch overlapping events for this SubLocation at current time
    // Include events whose effective window (with grace periods) overlaps current time
    const overlappingEvents = await db.collection('events').find({
      subLocationId: new ObjectId(subLocationId),
      isActive: true,
      startDate: { $lte: new Date(currentTime.getTime() + 24 * 60 * 60 * 1000) }, // events starting within 24h
      endDate: { $gte: new Date(currentTime.getTime() - 24 * 60 * 60 * 1000) },   // events ending within last 24h
    }).toArray();

    // Filter to events whose effective window actually overlaps current time
    const relevantEvents = overlappingEvents.filter((event) => {
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);
      const graceBeforeMs = (event.gracePeriodBefore || 0) * 60 * 1000;
      const graceAfterMs = (event.gracePeriodAfter || 0) * 60 * 1000;
      const effectiveStart = new Date(startDate.getTime() - graceBeforeMs);
      const effectiveEnd = new Date(endDate.getTime() + graceAfterMs);
      return currentTime >= effectiveStart && currentTime <= effectiveEnd;
    });

    const totalCapacity = sublocation.maxCapacity || 0;

    // Check for ticket_states — if present, compute aggregate overrides
    let physicalStatusOverride: PhysicalStatusCounts | undefined;
    let commercialStatusOverride: CommercialStatusCounts | undefined;

    const ticketStates = await db
      .collection('ticket_states')
      .find({ subLocationId })
      .toArray();

    if (ticketStates.length > 0) {
      const physCounts: PhysicalStatusCounts = {
        free: ticketStates.filter(t => t.physicalState === PhysicalStatus.FREE).length,
        occupied: ticketStates.filter(t => t.physicalState === PhysicalStatus.OCCUPIED).length,
        occupiedUnconfirmed: ticketStates.filter(t => t.physicalState === PhysicalStatus.OCCUPIED_UNCONFIRMED).length,
        unknown: ticketStates.filter(t => t.physicalState === PhysicalStatus.UNKNOWN).length,
      };

      const commCounts: CommercialStatusCounts = {
        none: ticketStates.filter(t => t.commercialState === CommercialStatus.NONE).length,
        reservedUpcoming: ticketStates.filter(t => t.commercialState === CommercialStatus.RESERVED_UPCOMING).length,
        reservedActive: ticketStates.filter(t => t.commercialState === CommercialStatus.RESERVED_ACTIVE).length,
        noShow: ticketStates.filter(t => t.commercialState === CommercialStatus.NO_SHOW).length,
        overstay: ticketStates.filter(t => t.commercialState === CommercialStatus.OVERSTAY).length,
      };

      // If fewer tickets than capacity, remaining spots are FREE + NONE (untracked)
      const ticketTotal = ticketStates.length;
      if (ticketTotal < totalCapacity) {
        const untracked = totalCapacity - ticketTotal;
        physCounts.free += untracked;
        commCounts.none += untracked;
      }

      physicalStatusOverride = physCounts;
      commercialStatusOverride = commCounts;
    }

    // Build engine context
    const context: InventoryStatusContext = {
      subLocationId: sublocation._id.toString(),
      subLocationLabel: sublocation.label,
      totalCapacity,
      capacityStatus: sublocation.capacityConfig?.defaultCapacities || null,
      physicalStatus: sublocation.physicalStatus || null,
      overlappingEvents: relevantEvents as Event[],
      currentTime,
      physicalStatusOverride,
      commercialStatusOverride,
    };

    // Compute 4D status
    const engine = new InventoryStatusEngine();
    const status = engine.computeStatus(context);

    return NextResponse.json(status);
  } catch (error: any) {
    console.error('Inventory status calculation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate inventory status' },
      { status: 500 }
    );
  }
}
