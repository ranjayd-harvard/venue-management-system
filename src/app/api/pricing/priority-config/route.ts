import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Import the canonical type definition
import { PriorityConfig } from '@/models/types';

// Default configurations
const DEFAULT_CONFIGS: Omit<PriorityConfig, '_id' | 'createdAt' | 'updatedAt'>[] = [
  {
    level: 'CUSTOMER',
    minPriority: 1000,
    maxPriority: 1999,
    color: '#3B82F6', // Blue
    description: 'Customer-level ratesheets have lowest priority and apply across all locations',
    enabled: true
  },
  {
    level: 'LOCATION',
    minPriority: 2000,
    maxPriority: 2999,
    color: '#10B981', // Green
    description: 'Location-level ratesheets override customer rates for specific locations',
    enabled: true
  },
  {
    level: 'SUBLOCATION',
    minPriority: 3000,
    maxPriority: 3999,
    color: '#F59E0B', // Orange
    description: 'SubLocation-level ratesheets have highest priority for specific spaces',
    enabled: true
  },
  {
    level: 'EVENT',
    minPriority: 4000,
    maxPriority: 4999,
    color: '#EC4899', // Pink
    description: 'Event-level ratesheets have highest priority and override all other rates for specific events',
    enabled: true
  }
];

// GET: Fetch all priority configurations
export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const collection = db.collection<PriorityConfig>('priority_configs');

    // Check if configs exist
    const existingConfigs = await collection.find({}).toArray();

    // If no configs exist, initialize with defaults
    if (existingConfigs.length === 0) {
      const configsToInsert = DEFAULT_CONFIGS.map(config => ({
        ...config,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await collection.insertMany(configsToInsert);
      
      const newConfigs = await collection.find({}).toArray();
      return NextResponse.json(newConfigs);
    }

    return NextResponse.json(existingConfigs);
  } catch (error: any) {
    console.error('Error fetching priority configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch priority configurations', details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Update priority configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { _id, level, minPriority, maxPriority, color, description, enabled } = body;

    if (!_id || !level || minPriority === undefined || maxPriority === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: _id, level, minPriority, maxPriority' },
        { status: 400 }
      );
    }

    // Validate priority range
    if (minPriority >= maxPriority) {
      return NextResponse.json(
        { error: 'minPriority must be less than maxPriority' },
        { status: 400 }
      );
    }

    // Validate no overlap with other configs
    const db = await getDb();
    const collection = db.collection<PriorityConfig>('priority_configs');

    const otherConfigs = await collection
      .find({ _id: { $ne: new ObjectId(_id) } })
      .toArray();

    for (const config of otherConfigs) {
      // Check for overlap
      if (
        (minPriority >= config.minPriority && minPriority <= config.maxPriority) ||
        (maxPriority >= config.minPriority && maxPriority <= config.maxPriority) ||
        (minPriority <= config.minPriority && maxPriority >= config.maxPriority)
      ) {
        return NextResponse.json(
          {
            error: `Priority range overlaps with ${config.level} range (${config.minPriority}-${config.maxPriority})`
          },
          { status: 400 }
        );
      }
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(_id) },
      {
        $set: {
          level,
          minPriority,
          maxPriority,
          color: color || '#6B7280',
          description: description || '',
          enabled: enabled !== undefined ? enabled : true,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Priority configuration not found' },
        { status: 404 }
      );
    }

    const updated = await collection.findOne({ _id: new ObjectId(_id) });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating priority config:', error);
    return NextResponse.json(
      { error: 'Failed to update priority configuration', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Reset to default configurations
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const collection = db.collection<PriorityConfig>('priority_configs');

    // Delete all existing configs
    await collection.deleteMany({});

    // Insert default configs
    const configsToInsert = DEFAULT_CONFIGS.map(config => ({
      ...config,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await collection.insertMany(configsToInsert);

    const newConfigs = await collection.find({}).toArray();
    return NextResponse.json(newConfigs);
  } catch (error: any) {
    console.error('Error resetting priority configs:', error);
    return NextResponse.json(
      { error: 'Failed to reset priority configurations', details: error.message },
      { status: 500 }
    );
  }
}
