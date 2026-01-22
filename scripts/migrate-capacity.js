/**
 * Capacity Migration Script
 *
 * This script initializes capacity values (min, max, default) for all sublocations
 * that don't have them set. Run this once to populate historical data.
 *
 * Usage: node scripts/migrate-capacity.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/venue-management';

async function migrateCapacity() {
  console.log('🚀 Starting capacity migration...\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db();
    const sublocationsCollection = db.collection('sublocations');

    // Fetch all sublocations
    const allSublocations = await sublocationsCollection.find({}).toArray();
    console.log(`📊 Found ${allSublocations.length} sublocations to process\n`);

    let updated = 0;
    let skipped = 0;

    for (const subloc of allSublocations) {
      // Check if capacity fields are already set
      const hasCapacitySet =
        subloc.minCapacity !== undefined &&
        subloc.maxCapacity !== undefined &&
        subloc.defaultCapacity !== undefined;

      if (hasCapacitySet) {
        console.log(`⏭️  Skipping "${subloc.label}" - already has capacity values`);
        skipped++;
        continue;
      }

      // Calculate default values based on allocatedCapacity
      const allocated = subloc.allocatedCapacity || 100;
      const maxCapacity = allocated + 50; // Max is allocated + 50
      const minCapacity = Math.floor(allocated * 0.5); // Min is 50% of allocated
      const defaultCapacity = allocated; // Default equals allocated

      // Update the sublocation
      await sublocationsCollection.updateOne(
        { _id: subloc._id },
        {
          $set: {
            minCapacity,
            maxCapacity,
            defaultCapacity,
            allocatedCapacity: allocated,
            isActive: subloc.isActive !== undefined ? subloc.isActive : true,
            pricingEnabled: subloc.pricingEnabled !== undefined ? subloc.pricingEnabled : true,
            updatedAt: new Date()
          }
        }
      );

      console.log(`✅ Updated "${subloc.label}": min=${minCapacity}, max=${maxCapacity}, default=${defaultCapacity}, allocated=${allocated}`);
      updated++;
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   Total sublocations: ${allSublocations.length}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log('\n✅ Migration complete!');

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

migrateCapacity();
