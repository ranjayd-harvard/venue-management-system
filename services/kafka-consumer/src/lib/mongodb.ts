import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
if (!process.env.MONGODB_URI) {
  dotenv.config();
}

if (!process.env.MONGODB_URI) {
  throw new Error(
    'Please add MONGODB_URI to environment variables\n' +
    'Example: MONGODB_URI=mongodb://admin:password123@mongodb:27017/venue_management?authSource=admin'
  );
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// Create MongoDB client
client = new MongoClient(uri, options);
clientPromise = client.connect();

/**
 * Get MongoDB database connection
 * Returns promise that resolves to the database instance
 */
export async function getDb(): Promise<Db> {
  const connectedClient = await clientPromise;
  // Extract database name from URI or use default
  const dbName = uri.split('/').pop()?.split('?')[0] || 'venue_management';
  return connectedClient.db(dbName);
}

/**
 * Close MongoDB connection
 * Called during application shutdown
 */
export async function disconnectMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    console.log('👋 MongoDB disconnected');
  }
}

// Handle graceful shutdown
process.on('SIGINT', disconnectMongoDB);
process.on('SIGTERM', disconnectMongoDB);

export default clientPromise;
