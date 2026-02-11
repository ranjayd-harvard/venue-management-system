import { Consumer, EachMessagePayload } from 'kafkajs';
import { createConsumer } from '../lib/kafka';
import { updateSurgeConfigDemand } from '../services/surge-service';

const TOPIC_DEMAND_HOURLY = process.env.KAFKA_TOPIC_DEMAND_HOURLY || 'venue.demand.hourly';
const GROUP_ID = process.env.KAFKA_GROUP_ID_UPDATER || 'surge-updater';

/**
 * Start surge updater consumer
 * Consumes hourly demand metrics and updates surge configs
 */
export async function startSurgeUpdater() {
  const consumer: Consumer = createConsumer(GROUP_ID);

  await consumer.connect();
  console.log(`✅ Surge Updater connected (group: ${GROUP_ID})`);

  await consumer.subscribe({ topic: TOPIC_DEMAND_HOURLY, fromBeginning: false });
  console.log(`📥 Subscribed to topic: ${TOPIC_DEMAND_HOURLY}`);

  await consumer.run({
    eachMessage: async (payload: EachMessagePayload) => {
      const { message, partition } = payload;

      try {
        const demandMetric = JSON.parse(message.value!.toString());
        console.log(`📈 [Partition ${partition}] Processing demand metric:`, {
          subLocationId: demandMetric.subLocationId,
          hour: demandMetric.hour,
          bookings: demandMetric.bookingsCount,
          pressure: demandMetric.demandPressure.toFixed(2)
        });

        // Update surge configs and auto-materialize ratesheets
        await updateSurgeConfigDemand(demandMetric);

      } catch (error) {
        console.error('❌ Error processing demand metric:', error);
        // TODO: Send to dead-letter queue
        // For now, log and continue
      }
    }
  });

  console.log('🔄 Surge updater is running...');
}
