import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../src/lib/mongodb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

async function diagnose() {
  console.log('🔍 Diagnosing SubLocation data...\n');

  try {
    const db = await getDb();
    
    // Get a sample location
    const location = await db.collection('locations').findOne();
    if (!location) {
      console.log('❌ No locations found!');
      process.exit(1);
    }
    
    console.log('✅ Sample Location:');
    console.log(`   ID: ${location._id}`);
    console.log(`   Name: ${location.name}\n`);

    // Get sublocations for this location
    console.log('🔍 Querying sublocations for this location...');
    const sublocations = await db.collection('sublocations')
      .find({ locationId: location._id })
      .toArray();

    console.log(`Found ${sublocations.length} sublocations\n`);

    if (sublocations.length === 0) {
      console.log('❌ No sublocations found for this location!');
      console.log('   This might be why the relationships page is empty.\n');
      
      // Check if sublocations exist at all
      const totalSublocations = await db.collection('sublocations').countDocuments();
      console.log(`Total sublocations in database: ${totalSublocations}`);
      
      if (totalSublocations > 0) {
        const anySublocation = await db.collection('sublocations').findOne();
        console.log('\n📋 Sample sublocation structure:');
        console.log(JSON.stringify(anySublocation, null, 2));
        
        console.log('\n⚠️  locationId type check:');
        console.log(`   Location._id type: ${typeof location._id} (${location._id.constructor.name})`);
        console.log(`   SubLocation.locationId type: ${typeof anySublocation.locationId} (${anySublocation.locationId?.constructor?.name || 'undefined'})`);
      }
    } else {
      console.log('✅ SubLocations found:');
      sublocations.forEach((sl, idx) => {
        console.log(`\n${idx + 1}. ${sl.label || sl._id}`);
        console.log(`   locationId: ${sl.locationId}`);
        console.log(`   pricingEnabled: ${sl.pricingEnabled}`);
        console.log(`   isActive: ${sl.isActive}`);
        console.log(`   defaultHourlyRate: ${sl.defaultHourlyRate}`);
      });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Diagnosis complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnose();
