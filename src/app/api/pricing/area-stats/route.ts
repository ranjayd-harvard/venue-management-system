import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET(request: Request) {
  try {
    const db = await getDb();
    
    // Aggregate sublocation rates by city and state
    const stats = await db.collection('sublocations').aggregate([
      {
        $match: {
          defaultHourlyRate: { $exists: true, $gt: 0 },
          pricingEnabled: true
        }
      },
      {
        $lookup: {
          from: 'locations',
          localField: 'locationId',
          foreignField: '_id',
          as: 'location'
        }
      },
      {
        $unwind: '$location'
      },
      {
        $group: {
          _id: {
            city: '$location.city',
            state: '$location.state'
          },
          avgRate: { $avg: '$defaultHourlyRate' },
          minRate: { $min: '$defaultHourlyRate' },
          maxRate: { $max: '$defaultHourlyRate' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          city: '$_id.city',
          state: '$_id.state',
          avgRate: { $round: ['$avgRate', 2] },
          minRate: 1,
          maxRate: 1,
          count: 1
        }
      }
    ]).toArray();

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching area stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch area statistics' },
      { status: 500 }
    );
  }
}
