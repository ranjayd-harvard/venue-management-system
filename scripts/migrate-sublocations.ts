import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../src/lib/mongodb.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

async function migrateSubLocations() {
  console.log('🔄 Migrating SubLocations to add pricing fields...\n');

  try {
    const db = await getDb();
    const collection = db.collection('sublocations');

    // Count existing sublocations
    const totalCount = await collection.countDocuments();
    console.log(`Found ${totalCount} sublocations\n`);

    if (totalCount === 0) {
      console.log('⚠️  No sublocations found. Run seed script first: npm run seed:dynamic');
      process.exit(0);
    }

    // Update all sublocations to add the new fields
    const result = await collection.updateMany(
      {
        // Only update documents that don't have these fields
        $or: [
          { pricingEnabled: { $exists: false } },
          { isActive: { $exists: false } },
          { defaultHourlyRate: { $exists: false } }
        ]
      },
      {
        $set: {
          pricingEnabled: false,  // Default to false for existing sublocations
          isActive: true,         // Default to active
          defaultHourlyRate: 100, // Default hourly rate
          updatedAt: new Date()
        }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} sublocations with pricing fields\n`);

    // Show sample of updated documents
    const samples = await collection.find({}).limit(3).toArray();
    console.log('Sample updated sublocations:');
    samples.forEach((subloc, idx) => {
      console.log(`\n${idx + 1}. ${subloc.label || subloc._id}`);
      console.log(`   pricingEnabled: ${subloc.pricingEnabled}`);
      console.log(`   isActive: ${subloc.isActive}`);
      console.log(`   defaultHourlyRate: ${subloc.defaultHourlyRate}`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\n💡 Note: Existing sublocations have pricingEnabled=false by default');
    console.log('   You can enable pricing for specific sublocations as needed.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateSubLocations();
