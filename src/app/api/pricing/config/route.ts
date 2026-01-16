// src/app/api/pricing/config/route.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// GET /api/pricing/config - Get priority configurations
export async function GET() {
  try {
    const db = await getDb();
    
    // Get priority configs from database
    let configs = await db
      .collection('priority_config')
      .find({})
      .sort({ type: 1 })
      .toArray();

    // Check if EVENT config exists, if not add it (for existing databases)
    const hasEventConfig = configs.some(c => c.type === 'EVENT');
    if (!hasEventConfig && configs.length > 0) {
      const eventConfig = {
        type: 'EVENT',
        minPriority: 4000,
        maxPriority: 4999,
        color: 'pink',
        description: 'Event-level ratesheets have highest priority and override all other levels',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.collection('priority_config').insertOne(eventConfig);
      // Re-fetch configs to get the inserted document with _id
      configs = await db
        .collection('priority_config')
        .find({})
        .sort({ type: 1 })
        .toArray();
      console.log('✅ Added EVENT priority configuration to existing database');
    }

    // If no configs exist, initialize them
    if (configs.length === 0) {
      const defaultConfigs = [
        {
          type: 'CUSTOMER',
          minPriority: 1000,
          maxPriority: 1999,
          color: 'blue',
          description: 'Customer-level ratesheets have lowest priority',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'LOCATION',
          minPriority: 2000,
          maxPriority: 2999,
          color: 'green',
          description: 'Location-level ratesheets override customer rates',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'SUBLOCATION',
          minPriority: 3000,
          maxPriority: 3999,
          color: 'purple',
          description: 'Sub-location-level ratesheets have high priority',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          type: 'EVENT',
          minPriority: 4000,
          maxPriority: 4999,
          color: 'pink',
          description: 'Event-level ratesheets have highest priority and override all other levels',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await db.collection('priority_config').insertMany(defaultConfigs);
      configs = defaultConfigs;
      
      console.log('✅ Initialized default priority configurations');
    }

    // Transform ObjectId to string for JSON serialization
    const serializedConfigs = configs.map((config) => ({
      _id: config._id?.toString(),
      level: config.type, // Map 'type' from DB to 'level' for frontend
      minPriority: config.minPriority,
      maxPriority: config.maxPriority,
      color: config.color,
      description: config.description,
      enabled: config.isActive, // Map 'isActive' to 'enabled' to match PriorityConfig interface
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }));

    return NextResponse.json(serializedConfigs);
  } catch (error) {
    console.error('Error fetching priority configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch priority configurations' },
      { status: 500 }
    );
  }
}

// POST /api/pricing/config - Update priority configuration
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, minPriority, maxPriority, color, description } = body;

    if (!type || minPriority === undefined || maxPriority === undefined) {
      return NextResponse.json(
        { error: 'Type, minPriority, and maxPriority are required' },
        { status: 400 }
      );
    }

    if (minPriority >= maxPriority) {
      return NextResponse.json(
        { error: 'minPriority must be less than maxPriority' },
        { status: 400 }
      );
    }

    const db = await getDb();

    const result = await db.collection('priority_config').updateOne(
      { type },
      {
        $set: {
          minPriority,
          maxPriority,
          color: color || 'blue',
          description: description || '',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          type,
          isActive: true,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      message: 'Priority configuration updated successfully',
      modified: result.modifiedCount,
      upserted: result.upsertedCount,
    });
  } catch (error) {
    console.error('Error updating priority config:', error);
    return NextResponse.json(
      { error: 'Failed to update priority configuration' },
      { status: 500 }
    );
  }
}
