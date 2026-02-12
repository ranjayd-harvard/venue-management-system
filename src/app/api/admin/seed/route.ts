import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { CustomerRepository } from '@/models/Customer';
import { LocationRepository } from '@/models/Location';
import { VenueRepository } from '@/models/Venue';
import { SubLocationRepository } from '@/models/SubLocation';
import { SubLocationVenueRepository } from '@/models/SubLocationVenue';
import { EventRepository } from '@/models/Event';
import type { SeedConfig } from '@/models/SeedConfig';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load USPS locations data
const uspsLocationsPath = join(process.cwd(), 'data', 'usps-locations.json');
let uspsLocations: any[] = [];

try {
  uspsLocations = JSON.parse(readFileSync(uspsLocationsPath, 'utf-8'));
} catch (error) {
  console.warn('USPS locations file not found, will use generated data');
}

// UUID helper for blackout IDs
function generateBlackoutId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Operating hours schedule templates
const SCHEDULE_24_7 = {
  monday: [{ startTime: '00:00', endTime: '23:59' }],
  tuesday: [{ startTime: '00:00', endTime: '23:59' }],
  wednesday: [{ startTime: '00:00', endTime: '23:59' }],
  thursday: [{ startTime: '00:00', endTime: '23:59' }],
  friday: [{ startTime: '00:00', endTime: '23:59' }],
  saturday: [{ startTime: '00:00', endTime: '23:59' }],
  sunday: [{ startTime: '00:00', endTime: '23:59' }],
};

const SCHEDULE_BUSINESS_HOURS = {
  monday: [{ startTime: '08:00', endTime: '22:00' }],
  tuesday: [{ startTime: '08:00', endTime: '22:00' }],
  wednesday: [{ startTime: '08:00', endTime: '22:00' }],
  thursday: [{ startTime: '08:00', endTime: '22:00' }],
  friday: [{ startTime: '08:00', endTime: '22:00' }],
  saturday: [] as any[],
  sunday: [] as any[],
};

const SCHEDULE_EXTENDED = {
  monday: [{ startTime: '06:00', endTime: '23:59' }],
  tuesday: [{ startTime: '06:00', endTime: '23:59' }],
  wednesday: [{ startTime: '06:00', endTime: '23:59' }],
  thursday: [{ startTime: '06:00', endTime: '23:59' }],
  friday: [{ startTime: '06:00', endTime: '23:59' }],
  saturday: [{ startTime: '06:00', endTime: '23:59' }],
  sunday: [{ startTime: '08:00', endTime: '18:00' }],
};

function getCustomerOperatingHours(customerIndex: number) {
  const schedules = [SCHEDULE_24_7, SCHEDULE_BUSINESS_HOURS, SCHEDULE_EXTENDED];
  const schedule = schedules[(customerIndex - 1) % schedules.length];
  return {
    schedule,
    blackouts: [
      { id: generateBlackoutId(), date: '2026-12-25', type: 'FULL_DAY' as const, name: 'Christmas Day', reason: 'Holiday closure', recurring: { pattern: 'YEARLY' as const } },
      { id: generateBlackoutId(), date: '2026-01-01', type: 'FULL_DAY' as const, name: "New Year's Day", reason: 'Holiday closure', recurring: { pattern: 'YEARLY' as const } },
      { id: generateBlackoutId(), date: '2026-11-26', type: 'FULL_DAY' as const, name: 'Thanksgiving', reason: 'Holiday closure', recurring: { pattern: 'YEARLY' as const } },
    ],
  };
}

function getLocationOperatingHours(locationIndex: number) {
  if (locationIndex % 2 === 0) {
    return {
      schedule: { saturday: [{ startTime: '09:00', endTime: '17:00' }] },
      blackouts: [
        { id: generateBlackoutId(), date: '2026-07-04', type: 'FULL_DAY' as const, name: 'Independence Day', reason: 'Location-specific holiday', recurring: { pattern: 'YEARLY' as const } },
      ],
    };
  }
  return undefined;
}

function getSubLocationOperatingHours(subLocationIndex: number) {
  if (subLocationIndex % 3 === 0) {
    return { schedule: { friday: [{ startTime: '08:00', endTime: '16:00', label: 'Early Close' }] } };
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  const log: string[] = [];

  try {
    const config: SeedConfig = await request.json();
    log.push('Starting dynamic database seeding...');
    log.push(`Configuration: ${JSON.stringify(config, null, 2)}`);

    // Clear existing data
    log.push('\nClearing existing data...');
    const db = await getDb();
    await db.collection('customers').deleteMany({});
    await db.collection('locations').deleteMany({});
    await db.collection('sublocations').deleteMany({});
    await db.collection('venues').deleteMany({});
    await db.collection('sublocation_venues').deleteMany({});
    await db.collection('ratesheets').deleteMany({});
    await db.collection('events').deleteMany({});
    await db.collection('capacitysheets').deleteMany({});
    await db.collection('priority_configs').deleteMany({});
    await db.collection('surge_configs').deleteMany({});
    await db.collection('demand_history').deleteMany({});
    await db.collection('pricing_scenarios').deleteMany({});
    log.push('Cleared all collections');

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Create Customers
    log.push(`\nCreating ${config.customers} customers...`);
    const customers: any[] = [];
    for (let i = 1; i <= config.customers; i++) {
      const operatingHours = getCustomerOperatingHours(i);
      const customer = await CustomerRepository.create({
        name: `${config.customerPrefix}-${i}`,
        email: `${config.customerPrefix.toLowerCase()}-${i}@example.com`,
        phone: `+1-555-${String(i).padStart(4, '0')}`,
        address: `${i * 100} Business Ave, Suite ${i}00`,
        defaultHourlyRate: 50 + (i * 5),
        timezone: 'America/New_York',
        operatingHours,
        attributes: [
          { key: 'customer_id', value: `${i}` },
          { key: 'tier', value: i % 3 === 0 ? 'Enterprise' : i % 2 === 0 ? 'Professional' : 'Basic' },
          { key: 'industry', value: ['Technology', 'Retail', 'Healthcare', 'Finance'][i % 4] },
        ],
      });
      customers.push(customer);
      log.push(`  Created: ${customer.name} (with operating hours)`);
    }

    // Create Locations
    log.push(`\nCreating ${config.locationsPerCustomer} locations per customer...`);
    const locations: any[] = [];
    let locationIndex = 1;
    let uspsIndex = 0;

    for (const customer of customers) {
      for (let i = 1; i <= config.locationsPerCustomer; i++) {
        let locationData: any;
        const locOpHours = getLocationOperatingHours(locationIndex);

        if (config.useUSPSLocations && uspsLocations.length > 0) {
          const uspsLocation = uspsLocations[uspsIndex % uspsLocations.length];
          locationData = {
            customerId: customer._id!,
            name: `${config.locationPrefix}-${locationIndex} (${uspsLocation.name})`,
            address: uspsLocation.address,
            city: uspsLocation.city,
            state: uspsLocation.state,
            zipCode: uspsLocation.zipCode,
            country: uspsLocation.country,
            latitude: uspsLocation.latitude,
            longitude: uspsLocation.longitude,
            totalCapacity: 500 + (locationIndex * 100),
            defaultHourlyRate: 75 + (locationIndex * 5),
            timezone: getTimezone(uspsLocation.state),
            ...(locOpHours ? { operatingHours: locOpHours } : {}),
            attributes: [
              { key: 'location_id', value: `${locationIndex}` },
              { key: 'timezone', value: getTimezone(uspsLocation.state) },
              { key: 'region', value: getRegion(uspsLocation.state) },
            ],
          };
          uspsIndex++;
        } else {
          const state = getStateName(locationIndex);
          locationData = {
            customerId: customer._id!,
            name: `${config.locationPrefix}-${locationIndex}`,
            address: `${locationIndex * 100} Main St`,
            city: getCityName(locationIndex),
            state: state,
            zipCode: `${10000 + locationIndex}`,
            country: 'USA',
            totalCapacity: 500 + (locationIndex * 100),
            defaultHourlyRate: 75 + (locationIndex * 5),
            timezone: getTimezone(state),
            ...(locOpHours ? { operatingHours: locOpHours } : {}),
            attributes: [
              { key: 'location_id', value: `${locationIndex}` },
              { key: 'parking', value: locationIndex % 2 === 0 ? 'Available' : 'Street Only' },
            ],
          };
        }

        const location = await LocationRepository.create(locationData);
        locations.push(location);
        log.push(`  Created: ${location.name} for ${customer.name}`);
        locationIndex++;
      }
    }

    // Create Sub-Locations
    log.push(`\nCreating ${config.subLocationsPerLocation} sub-locations per location...`);
    const subLocations: any[] = [];
    let subLocationIndex = 1;

    for (const location of locations) {
      for (let i = 1; i <= config.subLocationsPerLocation; i++) {
        const allocatedCapacity = Math.floor((location.totalCapacity || 1000) / config.subLocationsPerLocation);
        const maxCapacity = allocatedCapacity + 50;
        const minCapacity = Math.floor(allocatedCapacity * 0.5);
        const defaultCapacity = allocatedCapacity;

        // Capacity allocation breakdown
        const transient = Math.floor(allocatedCapacity * 0.40);
        const events = Math.floor(allocatedCapacity * 0.30);
        const reserved = Math.floor(allocatedCapacity * 0.10);
        const unavailable = Math.floor(allocatedCapacity * 0.05);
        const readyToUse = allocatedCapacity - transient - events - reserved - unavailable;

        const revenueGoalTypes: Array<'max' | 'allocated' | 'custom'> = ['max', 'allocated', 'custom'];
        const revenueGoalType = revenueGoalTypes[(subLocationIndex - 1) % 3];

        const subLocationOpHours = getSubLocationOperatingHours(subLocationIndex);
        const dailyRevenueGoal = (100 + subLocationIndex * 10) * allocatedCapacity / 10;

        const subLocationData: any = {
          locationId: location._id!,
          label: `${config.subLocationPrefix}-${subLocationIndex}`,
          description: `Sub-location ${i} of ${location.name}`,
          minCapacity,
          maxCapacity,
          defaultCapacity,
          allocatedCapacity,
          pricingEnabled: true,
          isActive: true,
          defaultHourlyRate: 100 + (subLocationIndex * 10),
          timezone: location.timezone,
          revenueGoalType,
          ...(subLocationOpHours ? { operatingHours: subLocationOpHours } : {}),
          capacityConfig: {
            minCapacity,
            maxCapacity,
            dailyCapacities: [],
            revenueGoals: [
              {
                startDate: today,
                endDate: in30Days,
                dailyGoal: Math.round(dailyRevenueGoal),
                weeklyGoal: Math.round(dailyRevenueGoal * 6),
                monthlyGoal: Math.round(dailyRevenueGoal * 26),
                revenueGoalType,
                ...(revenueGoalType === 'custom' ? {
                  customCategoryGoals: {
                    transient: Math.round(dailyRevenueGoal * 0.40),
                    events: Math.round(dailyRevenueGoal * 0.30),
                    reserved: Math.round(dailyRevenueGoal * 0.15),
                    unavailable: 0,
                    readyToUse: Math.round(dailyRevenueGoal * 0.15),
                  }
                } : {}),
              },
            ],
            hoursPerDay: 16,
            defaultCapacities: {
              allocated: { transient, events, reserved },
              unallocated: { unavailable, readyToUse },
            },
          },
          attributes: [
            { key: 'sublocation_id', value: `${subLocationIndex}` },
            { key: 'floor', value: `${i}` },
            { key: 'capacity', value: `${allocatedCapacity}` },
          ],
        };

        const subLocation = await SubLocationRepository.create(subLocationData);
        const subLocationObj = { ...subLocationData, _id: subLocation };
        subLocations.push(subLocationObj);
        log.push(`  Created: ${subLocationData.label} in ${location.name} (capacity: ${minCapacity}-${maxCapacity}, allocated: ${allocatedCapacity})`);
        subLocationIndex++;
      }
    }

    // Create Venues
    log.push(`\nCreating ${config.venues} venues...`);
    const venues: any[] = [];
    const venueTypes = ['Conference Room', 'Ballroom', 'Theater', 'Meeting Room', 'Auditorium', 'Banquet Hall'];

    for (let i = 1; i <= config.venues; i++) {
      const venue = await VenueRepository.create({
        name: `${config.venuePrefix}-${i}`,
        description: `${venueTypes[i % venueTypes.length]} for events and meetings`,
        capacity: 50 + (i * 25),
        venueType: venueTypes[i % venueTypes.length],
        attributes: [
          { key: 'venue_id', value: `${i}` },
          { key: 'av_equipment', value: i % 2 === 0 ? 'Full' : 'Basic' },
          { key: 'catering', value: i % 3 === 0 ? 'Available' : 'External Only' },
        ],
      });
      venues.push(venue);
      log.push(`  Created: ${venue.name}`);
    }

    // Create SubLocation-Venue Relationships
    log.push(`\nCreating sub-location to venue relationships...`);
    let relationshipCount = 0;

    for (const subLocation of subLocations) {
      const assignedVenues = new Set<string>();
      let attempts = 0;
      const maxAttempts = config.venues * 2;
      const targetVenueCount = Math.min(config.venuesPerSubLocation, venues.length);

      while (assignedVenues.size < targetVenueCount && attempts < maxAttempts) {
        const randomVenue = venues[Math.floor(Math.random() * venues.length)];
        const venueIdStr = randomVenue._id!.toString();

        if (!assignedVenues.has(venueIdStr)) {
          await SubLocationVenueRepository.create(
            subLocation._id!,
            randomVenue._id!
          );
          assignedVenues.add(venueIdStr);
          relationshipCount++;
          log.push(`  Linked: ${subLocation.label} -> ${randomVenue.name}`);
        }
        attempts++;
      }
    }

    // Create RateSheets
    let ratesheetCount = 0;
    if (config.createRatesheets) {
      log.push(`\nCreating rate sheets...`);
      const ratesheetsCollection = db.collection('ratesheets');

      let locationRsIndex = 0;
      for (const location of locations) {
        const locationRatesheet = {
          name: `${location.name} - Standard Hours`,
          description: `Standard hourly rates for ${location.name}`,
          type: 'TIMING_BASED' as const,
          applyTo: 'LOCATION' as const,
          locationId: location._id!,
          priority: 2000 + (locationRsIndex * 20),
          effectiveFrom: new Date('2024-01-01'),
          effectiveTo: new Date('2026-12-31'),
          timezone: location.timezone || 'America/New_York',
          timeWindows: [
            { startTime: '09:00', endTime: '17:00', pricePerHour: location.defaultHourlyRate || 75 },
            { startTime: '17:00', endTime: '21:00', pricePerHour: (location.defaultHourlyRate || 75) * 1.3 },
          ],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await ratesheetsCollection.insertOne(locationRatesheet);
        ratesheetCount++;
        log.push(`  ${locationRatesheet.name} (Priority: ${locationRatesheet.priority})`);

        const weekendRatesheet = {
          name: `${location.name} - Weekend Premium`,
          description: `Weekend rates for ${location.name}`,
          type: 'TIMING_BASED' as const,
          applyTo: 'LOCATION' as const,
          locationId: location._id!,
          priority: 2000 + (locationRsIndex * 20) + 10,
          effectiveFrom: new Date('2024-01-01'),
          effectiveTo: new Date('2026-12-31'),
          timezone: location.timezone || 'America/New_York',
          timeWindows: [
            { startTime: '00:00', endTime: '23:59', pricePerHour: (location.defaultHourlyRate || 75) * 1.5, daysOfWeek: [0, 6] },
          ],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await ratesheetsCollection.insertOne(weekendRatesheet);
        ratesheetCount++;
        log.push(`  ${weekendRatesheet.name} (Priority: ${weekendRatesheet.priority})`);
        locationRsIndex++;
      }

      let subLocRsIndex = 0;
      for (const subLocation of subLocations) {
        const subLocationRatesheet = {
          name: `${subLocation.label} - Standard + Busy Hours`,
          description: `Rates with busy hour premiums for ${subLocation.label}`,
          type: 'TIMING_BASED' as const,
          applyTo: 'SUBLOCATION' as const,
          subLocationId: subLocation._id!,
          priority: 3000 + (subLocRsIndex * 10),
          effectiveFrom: new Date('2024-01-01'),
          effectiveTo: new Date('2026-12-31'),
          timezone: subLocation.timezone || 'America/New_York',
          timeWindows: [
            { startTime: '06:00', endTime: '09:00', pricePerHour: (subLocation.defaultHourlyRate || 100) * 0.8 },
            { startTime: '09:00', endTime: '12:00', pricePerHour: (subLocation.defaultHourlyRate || 100) * 1.2 },
            { startTime: '12:00', endTime: '14:00', pricePerHour: subLocation.defaultHourlyRate || 100 },
            { startTime: '14:00', endTime: '18:00', pricePerHour: (subLocation.defaultHourlyRate || 100) * 1.3 },
            { startTime: '18:00', endTime: '22:00', pricePerHour: (subLocation.defaultHourlyRate || 100) * 1.5 },
          ],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await ratesheetsCollection.insertOne(subLocationRatesheet);
        ratesheetCount++;
        log.push(`  ${subLocationRatesheet.name} (Priority: ${subLocationRatesheet.priority})`);
        subLocRsIndex++;
      }

      log.push(`Created ${ratesheetCount} rate sheets`);
    }

    // Create Events
    let eventCount = 0;
    let eventRatesheetCount = 0;
    if (config.createEvents) {
      log.push(`\nCreating sample events...`);
      const eventTypes = ['Conference', 'Meeting', 'Workshop', 'Seminar', 'Training', 'Social Event'];
      const totalEvents = subLocations.length * config.eventsPerSubLocation;
      const totalDays = config.eventDateRangeEnd - config.eventDateRangeStart;
      let eventIndex = 1;

      for (const subLocation of subLocations) {
        const parentLocation = locations.find((loc: any) => loc._id!.toString() === subLocation.locationId.toString());
        if (!parentLocation) continue;
        const parentCustomer = customers.find((cust: any) => cust._id!.toString() === parentLocation.customerId.toString());
        if (!parentCustomer) continue;

        for (let i = 0; i < config.eventsPerSubLocation; i++) {
          const dayOffset = config.eventDateRangeStart + (eventIndex / totalEvents) * totalDays;
          const startDate = new Date(now);
          startDate.setDate(startDate.getDate() + Math.floor(dayOffset));
          startDate.setHours(9 + (i * 2), 0, 0, 0);

          const durationHours = 2 + (i % 4);
          const endDate = new Date(startDate);
          endDate.setHours(startDate.getHours() + durationHours);

          const shouldBeActive = (Math.random() * 100) < config.percentActiveEvents;
          const isActive = true;

          if (shouldBeActive) {
            const hoursSinceStart = 1 + Math.floor(Math.random() * (durationHours - 1));
            startDate.setTime(now.getTime() - (hoursSinceStart * 60 * 60 * 1000));
            endDate.setTime(startDate.getTime() + (durationHours * 60 * 60 * 1000));
          }

          const event = await EventRepository.create({
            name: `${config.eventPrefix}-${eventIndex} - ${eventTypes[eventIndex % eventTypes.length]}`,
            description: `${eventTypes[eventIndex % eventTypes.length]} event at ${subLocation.label}`,
            customerId: parentCustomer._id!,
            locationId: parentLocation._id!,
            subLocationId: subLocation._id!,
            startDate,
            endDate,
            attendees: 10 + (eventIndex * 5),
            defaultHourlyRate: subLocation.defaultHourlyRate,
            timezone: subLocation.timezone || parentLocation.timezone || 'America/New_York',
            isActive,
            attributes: [
              { key: 'event_id', value: `${eventIndex}` },
              { key: 'event_type', value: eventTypes[eventIndex % eventTypes.length] },
              { key: 'requires_av', value: i % 2 === 0 ? 'true' : 'false' },
              { key: 'status', value: shouldBeActive ? 'active' : 'scheduled' },
            ],
          });
          eventCount++;
          log.push(`  ${event.name} (${startDate.toLocaleDateString()})`);

          if (config.createEventRatesheets) {
            const ratesheetsCollection = db.collection('ratesheets');
            const eventRatesheet = {
              name: `${event.name} - Event Rate`,
              description: `Special event pricing for ${event.name}`,
              type: 'TIMING_BASED' as const,
              applyTo: 'EVENT' as const,
              eventId: event._id,
              subLocationId: subLocation._id!,
              locationId: parentLocation._id!,
              customerId: parentCustomer._id!,
              priority: 4900 + (eventIndex % 100),
              effectiveFrom: new Date(startDate),
              effectiveTo: new Date(endDate),
              timezone: event.timezone || 'America/New_York',
              timeWindows: [
                {
                  startTime: startDate.toTimeString().slice(0, 5),
                  endTime: endDate.toTimeString().slice(0, 5),
                  pricePerHour: (event.defaultHourlyRate || 150) * 1.5,
                },
              ],
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            await ratesheetsCollection.insertOne(eventRatesheet);
            eventRatesheetCount++;
          }

          eventIndex++;
        }
      }

      log.push(`Created ${eventCount} events`);
      if (config.createEventRatesheets) {
        log.push(`Created ${eventRatesheetCount} event-specific ratesheets`);
      }
    }

    // Seed Priority Configs
    let priorityConfigCount = 0;
    if (config.createPriorityConfigs) {
      log.push(`\nCreating priority configs...`);
      const priorityConfigs = [
        { level: 'CUSTOMER', minPriority: 1000, maxPriority: 1999, color: '#3B82F6', description: 'Customer-level ratesheets have lowest priority and apply across all locations', enabled: true, createdAt: new Date(), updatedAt: new Date() },
        { level: 'LOCATION', minPriority: 2000, maxPriority: 2999, color: '#10B981', description: 'Location-level ratesheets override customer rates for specific locations', enabled: true, createdAt: new Date(), updatedAt: new Date() },
        { level: 'SUBLOCATION', minPriority: 3000, maxPriority: 3999, color: '#F59E0B', description: 'SubLocation-level ratesheets have high priority for specific spaces', enabled: true, createdAt: new Date(), updatedAt: new Date() },
        { level: 'EVENT', minPriority: 4000, maxPriority: 4999, color: '#EC4899', description: 'Event-level ratesheets have highest priority and override all other rates', enabled: true, createdAt: new Date(), updatedAt: new Date() },
      ];
      await db.collection('priority_configs').insertMany(priorityConfigs);
      priorityConfigCount = priorityConfigs.length;
      log.push(`  Created ${priorityConfigCount} priority configs (CUSTOMER, LOCATION, SUBLOCATION, EVENT)`);
    }

    // Seed Capacity Sheets
    let capacitySheetCount = 0;
    if (config.createCapacitySheets) {
      log.push(`\nCreating capacity sheets...`);
      const csCollection = db.collection('capacitysheets');

      for (let ci = 0; ci < customers.length; ci++) {
        const customer = customers[ci];
        const cs = {
          name: `${customer.name} - Base Capacity`,
          description: `Base capacity defaults for ${customer.name}`,
          type: 'TIME_BASED',
          appliesTo: { level: 'CUSTOMER', entityId: customer._id! },
          priority: 1000 + ci * 10,
          conflictResolution: 'PRIORITY',
          effectiveFrom: new Date('2024-01-01'),
          effectiveTo: null,
          timeWindows: [
            { startTime: '00:00', endTime: '23:59', minCapacity: 0, maxCapacity: 1000, defaultCapacity: 500, allocatedCapacity: 400 },
          ],
          isActive: true,
          approvalStatus: 'APPROVED',
          approvedBy: 'admin@system.com',
          approvedAt: new Date(),
          createdBy: 'seed-script',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await csCollection.insertOne(cs);
        capacitySheetCount++;
        log.push(`  ${cs.name} (Customer, Priority: ${cs.priority})`);
      }

      for (let li = 0; li < locations.length; li++) {
        const location = locations[li];
        const locCapacity = location.totalCapacity || 500;
        const cs = {
          name: `${location.name} - Standard Hours Capacity`,
          description: `Operating hours capacity for ${location.name}`,
          type: 'TIME_BASED',
          appliesTo: { level: 'LOCATION', entityId: location._id! },
          priority: 2000 + li * 10,
          conflictResolution: 'PRIORITY',
          effectiveFrom: new Date('2024-01-01'),
          effectiveTo: null,
          timeWindows: [
            { startTime: '06:00', endTime: '12:00', minCapacity: Math.floor(locCapacity * 0.3), maxCapacity: locCapacity, defaultCapacity: Math.floor(locCapacity * 0.7), allocatedCapacity: Math.floor(locCapacity * 0.6) },
            { startTime: '12:00', endTime: '18:00', minCapacity: Math.floor(locCapacity * 0.4), maxCapacity: locCapacity, defaultCapacity: Math.floor(locCapacity * 0.85), allocatedCapacity: Math.floor(locCapacity * 0.8) },
            { startTime: '18:00', endTime: '22:00', minCapacity: Math.floor(locCapacity * 0.2), maxCapacity: locCapacity, defaultCapacity: Math.floor(locCapacity * 0.5), allocatedCapacity: Math.floor(locCapacity * 0.4) },
          ],
          isActive: true,
          approvalStatus: 'APPROVED',
          approvedBy: 'admin@system.com',
          approvedAt: new Date(),
          createdBy: 'seed-script',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await csCollection.insertOne(cs);
        capacitySheetCount++;
        log.push(`  ${cs.name} (Location, Priority: ${cs.priority})`);
      }

      for (let si = 0; si < subLocations.length; si++) {
        const subLocation = subLocations[si];
        const subCap = subLocation.allocatedCapacity || 200;
        const cs = {
          name: `${subLocation.label} - Detailed Capacity`,
          description: `Hourly capacity rules for ${subLocation.label}`,
          type: 'TIME_BASED',
          appliesTo: { level: 'SUBLOCATION', entityId: subLocation._id! },
          priority: 3000 + si * 10,
          conflictResolution: 'PRIORITY',
          effectiveFrom: new Date('2024-01-01'),
          effectiveTo: null,
          timeWindows: [
            { startTime: '06:00', endTime: '09:00', minCapacity: Math.floor(subCap * 0.2), maxCapacity: subCap, defaultCapacity: Math.floor(subCap * 0.5), allocatedCapacity: Math.floor(subCap * 0.4) },
            { startTime: '09:00', endTime: '12:00', minCapacity: Math.floor(subCap * 0.5), maxCapacity: subCap, defaultCapacity: Math.floor(subCap * 0.9), allocatedCapacity: Math.floor(subCap * 0.85) },
            { startTime: '12:00', endTime: '14:00', minCapacity: Math.floor(subCap * 0.4), maxCapacity: subCap, defaultCapacity: Math.floor(subCap * 0.7), allocatedCapacity: Math.floor(subCap * 0.65) },
            { startTime: '14:00', endTime: '18:00', minCapacity: Math.floor(subCap * 0.5), maxCapacity: subCap, defaultCapacity: Math.floor(subCap * 0.95), allocatedCapacity: Math.floor(subCap * 0.9) },
            { startTime: '18:00', endTime: '22:00', minCapacity: Math.floor(subCap * 0.1), maxCapacity: subCap, defaultCapacity: Math.floor(subCap * 0.4), allocatedCapacity: Math.floor(subCap * 0.3) },
          ],
          isActive: true,
          approvalStatus: 'APPROVED',
          approvedBy: 'admin@system.com',
          approvedAt: new Date(),
          createdBy: 'seed-script',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await csCollection.insertOne(cs);
        capacitySheetCount++;
        log.push(`  ${cs.name} (SubLocation, Priority: ${cs.priority})`);
      }

      // One pending capacity sheet for testing approval workflow
      if (subLocations.length > 0) {
        const pendingCs = {
          name: 'Holiday Capacity Override (Pending)',
          description: 'Special capacity rules for holiday season - awaiting approval',
          type: 'DATE_BASED',
          appliesTo: { level: 'SUBLOCATION', entityId: subLocations[0]._id! },
          priority: 3500,
          conflictResolution: 'PRIORITY',
          effectiveFrom: new Date('2026-12-20'),
          effectiveTo: new Date('2026-12-31'),
          dateRanges: [
            {
              startDate: new Date('2026-12-20'),
              endDate: new Date('2026-12-31'),
              minCapacity: 0,
              maxCapacity: subLocations[0].allocatedCapacity || 200,
              defaultCapacity: Math.floor((subLocations[0].allocatedCapacity || 200) * 0.3),
              allocatedCapacity: Math.floor((subLocations[0].allocatedCapacity || 200) * 0.2),
            },
          ],
          isActive: false,
          approvalStatus: 'PENDING_APPROVAL',
          createdBy: 'manager@example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await csCollection.insertOne(pendingCs);
        capacitySheetCount++;
        log.push(`  ${pendingCs.name} (Pending Approval)`);
      }

      log.push(`Created ${capacitySheetCount} capacity sheets total`);
    }

    // Seed Surge Configs
    let surgeConfigCount = 0;
    if (config.createSurgeConfigs && subLocations.length >= 2) {
      log.push(`\nCreating surge configs...`);
      const surgeCollection = db.collection('surge_configs');

      const normalSurge = {
        name: `${subLocations[0].label} - Normal Surge`,
        description: 'Standard surge pricing with moderate sensitivity',
        appliesTo: { level: 'SUBLOCATION', entityId: subLocations[0]._id! },
        priority: 500,
        demandSupplyParams: { currentDemand: 8, currentSupply: 10, historicalAvgPressure: 1.0 },
        surgeParams: { alpha: 0.3, minMultiplier: 0.75, maxMultiplier: 1.5, emaAlpha: 0.3 },
        effectiveFrom: new Date('2024-01-01'),
        isActive: true,
        createdBy: 'seed-script',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await surgeCollection.insertOne(normalSurge);
      surgeConfigCount++;
      log.push(`  ${normalSurge.name} (alpha: 0.3, range: 0.75-1.5x)`);

      const highSurge = {
        name: `${subLocations[1].label} - High Demand Surge`,
        description: 'Aggressive surge pricing for high-demand periods',
        appliesTo: { level: 'SUBLOCATION', entityId: subLocations[1]._id! },
        priority: 500,
        demandSupplyParams: { currentDemand: 15, currentSupply: 10, historicalAvgPressure: 1.2 },
        surgeParams: { alpha: 0.5, minMultiplier: 0.8, maxMultiplier: 1.8, emaAlpha: 0.25 },
        effectiveFrom: new Date('2024-01-01'),
        isActive: true,
        createdBy: 'seed-script',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await surgeCollection.insertOne(highSurge);
      surgeConfigCount++;
      log.push(`  ${highSurge.name} (alpha: 0.5, range: 0.8-1.8x)`);

      if (locations.length > 0) {
        const locationSurge = {
          name: `${locations[0].name} - Location Surge`,
          description: 'Location-wide surge pricing baseline',
          appliesTo: { level: 'LOCATION', entityId: locations[0]._id! },
          priority: 300,
          demandSupplyParams: { currentDemand: 10, currentSupply: 12, historicalAvgPressure: 1.1 },
          surgeParams: { alpha: 0.2, minMultiplier: 0.85, maxMultiplier: 1.4, emaAlpha: 0.35 },
          effectiveFrom: new Date('2024-01-01'),
          isActive: true,
          createdBy: 'seed-script',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await surgeCollection.insertOne(locationSurge);
        surgeConfigCount++;
        log.push(`  ${locationSurge.name} (Location-level, Priority: 300)`);
      }

      log.push(`Created ${surgeConfigCount} surge configs`);
    }

    log.push(`\nDatabase seeding completed successfully!`);
    log.push(`\nSummary:`);
    log.push(`  Customers: ${customers.length} (with operating hours)`);
    log.push(`  Locations: ${locations.length} (with operating hour overrides)`);
    log.push(`  Sub-Locations: ${subLocations.length} (with capacity allocation, revenue goals)`);
    log.push(`  Venues: ${venues.length}`);
    log.push(`  Sub-Location-Venue Relationships: ${relationshipCount}`);
    log.push(`  Rate Sheets: ${ratesheetCount}`);
    log.push(`  Events: ${eventCount}`);
    log.push(`  Event Rate Sheets: ${eventRatesheetCount}`);
    log.push(`  Total Rate Sheets: ${ratesheetCount + eventRatesheetCount}`);
    log.push(`  Priority Configs: ${priorityConfigCount}`);
    log.push(`  Capacity Sheets: ${capacitySheetCount}`);
    log.push(`  Surge Configs: ${surgeConfigCount}`);

    return NextResponse.json({ success: true, log });
  } catch (error) {
    console.error('Seed error:', error);
    log.push(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json(
      { error: 'Failed to seed database', log },
      { status: 500 }
    );
  }
}

// Helper functions
function getTimezone(state: string): string {
  const timezones: Record<string, string> = {
    NY: 'EST', CA: 'PST', IL: 'CST', TX: 'CST', AZ: 'MST',
    PA: 'EST', FL: 'EST', GA: 'EST', WA: 'PST', OR: 'PST',
    CO: 'MST', NV: 'PST', MI: 'EST', MN: 'CST', TN: 'CST',
    NC: 'EST', MD: 'EST', WI: 'CST', MA: 'EST',
  };
  return timezones[state] || 'EST';
}

function getRegion(state: string): string {
  const regions: Record<string, string> = {
    NY: 'Northeast', CA: 'West Coast', IL: 'Midwest', TX: 'South',
    AZ: 'Southwest', PA: 'Northeast', FL: 'Southeast', GA: 'Southeast',
    WA: 'Northwest', OR: 'Northwest', CO: 'Mountain', NV: 'West',
    MI: 'Midwest', MN: 'Midwest', TN: 'South', NC: 'Southeast',
    MD: 'Mid-Atlantic', WI: 'Midwest', MA: 'Northeast',
  };
  return regions[state] || 'Central';
}

function getCityName(index: number): string {
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin'];
  return cities[index % cities.length];
}

function getStateName(index: number): string {
  const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'TX'];
  return states[index % states.length];
}
