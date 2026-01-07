import { NextResponse } from 'next/server';
import { VenueRepository } from '@/models/Venue';

export async function GET() {
  try {
    const venues = await VenueRepository.findAll();
    return NextResponse.json(venues);
  } catch (error) {
    console.error('Error fetching venues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch venues' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const venue = await VenueRepository.create(body);
    return NextResponse.json(venue, { status: 201 });
  } catch (error) {
    console.error('Error creating venue:', error);
    return NextResponse.json(
      { error: 'Failed to create venue' },
      { status: 500 }
    );
  }
}
