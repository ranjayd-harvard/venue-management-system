import { NextResponse } from 'next/server';
import { SubLocationVenueRepository } from '@/models/SubLocationVenue';

export async function GET() {
  try {
    const db = await import('@/lib/mongodb').then(m => m.getDb());
    const relationships = await db.collection('sublocation_venues').find({}).toArray();
    
    // Convert ObjectIds to strings for JSON serialization
    const serializedRelationships = relationships.map(rel => ({
      ...rel,
      _id: rel._id.toString(),
      subLocationId: rel.subLocationId.toString(),
      venueId: rel.venueId.toString(),
    }));
    
    return NextResponse.json(serializedRelationships);
  } catch (error) {
    console.error('Error fetching relationships:', error);
    return NextResponse.json(
      { error: 'Failed to fetch relationships' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subLocationId, venueId } = body;

    // Check if relationship already exists
    const exists = await SubLocationVenueRepository.exists(subLocationId, venueId);
    if (exists) {
      return NextResponse.json(
        { error: 'Relationship already exists' },
        { status: 400 }
      );
    }

    const relationship = await SubLocationVenueRepository.create(subLocationId, venueId);
    return NextResponse.json(relationship, { status: 201 });
  } catch (error) {
    console.error('Error creating relationship:', error);
    return NextResponse.json(
      { error: 'Failed to create relationship' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { subLocationId, venueId } = body;

    const deleted = await SubLocationVenueRepository.delete(subLocationId, venueId);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Relationship not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting relationship:', error);
    return NextResponse.json(
      { error: 'Failed to delete relationship' },
      { status: 500 }
    );
  }
}
