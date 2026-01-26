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
    const { subLocationId, eventId, startTime, endTime, timezone: requestTimezone, isEventBooking } = body;

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
    
    // Fetch all ratesheets for hierarchy using appliesTo structure
    // IMPORTANT: Support BOTH old schema (customerId/locationId/subLocationId fields)
    // AND new schema (appliesTo.level/entityId structure)
    const customerRatesheets = await db.collection('ratesheets').find({
      $or: [
        // New schema
        {
          'appliesTo.level': 'CUSTOMER',
          'appliesTo.entityId': new ObjectId(customer._id)
        },
        // Old schema
        {
          customerId: customer._id.toString(),
          locationId: { $exists: false },
          subLocationId: { $exists: false }
        },
        {
          customerId: new ObjectId(customer._id),
          locationId: { $exists: false },
          subLocationId: { $exists: false }
        }
      ],
      isActive: true
    }).toArray();

    const locationRatesheets = await db.collection('ratesheets').find({
      $or: [
        // New schema
        {
          'appliesTo.level': 'LOCATION',
          'appliesTo.entityId': new ObjectId(location._id)
        },
        // Old schema
        {
          locationId: location._id.toString(),
          subLocationId: { $exists: false }
        },
        {
          locationId: new ObjectId(location._id),
          subLocationId: { $exists: false }
        }
      ],
      isActive: true
    }).toArray();

    const sublocationRatesheets = await db.collection('ratesheets').find({
      $or: [
        // New schema
        {
          'appliesTo.level': 'SUBLOCATION',
          'appliesTo.entityId': new ObjectId(sublocation._id)
        },
        // Old schema
        {
          subLocationId: sublocation._id.toString()
        },
        {
          subLocationId: new ObjectId(sublocation._id)
        }
      ],
      isActive: true
    }).toArray();

    console.log(`\n📊 [API] Fetched ratesheets:`);
    console.log(`[API]   Customer: ${customerRatesheets.length}`);
    console.log(`[API]   Location: ${locationRatesheets.length}`);
    console.log(`[API]   Sublocation: ${sublocationRatesheets.length}`);

    // Fetch EVENT ratesheets based on booking type and event selection
    // The isEventBooking flag will control whether grace periods ($0/hr) are applied
    const bookingStartDate = new Date(startTime);
    const bookingEndDate = new Date(endTime);

    let overlappingEvents: any[] = [];
    let eventRatesheets: any[] = [];

    if (eventId) {
      // If specific event selected, only fetch ratesheets for that event
      // BUT only if the booking overlaps with the event dates
      const selectedEvent = await db.collection('events').findOne({
        _id: new ObjectId(eventId),
        isActive: true
      });

      if (selectedEvent) {
        // Check if booking overlaps with event
        const eventStart = new Date(selectedEvent.startDate);
        const eventEnd = new Date(selectedEvent.endDate);
        const bookingOverlaps = eventEnd >= bookingStartDate && eventStart <= bookingEndDate;

        if (bookingOverlaps) {
          overlappingEvents = [selectedEvent];
          eventRatesheets = await db.collection('ratesheets').find({
            'appliesTo.level': 'EVENT',
            'appliesTo.entityId': new ObjectId(eventId),
            isActive: true
          }).toArray();
        }
        // If booking doesn't overlap with selected event, don't fetch its ratesheets
      }
    } else {
      // ALWAYS auto-fetch overlapping events for this sublocation
      // Event ratesheets should ALWAYS be applied when they overlap with booking time
      // The isEventBooking flag only controls whether $0/hr grace periods are free or not
      console.log(`\n🔍 [API] Auto-fetching overlapping events for sublocation ${sublocation._id}`);
      console.log(`[API] Booking range: ${bookingStartDate.toISOString()} - ${bookingEndDate.toISOString()}`);

      overlappingEvents = await db.collection('events').find({
        isActive: true,
        // Event must not end before booking starts AND must not start after booking ends
        endDate: { $gte: bookingStartDate },
        startDate: { $lte: bookingEndDate },
        // Event must belong to this sublocation (or location/customer hierarchy)
        // Handle both string and ObjectId formats for IDs
        $or: [
          { subLocationId: sublocation._id.toString() },
          { subLocationId: new ObjectId(sublocation._id) },
          { locationId: location._id.toString(), subLocationId: { $exists: false } },
          { locationId: new ObjectId(location._id), subLocationId: { $exists: false } },
          { customerId: customer._id.toString(), locationId: { $exists: false }, subLocationId: { $exists: false } },
          { customerId: new ObjectId(customer._id), locationId: { $exists: false }, subLocationId: { $exists: false } }
        ]
      }).toArray();

      console.log(`[API] Found ${overlappingEvents.length} overlapping events:`);
      overlappingEvents.forEach(e => {
        console.log(`  - ${e.name} (${e.startDate} - ${e.endDate})`);
      });

      // Fetch ratesheets for all overlapping events
      eventRatesheets = overlappingEvents.length > 0
        ? await db.collection('ratesheets').find({
            'appliesTo.level': 'EVENT',
            'appliesTo.entityId': { $in: overlappingEvents.map(e => e._id) },
            isActive: true
          }).toArray()
        : [];

      console.log(`[API] Found ${eventRatesheets.length} event ratesheets`);
      eventRatesheets.forEach(rs => {
        console.log(`  - ${rs.name} (${rs.effectiveFrom} - ${rs.effectiveTo})`);
      });
    }
    
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
    
    // CRITICAL: Ensure all ratesheet dates are Date objects, not strings
    // MongoDB returns dates as strings, but HourlyPricingEngine expects Date objects
    // ALSO: Add applyTo field for old schema ratesheets that don't have appliesTo structure
    const convertRatesheetDates = (ratesheets: any[], level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT') => {
      return ratesheets.map(rs => {
        const converted = {
          ...rs,
          effectiveFrom: new Date(rs.effectiveFrom),
          effectiveTo: rs.effectiveTo ? new Date(rs.effectiveTo) : null
        };

        // For old schema ratesheets (without appliesTo), add applyTo field for compatibility
        if (!converted.appliesTo && !converted.applyTo) {
          converted.applyTo = level;
        }

        return converted;
      });
    };

    const convertedCustomerRatesheets = convertRatesheetDates(customerRatesheets, 'CUSTOMER');
    const convertedLocationRatesheets = convertRatesheetDates(locationRatesheets, 'LOCATION');
    const convertedSublocationRatesheets = convertRatesheetDates(sublocationRatesheets, 'SUBLOCATION');
    const convertedEventRatesheets = convertRatesheetDates(eventRatesheets, 'EVENT');

    console.log(`\n🔍 [API] Converted ratesheet dates to Date objects`);
    if (convertedSublocationRatesheets.length > 0) {
      console.log(`[API] Sample sublocation ratesheet:`, {
        name: convertedSublocationRatesheets[0].name,
        type: convertedSublocationRatesheets[0].type,
        effectiveFrom: convertedSublocationRatesheets[0].effectiveFrom,
        effectiveTo: convertedSublocationRatesheets[0].effectiveTo,
        timeWindows: convertedSublocationRatesheets[0].timeWindows,
        applyTo: convertedSublocationRatesheets[0].applyTo,
        appliesTo: convertedSublocationRatesheets[0].appliesTo
      });
      console.log(`[API] effectiveFrom type:`, typeof convertedSublocationRatesheets[0].effectiveFrom);
      console.log(`[API] effectiveFrom isDate:`, convertedSublocationRatesheets[0].effectiveFrom instanceof Date);
    } else {
      console.log(`[API] ⚠️ No sublocation ratesheets found!`);
    }

    // Build pricing context
    const context: PricingContext = {
      bookingStart: new Date(startTime),
      bookingEnd: new Date(endTime),
      timezone,

      customerId: customer._id.toString(),
      locationId: location._id.toString(),
      subLocationId: sublocation._id.toString(),
      eventId: eventId ? eventId : undefined,

      // Pass isEventBooking flag (defaults to false for backward compatibility)
      isEventBooking: isEventBooking === true,

      customerRatesheets: convertedCustomerRatesheets as any[],
      locationRatesheets: convertedLocationRatesheets as any[],
      sublocationRatesheets: convertedSublocationRatesheets as any[],
      eventRatesheets: convertedEventRatesheets as any[],

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
        overlappingEvents: overlappingEvents.map(e => ({
          id: e._id.toString(),
          name: e.name,
          startDate: e.startDate,
          endDate: e.endDate
        })),
        ratesheetSummary: {
          total: customerRatesheets.length + locationRatesheets.length + sublocationRatesheets.length + eventRatesheets.length,
          customer: customerRatesheets.length,
          location: locationRatesheets.length,
          sublocation: sublocationRatesheets.length,
          event: eventRatesheets.length
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
