import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'Missing entityType or entityId' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const history = await db
      .collection('rate_history')
      .find({
        entityType,
        entityId: new ObjectId(entityId)
      })
      .sort({ changedAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching rate history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rate history' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      entityType, 
      entityId, 
      entityName, 
      oldRate, 
      newRate, 
      changedBy, 
      reason 
    } = body;

    if (!entityType || !entityId || newRate === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const result = await db.collection('rate_history').insertOne({
      entityType,
      entityId: new ObjectId(entityId),
      entityName,
      oldRate: oldRate || null,
      newRate: parseFloat(newRate),
      changedBy: changedBy || 'system',
      changedAt: new Date(),
      reason: reason || null
    });

    return NextResponse.json({ 
      success: true, 
      id: result.insertedId 
    });
  } catch (error) {
    console.error('Error creating rate history:', error);
    return NextResponse.json(
      { error: 'Failed to create rate history entry' },
      { status: 500 }
    );
  }
}
