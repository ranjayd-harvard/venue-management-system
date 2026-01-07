import { NextResponse } from 'next/server';
import { SubLocationRepository } from '@/models/SubLocation';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId');

    if (locationId) {
      const sublocations = await SubLocationRepository.findByLocationId(locationId);
      return NextResponse.json(sublocations);
    }

    const sublocations = await SubLocationRepository.findAll();
    return NextResponse.json(sublocations);
  } catch (error) {
    console.error('Error fetching sub-locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sub-locations' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Check if sublocation with same label already exists for this location
    const db = await import('@/lib/mongodb').then(m => m.getDb());
    const { ObjectId } = await import('mongodb');
    
    const existing = await db.collection('sublocations').findOne({
      locationId: new ObjectId(body.locationId),
      label: body.label,
    });
    
    if (existing) {
      return NextResponse.json(
        { error: `A sub-location named "${body.label}" already exists for this location` },
        { status: 400 }
      );
    }
    
    const sublocation = await SubLocationRepository.create(body);
    return NextResponse.json(sublocation, { status: 201 });
  } catch (error) {
    console.error('Error creating sub-location:', error);
    return NextResponse.json(
      { error: 'Failed to create sub-location' },
      { status: 500 }
    );
  }
}
