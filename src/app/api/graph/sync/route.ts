import { NextResponse } from 'next/server';
import { syncToNeo4j } from '@/lib/neo4j';

export async function POST() {
  try {
    await syncToNeo4j();
    return NextResponse.json({ success: true, message: 'Data synced to Neo4j successfully' });
  } catch (error) {
    console.error('Error syncing to Neo4j:', error);
    return NextResponse.json(
      { error: 'Failed to sync to Neo4j. Make sure Neo4j is running.' },
      { status: 500 }
    );
  }
}
