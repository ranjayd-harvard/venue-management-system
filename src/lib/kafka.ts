import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import * as dotenv from 'dotenv';

// Load environment variables
if (!process.env.KAFKA_BROKERS) {
  dotenv.config({ path: '.env.local' });
}

if (!process.env.KAFKA_BROKERS) {
  throw new Error(
    'Please add KAFKA_BROKERS to .env.local\n' +
    'Example: KAFKA_BROKERS=localhost:9092'
  );
}

// Kafka client configuration
const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'venue-management-app',
  brokers: process.env.KAFKA_BROKERS.split(','),
  logLevel: logLevel.ERROR,
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

// ===== PRODUCER SINGLETON =====

let producer: Producer | null = null;
let producerPromise: Promise<Producer> | null = null;

/**
 * Get Kafka producer singleton
 * Follows the same singleton pattern as MongoDB connection
 */
export async function getProducer(): Promise<Producer> {
  if (producerPromise) {
    return producerPromise;
  }

  producerPromise = (async () => {
    if (!producer) {
      producer = kafka.producer({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000
      });
      await producer.connect();
      console.log('✅ Kafka Producer connected');
    }
    return producer;
  })();

  return producerPromise;
}

// ===== CONSUMER FACTORY =====

/**
 * Create a Kafka consumer for a specific group
 * Each consumer group processes messages independently
 */
export function createConsumer(groupId: string): Consumer {
  const consumer = kafka.consumer({
    groupId,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    retry: {
      retries: 5
    }
  });
  return consumer;
}

// ===== GRACEFUL SHUTDOWN =====

/**
 * Disconnect Kafka producer
 * Called during application shutdown
 */
export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    console.log('👋 Kafka Producer disconnected');
    producer = null;
    producerPromise = null;
  }
}

// Handle graceful shutdown
process.on('SIGINT', disconnectKafka);
process.on('SIGTERM', disconnectKafka);

export default kafka;
