import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

/**
 * Standalone Priority Config Initialization API
 * 
 * Hit this endpoint once to initialize priority configs:
 * GET http://localhost:3031/api/pricing/init
 */

const DEFAULT_CONFIGS = [
  {
    type: 'CUSTOMER',
    minPriority: 1000,
    maxPriority: 1999,
    color: '#3B82F6', // Blue
    description: 'Customer-level ratesheets have lowest priority and apply across all locations',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    type: 'LOCATION',
    minPriority: 2000,
    maxPriority: 2999,
    color: '#10B981', // Green
    description: 'Location-level ratesheets override customer rates for specific locations',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    type: 'SUBLOCATION',
    minPriority: 3000,
    maxPriority: 3999,
    color: '#F59E0B', // Orange
    description: 'SubLocation-level ratesheets have highest priority for specific spaces',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const collection = db.collection('priority_configs');

    // Check if configs already exist
    const existingCount = await collection.countDocuments();

    if (existingCount > 0) {
      const existing = await collection.find({}).toArray();
      return NextResponse.json({
        status: 'already_exists',
        message: `Found ${existingCount} existing priority configurations`,
        configs: existing,
      });
    }

    // Create new configs
    await collection.insertMany(DEFAULT_CONFIGS);

    const newConfigs = await collection.find({}).toArray();

    return NextResponse.json({
      status: 'created',
      message: 'Successfully created priority configurations',
      configs: newConfigs,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Initialization error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to initialize priority configurations',
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// Force reset (use with caution!)
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const collection = db.collection('priority_configs');

    // Delete all existing configs
    await collection.deleteMany({});

    // Insert defaults
    await collection.insertMany(DEFAULT_CONFIGS);

    const newConfigs = await collection.find({}).toArray();

    return NextResponse.json({
      status: 'reset',
      message: 'Successfully reset priority configurations to defaults',
      configs: newConfigs,
    });
  } catch (error: any) {
    console.error('Reset error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to reset priority configurations',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
