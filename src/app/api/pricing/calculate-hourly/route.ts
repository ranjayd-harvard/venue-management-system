// src/app/api/pricing/calculate-hourly/route.ts
// Enhanced pricing calculator using hourly evaluation

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { HourlyPricingEngine, PricingContext } from '@/lib/price-engine-hourly';
import { TimezoneSettingsRepository } from '@/models/TimezoneSettings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subLocationId, startTime, endTime, timezone: requestTimezone } = body;
    
    if (!subLocationId || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const db = await getDb();
    
    // Get sublocation
    const sublocation = await db.collection('sublocations').findOne({
      _id: new ObjectId(subLocationId)
    });
    
    if (!sublocation) {
      return NextResponse.json(
        { error: 'SubLocation not found' },
        { status: 404 }
      );
    }
    
    // Get location
    const location = await db.collection('locations').findOne({
      _id: new ObjectId(sublocation.locationId)
    });
    
    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }
    
    // Get customer
    const customer = await db.collection('customers').findOne({
      _id: new ObjectId(location.customerId)
    });
    
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }
    
    // Get timezone (hierarchy: Request → SubLocation → Location → Customer → System)
    const timezone = requestTimezone || await TimezoneSettingsRepository.getTimezoneForEntity(
      'SUBLOCATION',
      subLocationId
    );
    
    // Fetch all ratesheets for hierarchy
    const customerRatesheets = await db.collection('ratesheets').find({
      customerId: new ObjectId(customer._id),
      isActive: true
    }).toArray();
    
    const locationRatesheets = await db.collection('ratesheets').find({
      locationId: new ObjectId(location._id),
      isActive: true
    }).toArray();
    
    const sublocationRatesheets = await db.collection('ratesheets').find({
      subLocationId: new ObjectId(sublocation._id),
      isActive: true
    }).toArray();
    
    // Get pricing config (auto-create if missing)
    let pricingConfig = await db.collection('pricing_configs').findOne({});
    
    if (!pricingConfig) {
      console.log('⚠️  Pricing config not found, creating default...');
      
      // Create default config
      const defaultConfig = {
        customerPriorityRange: { min: 1000, max: 1999 },
        locationPriorityRange: { min: 2000, max: 2999 },
        sublocationPriorityRange: { min: 3000, max: 3999 },
        defaultTimezone: 'America/Detroit',
        defaultHourlyRate: 0, // Will use hierarchy defaults instead
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.collection('pricing_configs').insertOne(defaultConfig);
      pricingConfig = defaultConfig;
      
      console.log('✅ Created default pricing config');
    }
    
    // Build pricing context
    const context: PricingContext = {
      bookingStart: new Date(startTime),
      bookingEnd: new Date(endTime),
      timezone,
      
      customerId: customer._id.toString(),
      locationId: location._id.toString(),
      subLocationId: sublocation._id.toString(),
      
      customerRatesheets: customerRatesheets as any[],
      locationRatesheets: locationRatesheets as any[],
      sublocationRatesheets: sublocationRatesheets as any[],
      
      customerDefaultRate: customer.defaultHourlyRate,
      locationDefaultRate: location.defaultHourlyRate,
      sublocationDefaultRate: sublocation.defaultHourlyRate,
      
      pricingConfig: pricingConfig as any
    };
    
    // Calculate pricing using hourly engine
    const engine = new HourlyPricingEngine();
    const result = engine.calculatePrice(context);
    
    // Return enhanced result
    return NextResponse.json({
      ...result,
      metadata: {
        customer: customer.name,
        location: location.name,
        sublocation: sublocation.label,
        timezone: result.timezone,
        ratesheetSummary: {
          total: customerRatesheets.length + locationRatesheets.length + sublocationRatesheets.length,
          customer: customerRatesheets.length,
          location: locationRatesheets.length,
          sublocation: sublocationRatesheets.length
        }
      }
    });
    
  } catch (error: any) {
    console.error('Pricing calculation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate pricing' },
      { status: 500 }
    );
  }
}
