import { startDemandAggregator } from './consumers/demand-aggregator';
import { startSurgeUpdater } from './consumers/surge-updater';
import { disconnectKafka } from './lib/kafka';
import { disconnectMongoDB } from './lib/mongodb';

async function main() {
  console.log('🚀 Starting Kafka Consumer Service...');
  console.log('Environment:', {
    kafkaBrokers: process.env.KAFKA_BROKERS,
    mongoUri: process.env.MONGODB_URI?.replace(/:[^:@]+@/, ':****@'), // Hide password
    aggregatorGroup: process.env.KAFKA_GROUP_ID_AGGREGATOR,
    updaterGroup: process.env.KAFKA_GROUP_ID_UPDATER
  });

  try {
    // Start both consumer groups in parallel
    await Promise.all([
      startDemandAggregator(),
      startSurgeUpdater()
    ]);

    console.log('✅ All consumers running');
  } catch (error) {
    console.error('❌ Failed to start consumers:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('\n🛑 Shutting down consumers...');
  try {
    await disconnectKafka();
    await disconnectMongoDB();
    console.log('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main();
