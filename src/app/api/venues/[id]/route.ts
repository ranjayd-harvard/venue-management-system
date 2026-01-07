import { NextResponse } from 'next/server';
import { VenueRepository } from '@/models/Venue';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const venue = await VenueRepository.findById(params.id);
    if (!venue) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(venue);
  } catch (error) {
    console.error('Error fetching venue:', error);
    return NextResponse.json(
      { error: 'Failed to fetch venue' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const venue = await VenueRepository.update(params.id, body);
    if (!venue) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(venue);
  } catch (error) {
    console.error('Error updating venue:', error);
    return NextResponse.json(
      { error: 'Failed to update venue' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await VenueRepository.delete(params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Venue not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting venue:', error);
    return NextResponse.json(
      { error: 'Failed to delete venue' },
      { status: 500 }
    );
  }
}
