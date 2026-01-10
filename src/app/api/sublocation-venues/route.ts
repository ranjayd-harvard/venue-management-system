import { NextResponse } from 'next/server';
import { SubLocationVenueRepository } from '@/models/SubLocationVenue';

export async function GET() {
  try {
    const relationships = await SubLocationVenueRepository.findAll();
    
    // Filter out any relationships with null IDs and safely convert to string
    const formattedRelationships = relationships
      .filter(r => r._id && r.subLocationId && r.venueId) // Filter out null values
      .map(r => ({
        _id: r._id!.toString(),
        subLocationId: r.subLocationId!.toString(),
        venueId: r.venueId!.toString(),
        createdAt: r.createdAt,
      }));

    return NextResponse.json(formattedRelationships);
  } catch (error) {
    console.error('Error fetching relationships:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sublocation-venue relationships' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { subLocationId, venueId } = await request.json();

    if (!subLocationId || !venueId) {
      return NextResponse.json(
        { error: 'Missing subLocationId or venueId' },
        { status: 400 }
      );
    }

    const id = await SubLocationVenueRepository.create(
      subLocationId,
      venueId
    );

    return NextResponse.json({ 
      success: true, 
      id: id.toString() 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating relationship:', error);
    return NextResponse.json(
      { error: 'Failed to create sublocation-venue relationship' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing relationship ID' },
        { status: 400 }
      );
    }

    const success = await SubLocationVenueRepository.deleteById(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Relationship not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting relationship:', error);
    return NextResponse.json(
      { error: 'Failed to delete sublocation-venue relationship' },
      { status: 500 }
    );
  }
}
