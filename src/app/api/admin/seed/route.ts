import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { CustomerRepository } from '@/models/Customer';
import { LocationRepository } from '@/models/Location';
import { VenueRepository } from '@/models/Venue';
import { SubLocationRepository } from '@/models/SubLocation';
import { SubLocationVenueRepository } from '@/models/SubLocationVenue';
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

export async function POST(request: NextRequest) {
  const log: string[] = [];

  try {
    const config: SeedConfig = await request.json();
    log.push('🌱 Starting dynamic database seeding...');
    log.push(`Configuration: ${JSON.stringify(config, null, 2)}`);

    // Clear existing data
    log.push('\n🗑️  Clearing existing data...');
    const db = await getDb();
    await db.collection('customers').deleteMany({});
    await db.collection('locations').deleteMany({});
    await db.collection('sublocations').deleteMany({});
    await db.collection('venues').deleteMany({});
    await db.collection('sublocation_venues').deleteMany({});
    log.push('✓ Cleared all collections');

    // Create Customers
    log.push(`\n👥 Creating ${config.customers} customers...`);
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
      log.push(`  ✓ Created: ${customer.name}`);
    }

    // Create Locations
    log.push(`\n📍 Creating ${config.locationsPerCustomer} locations per customer...`);
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
        log.push(`  ✓ Created: ${location.name} for ${customer.name}`);
        locationIndex++;
      }
    }

    // Create Sub-Locations
    log.push(`\n🏢 Creating ${config.subLocationsPerLocation} sub-locations per location...`);
    const subLocations = [];
    let subLocationIndex = 1;

    for (const location of locations) {
      for (let i = 1; i <= config.subLocationsPerLocation; i++) {
        const allocatedCapacity = Math.floor((location.totalCapacity || 1000) / config.subLocationsPerLocation);
        const maxCapacity = allocatedCapacity + 50; // Max is slightly higher than allocated
        const minCapacity = Math.floor(allocatedCapacity * 0.5); // Min is 50% of allocated
        const defaultCapacity = allocatedCapacity; // Default equals allocated

        const subLocation = await SubLocationRepository.create({
          locationId: location._id!,
          label: `${config.subLocationPrefix}-${subLocationIndex}`,
          description: `Sub-location ${i} of ${location.name}`,
          minCapacity,
          maxCapacity,
          defaultCapacity,
          allocatedCapacity,
          isActive: true,
          pricingEnabled: true,
          attributes: [
            { key: 'sublocation_id', value: `${subLocationIndex}` },
            { key: 'floor', value: `${i}` },
            { key: 'capacity', value: `${allocatedCapacity}` },
          ],
        });
        subLocations.push(subLocation);
        log.push(`  ✓ Created: ${subLocation.label} in ${location.name} (capacity: ${minCapacity}-${maxCapacity}, default: ${defaultCapacity}, allocated: ${allocatedCapacity})`);
        subLocationIndex++;
      }
    }

    // Create Venues
    log.push(`\n🎭 Creating ${config.venues} venues...`);
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
      log.push(`  ✓ Created: ${venue.name}`);
    }

    // Create SubLocation-Venue Relationships
    log.push(`\n🔗 Creating sub-location to venue relationships...`);
    let relationshipCount = 0;

    for (const subLocation of subLocations) {
      // Assign random venues to each sub-location
      const assignedVenues = new Set<string>();
      let attempts = 0;
      const maxAttempts = config.venues * 2; // Prevent infinite loops

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
          log.push(`  ✓ Linked: ${subLocation.label} → ${randomVenue.name}`);
        }
        attempts++;
      }
    }

    log.push(`\n✅ Database seeding completed successfully!`);
    log.push(`\n📊 Summary:`);
    log.push(`  • Customers: ${customers.length}`);
    log.push(`  • Locations: ${locations.length}`);
    log.push(`  • Sub-Locations: ${subLocations.length}`);
    log.push(`  • Venues: ${venues.length}`);
    log.push(`  • Sub-Location-Venue Relationships: ${relationshipCount}`);

    return NextResponse.json({ success: true, log });
  } catch (error) {
    console.error('Seed error:', error);
    log.push(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
