import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CustomerRepository } from '../src/models/Customer.js';
import { LocationRepository } from '../src/models/Location.js';
import { VenueRepository } from '../src/models/Venue.js';
import { SubLocationRepository } from '../src/models/SubLocation.js';
import { SubLocationVenueRepository } from '../src/models/SubLocationVenue.js';

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

async function seed() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Create Customers
    console.log('Creating customers...');
    const customer1 = await CustomerRepository.create({
      name: 'Acme Corporation',
      email: 'contact@acmecorp.com',
      phone: '+1-555-0101',
      address: '123 Business Ave, New York, NY 10001',
      attributes: [
        { key: 'industry', value: 'Technology' },
        { key: 'region', value: 'North America' },
        { key: 'account_type', value: 'Enterprise' },
        { key: 'contract_tier', value: 'Premium' },
      ],
    });
    console.log(`✓ Created customer: ${customer1.name}`);

    const customer2 = await CustomerRepository.create({
      name: 'TechStart Inc',
      email: 'info@techstart.com',
      phone: '+1-555-0202',
      address: '456 Innovation Dr, San Francisco, CA 94102',
      attributes: [
        { key: 'industry', value: 'Software' },
        { key: 'region', value: 'West Coast' },
        { key: 'account_type', value: 'Startup' },
      ],
    });
    console.log(`✓ Created customer: ${customer2.name}`);

    const customer3 = await CustomerRepository.create({
      name: 'Global Events Ltd',
      email: 'hello@globalevents.com',
      phone: '+1-555-0303',
      address: '789 Event Plaza, Chicago, IL 60601',
      attributes: [
        { key: 'industry', value: 'Event Management' },
        { key: 'region', value: 'Midwest' },
        { key: 'event_frequency', value: 'Weekly' },
      ],
    });
    console.log(`✓ Created customer: ${customer3.name}\n`);

    // Create Locations for Customer 1
    console.log('Creating locations...');
    const location1 = await LocationRepository.create({
      customerId: customer1._id!,
      name: 'Acme NYC Headquarters',
      address: '123 Business Ave',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
      totalCapacity: 1000,
      attributes: [
        { key: 'timezone', value: 'EST' },
        { key: 'parking_rate', value: '$5/hour' },
        { key: 'region', value: 'East Coast' }, // Overrides customer's "North America"
      ],
    });
    console.log(`✓ Created location: ${location1.name}`);

    const location2 = await LocationRepository.create({
      customerId: customer1._id!,
      name: 'Acme Brooklyn Office',
      address: '321 Creative St',
      city: 'Brooklyn',
      state: 'NY',
      zipCode: '11201',
      country: 'USA',
      totalCapacity: 800,
      attributes: [
        { key: 'timezone', value: 'EST' },
        { key: 'building_type', value: 'Modern' },
      ],
    });
    console.log(`✓ Created location: ${location2.name}`);

    // Create Locations for Customer 2
    const location3 = await LocationRepository.create({
      customerId: customer2._id!,
      name: 'TechStart SF Campus',
      address: '456 Innovation Dr',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
      country: 'USA',
      totalCapacity: 1500,
    });
    console.log(`✓ Created location: ${location3.name}`);

    const location4 = await LocationRepository.create({
      customerId: customer2._id!,
      name: 'TechStart Palo Alto Lab',
      address: '789 Research Blvd',
      city: 'Palo Alto',
      state: 'CA',
      zipCode: '94301',
      country: 'USA',
      totalCapacity: 600,
    });
    console.log(`✓ Created location: ${location4.name}`);

    // Create Locations for Customer 3
    const location5 = await LocationRepository.create({
      customerId: customer3._id!,
      name: 'Global Events Chicago Center',
      address: '789 Event Plaza',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      country: 'USA',
      totalCapacity: 2000,
    });
    console.log(`✓ Created location: ${location5.name}`);

    const location6 = await LocationRepository.create({
      customerId: customer3._id!,
      name: 'Global Events Austin Hub',
      address: '321 Music Ln',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      country: 'USA',
      totalCapacity: 1200,
    });
    console.log(`✓ Created location: ${location6.name}\n`);

    // Create Venues
    console.log('Creating venues...');
    const venue1 = await VenueRepository.create({
      name: 'Grand Ballroom',
      description: 'Luxurious ballroom perfect for weddings and galas',
      capacity: 500,
      venueType: 'Ballroom',
    });
    console.log(`✓ Created venue: ${venue1.name}`);

    const venue2 = await VenueRepository.create({
      name: 'Conference Hall A',
      description: 'Modern conference space with AV equipment',
      capacity: 200,
      venueType: 'Conference',
    });
    console.log(`✓ Created venue: ${venue2.name}`);

    const venue3 = await VenueRepository.create({
      name: 'Rooftop Garden',
      description: 'Beautiful outdoor space with city views',
      capacity: 150,
      venueType: 'Outdoor',
    });
    console.log(`✓ Created venue: ${venue3.name}`);

    const venue4 = await VenueRepository.create({
      name: 'Theater Room',
      description: 'Intimate theater-style venue with stage',
      capacity: 100,
      venueType: 'Theater',
    });
    console.log(`✓ Created venue: ${venue4.name}`);

    const venue5 = await VenueRepository.create({
      name: 'Banquet Hall',
      description: 'Spacious hall for corporate events and dinners',
      capacity: 300,
      venueType: 'Banquet',
    });
    console.log(`✓ Created venue: ${venue5.name}`);

    const venue6 = await VenueRepository.create({
      name: 'Meeting Room B',
      description: 'Compact meeting space for small groups',
      capacity: 25,
      venueType: 'Meeting Room',
    });
    console.log(`✓ Created venue: ${venue6.name}\n`);

    // Create Sub-Locations
    console.log('\nCreating sub-locations...');
    
    // Sub-locations for Location 1 (NYC Headquarters - Total: 1000)
    const subloc1 = await SubLocationRepository.create({
      locationId: location1._id!,
      label: 'LOT A',
      description: 'Main parking lot, north side',
      allocatedCapacity: 600,
      attributes: [
        { key: 'access_level', value: 'VIP' },
        { key: 'surface_type', value: 'Paved' },
        { key: 'parking_rate', value: '$8/hour' }, // Overrides location's "$5/hour"
      ],
    });
    const subloc2 = await SubLocationRepository.create({
      locationId: location1._id!,
      label: 'LOT B',
      description: 'Overflow parking lot, south side',
      allocatedCapacity: 300,
      attributes: [
        { key: 'access_level', value: 'Public' },
        { key: 'surface_type', value: 'Gravel' },
      ],
    });
    console.log(`✓ Created 2 sub-locations for ${location1.name} (Total: 900/1000, 100 available)`);

    // Sub-locations for Location 2 (Brooklyn Office - Total: 800)
    const subloc3 = await SubLocationRepository.create({
      locationId: location2._id!,
      label: 'Garage X',
      description: 'Underground parking garage',
      allocatedCapacity: 500,
    });
    const subloc4 = await SubLocationRepository.create({
      locationId: location2._id!,
      label: 'Garage Y',
      description: 'Street level parking',
      allocatedCapacity: 250,
    });
    console.log(`✓ Created 2 sub-locations for ${location2.name} (Total: 750/800, 50 available)`);

    // Sub-locations for Location 3 (SF Campus - Total: 1500)
    const subloc5 = await SubLocationRepository.create({
      locationId: location3._id!,
      label: 'Building A',
      description: 'Main building section',
      allocatedCapacity: 700,
    });
    const subloc6 = await SubLocationRepository.create({
      locationId: location3._id!,
      label: 'Building B',
      description: 'Secondary building section',
      allocatedCapacity: 500,
    });
    const subloc7 = await SubLocationRepository.create({
      locationId: location3._id!,
      label: 'Outdoor Plaza',
      description: 'Central courtyard area',
      allocatedCapacity: 200,
    });
    console.log(`✓ Created 3 sub-locations for ${location3.name} (Total: 1400/1500, 100 available)`);

    // Sub-locations for Location 5 (Chicago Center - Total: 2000)
    const subloc8 = await SubLocationRepository.create({
      locationId: location5._id!,
      label: 'North Wing',
      description: 'Northern section of the building',
      allocatedCapacity: 1000,
    });
    const subloc9 = await SubLocationRepository.create({
      locationId: location5._id!,
      label: 'South Wing',
      description: 'Southern section of the building',
      allocatedCapacity: 800,
    });
    console.log(`✓ Created 2 sub-locations for ${location5.name} (Total: 1800/2000, 200 available)`);

    // Create SubLocation-Venue relationships (venues assigned to sublocations)
    console.log('\nCreating sublocation-venue relationships...');
    
    // SubLoc1 (LOT A - 600 capacity) has venues: venue1 (500)
    await SubLocationVenueRepository.create(subloc1._id!, venue1._id!);
    console.log(`✓ Linked ${subloc1.label} with Grand Ballroom (500/600 capacity used)`);

    // SubLoc2 (LOT B - 300 capacity) has venues: venue2 (200), venue6 (25)
    await SubLocationVenueRepository.create(subloc2._id!, venue2._id!);
    await SubLocationVenueRepository.create(subloc2._id!, venue6._id!);
    console.log(`✓ Linked ${subloc2.label} with 2 venues (225/300 capacity used)`);

    // SubLoc3 (Garage X - 500 capacity) has venues: venue3 (150), venue4 (100)
    await SubLocationVenueRepository.create(subloc3._id!, venue3._id!);
    await SubLocationVenueRepository.create(subloc3._id!, venue4._id!);
    console.log(`✓ Linked ${subloc3.label} with 2 venues (250/500 capacity used)`);

    // SubLoc4 (Garage Y - 250 capacity) has venues: venue6 (25) - shared venue
    await SubLocationVenueRepository.create(subloc4._id!, venue6._id!);
    console.log(`✓ Linked ${subloc4.label} with Meeting Room B (25/250 capacity used)`);

    // SubLoc5 (Building A - 700 capacity) has venues: venue1 (500), venue5 (300) - over capacity!
    await SubLocationVenueRepository.create(subloc5._id!, venue1._id!);
    await SubLocationVenueRepository.create(subloc5._id!, venue5._id!);
    console.log(`✓ Linked ${subloc5.label} with 2 venues (800/700 capacity - OVER!)`);

    // SubLoc6 (Building B - 500 capacity) has venues: venue2 (200), venue4 (100)
    await SubLocationVenueRepository.create(subloc6._id!, venue2._id!);
    await SubLocationVenueRepository.create(subloc6._id!, venue4._id!);
    console.log(`✓ Linked ${subloc6.label} with 2 venues (300/500 capacity used)`);

    // SubLoc7 (Outdoor Plaza - 200 capacity) has venues: venue3 (150)
    await SubLocationVenueRepository.create(subloc7._id!, venue3._id!);
    console.log(`✓ Linked ${subloc7.label} with Rooftop Garden (150/200 capacity used)`);

    // SubLoc8 (North Wing - 1000 capacity) has venues: venue1 (500), venue5 (300)
    await SubLocationVenueRepository.create(subloc8._id!, venue1._id!);
    await SubLocationVenueRepository.create(subloc8._id!, venue5._id!);
    console.log(`✓ Linked ${subloc8.label} with 2 venues (800/1000 capacity used)`);

    // SubLoc9 (South Wing - 800 capacity) has venues: venue2 (200), venue3 (150), venue4 (100)
    await SubLocationVenueRepository.create(subloc9._id!, venue2._id!);
    await SubLocationVenueRepository.create(subloc9._id!, venue3._id!);
    await SubLocationVenueRepository.create(subloc9._id!, venue4._id!);
    console.log(`✓ Linked ${subloc9.label} with 3 venues (450/800 capacity used)`);

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\nSummary:');
    console.log(`- Created 3 customers`);
    console.log(`- Created 6 locations with total capacities`);
    console.log(`- Created 9 sub-locations with allocated capacities`);
    console.log(`- Created 6 venues with individual capacities`);
    console.log(`- Created 15 sublocation-venue relationships`);
    console.log(`\nCapacity Visualization:`);
    console.log(`- View capacity flow in the Graph page (/graph)`);
    console.log(`- Note: Building A is intentionally over-allocated to demonstrate warnings`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed();
