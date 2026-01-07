import { NextResponse } from 'next/server';
import { LocationRepository } from '@/models/Location';

export async function GET() {
  try {
    const locations = await LocationRepository.findAll();
    return NextResponse.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Check if location with same name already exists for this customer
    const db = await import('@/lib/mongodb').then(m => m.getDb());
    const { ObjectId } = await import('mongodb');
    
    const existing = await db.collection('locations').findOne({
      customerId: new ObjectId(body.customerId),
      name: body.name,
    });
    
    if (existing) {
      return NextResponse.json(
        { error: `A location named "${body.name}" already exists for this customer` },
        { status: 400 }
      );
    }
    
    const location = await LocationRepository.create(body);
    
    // Auto-create default sublocation with same name as location
    const { SubLocationRepository } = await import('@/models/SubLocation');
    await SubLocationRepository.create({
      locationId: location._id!,
      label: body.name,
      description: 'Default sub-location',
      allocatedCapacity: body.totalCapacity || undefined,
    });
    
    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    console.error('Error creating location:', error);
    return NextResponse.json(
      { error: 'Failed to create location' },
      { status: 500 }
    );
  }
}
