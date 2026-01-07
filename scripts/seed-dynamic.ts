import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { CustomerRepository } from '../src/models/Customer.js';
import { LocationRepository } from '../src/models/Location.js';
import { VenueRepository } from '../src/models/Venue.js';
import { SubLocationRepository } from '../src/models/SubLocation.js';
import { SubLocationVenueRepository } from '../src/models/SubLocationVenue.js';
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
  customerPrefix: 'Customer',
  locationPrefix: 'Location',
  subLocationPrefix: 'SubLocation',
  venuePrefix: 'Venue',
  useUSPSLocations: true,
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
            attributes: [
              { key: 'location_id', value: `${locationIndex}` },
              { key: 'timezone', value: getTimezone(uspsLocation.state) },
              { key: 'region', value: getRegion(uspsLocation.state) },
            ],
          };
          uspsIndex++;
        } else {
          // Generate synthetic location
          locationData = {
            customerId: customer._id!,
            name: `${config.locationPrefix}-${locationIndex}`,
            address: `${locationIndex * 100} Main St`,
            city: getCityName(locationIndex),
            state: getStateName(locationIndex),
            zipCode: `${10000 + locationIndex}`,
            country: 'USA',
            totalCapacity: 500 + (locationIndex * 100),
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
    const subLocations = [];
    let subLocationIndex = 1;

    for (const location of locations) {
      for (let i = 1; i <= config.subLocationsPerLocation; i++) {
        const allocatedCapacity = Math.floor((location.totalCapacity || 1000) / config.subLocationsPerLocation);
        const subLocation = await SubLocationRepository.create({
          locationId: location._id!,
          label: `${config.subLocationPrefix}-${subLocationIndex}`,
          description: `Sub-location ${i} of ${location.name}`,
          allocatedCapacity,
          attributes: [
            { key: 'sublocation_id', value: `${subLocationIndex}` },
            { key: 'floor', value: `${i}` },
            { key: 'capacity', value: `${allocatedCapacity}` },
          ],
        });
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

      while (assignedVenues.size < config.venuesPerSubLocation && attempts < maxAttempts) {
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

    console.log(`\n✅ Database seeding completed successfully!`);
    console.log(`\n📊 Summary:`);
    console.log(`  • Customers: ${customers.length}`);
    console.log(`  • Locations: ${locations.length}`);
    console.log(`  • Sub-Locations: ${subLocations.length}`);
    console.log(`  • Venues: ${venues.length}`);
    console.log(`  • SubLocation-Venue Relationships: ${relationshipCount}`);

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
      } else if (key === 'useUSPSLocations') {
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
