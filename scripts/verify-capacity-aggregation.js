/**
 * Capacity Aggregation Verification Script
 *
 * This script verifies that capacity values are correctly aggregated from
 * sublocations -> locations -> customers
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/venue-management';

async function verifyAggregation() {
  console.log('🔍 Verifying capacity aggregation...\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    const sublocations = await db.collection('sublocations').find({}).toArray();
    const locations = await db.collection('locations').find({}).toArray();
    const customers = await db.collection('customers').find({}).toArray();

    console.log('📊 SUBLOCATION LEVEL:\n');
    sublocations.forEach(sub => {
      console.log(`  ${sub.label}:`);
      console.log(`    min: ${sub.minCapacity}, max: ${sub.maxCapacity}, default: ${sub.defaultCapacity}, allocated: ${sub.allocatedCapacity}`);
    });

    console.log('\n📍 LOCATION LEVEL (Aggregated):\n');
    locations.forEach(loc => {
      const locationSublocations = sublocations.filter(s => String(s.locationId) === String(loc._id));

      const minCapacity = locationSublocations.reduce((sum, s) => sum + (s.minCapacity || 0), 0);
      const maxCapacity = locationSublocations.reduce((sum, s) => sum + (s.maxCapacity || 0), 0);
      const defaultCapacity = locationSublocations.reduce((sum, s) => sum + (s.defaultCapacity || 0), 0);
      const allocatedCapacity = locationSublocations.reduce((sum, s) => sum + (s.allocatedCapacity || 0), 0);

      console.log(`  ${loc.name} (${locationSublocations.length} sublocations):`);
      console.log(`    min: ${minCapacity}, max: ${maxCapacity}, default: ${defaultCapacity}, allocated: ${allocatedCapacity}`);
    });

    console.log('\n🏢 CUSTOMER LEVEL (Aggregated):\n');
    customers.forEach(customer => {
      const customerLocations = locations.filter(l => String(l.customerId) === String(customer._id));

      let totalMin = 0;
      let totalMax = 0;
      let totalDefault = 0;
      let totalAllocated = 0;

      customerLocations.forEach(loc => {
        const locationSublocations = sublocations.filter(s => String(s.locationId) === String(loc._id));
        totalMin += locationSublocations.reduce((sum, s) => sum + (s.minCapacity || 0), 0);
        totalMax += locationSublocations.reduce((sum, s) => sum + (s.maxCapacity || 0), 0);
        totalDefault += locationSublocations.reduce((sum, s) => sum + (s.defaultCapacity || 0), 0);
        totalAllocated += locationSublocations.reduce((sum, s) => sum + (s.allocatedCapacity || 0), 0);
      });

      console.log(`  ${customer.name} (${customerLocations.length} locations):`);
      console.log(`    min: ${totalMin}, max: ${totalMax}, default: ${totalDefault}, allocated: ${totalAllocated}`);
    });

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Verification error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

verifyAggregation();
