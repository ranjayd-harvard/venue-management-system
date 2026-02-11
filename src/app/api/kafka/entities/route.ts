import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

/**
 * GET /api/kafka/entities
 * Get sublocations and locations for dropdown selection
 */
export async function GET() {
  try {
    const db = await getDb();

    // Fetch all sublocations with location info
    const sublocations = await db.collection('sublocations')
      .aggregate([
        {
          $lookup: {
            from: 'locations',
            localField: 'locationId',
            foreignField: '_id',
            as: 'location'
          }
        },
        {
          $unwind: { path: '$location', preserveNullAndEmptyArrays: true }
        },
        {
          $project: {
            _id: 1,
            label: 1,
            locationId: 1,
            locationName: '$location.name'
          }
        },
        {
          $sort: { label: 1 }
        }
      ])
      .toArray();

    // Fetch all locations
    const locations = await db.collection('locations')
      .find({})
      .project({ _id: 1, name: 1 })
      .sort({ name: 1 })
      .toArray();

    return NextResponse.json({
      sublocations: sublocations.map(s => ({
        id: s._id.toString(),
        label: s.label,
        locationId: s.locationId?.toString(),
        locationName: s.locationName || 'Unknown Location'
      })),
      locations: locations.map(l => ({
        id: l._id.toString(),
        name: l.name
      }))
    });

  } catch (error) {
    console.error('Error fetching entities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
      { status: 500 }
    );
  }
}
