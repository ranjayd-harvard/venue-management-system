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
    const { subLocationId, eventId, startTime, endTime, timezone: requestTimezone, isEventBooking, includeSurge = true } = body;

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

      // Step 1: Find venues assigned to this sublocation
      const sublocationVenueRelationships = await db.collection('sublocation_venues').find({
        $or: [
          { subLocationId: sublocation._id.toString() },
          { subLocationId: new ObjectId(sublocation._id) }
        ]
      }).toArray();

      const assignedVenueIds = sublocationVenueRelationships.map(rel => {
        // Handle both string and ObjectId formats
        const venueId = rel.venueId;
        return typeof venueId === 'string' ? venueId : venueId.toString();
      });

      console.log(`[API] Found ${assignedVenueIds.length} venues assigned to this sublocation`);

      // Step 2: Build query to include both:
      // 1. Events directly linked to this sublocation/location/customer
      // 2. Venue-only events (venueId set, but subLocationId null) where venue is assigned to this sublocation
      const eventQuery: any = {
        isActive: true,
        endDate: { $gte: bookingStartDate },
        startDate: { $lte: bookingEndDate },
        $or: [
          // Direct sublocation events
          { subLocationId: sublocation._id.toString() },
          { subLocationId: new ObjectId(sublocation._id) },
          // Location-level events (no sublocation specified)
          { locationId: location._id.toString(), subLocationId: { $exists: false } },
          { locationId: new ObjectId(location._id), subLocationId: { $exists: false } },
          // Customer-level events (no location/sublocation specified)
          { customerId: customer._id.toString(), locationId: { $exists: false }, subLocationId: { $exists: false } },
          { customerId: new ObjectId(customer._id), locationId: { $exists: false }, subLocationId: { $exists: false } }
        ]
      };

      // Add venue-only events if there are assigned venues
      if (assignedVenueIds.length > 0) {
        // Convert venue IDs to both string and ObjectId formats for comparison
        const venueIdConditions = assignedVenueIds.flatMap(id => [
          { venueId: id },
          { venueId: new ObjectId(id) }
        ]);

        eventQuery.$or.push({
          // Venue-only events: has venueId, but no subLocationId/locationId/customerId
          $and: [
            { $or: venueIdConditions },
            { subLocationId: { $in: [null, undefined] } },
            { locationId: { $in: [null, undefined] } },
            { customerId: { $in: [null, undefined] } }
          ]
        });

        console.log(`[API] Including venue-only events for venues: ${assignedVenueIds.join(', ')}`);
      }

      overlappingEvents = await db.collection('events').find(eventQuery).toArray();

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
    console.log('\n🎯 ===== BASE PRICING CALCULATION (WITHOUT SURGE) =====');
    const engine = new HourlyPricingEngine();
    const baseResult = engine.calculatePrice(context);

    console.log('\n📊 BASE PRICING RESULTS:');
    console.log(`   Total Hours: ${baseResult.totalHours}`);
    console.log(`   Total Price: $${baseResult.totalPrice.toFixed(2)}`);
    console.log(`   Average Price/Hour: $${(baseResult.totalPrice / baseResult.totalHours).toFixed(2)}`);
    console.log('\n   Sample Base Segments (first 3):');
    baseResult.segments.slice(0, 3).forEach((seg, idx) => {
      console.log(`   ${idx + 1}. ${new Date(seg.startTime).toLocaleString()} → $${seg.pricePerHour.toFixed(2)}/hr`);
      console.log(`      Ratesheet: ${seg.ratesheet?.name || 'Default'} (Level: ${seg.ratesheet?.level || 'N/A'}, Priority: ${seg.ratesheet?.priority || 'N/A'})`);
    });

    // Check for active surge config and generate surge ratesheets (only if includeSurge is true)
    let finalResult = baseResult;
    let surgeRatesheets: any[] = [];

    if (includeSurge) {
      const { SurgeConfigRepository } = await import('@/models/SurgeConfig');
      const { calculateSurgeFactor, applySurgeToPrice } = await import('@/lib/surge-pricing-engine');

      const surgeConfig = await SurgeConfigRepository.findActiveBySubLocation(
        subLocationId,
        new Date(startTime)
      );

      if (surgeConfig) {
      console.log('\n🔥 ===== SURGE PRICING GENERATION =====');
      console.log(`   Surge Config: ${surgeConfig.name}`);
      console.log(`   Applies To: ${surgeConfig.appliesTo.level} (${surgeConfig.appliesTo.entityId})`);

      // Calculate surge factor
      const surgeResult = calculateSurgeFactor({
        demand: surgeConfig.demandSupplyParams.currentDemand,
        supply: surgeConfig.demandSupplyParams.currentSupply,
        historicalAvgPressure: surgeConfig.demandSupplyParams.historicalAvgPressure,
        alpha: surgeConfig.surgeParams.alpha,
        minMultiplier: surgeConfig.surgeParams.minMultiplier,
        maxMultiplier: surgeConfig.surgeParams.maxMultiplier,
        emaAlpha: surgeConfig.surgeParams.emaAlpha,
        previousSmoothedPressure: undefined
      });

      console.log('\n   Surge Calculation:');
      console.log(`   - Demand: ${surgeConfig.demandSupplyParams.currentDemand}`);
      console.log(`   - Supply: ${surgeConfig.demandSupplyParams.currentSupply}`);
      console.log(`   - Pressure: ${surgeResult.pressure.toFixed(3)}`);
      console.log(`   - Normalized Pressure: ${surgeResult.normalized_pressure.toFixed(3)}`);
      console.log(`   - Smoothed Pressure: ${surgeResult.smoothed_pressure.toFixed(3)}`);
      console.log(`   - Raw Factor: ${surgeResult.raw_factor.toFixed(3)}`);
      console.log(`   - Final Surge Factor: ${surgeResult.surge_factor.toFixed(3)}x`);
      console.log(`   - Min/Max: ${surgeConfig.surgeParams.minMultiplier}x - ${surgeConfig.surgeParams.maxMultiplier}x`);

      // Generate surge ratesheets with surge-adjusted prices
      const timeWindows: any[] = [];
      let windowsCreated = 0;
      let windowsSkipped = 0;

      console.log('\n   Generating Surge Time Windows:');
      for (const segment of baseResult.segments) {
        const hourTimestamp = new Date(segment.startTime);
        let surgeFactor = surgeResult.surge_factor;

        // Check if this hour matches the surge config's time windows
        if (surgeConfig.timeWindows && surgeConfig.timeWindows.length > 0) {
          const dayOfWeek = hourTimestamp.getDay();
          const timeStr = `${hourTimestamp.getHours().toString().padStart(2, '0')}:${hourTimestamp.getMinutes().toString().padStart(2, '0')}`;

          const matchesWindow = surgeConfig.timeWindows.some(window => {
            if (window.daysOfWeek && window.daysOfWeek.length > 0) {
              if (!window.daysOfWeek.includes(dayOfWeek)) return false;
            }
            if (window.startTime && window.endTime) {
              // Handle overnight ranges (e.g., 19:00 - 07:00)
              if (window.startTime > window.endTime) {
                // Overnight: matches if time >= startTime OR time < endTime
                if (timeStr < window.startTime && timeStr >= window.endTime) return false;
              } else {
                // Same-day: matches if time >= startTime AND time < endTime
                if (timeStr < window.startTime || timeStr >= window.endTime) return false;
              }
            }
            return true;
          });

          if (!matchesWindow) {
            windowsSkipped++;
            continue; // Skip this hour
          }
        }

        // Store the surge MULTIPLIER, not the absolute price
        // The pricing engine will apply this multiplier to the base price dynamically
        const basePrice = segment.pricePerHour;
        const surgePrice = applySurgeToPrice(basePrice, { ...surgeResult, surge_factor: surgeFactor });

        const startTimeStr = `${hourTimestamp.getHours().toString().padStart(2, '0')}:${hourTimestamp.getMinutes().toString().padStart(2, '0')}`;
        const endHour = new Date(hourTimestamp);
        endHour.setHours(endHour.getHours() + 1);
        const endTimeStr = `${endHour.getHours().toString().padStart(2, '0')}:00`;

        timeWindows.push({
          startTime: startTimeStr,
          endTime: endTimeStr,
          pricePerHour: surgeFactor, // CHANGED: Store multiplier instead of absolute price
          windowType: 'ABSOLUTE_TIME',
          surgeMultiplier: surgeFactor // Also store explicitly for clarity
        });

        windowsCreated++;

        // Log first 3 conversions
        if (windowsCreated <= 3) {
          console.log(`   ${windowsCreated}. ${startTimeStr}-${endTimeStr}: Multiplier ${surgeFactor.toFixed(2)}x (example: $${basePrice.toFixed(2)} → $${surgePrice.toFixed(2)})`);
        }
      }

      console.log(`\n   Created ${windowsCreated} surge windows, skipped ${windowsSkipped} windows`);

      if (timeWindows.length > 0) {
        const surgeRatesheet = {
          _id: new ObjectId(),
          name: `SURGE: ${surgeConfig.name}`,
          description: `Auto-generated surge pricing (${surgeResult.surge_factor.toFixed(2)}x)`,
          type: 'SURGE_MULTIPLIER', // CHANGED: Special type for multiplier-based pricing
          appliesTo: surgeConfig.appliesTo,
          priority: 10000,
          effectiveFrom: new Date(startTime),
          effectiveTo: new Date(endTime),
          timeWindows,
          isActive: true,
          approvalStatus: 'APPROVED',
          createdAt: new Date(),
          updatedAt: new Date(),
          surgeMultiplier: surgeResult.surge_factor // Store base multiplier
        };

        surgeRatesheets = [surgeRatesheet];

        console.log('\n   Surge Ratesheet Generated:');
        console.log(`   - Name: ${surgeRatesheet.name}`);
        console.log(`   - Type: ${surgeRatesheet.type} (stores multipliers, not absolute prices)`);
        console.log(`   - Priority: ${surgeRatesheet.priority}`);
        console.log(`   - Level: SURGE`);
        console.log(`   - Base Multiplier: ${surgeResult.surge_factor.toFixed(2)}x`);
        console.log(`   - Time Windows: ${timeWindows.length}`);
        console.log(`   - Effective: ${surgeRatesheet.effectiveFrom.toISOString()} → ${surgeRatesheet.effectiveTo.toISOString()}`);

        // Re-run pricing engine with surge ratesheets
        console.log('\n🎯 ===== FINAL PRICING CALCULATION (WITH SURGE) =====');
        const surgeContext = {
          ...context,
          surgeRatesheets
        };

        finalResult = engine.calculatePrice(surgeContext);

        console.log('\n📊 FINAL PRICING RESULTS:');
        console.log(`   Total Hours: ${finalResult.totalHours}`);
        console.log(`   Total Price: $${finalResult.totalPrice.toFixed(2)}`);
        console.log(`   Average Price/Hour: $${(finalResult.totalPrice / finalResult.totalHours).toFixed(2)}`);
        console.log('\n   Sample Final Segments (first 3):');
        finalResult.segments.slice(0, 3).forEach((seg, idx) => {
          console.log(`   ${idx + 1}. ${new Date(seg.startTime).toLocaleString()} → $${seg.pricePerHour.toFixed(2)}/hr`);
          console.log(`      Ratesheet: ${seg.ratesheet?.name || 'Default'} (Level: ${seg.ratesheet?.level || 'N/A'}, Priority: ${seg.ratesheet?.priority || 'N/A'})`);
        });

        console.log('\n📈 BASE vs SURGE COMPARISON:');
        console.log(`   Base Total: $${baseResult.totalPrice.toFixed(2)}`);
        console.log(`   Surge Total: $${finalResult.totalPrice.toFixed(2)}`);
        console.log(`   Difference: $${(finalResult.totalPrice - baseResult.totalPrice).toFixed(2)} (${((finalResult.totalPrice / baseResult.totalPrice - 1) * 100).toFixed(1)}%)`);
      } else {
        console.log('\n   ⚠️ No surge windows created (all hours filtered out by time window constraints)');
      }
      } else {
        console.log('\n   ℹ️ No active surge configuration found for this sublocation/time');
      }
    } else {
      console.log('\n   ℹ️ Surge pricing disabled (includeSurge=false)');
    }

    // Return enhanced result
    return NextResponse.json({
      ...finalResult,
      metadata: {
        customer: customer.name,
        location: location.name,
        sublocation: sublocation.label,
        timezone: finalResult.timezone,
        overlappingEvents: overlappingEvents.map(e => ({
          id: e._id.toString(),
          name: e.name,
          startDate: e.startDate,
          endDate: e.endDate
        })),
        ratesheetSummary: {
          total: customerRatesheets.length + locationRatesheets.length + sublocationRatesheets.length + eventRatesheets.length + surgeRatesheets.length,
          customer: customerRatesheets.length,
          location: locationRatesheets.length,
          sublocation: sublocationRatesheets.length,
          event: eventRatesheets.length,
          surge: surgeRatesheets.length
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
