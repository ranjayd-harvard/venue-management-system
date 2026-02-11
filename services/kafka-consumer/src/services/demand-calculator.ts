import { getDb } from '../lib/mongodb';
import { getProducer } from '../lib/kafka';
import { ObjectId } from 'mongodb';

const TOPIC_DEMAND_HOURLY = process.env.KAFKA_TOPIC_DEMAND_HOURLY || 'venue.demand.hourly';

interface BookingEvent {
  eventId: string;
  action: string;
  subLocationId: string;
  locationId?: string;
  startDate: string;
  endDate: string;
  attendees?: number;
  timestamp: string;
}

// In-memory buffer of booking events per sublocation per hour
// Key format: "subLocationId:hourISO"
const eventBuffer = new Map<string, BookingEvent[]>();

// Track last emission time to prevent duplicate metrics for the same hour
// Key format: "subLocationId:hourISO"
const lastEmissionTime = new Map<string, Date>();

/**
 * Calculate hourly demand metrics for a booking event
 * Aggregates events by sublocation and hour, then emits to demand.hourly topic
 */
export async function calculateHourlyDemand(event: BookingEvent): Promise<void> {
  const db = await getDb();

  // Determine which hour this booking affects
  const bookingHour = new Date(event.startDate);
  bookingHour.setMinutes(0, 0, 0);

  const hourEnd = new Date(bookingHour);
  hourEnd.setHours(hourEnd.getHours() + 1);

  console.log(`📊 Calculating demand for sublocation ${event.subLocationId} at ${bookingHour.toISOString()}`);

  // Add event to buffer (only if action is CREATED or UPDATED)
  const bufferKey = `${event.subLocationId}:${bookingHour.toISOString()}`;
  if (event.action === 'CREATED' || event.action === 'UPDATED') {
    if (!eventBuffer.has(bufferKey)) {
      eventBuffer.set(bufferKey, []);
    }
    eventBuffer.get(bufferKey)!.push(event);
    console.log(`📥 Added event to buffer: ${bufferKey}, buffer size: ${eventBuffer.get(bufferKey)!.length}`);
  } else if (event.action === 'DELETED') {
    // Remove event from buffer
    const buffer = eventBuffer.get(bufferKey);
    if (buffer) {
      const index = buffer.findIndex(e => e.eventId === event.eventId);
      if (index !== -1) {
        buffer.splice(index, 1);
        console.log(`🗑️  Removed event from buffer: ${bufferKey}, buffer size: ${buffer.length}`);
      }
    }
  }

  // Get all events from buffer for this hour
  const eventsInHour = eventBuffer.get(bufferKey) || [];
  const bookingsCount = eventsInHour.length;
  const totalAttendees = eventsInHour.reduce((sum, e) => sum + (e.attendees || 0), 0);

  // Get sublocation capacity (supply)
  const sublocation = await db.collection('sublocations').findOne({
    _id: new ObjectId(event.subLocationId)
  });

  const availableCapacity = sublocation?.maxCapacity || 100;

  // Calculate demand pressure (normalized per 100 capacity units)
  const demandPressure = bookingsCount / (availableCapacity / 100);

  // Get historical average for this hour-of-week
  const historicalAvg = await getHistoricalAverage(
    event.subLocationId,
    bookingHour.getDay(),
    bookingHour.getHours()
  );

  const capacityUtilization = (totalAttendees / availableCapacity) * 100;

  // Check if we should emit (throttle to prevent duplicate emissions)
  const lastEmission = lastEmissionTime.get(bufferKey);
  const now = new Date();
  const THROTTLE_MINUTES = 5; // Wait at least 5 minutes before re-emitting for same hour

  if (lastEmission) {
    const minutesSinceLastEmission = (now.getTime() - lastEmission.getTime()) / 1000 / 60;
    if (minutesSinceLastEmission < THROTTLE_MINUTES) {
      console.log(`⏸️  Skipping emission (throttled): last emitted ${minutesSinceLastEmission.toFixed(1)} minutes ago`);
      return; // Skip emission
    }
  }

  // Emit aggregated metric
  const demandMetric = {
    subLocationId: event.subLocationId,
    locationId: event.locationId,
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
    eventsProcessed: eventsInHour.map(e => e.eventId)
  };

  const producer = await getProducer();
  await producer.send({
    topic: TOPIC_DEMAND_HOURLY,
    messages: [{
      key: event.subLocationId,
      value: JSON.stringify(demandMetric)
    }]
  });

  // Update last emission time
  lastEmissionTime.set(bufferKey, now);

  console.log(`📊 Emitted hourly demand metric:`, {
    subLocationId: event.subLocationId,
    hour: bookingHour.toISOString(),
    bookingsCount,
    pressure: demandPressure.toFixed(2),
    historical: historicalAvg.toFixed(2)
  });

  // Store in demand_history collection for future historical calculations
  await storeHistoricalMetric(demandMetric);
}

/**
 * Get historical average pressure for a sublocation at a specific day-of-week and hour
 */
async function getHistoricalAverage(
  subLocationId: string,
  dayOfWeek: number,
  hour: number
): Promise<number> {
  const db = await getDb();

  // Get average pressure for this sublocation, day-of-week, and hour over last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db.collection('demand_history').aggregate([
    {
      $match: {
        subLocationId,
        timestamp: { $gte: thirtyDaysAgo },
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

/**
 * Store demand metric in history collection for future calculations
 */
async function storeHistoricalMetric(metric: any): Promise<void> {
  const db = await getDb();

  const hourDate = new Date(metric.hour);

  await db.collection('demand_history').insertOne({
    ...metric,
    dayOfWeek: hourDate.getDay(),
    hourOfDay: hourDate.getHours(), // 0-23 for historical queries (don't overwrite hour ISO string!)
    createdAt: new Date()
  });

  console.log(`💾 Stored historical metric for ${metric.subLocationId} at ${metric.hour}`);
}
