import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * POST /api/kafka/aggregate-demand
 * Manually aggregate demand for a sublocation and hour
 * Creates ONE demand_history record from buffered Kafka events
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subLocationId, hour } = body;

    if (!subLocationId) {
      return NextResponse.json(
        { error: 'subLocationId is required' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Read booking events from Kafka topic
    console.log(`📊 Reading booking events from Kafka topic for sublocation ${subLocationId}...`);

    const command = `docker exec venue-kafka kafka-console-consumer \
      --bootstrap-server kafka:29092 \
      --topic venue.booking.events \
      --partition 0 \
      --offset earliest \
      --max-messages 1000 \
      --timeout-ms 5000 2>&1`;

    let stdout = '';
    try {
      const result = await execAsync(command, {
        maxBuffer: 1024 * 1024 * 10,
        timeout: 15000
      });
      stdout = result.stdout;
    } catch (error: any) {
      if (error.killed && error.stdout) {
        stdout = error.stdout;
      } else {
        throw error;
      }
    }

    // Parse Kafka messages
    const lines = stdout
      .trim()
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return (
          trimmed.length > 0 &&
          trimmed.startsWith('{') &&
          !line.includes('Processed a total of')
        );
      });

    const allKafkaEvents: any[] = [];
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.subLocationId === subLocationId) {
          allKafkaEvents.push(event);
        }
      } catch (error) {
        // Skip unparseable lines
      }
    }

    console.log(`📊 Found ${allKafkaEvents.length} Kafka events for sublocation`);

    if (allKafkaEvents.length === 0) {
      return NextResponse.json(
        { error: 'No events found for this sublocation', details: 'Generate events first using the data generator' },
        { status: 404 }
      );
    }

    // Group events by hour and find the hour with most events
    let bookingHour: Date;
    let hourEnd: Date;
    let eventsInHour: any[];

    if (hour) {
      // Use specified hour
      bookingHour = new Date(hour);
      bookingHour.setMinutes(0, 0, 0);
      hourEnd = new Date(bookingHour);
      hourEnd.setHours(hourEnd.getHours() + 1);

      eventsInHour = allKafkaEvents.filter(event => {
        const eventStart = new Date(event.startDate);
        return eventStart >= bookingHour && eventStart < hourEnd;
      });
    } else {
      // Group by hour
      const eventsByHour = new Map<string, any[]>();

      for (const event of allKafkaEvents) {
        const eventHour = new Date(event.startDate);
        eventHour.setMinutes(0, 0, 0);
        const hourKey = eventHour.toISOString();

        if (!eventsByHour.has(hourKey)) {
          eventsByHour.set(hourKey, []);
        }
        eventsByHour.get(hourKey)!.push(event);
      }

      // Find hour with most events
      let maxCount = 0;
      let selectedHour = '';

      for (const [hourKey, events] of eventsByHour.entries()) {
        if (events.length > maxCount) {
          maxCount = events.length;
          selectedHour = hourKey;
        }
      }

      bookingHour = new Date(selectedHour);
      hourEnd = new Date(bookingHour);
      hourEnd.setHours(hourEnd.getHours() + 1);
      eventsInHour = eventsByHour.get(selectedHour) || [];

      console.log(`📊 Selected hour ${bookingHour.toISOString()} with ${eventsInHour.length} events`);
    }

    console.log(`📊 Manual demand aggregation for ${subLocationId} at ${bookingHour.toISOString()}`);

    const bookingsCount = eventsInHour.length;
    const totalAttendees = eventsInHour.reduce((sum, e) => sum + (e.attendees || 0), 0);

    console.log(`📊 Found ${bookingsCount} bookings in hour`);

    // Get sublocation capacity (supply)
    const sublocation = await db.collection('sublocations').findOne({
      _id: new ObjectId(subLocationId)
    });

    if (!sublocation) {
      return NextResponse.json(
        { error: 'Sublocation not found' },
        { status: 404 }
      );
    }

    const availableCapacity = sublocation.maxCapacity || 100;

    // Calculate demand pressure (normalized per 100 capacity units)
    const demandPressure = bookingsCount / (availableCapacity / 100);

    // Get historical average for this hour-of-week
    const historicalAvg = await getHistoricalAverage(
      db,
      subLocationId,
      bookingHour.getDay(),
      bookingHour.getHours()
    );

    const capacityUtilization = (totalAttendees / availableCapacity) * 100;

    // Create demand metric
    const demandMetric = {
      subLocationId,
      locationId: sublocation.locationId?.toString(),
      hour: bookingHour.toISOString(),
      hourEnd: hourEnd.toISOString(),
      bookingsCount,
      totalAttendees,
      capacityUtilization,
      availableCapacity,
      demandPressure,
      historicalAvgPressure: historicalAvg,
      pressureDelta: demandPressure - historicalAvg,
      timestamp: new Date().toISOString(),
      eventsProcessed: eventsInHour.map(e => e.eventId),
      manual: true // Flag to indicate manual aggregation
    };

    // Store in demand_history collection
    const hourDate = new Date(demandMetric.hour);
    await db.collection('demand_history').insertOne({
      ...demandMetric,
      dayOfWeek: hourDate.getDay(),
      hourOfDay: hourDate.getHours(), // 0-23 for historical queries (don't overwrite hour ISO string!)
      createdAt: new Date()
    });

    console.log(`✅ Created manual demand_history record`, {
      subLocationId,
      hour: bookingHour.toISOString(),
      bookingsCount,
      pressure: demandPressure.toFixed(2)
    });

    return NextResponse.json({
      success: true,
      message: 'Demand aggregated successfully',
      metric: {
        subLocationId,
        hour: bookingHour.toISOString(),
        bookingsCount,
        demandPressure: parseFloat(demandPressure.toFixed(2)),
        historicalAvg: parseFloat(historicalAvg.toFixed(2)),
        pressureDelta: parseFloat((demandPressure - historicalAvg).toFixed(2))
      }
    });

  } catch (error) {
    console.error('Error aggregating demand:', error);
    return NextResponse.json(
      { error: 'Failed to aggregate demand', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get historical average pressure for a sublocation at a specific day-of-week and hour
 */
async function getHistoricalAverage(
  db: any,
  subLocationId: string,
  dayOfWeek: number,
  hour: number
): Promise<number> {
  // Get average pressure for this sublocation, day-of-week, and hour over last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db.collection('demand_history').aggregate([
    {
      $match: {
        subLocationId,
        timestamp: { $gte: thirtyDaysAgo.toISOString() },
        dayOfWeek,
        hourOfDay: hour // Use hourOfDay field (0-23) for matching
      }
    },
    {
      $group: {
        _id: null,
        avgPressure: { $avg: '$demandPressure' }
      }
    }
  ]).toArray();

  return result[0]?.avgPressure || 1.0; // Default to 1.0 if no history
}
