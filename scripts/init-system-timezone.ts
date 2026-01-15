// scripts/init-system-timezone.ts
// Initialize system-level timezone setting
// Run with: npx tsx scripts/init-system-timezone.ts

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/venue-management';

async function initSystemTimezone() {
  console.log('🌍 Initializing System Timezone...\n');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db();
    
    // Check if system timezone already exists
    const existing = await db.collection('timezone_settings').findOne({
      entityType: 'SYSTEM'
    });
    
    if (existing) {
      console.log('ℹ️  System timezone already exists:');
      console.log(`   Timezone: ${existing.timezone}`);
      console.log(`   Display Name: ${existing.displayName}`);
      console.log(`   Created: ${existing.createdAt}`);
      console.log(`   Updated: ${existing.updatedAt}\n`);
      
      console.log('Do you want to keep the existing timezone? (No changes will be made)');
      console.log('To change it, delete the existing setting and run this script again.\n');
      return;
    }
    
    // Create system timezone setting
    const result = await db.collection('timezone_settings').insertOne({
      entityType: 'SYSTEM',
      timezone: 'America/Detroit',
      displayName: 'Eastern Time (Detroit)',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ System timezone setting created!\n');
    console.log('Details:');
    console.log('  Entity Type: SYSTEM');
    console.log('  Timezone: America/Detroit');
    console.log('  Display Name: Eastern Time (Detroit)');
    console.log('  ID:', result.insertedId.toString());
    console.log();
    
    console.log('📍 Timezone Hierarchy:');
    console.log('   SubLocation → Location → Customer → SYSTEM → Hardcoded Default');
    console.log();
    console.log('   When a SubLocation, Location, or Customer does not have');
    console.log('   a specific timezone set, it will inherit from this system');
    console.log('   timezone (America/Detroit).\n');
    
    console.log('💡 Next Steps:');
    console.log('   1. You can now create ratesheets with timezone awareness');
    console.log('   2. Each entity can override with its own timezone');
    console.log('   3. Use the timezone selector in the Create Ratesheet modal\n');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Check if MongoDB is running');
    console.error('  2. Verify MONGODB_URI in .env.local');
    console.error('  3. Ensure database is accessible\n');
    process.exit(1);
  } finally {
    await client.close();
    console.log('✅ MongoDB connection closed\n');
  }
}

// Run the script
initSystemTimezone().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
