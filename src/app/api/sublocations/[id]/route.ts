import { NextResponse } from 'next/server';
import { SubLocationRepository } from '@/models/SubLocation';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Convert string to ObjectId
    const sublocation = await SubLocationRepository.findById(new ObjectId(params.id));
    if (!sublocation) {
      return NextResponse.json(
        { error: 'Sub-location not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(sublocation);
  } catch (error) {
    console.error('Error fetching sub-location:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sub-location' },
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
    const { defaultHourlyRate, pricingEnabled, ...otherUpdates } = body;

    console.log('🔍 PATCH sublocation:', params.id);
    console.log('📦 Body:', body);

    // Convert string to ObjectId
    const objectId = new ObjectId(params.id);

    // Get current sublocation data for history tracking
    const currentSublocation = await SubLocationRepository.findById(objectId);
    if (!currentSublocation) {
      console.error('❌ SubLocation not found:', params.id);
      return NextResponse.json(
        { error: 'SubLocation not found' },
        { status: 404 }
      );
    }

    console.log('✅ Found sublocation:', currentSublocation.label);

    const updates: any = { ...otherUpdates };
    
    // Track if rate is changing
    let rateChanged = false;
    let oldRate = currentSublocation.defaultHourlyRate;
    
    if (defaultHourlyRate !== undefined) {
      updates.defaultHourlyRate = parseFloat(defaultHourlyRate);
      rateChanged = oldRate !== updates.defaultHourlyRate;
      console.log('💰 Rate change:', oldRate, '→', updates.defaultHourlyRate);
    }
    
    if (pricingEnabled !== undefined) {
      updates.pricingEnabled = pricingEnabled;
      console.log('🔧 Pricing enabled:', pricingEnabled);
    }

    // Update using ObjectId
    const success = await SubLocationRepository.update(objectId, updates);

    if (!success) {
      console.error('❌ Update failed for:', params.id);
      return NextResponse.json(
        { error: 'SubLocation not found' },
        { status: 404 }
      );
    }

    console.log('✅ Update successful');

    // Record rate history if rate changed
    if (rateChanged) {
      try {
        const db = await getDb();
        await db.collection('rate_history').insertOne({
          entityType: 'sublocation',
          entityId: objectId,
          entityName: currentSublocation.label,
          oldRate: oldRate || null,
          newRate: parseFloat(defaultHourlyRate),
          changedBy: 'system', // TODO: Replace with actual user from session
          changedAt: new Date(),
          reason: body.reason || null
        });
        console.log('✅ Rate history recorded for sublocation:', currentSublocation.label);
      } catch (historyError) {
        console.error('⚠️ Failed to record rate history:', historyError);
        // Don't fail the request if history fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error updating sub-location:', error);
    console.error('Stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to update sub-location', details: error.message },
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
    
    // Convert string to ObjectId
    const objectId = new ObjectId(params.id);
    
    const sublocation = await SubLocationRepository.update(objectId, body);
    if (!sublocation) {
      return NextResponse.json(
        { error: 'Sub-location not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(sublocation);
  } catch (error) {
    console.error('Error updating sub-location:', error);
    return NextResponse.json(
      { error: 'Failed to update sub-location' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Convert string to ObjectId
    const objectId = new ObjectId(params.id);
    
    const deleted = await SubLocationRepository.delete(objectId);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Sub-location not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sub-location:', error);
    return NextResponse.json(
      { error: 'Failed to delete sub-location' },
      { status: 500 }
    );
  }
}
