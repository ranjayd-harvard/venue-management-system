import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { ObjectId } from 'mongodb';
import { CustomerRepository } from '../src/models/Customer.js';
import { LocationRepository } from '../src/models/Location.js';
import { VenueRepository } from '../src/models/Venue.js';
import { SubLocationRepository } from '../src/models/SubLocation.js';
import { SubLocationVenueRepository } from '../src/models/SubLocationVenue.js';
import { EventRepository } from '../src/models/Event.js';
import { getDb } from '../src/lib/mongodb.js';
import { ENTITY_LABEL_PRESETS } from '../src/lib/entity-labels.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

// Verify MongoDB URI is loaded
if (!process.env.MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in .env.local');
  console.error('Current directory:', process.cwd());
  console.error('Looking for .env.local at:', resolve(__dirname, '..', '.env.local'));
  process.exit(1);
}

// Default configuration (can be overridden via command line args)
const DEFAULT_CONFIG = {
  customers: 3,
  locationsPerCustomer: 2,
  subLocationsPerLocation: 2,
  venues: 6,
  venuesPerSubLocation: 2,
  eventsPerSubLocation: 3,
  eventDateRangeStart: 1, // Days from now (1 = tomorrow)
  eventDateRangeEnd: 5, // Days from now (5 = 5 days ahead)
  percentActiveEvents: 0, // Percentage of events currently active (0 since all are future)
  customerPrefix: 'Customer',
  locationPrefix: 'Location',
  subLocationPrefix: 'SubLocation',
  venuePrefix: 'Venue',
  eventPrefix: 'Event',
  useUSPSLocations: true,
  createRatesheets: true,
  createEvents: true,
  createEventRatesheets: true,
  createPriorityConfigs: true,
  createCapacitySheets: true,
  createSurgeConfigs: true,
};

// Load USPS locations data
let uspsLocations: any[] = [];
try {
  const uspsPath = resolve(__dirname, '..', 'data', 'usps-locations.json');
  uspsLocations = JSON.parse(readFileSync(uspsPath, 'utf-8'));
  console.log(`✓ Loaded ${uspsLocations.length} USPS locations`);
} catch (error) {
  console.warn('⚠️  USPS locations file not found, will use generated data');
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
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 
                  'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin'];
  return cities[index % cities.length];
}

function getStateName(index: number): string {
  const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'TX'];
  return states[index % states.length];
}

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
  saturday: [] as any[], // Closed
  sunday: [] as any[], // Closed
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

// Customer operating hours templates (indexed by customer number)
function getCustomerOperatingHours(customerIndex: number) {
  const schedules = [SCHEDULE_24_7, SCHEDULE_BUSINESS_HOURS, SCHEDULE_EXTENDED];
  const schedule = schedules[(customerIndex - 1) % schedules.length];

  return {
    schedule,
    blackouts: [
      {
        id: generateBlackoutId(),
        date: '2026-12-25',
        type: 'FULL_DAY' as const,
        name: 'Christmas Day',
        reason: 'Holiday closure',
        recurring: { pattern: 'YEARLY' as const },
      },
      {
        id: generateBlackoutId(),
        date: '2026-01-01',
        type: 'FULL_DAY' as const,
        name: "New Year's Day",
        reason: 'Holiday closure',
        recurring: { pattern: 'YEARLY' as const },
      },
      {
        id: generateBlackoutId(),
        date: '2026-11-26',
        type: 'FULL_DAY' as const,
        name: 'Thanksgiving',
        reason: 'Holiday closure',
        recurring: { pattern: 'YEARLY' as const },
      },
    ],
  };
}

// Location operating hours (overrides some parent days)
function getLocationOperatingHours(locationIndex: number) {
  if (locationIndex % 2 === 0) {
    // Even locations: open Saturday for limited hours (overrides parent)
    return {
      schedule: {
        saturday: [{ startTime: '09:00', endTime: '17:00' }],
      },
      blackouts: [
        {
          id: generateBlackoutId(),
          date: '2026-07-04',
          type: 'FULL_DAY' as const,
          name: 'Independence Day',
          reason: 'Location-specific holiday',
          recurring: { pattern: 'YEARLY' as const },
        },
      ],
    };
  }
  // Odd locations: inherit everything from parent, no overrides
  return undefined;
}

// SubLocation operating hours (some override Friday to close early)
function getSubLocationOperatingHours(subLocationIndex: number) {
  if (subLocationIndex % 3 === 0) {
    // Every 3rd sublocation closes early on Fridays
    return {
      schedule: {
        friday: [{ startTime: '08:00', endTime: '16:00', label: 'Early Close' }],
      },
    };
  }
  return undefined;
}

async function seed(config = DEFAULT_CONFIG) {
  console.log('🌱 Starting dynamic database seeding...\n');
  console.log('Configuration:');
  console.log(JSON.stringify(config, null, 2));
  console.log('');

  try {
    // Clear existing data
    console.log('🗑️  Clearing existing data...');
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
    console.log('✓ Cleared all collections\n');

    // Create Customers
    console.log(`👥 Creating ${config.customers} customers...`);
    const customers = [];
    // Map industry to entity label presets
    const industryLabelPresets: Record<string, string> = {
      'Technology': 'campus',
      'Retail': 'retail',
      'Healthcare': 'healthcare',
      'Finance': 'facilities',
    };

    for (let i = 1; i <= config.customers; i++) {
      const operatingHours = getCustomerOperatingHours(i);
      const industry = ['Technology', 'Retail', 'Healthcare', 'Finance'][i % 4];
      const presetKey = industryLabelPresets[industry] || 'default';
      const entityLabels = ENTITY_LABEL_PRESETS[presetKey];
      const customer = await CustomerRepository.create({
        name: `${config.customerPrefix}-${i}`,
        email: `${config.customerPrefix.toLowerCase()}-${i}@example.com`,
        phone: `+1-555-${String(i).padStart(4, '0')}`,
        address: `${i * 100} Business Ave, Suite ${i}00`,
        defaultHourlyRate: 50 + (i * 5),
        timezone: 'America/New_York',
        operatingHours,
        entityLabels,
        attributes: [
          { key: 'customer_id', value: `${i}` },
          { key: 'tier', value: i % 3 === 0 ? 'Enterprise' : i % 2 === 0 ? 'Professional' : 'Basic' },
          { key: 'industry', value: industry },
        ],
      });
      customers.push(customer);
      console.log(`  ✓ ${customer.name}`);
    }

    // Create Locations
    console.log(`\n📍 Creating ${config.locationsPerCustomer} locations per customer...`);
    const locations = [];
    let locationIndex = 1;
    let uspsIndex = 0;

    for (const customer of customers) {
      for (let i = 1; i <= config.locationsPerCustomer; i++) {
        let locationData: any;

        const locOpHours = getLocationOperatingHours(locationIndex);

        if (config.useUSPSLocations && uspsLocations.length > 0) {
          // Use real USPS location
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
          // Generate synthetic location
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
        console.log(`  ✓ ${location.name} → ${customer.name}`);
        locationIndex++;
      }
    }

    // Create Sub-Locations
    console.log(`\n🏢 Creating ${config.subLocationsPerLocation} sub-locations per location...`);
    const subLocations: any[] = [];
    let subLocationIndex = 1;

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
        const subLocationId = await SubLocationRepository.create(subLocationData);
        const subLocation = { ...subLocationData, _id: subLocationId };
        subLocations.push(subLocation);
        console.log(`  ✓ ${subLocation.label} in ${location.name} (capacity: ${minCapacity}-${maxCapacity}, allocated: ${allocatedCapacity}, goal: $${Math.round(dailyRevenueGoal)}/day)`);
        subLocationIndex++;
      }
    }

    // Create Venues
    console.log(`\n🎭 Creating ${config.venues} venues...`);
    const venues = [];
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
      console.log(`  ✓ ${venue.name}`);
    }

    // Create SubLocation-Venue Relationships
    console.log(`\n🔗 Creating sub-location to venue relationships...`);
    let relationshipCount = 0;

    for (const subLocation of subLocations) {
      // Assign random venues to each sub-location
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
          console.log(`  ✓ ${subLocation.label} → ${randomVenue.name}`);
        }
        attempts++;
      }
    }

    // Create RateSheets
    let ratesheets: any[] = [];
    if (config.createRatesheets) {
      console.log(`\n💰 Creating rate sheets...`);
      const db = await getDb();
      const ratesheetsCollection = db.collection('ratesheets');

      // Create rate sheets for each location and sublocation
      let locationRsIndex = 0;
      for (const location of locations) {
        // Location-level ratesheet with standard hours
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
            { startTime: '17:00', endTime: '21:00', pricePerHour: (location.defaultHourlyRate || 75) * 1.3 }, // Evening premium
          ],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await ratesheetsCollection.insertOne(locationRatesheet);
        ratesheets.push(locationRatesheet);
        console.log(`  ✓ ${locationRatesheet.name} (Priority: ${locationRatesheet.priority})`);

        // Weekend premium ratesheet for location
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
            { startTime: '00:00', endTime: '23:59', pricePerHour: (location.defaultHourlyRate || 75) * 1.5, daysOfWeek: [0, 6] }, // Sat-Sun
          ],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await ratesheetsCollection.insertOne(weekendRatesheet);
        ratesheets.push(weekendRatesheet);
        console.log(`  ✓ ${weekendRatesheet.name} (Priority: ${weekendRatesheet.priority})`);
        locationRsIndex++;
      }

      // Create sublocation-specific rate sheets
      let subLocRsIndex = 0;
      for (const subLocation of subLocations) {
        // Sublocation standard ratesheet with busy hours
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
            { startTime: '06:00', endTime: '09:00', pricePerHour: (subLocation.defaultHourlyRate || 100) * 0.8 }, // Early morning discount
            { startTime: '09:00', endTime: '12:00', pricePerHour: (subLocation.defaultHourlyRate || 100) * 1.2 }, // Morning busy hours
            { startTime: '12:00', endTime: '14:00', pricePerHour: subLocation.defaultHourlyRate || 100 }, // Lunch standard
            { startTime: '14:00', endTime: '18:00', pricePerHour: (subLocation.defaultHourlyRate || 100) * 1.3 }, // Afternoon busy hours
            { startTime: '18:00', endTime: '22:00', pricePerHour: (subLocation.defaultHourlyRate || 100) * 1.5 }, // Evening premium
          ],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await ratesheetsCollection.insertOne(subLocationRatesheet);
        ratesheets.push(subLocationRatesheet);
        console.log(`  ✓ ${subLocationRatesheet.name} (Priority: ${subLocationRatesheet.priority})`);
        subLocRsIndex++;
      }

      console.log(`✓ Created ${ratesheets.length} rate sheets`);
    }

    // Create Events
    let events: any[] = [];
    let eventRatesheets: any[] = [];
    if (config.createEvents) {
      console.log(`\n📅 Creating sample events...`);

      const eventTypes = ['Conference', 'Meeting', 'Workshop', 'Seminar', 'Training', 'Social Event'];
      const totalEvents = subLocations.length * config.eventsPerSubLocation;
      const totalDays = config.eventDateRangeEnd - config.eventDateRangeStart;
      let eventIndex = 1;

      for (const subLocation of subLocations) {
        // Find parent location
        const parentLocation = locations.find(loc => loc._id!.toString() === subLocation.locationId.toString());
        if (!parentLocation) continue;

        // Find parent customer
        const parentCustomer = customers.find(cust => cust._id!.toString() === parentLocation.customerId.toString());
        if (!parentCustomer) continue;

        for (let i = 0; i < config.eventsPerSubLocation; i++) {
          // Distribute events across the date range
          const dayOffset = config.eventDateRangeStart + (eventIndex / totalEvents) * totalDays;
          const startDate = new Date(now);
          startDate.setDate(startDate.getDate() + Math.floor(dayOffset));
          startDate.setHours(9 + (i * 2), 0, 0, 0); // Stagger start times: 9am, 11am, 1pm, etc.

          // Event duration: 2-5 hours
          const durationHours = 2 + (i % 4);
          const endDate = new Date(startDate);
          endDate.setHours(startDate.getHours() + durationHours);

          // Determine if event should be active (happening now)
          const shouldBeActive = (Math.random() * 100) < config.percentActiveEvents;
          let isActive = true;

          // If should be active, adjust dates to span current time
          if (shouldBeActive) {
            const hoursSinceStart = 1 + Math.floor(Math.random() * (durationHours - 1)); // Already started
            startDate.setTime(now.getTime() - (hoursSinceStart * 60 * 60 * 1000));
            endDate.setTime(startDate.getTime() + (durationHours * 60 * 60 * 1000));
            console.log(`  ⚡ Active event: starts ${hoursSinceStart}h ago, ends in ${durationHours - hoursSinceStart}h`);
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
          events.push(event);
          const status = shouldBeActive ? '🔴 ACTIVE' : '';
          console.log(`  ✓ ${event.name} (${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) ${status}`);

          // Create event-specific ratesheet if enabled
          if (config.createEventRatesheets) {
            const db = await getDb();
            const ratesheetsCollection = db.collection('ratesheets');

            // Event ratesheets have highest priority and cover exact event window
            const eventRatesheet = {
              name: `${event.name} - Event Rate`,
              description: `Special event pricing for ${event.name}`,
              type: 'TIMING_BASED' as const,
              applyTo: 'EVENT' as const,
              eventId: event._id,
              subLocationId: subLocation._id!,
              locationId: parentLocation._id!,
              customerId: parentCustomer._id!,
              priority: 4900 + (eventIndex % 100), // Event priority range: 4000-4999
              effectiveFrom: new Date(startDate),
              effectiveTo: new Date(endDate),
              timezone: event.timezone || 'America/New_York',
              timeWindows: [
                {
                  startTime: startDate.toTimeString().slice(0, 5), // HH:MM format
                  endTime: endDate.toTimeString().slice(0, 5),
                  pricePerHour: (event.defaultHourlyRate || 150) * 1.5 // Event premium 50%
                },
              ],
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            await ratesheetsCollection.insertOne(eventRatesheet);
            eventRatesheets.push(eventRatesheet);
          }

          eventIndex++;
        }
      }

      console.log(`✓ Created ${events.length} events`);
      if (config.createEventRatesheets) {
        console.log(`✓ Created ${eventRatesheets.length} event-specific ratesheets`);
      }

      const activeCount = events.filter(e => {
        const start = new Date(e.startDate);
        const end = new Date(e.endDate);
        return start <= now && end >= now;
      }).length;
      console.log(`  📊 ${activeCount} events are currently active`);
    }

    // Seed Priority Configs
    let priorityConfigCount = 0;
    if (config.createPriorityConfigs) {
      console.log(`\n🎯 Creating priority configs...`);
      const priorityConfigs = [
        {
          level: 'CUSTOMER',
          minPriority: 1000,
          maxPriority: 1999,
          color: '#3B82F6',
          description: 'Customer-level ratesheets have lowest priority and apply across all locations',
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          level: 'LOCATION',
          minPriority: 2000,
          maxPriority: 2999,
          color: '#10B981',
          description: 'Location-level ratesheets override customer rates for specific locations',
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          level: 'SUBLOCATION',
          minPriority: 3000,
          maxPriority: 3999,
          color: '#F59E0B',
          description: 'SubLocation-level ratesheets have high priority for specific spaces',
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          level: 'EVENT',
          minPriority: 4000,
          maxPriority: 4999,
          color: '#EC4899',
          description: 'Event-level ratesheets have highest priority and override all other rates',
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await db.collection('priority_configs').insertMany(priorityConfigs);
      priorityConfigCount = priorityConfigs.length;
      console.log(`  ✓ Created ${priorityConfigCount} priority configs (CUSTOMER, LOCATION, SUBLOCATION, EVENT)`);
    }

    // Seed Capacity Sheets
    let capacitySheets: any[] = [];
    if (config.createCapacitySheets) {
      console.log(`\n📊 Creating capacity sheets...`);
      const csCollection = db.collection('capacitysheets');

      // Customer-level capacity sheets (base defaults)
      for (const customer of customers) {
        const cs = {
          name: `${customer.name} - Base Capacity`,
          description: `Base capacity defaults for ${customer.name}`,
          type: 'TIME_BASED',
          appliesTo: { level: 'CUSTOMER', entityId: customer._id! },
          priority: 1000 + customers.indexOf(customer) * 10,
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
        capacitySheets.push(cs);
        console.log(`  ✓ ${cs.name} (Customer, Priority: ${cs.priority})`);
      }

      // Location-level capacity sheets (standard hours)
      for (const location of locations) {
        const locCapacity = location.totalCapacity || 500;
        const cs = {
          name: `${location.name} - Standard Hours Capacity`,
          description: `Operating hours capacity for ${location.name}`,
          type: 'TIME_BASED',
          appliesTo: { level: 'LOCATION', entityId: location._id! },
          priority: 2000 + locations.indexOf(location) * 10,
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
        capacitySheets.push(cs);
        console.log(`  ✓ ${cs.name} (Location, Priority: ${cs.priority})`);
      }

      // SubLocation-level capacity sheets (detailed time windows)
      for (const subLocation of subLocations) {
        const subCap = subLocation.allocatedCapacity || 200;
        const cs = {
          name: `${subLocation.label} - Detailed Capacity`,
          description: `Hourly capacity rules for ${subLocation.label}`,
          type: 'TIME_BASED',
          appliesTo: { level: 'SUBLOCATION', entityId: subLocation._id! },
          priority: 3000 + subLocations.indexOf(subLocation) * 10,
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
        capacitySheets.push(cs);
        console.log(`  ✓ ${cs.name} (SubLocation, Priority: ${cs.priority})`);
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
        capacitySheets.push(pendingCs);
        console.log(`  ✓ ${pendingCs.name} (Pending Approval)`);
      }

      console.log(`  ✓ Created ${capacitySheets.length} capacity sheets total`);
    }

    // Seed Surge Configs
    let surgeConfigs: any[] = [];
    if (config.createSurgeConfigs && subLocations.length >= 2) {
      console.log(`\n⚡ Creating surge configs...`);
      const surgeCollection = db.collection('surge_configs');

      // Normal demand surge config
      const normalSurge = {
        name: `${subLocations[0].label} - Normal Surge`,
        description: 'Standard surge pricing with moderate sensitivity',
        appliesTo: { level: 'SUBLOCATION', entityId: subLocations[0]._id! },
        priority: 500,
        demandSupplyParams: {
          currentDemand: 8,
          currentSupply: 10,
          historicalAvgPressure: 1.0,
        },
        surgeParams: {
          alpha: 0.3,
          minMultiplier: 0.75,
          maxMultiplier: 1.5,
          emaAlpha: 0.3,
        },
        effectiveFrom: new Date('2024-01-01'),
        isActive: true,
        createdBy: 'seed-script',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await surgeCollection.insertOne(normalSurge);
      surgeConfigs.push(normalSurge);
      console.log(`  ✓ ${normalSurge.name} (alpha: ${normalSurge.surgeParams.alpha}, range: ${normalSurge.surgeParams.minMultiplier}-${normalSurge.surgeParams.maxMultiplier}x)`);

      // High demand surge config
      const highSurge = {
        name: `${subLocations[1].label} - High Demand Surge`,
        description: 'Aggressive surge pricing for high-demand periods',
        appliesTo: { level: 'SUBLOCATION', entityId: subLocations[1]._id! },
        priority: 500,
        demandSupplyParams: {
          currentDemand: 15,
          currentSupply: 10,
          historicalAvgPressure: 1.2,
        },
        surgeParams: {
          alpha: 0.5,
          minMultiplier: 0.8,
          maxMultiplier: 1.8,
          emaAlpha: 0.25,
        },
        effectiveFrom: new Date('2024-01-01'),
        isActive: true,
        createdBy: 'seed-script',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await surgeCollection.insertOne(highSurge);
      surgeConfigs.push(highSurge);
      console.log(`  ✓ ${highSurge.name} (alpha: ${highSurge.surgeParams.alpha}, range: ${highSurge.surgeParams.minMultiplier}-${highSurge.surgeParams.maxMultiplier}x)`);

      // Location-level surge config
      if (locations.length > 0) {
        const locationSurge = {
          name: `${locations[0].name} - Location Surge`,
          description: 'Location-wide surge pricing baseline',
          appliesTo: { level: 'LOCATION', entityId: locations[0]._id! },
          priority: 300,
          demandSupplyParams: {
            currentDemand: 10,
            currentSupply: 12,
            historicalAvgPressure: 1.1,
          },
          surgeParams: {
            alpha: 0.2,
            minMultiplier: 0.85,
            maxMultiplier: 1.4,
            emaAlpha: 0.35,
          },
          effectiveFrom: new Date('2024-01-01'),
          isActive: true,
          createdBy: 'seed-script',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await surgeCollection.insertOne(locationSurge);
        surgeConfigs.push(locationSurge);
        console.log(`  ✓ ${locationSurge.name} (Location-level, Priority: ${locationSurge.priority})`);
      }

      console.log(`  ✓ Created ${surgeConfigs.length} surge configs`);
    }

    console.log(`\n✅ Database seeding completed successfully!`);
    console.log(`\n📊 Summary:`);
    console.log(`  • Customers: ${customers.length} (with operating hours & blackouts)`);
    console.log(`  • Locations: ${locations.length} (with operating hour overrides)`);
    console.log(`  • Sub-Locations: ${subLocations.length} (with capacity allocation, revenue goals, operating hours)`);
    console.log(`  • Venues: ${venues.length}`);
    console.log(`  • SubLocation-Venue Relationships: ${relationshipCount}`);
    console.log(`  • Rate Sheets: ${ratesheets.length}`);
    console.log(`  • Events: ${events.length}`);
    console.log(`  • Event Rate Sheets: ${eventRatesheets.length}`);
    console.log(`  • Total Rate Sheets: ${ratesheets.length + eventRatesheets.length}`);
    console.log(`  • Priority Configs: ${priorityConfigCount}`);
    console.log(`  • Capacity Sheets: ${capacitySheets.length}`);
    console.log(`  • Surge Configs: ${surgeConfigs.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];

    if (key in config) {
      if (key.includes('Prefix')) {
        (config as any)[key] = value;
      } else if (key === 'useUSPSLocations' || key === 'createRatesheets' || key === 'createEvents' || key === 'createEventRatesheets' || key === 'createPriorityConfigs' || key === 'createCapacitySheets' || key === 'createSurgeConfigs') {
        (config as any)[key] = value === 'true';
      } else {
        (config as any)[key] = parseInt(value);
      }
    }
  }

  return config;
}

// Run the seed
const config = parseArgs();
seed(config);
