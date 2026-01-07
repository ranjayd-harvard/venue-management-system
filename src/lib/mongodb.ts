import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables if not already loaded
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: '.env.local' });
}

if (!process.env.MONGODB_URI) {
  throw new Error(
    'Please add your MongoDB URI to .env.local\n' +
    'Create a .env.local file in the root directory with:\n' +
    'MONGODB_URI=mongodb://localhost:27017/venue-management'
  );
}

const uri: string = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable to preserve the connection
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, create a new client
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db();
}

export default clientPromise;
