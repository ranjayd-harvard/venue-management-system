// src/app/api/pricing/calculate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { PricingEngine } from '@/lib/pricing-engine';

interface TimeWindow {
  startTime: string;
  endTime: string;
  pricePerHour: number;
}

interface DurationRule {
  durationHours: number;
  totalPrice: number;
  description: string;
}

interface Ratesheet {
  _id: ObjectId;
  subLocationId?: ObjectId;
  locationId?: ObjectId;
  customerId?: ObjectId;
  name: string;
  description?: string;
  type: 'TIMING_BASED' | 'DURATION_BASED';
  priority: number;
  conflictResolution: 'PRIORITY' | 'HIGHEST_PRICE' | 'LOWEST_PRICE';
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  timeWindows?: TimeWindow[];
  durationRules?: DurationRule[];
}

interface DefaultRate {
  level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
  hourlyRate: number;
  entityId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Pricing API] Request:', body);

    const { subLocationId, startDateTime, endDateTime } = body;

    if (!subLocationId || !startDateTime || !endDateTime) {
      return NextResponse.json(
        { error: 'Missing required fields: subLocationId, startDateTime, endDateTime' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Step 1: Get sublocation with hierarchy info
    const sublocation = await db.collection('sublocations').findOne({
      _id: new ObjectId(subLocationId),
    });

    if (!sublocation) {
      return NextResponse.json({ error: 'SubLocation not found' }, { status: 404 });
    }

    const location = await db.collection('locations').findOne({
      _id: new ObjectId(sublocation.locationId),
    });

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    console.log('[Pricing API] Entity hierarchy:', {
      customer: location.customerId.toString(),
      location: location._id.toString(),
      sublocation: sublocation._id.toString(),
    });

    // Step 2: Fetch all active ratesheets for this hierarchy
    const ratesheets = await db
      .collection('ratesheets')
      .find({
        $or: [
          { customerId: new ObjectId(location.customerId) },
          { locationId: new ObjectId(location._id) },
          { subLocationId: new ObjectId(sublocation._id) },
        ],
        isActive: true,
      })
      .toArray();

    console.log('[Pricing API] Found ratesheets:', ratesheets.length);

    // Step 3: Fetch default rates
    const defaultRates: DefaultRate[] = [];

    // Customer-level default
    const customer = await db.collection('customers').findOne({
      _id: new ObjectId(location.customerId),
    });
    if (customer?.defaultHourlyRate) {
      defaultRates.push({
        level: 'CUSTOMER',
        hourlyRate: customer.defaultHourlyRate,
        entityId: customer._id.toString(),
      });
    }

    // Location-level default
    if (location.defaultHourlyRate) {
      defaultRates.push({
        level: 'LOCATION',
        hourlyRate: location.defaultHourlyRate,
        entityId: location._id.toString(),
      });
    }

    // SubLocation-level default
    if (sublocation.defaultHourlyRate) {
      defaultRates.push({
        level: 'SUBLOCATION',
        hourlyRate: sublocation.defaultHourlyRate,
        entityId: sublocation._id.toString(),
      });
    }

    console.log('[Pricing API] Default rates:', defaultRates);

    // Step 4: Create pricing context
    const context = {
      customerId: location.customerId.toString(),
      locationId: location._id.toString(),
      subLocationId: sublocation._id.toString(),
      startDateTime: new Date(startDateTime),
      endDateTime: new Date(endDateTime),
    };

    // Step 5: Calculate pricing using the new PricingEngine
    const engine = new PricingEngine();
    const result = await engine.calculatePrice(
      context,
      ratesheets as any,
      defaultRates
    );

    console.log('[Pricing API] Calculation complete:', {
      totalPrice: result.totalPrice,
      breakdownItems: result.breakdown.length,
      ratesheetsSummary: result.ratesheetsSummary,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Pricing API] Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to calculate pricing',
        details: error.stack,
      },
      { status: 500 }
    );
  }
}
