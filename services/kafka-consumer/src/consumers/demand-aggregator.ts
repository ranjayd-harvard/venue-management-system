import { Consumer, EachMessagePayload } from 'kafkajs';
import { createConsumer } from '../lib/kafka';
import { calculateHourlyDemand } from '../services/demand-calculator';

const TOPIC_BOOKING_EVENTS = process.env.KAFKA_TOPIC_BOOKING_EVENTS || 'venue.booking.events';
const GROUP_ID = process.env.KAFKA_GROUP_ID_AGGREGATOR || 'demand-aggregator';

/**
 * Start demand aggregator consumer
 * Consumes booking events and calculates hourly demand metrics
 */
export async function startDemandAggregator() {
  const consumer: Consumer = createConsumer(GROUP_ID);

  await consumer.connect();
  console.log(`✅ Demand Aggregator connected (group: ${GROUP_ID})`);

  await consumer.subscribe({ topic: TOPIC_BOOKING_EVENTS, fromBeginning: false });
  console.log(`📥 Subscribed to topic: ${TOPIC_BOOKING_EVENTS}`);

  await consumer.run({
    eachMessage: async (payload: EachMessagePayload) => {
      const { message, partition } = payload;

      try {
        const event = JSON.parse(message.value!.toString());
        console.log(`📥 [Partition ${partition}] Processing booking event:`, {
          action: event.action,
          eventId: event.eventId,
          subLocationId: event.subLocationId
        });

        // Calculate hourly demand for the affected sublocation
        await calculateHourlyDemand(event);

      } catch (error) {
        console.error('❌ Error processing booking event:', error);
        // TODO: Send to dead-letter queue
        // For now, log and continue (message will be committed)
      }
    }
  });

  console.log('🔄 Demand aggregator is running...');
}
