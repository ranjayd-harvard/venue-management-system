/**
 * Generate synthetic booking load for testing Kafka surge pricing
 *
 * Usage:
 *   npx tsx scripts/generate-booking-load.ts --scenario PEAK_HOUR --sublocation <id>
 *   npx tsx scripts/generate-booking-load.ts --scenario NORMAL --sublocation <id>
 *
 * Scenarios:
 *   PEAK_HOUR: 20 bookings/hour for 1 hour (high demand)
 *   NORMAL: 5 bookings/hour for 2 hours (moderate demand)
 *   LOW: 2 bookings/hour for 1 hour (low demand)
 */

import { getProducer, disconnectKafka } from '../src/lib/kafka';
import { ObjectId } from 'mongodb';

const TOPIC_BOOKING_EVENTS = process.env.KAFKA_TOPIC_BOOKING_EVENTS || 'venue.booking.events';

interface Scenario {
  rate: number;      // Bookings per hour
  duration: number;  // Hours to run
}

const SCENARIOS: Record<string, Scenario> = {
  RAPID_TEST: { rate: 60, duration: 0.1 }, // 60/hr for 6 min = 6 events, 1 per minute
  PEAK_HOUR: { rate: 20, duration: 1 },    // 20/hr for 1 hr = 20 events, 1 per 3 min
  NORMAL: { rate: 5, duration: 2 },        // 5/hr for 2 hr = 10 events, 1 per 12 min
  LOW: { rate: 2, duration: 1 },           // 2/hr for 1 hr = 2 events, 1 per 30 min
  CUSTOM: { rate: 0, duration: 0 }         // Placeholder for custom mode
};

async function sleep(ms: number): Promise<void> {
  // Ensure sleep duration is valid and positive
  const duration = Math.max(0, Math.floor(ms));
  if (!isFinite(duration) || duration < 0) {
    console.error(`⚠️  Invalid sleep duration: ${ms}ms, using 0ms`);
    return Promise.resolve();
  }
  return new Promise(resolve => setTimeout(resolve, duration));
}

async function emitBookingEvent(
  subLocationId: string,
  locationId: string,
  eventIndex: number
): Promise<void> {
  try {
    const producer = await getProducer();

    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(startDate.getHours() + 1); // Event starts in 1 hour

    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 2); // 2-hour event

    const message = {
      eventId: new ObjectId().toString(),
      action: 'CREATED',
      timestamp: now.toISOString(),
      subLocationId,
      locationId,
      eventName: `Test Event ${eventIndex}`,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      attendees: Math.floor(Math.random() * 50) + 10, // 10-60 attendees
      producedBy: 'synthetic-generator'
    };

    await producer.send({
      topic: TOPIC_BOOKING_EVENTS,
      messages: [{
        key: subLocationId,
        value: JSON.stringify(message)
      }]
    });

    console.log(`📤 [${eventIndex}] Emitted booking event:`, {
      eventId: message.eventId.substring(0, 8),
      attendees: message.attendees,
      startHour: startDate.getHours()
    });
  } catch (error) {
    console.error(`❌ [${eventIndex}] Failed to emit event:`, error);
    // Don't throw - continue with next event
  }
}

async function generateLoad(
  scenario: keyof typeof SCENARIOS,
  subLocationId: string,
  locationId: string
): Promise<void> {
  const config = SCENARIOS[scenario];
  if (!config) {
    throw new Error(`Unknown scenario: ${scenario}. Available: ${Object.keys(SCENARIOS).join(', ')}`);
  }

  console.log(`🚀 Starting load generation:`, {
    scenario,
    rate: `${config.rate} bookings/hour`,
    duration: `${config.duration} hour(s)`,
    subLocationId,
    locationId
  });

  const totalEvents = config.rate * config.duration;
  // Calculate interval: spread events evenly over the duration
  // For PEAK_HOUR (20/hr, 1hr): 3600000ms / 20 = 180000ms (3 min between events)
  const intervalMs = Math.floor((3600000 * config.duration) / totalEvents);

  // Safety check: ensure interval is positive and reasonable
  if (intervalMs <= 0 || !isFinite(intervalMs)) {
    throw new Error(`Invalid interval calculated: ${intervalMs}ms. Check scenario configuration.`);
  }

  console.log(`⏱️  Event interval: ${intervalMs}ms (${(intervalMs / 1000).toFixed(1)}s between events)`);

  // Wait 2 seconds for Kafka to establish topic leadership
  console.log('⏳ Waiting for Kafka topic initialization...');
  await sleep(2000);

  for (let i = 1; i <= totalEvents; i++) {
    await emitBookingEvent(subLocationId, locationId, i);

    if (i < totalEvents) {
      await sleep(intervalMs);
    }
  }

  console.log(`✅ Generated ${totalEvents} booking events`);
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const scenarioIndex = args.indexOf('--scenario');
  const sublocationIndex = args.indexOf('--sublocation');
  const locationIndex = args.indexOf('--location');
  const rateIndex = args.indexOf('--rate');         // Messages per second
  const countIndex = args.indexOf('--count');       // Total message count

  if (sublocationIndex === -1) {
    console.error('Usage: npx tsx scripts/generate-booking-load.ts --sublocation <ID> [--location <ID>] [--scenario <SCENARIO> | --rate <NUM> --count <NUM>]');
    console.error('Available scenarios:', Object.keys(SCENARIOS).filter(s => s !== 'CUSTOM').join(', '));
    console.error('Custom mode: --rate <messages/sec> --count <total messages>');
    process.exit(1);
  }

  const subLocationId = args[sublocationIndex + 1];
  const locationId = locationIndex !== -1 ? args[locationIndex + 1] : new ObjectId().toString();

  try {
    // Check if using custom rate/count
    if (rateIndex !== -1 && countIndex !== -1) {
      const messagesPerSecond = parseFloat(args[rateIndex + 1]);
      const totalMessages = parseInt(args[countIndex + 1]);

      console.log('🚀 Starting custom load generation:', {
        messagesPerSecond,
        totalMessages,
        subLocationId,
        locationId
      });

      const intervalMs = Math.floor(1000 / messagesPerSecond);
      console.log(`⏱️  Event interval: ${intervalMs}ms (${messagesPerSecond} msg/sec)`);

      // Wait 2 seconds for Kafka to establish topic leadership
      console.log('⏳ Waiting for Kafka topic initialization...');
      await sleep(2000);

      for (let i = 1; i <= totalMessages; i++) {
        await emitBookingEvent(subLocationId, locationId, i);
        if (i < totalMessages) {
          await sleep(intervalMs);
        }
      }

      console.log(`✅ Generated ${totalMessages} booking events`);
    } else {
      // Use predefined scenario
      if (scenarioIndex === -1) {
        console.error('❌ Must provide either --scenario or both --rate and --count');
        process.exit(1);
      }

      const scenario = args[scenarioIndex + 1] as keyof typeof SCENARIOS;
      await generateLoad(scenario, subLocationId, locationId);
    }

    console.log('\n✅ Load generation complete!');
    console.log('\nNext steps:');
    console.log('1. Check Kafka topics:');
    console.log('   docker exec venue-kafka kafka-console-consumer --bootstrap-server kafka:29092 --topic venue.booking.events --partition 0 --offset earliest');
    console.log('2. Check demand_history collection in MongoDB');
    console.log('3. Check surge_configs for updated demandSupplyParams');
    console.log('4. Check ratesheets for newly materialized surge ratesheets');
  } catch (error) {
    console.error('❌ Error generating load:', error);
    process.exit(1);
  } finally {
    await disconnectKafka();
    process.exit(0);
  }
}

main();
