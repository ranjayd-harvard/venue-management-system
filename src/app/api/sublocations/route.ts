import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { SubLocationRepository } from '@/models/SubLocation';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId');

    let sublocations;
    
    if (locationId) {
      // Convert string to ObjectId
      const locationObjectId = new ObjectId(locationId);
      sublocations = await SubLocationRepository.findByLocationId(locationObjectId);
      
      console.log(`[API] Found ${sublocations.length} sublocations for location ${locationId}`);
    } else {
      sublocations = await SubLocationRepository.findAll();
      console.log(`[API] Found ${sublocations.length} total sublocations`);
    }

    // Convert ObjectIds to strings for JSON serialization
    const formattedSublocations = sublocations.map(sl => ({
      _id: sl._id!.toString(),
      locationId: sl.locationId.toString(),
      label: sl.label,
      description: sl.description,
      minCapacity: sl.minCapacity,
      maxCapacity: sl.maxCapacity,
      defaultCapacity: sl.defaultCapacity,
      allocatedCapacity: sl.allocatedCapacity,
      capacityConfig: sl.capacityConfig,
      attributes: sl.attributes,
      pricingEnabled: sl.pricingEnabled ?? false,
      isActive: sl.isActive ?? true,
      defaultHourlyRate: sl.defaultHourlyRate,
      createdAt: sl.createdAt,
      updatedAt: sl.updatedAt,
    }));

    console.log(`[API] Returning ${formattedSublocations.length} sublocations`);
    console.log('[API] Sample sublocation:', formattedSublocations[0]);

    return NextResponse.json(formattedSublocations);
  } catch (error) {
    console.error('Error fetching sublocations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sublocations' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locationId, label, description, allocatedCapacity, attributes, pricingEnabled, isActive, defaultHourlyRate } = body;

    if (!locationId || !label) {
      return NextResponse.json(
        { error: 'Missing required fields: locationId and label' },
        { status: 400 }
      );
    }

    const sublocationId = await SubLocationRepository.create({
      locationId: new ObjectId(locationId),
      label,
      description,
      allocatedCapacity,
      attributes: attributes || [],
      pricingEnabled: pricingEnabled ?? false,
      isActive: isActive ?? true,
      defaultHourlyRate,
    });

    return NextResponse.json({ 
      success: true, 
      id: sublocationId.toString() 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating sublocation:', error);
    return NextResponse.json(
      { error: 'Failed to create sublocation' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing sublocation ID' },
        { status: 400 }
      );
    }

    // Convert locationId if provided
    if (updates.locationId) {
      updates.locationId = new ObjectId(updates.locationId);
    }

    const success = await SubLocationRepository.update(new ObjectId(id), updates);

    if (!success) {
      return NextResponse.json(
        { error: 'SubLocation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating sublocation:', error);
    return NextResponse.json(
      { error: 'Failed to update sublocation' },
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
        { error: 'Missing sublocation ID' },
        { status: 400 }
      );
    }

    const success = await SubLocationRepository.delete(new ObjectId(id));

    if (!success) {
      return NextResponse.json(
        { error: 'SubLocation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sublocation:', error);
    return NextResponse.json(
      { error: 'Failed to delete sublocation' },
      { status: 500 }
    );
  }
}
