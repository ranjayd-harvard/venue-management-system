import { NextResponse } from 'next/server';
import { LocationRepository } from '@/models/Location';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const location = await LocationRepository.findById(new ObjectId(params.id));
    
    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(location);
  } catch (error) {
    console.error('Error fetching location:', error);
    return NextResponse.json(
      { error: 'Failed to fetch location' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { 
      defaultHourlyRate, 
      name, 
      address, 
      city, 
      state, 
      zipCode, 
      country,
      totalCapacity 
    } = body;

    // Get current location data for history tracking
    const currentLocation = await LocationRepository.findById(new ObjectId(params.id));
    if (!currentLocation) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    const updates: any = {};
    
    // Track if rate is changing
    let rateChanged = false;
    let oldRate = currentLocation.defaultHourlyRate;
    
    // PATCH: Only update fields that are provided
    if (defaultHourlyRate !== undefined) {
      updates.defaultHourlyRate = parseFloat(defaultHourlyRate);
      rateChanged = oldRate !== updates.defaultHourlyRate;
    }
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (zipCode !== undefined) updates.zipCode = zipCode;
    if (country !== undefined) updates.country = country;
    if (totalCapacity !== undefined) updates.totalCapacity = totalCapacity;

    const success = await LocationRepository.update(new ObjectId(params.id), updates);

    if (!success) {
      return NextResponse.json(
        { error: 'Location not found or no changes made' },
        { status: 404 }
      );
    }

    // Record rate history if rate changed
    if (rateChanged) {
      try {
        const db = await getDb();
        await db.collection('rate_history').insertOne({
          entityType: 'location',
          entityId: new ObjectId(params.id),
          entityName: currentLocation.name,
          oldRate: oldRate || null,
          newRate: parseFloat(defaultHourlyRate),
          changedBy: 'system', // TODO: Replace with actual user from session
          changedAt: new Date(),
          reason: body.reason || null
        });
        console.log('✅ Rate history recorded for location:', currentLocation.name);
      } catch (historyError) {
        console.error('⚠️ Failed to record rate history:', historyError);
        // Don't fail the request if history fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating location:', error);
    return NextResponse.json(
      { error: 'Failed to update location' },
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

    // Get current location data for history tracking
    const currentLocation = await LocationRepository.findById(new ObjectId(params.id));
    if (!currentLocation) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Track if rate is changing
    let rateChanged = false;
    let oldRate = currentLocation.defaultHourlyRate;
    
    if (body.defaultHourlyRate !== undefined) {
      rateChanged = oldRate !== parseFloat(body.defaultHourlyRate);
    }

    // PUT: Replace entire resource (but keep _id and createdAt)
    const success = await LocationRepository.update(new ObjectId(params.id), body);

    if (!success) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Record rate history if rate changed
    if (rateChanged && body.defaultHourlyRate !== undefined) {
      try {
        const db = await getDb();
        await db.collection('rate_history').insertOne({
          entityType: 'location',
          entityId: new ObjectId(params.id),
          entityName: body.name || currentLocation.name,
          oldRate: oldRate || null,
          newRate: parseFloat(body.defaultHourlyRate),
          changedBy: 'system',
          changedAt: new Date(),
          reason: body.reason || null
        });
        console.log('✅ Rate history recorded for location (PUT):', body.name || currentLocation.name);
      } catch (historyError) {
        console.error('⚠️ Failed to record rate history:', historyError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating location:', error);
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const success = await LocationRepository.delete(new ObjectId(params.id));

    if (!success) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting location:', error);
    return NextResponse.json(
      { error: 'Failed to delete location' },
      { status: 500 }
    );
  }
}
