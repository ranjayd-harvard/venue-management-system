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
  eventDateRangeStart: -7, // Days from now (negative = past)
  eventDateRangeEnd: 7, // Days from now (positive = future)
  percentActiveEvents: 40, // Percentage of events currently active
  customerPrefix: 'Customer',
  locationPrefix: 'Location',
  subLocationPrefix: 'SubLocation',
  venuePrefix: 'Venue',
  eventPrefix: 'Event',
  useUSPSLocations: true,
  createRatesheets: true,
  createEvents: true,
  createEventRatesheets: true,
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
    console.log('✓ Cleared all collections\n');

    // Create Customers
    console.log(`👥 Creating ${config.customers} customers...`);
    const customers = [];
    for (let i = 1; i <= config.customers; i++) {
      const customer = await CustomerRepository.create({
        name: `${config.customerPrefix}-${i}`,
        email: `${config.customerPrefix.toLowerCase()}-${i}@example.com`,
        phone: `+1-555-${String(i).padStart(4, '0')}`,
        address: `${i * 100} Business Ave, Suite ${i}00`,
        defaultHourlyRate: 50 + (i * 5),
        timezone: 'America/New_York',
        attributes: [
          { key: 'customer_id', value: `${i}` },
          { key: 'tier', value: i % 3 === 0 ? 'Enterprise' : i % 2 === 0 ? 'Professional' : 'Basic' },
          { key: 'industry', value: ['Technology', 'Retail', 'Healthcare', 'Finance'][i % 4] },
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

    for (const location of locations) {
      for (let i = 1; i <= config.subLocationsPerLocation; i++) {
        const allocatedCapacity = Math.floor((location.totalCapacity || 1000) / config.subLocationsPerLocation);
        const subLocationData = {
          locationId: location._id!,
          label: `${config.subLocationPrefix}-${subLocationIndex}`,
          description: `Sub-location ${i} of ${location.name}`,
          allocatedCapacity,
          pricingEnabled: true,
          isActive: true,
          defaultHourlyRate: 100 + (subLocationIndex * 10),
          timezone: location.timezone,
          attributes: [
            { key: 'sublocation_id', value: `${subLocationIndex}` },
            { key: 'floor', value: `${i}` },
            { key: 'capacity', value: `${allocatedCapacity}` },
          ],
        };
        const subLocationId = await SubLocationRepository.create(subLocationData);
        const subLocation = { ...subLocationData, _id: subLocationId };
        subLocations.push(subLocation);
        console.log(`  ✓ ${subLocation.label} in ${location.name}`);
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
      for (const location of locations) {
        // Location-level ratesheet with standard hours
        const locationRatesheet = {
          name: `${location.name} - Standard Hours`,
          description: `Standard hourly rates for ${location.name}`,
          type: 'TIMING_BASED' as const,
          applyTo: 'LOCATION' as const,
          locationId: location._id!,
          priority: 5,
          effectiveFrom: new Date('2024-01-01'),
          effectiveTo: new Date('2025-12-31'),
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
          priority: 7,
          effectiveFrom: new Date('2024-01-01'),
          effectiveTo: new Date('2025-12-31'),
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
      }

      // Create sublocation-specific rate sheets
      for (const subLocation of subLocations) {
        // Sublocation standard ratesheet with busy hours
        const subLocationRatesheet = {
          name: `${subLocation.label} - Standard + Busy Hours`,
          description: `Rates with busy hour premiums for ${subLocation.label}`,
          type: 'TIMING_BASED' as const,
          applyTo: 'SUBLOCATION' as const,
          subLocationId: subLocation._id!,
          priority: 10,
          effectiveFrom: new Date('2024-01-01'),
          effectiveTo: new Date('2025-12-31'),
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
      }

      console.log(`✓ Created ${ratesheets.length} rate sheets`);
    }

    // Create Events
    let events: any[] = [];
    let eventRatesheets: any[] = [];
    if (config.createEvents) {
      console.log(`\n📅 Creating sample events...`);

      const eventTypes = ['Conference', 'Meeting', 'Workshop', 'Seminar', 'Training', 'Social Event'];
      const now = new Date();
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
              priority: 20, // Highest priority
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

    console.log(`\n✅ Database seeding completed successfully!`);
    console.log(`\n📊 Summary:`);
    console.log(`  • Customers: ${customers.length}`);
    console.log(`  • Locations: ${locations.length}`);
    console.log(`  • Sub-Locations: ${subLocations.length}`);
    console.log(`  • Venues: ${venues.length}`);
    console.log(`  • SubLocation-Venue Relationships: ${relationshipCount}`);
    console.log(`  • Rate Sheets: ${ratesheets.length}`);
    console.log(`  • Events: ${events.length}`);
    console.log(`  • Event Rate Sheets: ${eventRatesheets.length}`);
    console.log(`  • Total Rate Sheets: ${ratesheets.length + eventRatesheets.length}`);

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
      } else if (key === 'useUSPSLocations' || key === 'createRatesheets' || key === 'createEvents' || key === 'createEventRatesheets') {
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
