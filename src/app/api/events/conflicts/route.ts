import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * Conflict Detection API
 *
 * Detects overlapping events and identifies which event wins at each hour
 * based on the priority hierarchy.
 *
 * Query Parameters:
 * - subLocationId: SubLocation to check for conflicts
 * - startDate: Start date for conflict window (ISO string)
 * - endDate: End date for conflict window (ISO string)
 * - excludeEventId: (Optional) Event ID to exclude from conflict check (useful when editing)
 */

interface TimeSlot {
  hour: number;
  startTime: string;
  endTime: string;
  winningEvent: {
    id: string;
    name: string;
    priority: number;
    rate: number;
    isCustomPriority: boolean;
  } | null;
  conflictingEvents: Array<{
    id: string;
    name: string;
    priority: number;
    rate: number;
    isCustomPriority: boolean;
    effectiveStart: string;
    effectiveEnd: string;
  }>;
  hasConflict: boolean;
}

interface ConflictDetectionResult {
  subLocationId: string;
  sublocationName: string;
  checkWindow: {
    startDate: string;
    endDate: string;
  };
  totalHours: number;
  conflictHours: number;
  noConflictHours: number;
  timeSlots: TimeSlot[];
  summary: {
    totalEvents: number;
    eventsWithCustomPriority: number;
    eventsWithDefaultPriority: number;
    conflictsByPriority: {
      [key: number]: number; // priority -> count of hours where this priority wins
    };
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subLocationId = searchParams.get('subLocationId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const excludeEventId = searchParams.get('excludeEventId');

    if (!subLocationId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: subLocationId, startDate, endDate' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Get sublocation info
    const sublocation = await db.collection('sublocations').findOne({
      _id: new ObjectId(subLocationId)
    });

    if (!sublocation) {
      return NextResponse.json(
        { error: 'SubLocation not found' },
        { status: 404 }
      );
    }

    // Build query to find overlapping events
    // An event overlaps if: event.start <= window.end AND event.end >= window.start

    // Step 1: Find venues assigned to this sublocation
    const sublocationVenueRelationships = await db.collection('sublocation_venues').find({
      $or: [
        { subLocationId: subLocationId },
        { subLocationId: new ObjectId(subLocationId) }
      ]
    }).toArray();

    const assignedVenueIds = sublocationVenueRelationships.map(rel => {
      const venueId = rel.venueId;
      return typeof venueId === 'string' ? venueId : venueId.toString();
    });

    // Step 2: Build query to include both sublocation events AND venue-only events
    const eventQuery: any = {
      isActive: true,
      startDate: { $lte: new Date(endDate) },
      endDate: { $gte: new Date(startDate) },
      $or: [
        // Events directly linked to this sublocation
        { subLocationId: subLocationId },
        { subLocationId: new ObjectId(subLocationId) }
      ]
    };

    // Add venue-only events if there are assigned venues
    if (assignedVenueIds.length > 0) {
      const venueIdConditions = assignedVenueIds.flatMap(id => [
        { venueId: id },
        { venueId: new ObjectId(id) }
      ]);

      eventQuery.$or.push({
        // Venue-only events: has venueId, but no subLocationId
        $and: [
          { $or: venueIdConditions },
          { subLocationId: { $in: [null, undefined] } }
        ]
      });
    }

    // Exclude specific event if provided (useful when editing)
    if (excludeEventId) {
      eventQuery._id = { $ne: new ObjectId(excludeEventId) };
    }

    // Fetch all overlapping events
    const events = await db.collection('events')
      .find(eventQuery)
      .sort({ customPriority: -1, _id: 1 }) // Sort by priority (high to low), then insertion order
      .toArray();

    // Convert to events with effective time windows (including grace periods)
    const eventsWithGrace = events.map((event: any) => {
      const graceBefore = event.gracePeriodBefore || 0;
      const graceAfter = event.gracePeriodAfter || 0;

      const effectiveStart = new Date(
        new Date(event.startDate).getTime() - graceBefore * 60 * 1000
      );
      const effectiveEnd = new Date(
        new Date(event.endDate).getTime() + graceAfter * 60 * 1000
      );

      return {
        id: event._id.toString(),
        name: event.name,
        priority: event.customPriority || 4900,
        rate: event.defaultHourlyRate || 0,
        isCustomPriority: !!event.customPriority,
        effectiveStart: effectiveStart.toISOString(),
        effectiveEnd: effectiveEnd.toISOString(),
        rawStart: event.startDate,
        rawEnd: event.endDate,
        graceBefore,
        graceAfter,
      };
    });

    // Generate hourly time slots
    const timeSlots: TimeSlot[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    let currentHour = new Date(start);
    let hourIndex = 1;

    while (currentHour < end) {
      const nextHour = new Date(currentHour.getTime() + 60 * 60 * 1000);
      const slotStart = currentHour.toISOString();
      const slotEnd = nextHour.toISOString();

      // Find all events that overlap this hour
      const overlappingEvents = eventsWithGrace.filter(event => {
        const eventStart = new Date(event.effectiveStart);
        const eventEnd = new Date(event.effectiveEnd);
        return eventStart < nextHour && eventEnd > currentHour;
      });

      // Determine winner (highest priority, or first by insertion order if tied)
      let winningEvent = null;
      if (overlappingEvents.length > 0) {
        // Sort by priority (descending), then by insertion order (events are already sorted)
        const sortedEvents = [...overlappingEvents].sort((a, b) => {
          if (b.priority !== a.priority) {
            return b.priority - a.priority; // Higher priority wins
          }
          // If priorities are equal, maintain original order (insertion order)
          return 0;
        });

        const winner = sortedEvents[0];
        winningEvent = {
          id: winner.id,
          name: winner.name,
          priority: winner.priority,
          rate: winner.rate,
          isCustomPriority: winner.isCustomPriority,
        };
      }

      timeSlots.push({
        hour: hourIndex,
        startTime: slotStart,
        endTime: slotEnd,
        winningEvent,
        conflictingEvents: overlappingEvents,
        hasConflict: overlappingEvents.length > 1,
      });

      currentHour = nextHour;
      hourIndex++;
    }

    // Generate summary statistics
    const conflictHours = timeSlots.filter(slot => slot.hasConflict).length;
    const noConflictHours = timeSlots.length - conflictHours;

    const conflictsByPriority: { [key: number]: number } = {};
    timeSlots.forEach(slot => {
      if (slot.winningEvent) {
        const priority = slot.winningEvent.priority;
        conflictsByPriority[priority] = (conflictsByPriority[priority] || 0) + 1;
      }
    });

    const uniqueEvents = new Set(eventsWithGrace.map(e => e.id));
    const eventsWithCustom = eventsWithGrace.filter(e => e.isCustomPriority).length;

    const result: ConflictDetectionResult = {
      subLocationId,
      sublocationName: sublocation.label,
      checkWindow: {
        startDate,
        endDate,
      },
      totalHours: timeSlots.length,
      conflictHours,
      noConflictHours,
      timeSlots,
      summary: {
        totalEvents: uniqueEvents.size,
        eventsWithCustomPriority: eventsWithCustom,
        eventsWithDefaultPriority: uniqueEvents.size - eventsWithCustom,
        conflictsByPriority,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error detecting conflicts:', error);
    return NextResponse.json(
      { error: 'Failed to detect conflicts' },
      { status: 500 }
    );
  }
}
