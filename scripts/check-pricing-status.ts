import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../src/lib/mongodb.js';
import { ObjectId } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

async function checkPricingStatus() {
  console.log('🔍 Checking SubLocation Pricing Status...\n');

  try {
    const db = await getDb();
    
    // Get all sublocations
    const sublocations = await db.collection('sublocations').find().toArray();
    
    console.log(`Found ${sublocations.length} sublocations\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    sublocations.forEach((sl, idx) => {
      const status = sl.pricingEnabled ? '✅ ENABLED' : '❌ DISABLED';
      const rate = sl.defaultHourlyRate || 'Not set';
      
      console.log(`${idx + 1}. ${sl.label}`);
      console.log(`   ID: ${sl._id}`);
      console.log(`   Location ID: ${sl.locationId}`);
      console.log(`   Pricing Status: ${status}`);
      console.log(`   Default Rate: $${rate}`);
      console.log(`   Is Active: ${sl.isActive !== false ? 'Yes' : 'No'}`);
      console.log(`   Capacity: ${sl.allocatedCapacity || 'Not set'}`);
      console.log('');
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Summary
    const enabledCount = sublocations.filter(sl => sl.pricingEnabled).length;
    const disabledCount = sublocations.filter(sl => !sl.pricingEnabled).length;
    const withRates = sublocations.filter(sl => sl.defaultHourlyRate).length;
    
    console.log('📊 Summary:');
    console.log(`   Total SubLocations: ${sublocations.length}`);
    console.log(`   Pricing Enabled: ${enabledCount}`);
    console.log(`   Pricing Disabled: ${disabledCount}`);
    console.log(`   With Default Rates: ${withRates}`);
    console.log('');
    
    // Check for specific sublocation if provided
    if (process.argv[2]) {
      const specificId = process.argv[2];
      console.log(`\n🔎 Checking specific SubLocation: ${specificId}\n`);
      
      try {
        const specific = await db.collection('sublocations').findOne({ 
          _id: new ObjectId(specificId) 
        });
        
        if (specific) {
          console.log('✅ Found:');
          console.log(JSON.stringify(specific, null, 2));
        } else {
          console.log('❌ Not found');
        }
      } catch (err) {
        console.log('❌ Invalid ObjectId format');
      }
    }
    
    console.log('\n✅ Check complete!');
    console.log('\n💡 To check a specific sublocation:');
    console.log('   npm run check:pricing <sublocation_id>');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkPricingStatus();
