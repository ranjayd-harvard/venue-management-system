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
          description: 'Sub-location-level ratesheets have highest priority',
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
      type: config.type,
      minPriority: config.minPriority,
      maxPriority: config.maxPriority,
      color: config.color,
      description: config.description,
      isActive: config.isActive,
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
