// scripts/fix-timewindow-rs1-dates.ts
// Quick fix for Time-window-rs1 timezone issue
// Run with: npx tsx scripts/fix-timewindow-rs1-dates.ts

import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/venue-management';

async function fixDates() {
  console.log('🔧 Fixing Time-window-rs1 dates...\n');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Find Time-window-rs1
    const ratesheet = await db.collection('ratesheets').findOne({
      name: 'Time-window-rs1'
    });
    
    if (!ratesheet) {
      console.error('❌ Time-window-rs1 not found!');
      return;
    }
    
    console.log('Current dates (in UTC):');
    console.log('  effectiveFrom:', ratesheet.effectiveFrom);
    console.log('  effectiveTo:', ratesheet.effectiveTo);
    console.log();
    
    // The correct dates should be:
    // 1/13/2026 00:00:00 LOCAL time (not UTC)
    // 1/14/2026 23:59:59 LOCAL time (not UTC)
    
    // Since we're in Detroit (EST/EDT), and dates are stored in local time:
    const correctEffectiveFrom = new Date(2026, 0, 13, 0, 0, 0, 0); // Jan 13, 2026, midnight
    const correctEffectiveTo = new Date(2026, 0, 14, 23, 59, 59, 999); // Jan 14, 2026, end of day
    
    console.log('Corrected dates (local time):');
    console.log('  effectiveFrom:', correctEffectiveFrom);
    console.log('  effectiveTo:', correctEffectiveTo);
    console.log();
    
    console.log('In UTC:');
    console.log('  effectiveFrom:', correctEffectiveFrom.toISOString());
    console.log('  effectiveTo:', correctEffectiveTo.toISOString());
    console.log();
    
    // Update the ratesheet
    const result = await db.collection('ratesheets').updateOne(
      { _id: ratesheet._id },
      {
        $set: {
          effectiveFrom: correctEffectiveFrom,
          effectiveTo: correctEffectiveTo,
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Time-window-rs1 dates fixed!');
      console.log();
      console.log('Verification:');
      
      const updated = await db.collection('ratesheets').findOne({
        _id: ratesheet._id
      });
      
      console.log('  effectiveFrom:', updated.effectiveFrom);
      console.log('  effectiveTo:', updated.effectiveTo);
      console.log();
      
      // Test if booking now falls within range
      const testBookingStart = new Date('2026-01-13T14:00:00.000Z'); // 9 AM EST
      const testBookingEnd = new Date('2026-01-13T19:00:00.000Z');   // 2 PM EST
      
      const isWithinRange = 
        testBookingStart >= updated.effectiveFrom &&
        testBookingEnd <= updated.effectiveTo;
      
      console.log('Test booking (Jan 13, 9 AM - 2 PM EST):');
      console.log('  Start:', testBookingStart.toISOString());
      console.log('  End:', testBookingEnd.toISOString());
      console.log(`  ${isWithinRange ? '✅' : '❌'} Falls within ratesheet range`);
      
    } else {
      console.log('⚠️ No changes made (already correct?)');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

fixDates().catch(console.error);
