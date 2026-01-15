// scripts/diagnose-pricing.ts
// Run with: npx tsx scripts/diagnose-pricing.ts

import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/venue-management';

async function diagnosePricing() {
  console.log('🔍 Pricing Engine Diagnostic\n');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Test scenario from screenshot
    const testSubLocationId = '69669dee7e6882578d3f93d9'; // SubLocation-1
    const testStart = new Date('2026-01-13T14:00:00.000Z'); // 9 AM local (14:00 UTC)
    const testEnd = new Date('2026-01-13T19:00:00.000Z');   // 2 PM local (19:00 UTC)
    
    console.log('📋 Test Scenario:');
    console.log('  SubLocation ID:', testSubLocationId);
    console.log('  Start:', testStart.toISOString(), '(9:00 AM local)');
    console.log('  End:', testEnd.toISOString(), '(2:00 PM local)');
    console.log();
    
    // Get sublocation
    const sublocation = await db.collection('sublocations').findOne({
      _id: new ObjectId(testSubLocationId)
    });
    
    if (!sublocation) {
      console.error('❌ SubLocation not found!');
      return;
    }
    
    console.log('✅ SubLocation:', sublocation.label);
    console.log('  Location ID:', sublocation.locationId.toString());
    console.log('  Default Rate:', sublocation.defaultHourlyRate || 'Not set');
    console.log();
    
    // Get location
    const location = await db.collection('locations').findOne({
      _id: new ObjectId(sublocation.locationId)
    });
    
    if (!location) {
      console.error('❌ Location not found!');
      return;
    }
    
    console.log('✅ Location:', location.name);
    console.log('  Customer ID:', location.customerId.toString());
    console.log('  Default Rate:', location.defaultHourlyRate || 'Not set');
    console.log();
    
    // Get customer
    const customer = await db.collection('customers').findOne({
      _id: new ObjectId(location.customerId)
    });
    
    console.log('✅ Customer:', customer?.name);
    console.log('  Default Rate:', customer?.defaultHourlyRate || 'Not set');
    console.log();
    
    // Find all ratesheets
    const allRatesheets = await db.collection('ratesheets').find({
      $or: [
        { customerId: new ObjectId(location.customerId) },
        { locationId: new ObjectId(location._id) },
        { subLocationId: new ObjectId(sublocation._id) }
      ]
    }).toArray();
    
    console.log('📊 Ratesheets Found:', allRatesheets.length);
    console.log();
    
    for (const rs of allRatesheets) {
      const level = rs.subLocationId ? 'SUBLOCATION' : rs.locationId ? 'LOCATION' : 'CUSTOMER';
      console.log(`  📄 ${rs.name} (${level}, Priority: ${rs.priority})`);
      console.log(`     Active: ${rs.isActive}`);
      console.log(`     Type: ${rs.type}`);
      console.log(`     Effective: ${new Date(rs.effectiveFrom).toLocaleDateString()} - ${rs.effectiveTo ? new Date(rs.effectiveTo).toLocaleDateString() : 'Indefinite'}`);
      
      if (rs.timeWindows) {
        console.log(`     Time Windows (${rs.timeWindows.length}):`);
        rs.timeWindows.forEach((tw: any) => {
          console.log(`       • ${tw.startTime} - ${tw.endTime}: $${tw.pricePerHour}/hr`);
        });
      }
      
      // Check if this ratesheet applies
      console.log('     🔍 Checking applicability:');
      
      // Entity match
      const entityMatch = 
        (level === 'CUSTOMER' && rs.customerId.toString() === location.customerId.toString()) ||
        (level === 'LOCATION' && rs.locationId.toString() === location._id.toString()) ||
        (level === 'SUBLOCATION' && rs.subLocationId.toString() === sublocation._id.toString());
      
      console.log(`       Entity match: ${entityMatch ? '✅' : '❌'}`);
      
      // Date match
      const effectiveFrom = new Date(rs.effectiveFrom);
      const effectiveTo = rs.effectiveTo ? new Date(rs.effectiveTo) : null;
      
      const dateOverlap = (testStart >= effectiveFrom || testEnd >= effectiveFrom) && 
                          (!effectiveTo || testStart <= effectiveTo);
      
      console.log(`       Date overlap: ${dateOverlap ? '✅' : '❌'}`);
      console.log(`         Ratesheet: ${effectiveFrom.toISOString()} - ${effectiveTo?.toISOString() || 'indefinite'}`);
      console.log(`         Booking: ${testStart.toISOString()} - ${testEnd.toISOString()}`);
      
      // Time window match (for TIMING_BASED)
      if (rs.type === 'TIMING_BASED' && rs.timeWindows) {
        const testTime = '09:00'; // 9 AM local
        let timeMatch = false;
        
        for (const tw of rs.timeWindows) {
          if (testTime >= tw.startTime && testTime < tw.endTime) {
            console.log(`       Time match: ✅ (${tw.startTime}-${tw.endTime})`);
            timeMatch = true;
            break;
          }
        }
        
        if (!timeMatch) {
          console.log(`       Time match: ❌ (${testTime} not in any window)`);
        }
      }
      
      console.log(`       🎯 APPLICABLE: ${entityMatch && dateOverlap && rs.isActive ? '✅ YES' : '❌ NO'}`);
      console.log();
    }
    
    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 EXPECTED BEHAVIOR:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const applicableRatesheets = allRatesheets.filter(rs => {
      const level = rs.subLocationId ? 'SUBLOCATION' : rs.locationId ? 'LOCATION' : 'CUSTOMER';
      const entityMatch = 
        (level === 'CUSTOMER' && rs.customerId.toString() === location.customerId.toString()) ||
        (level === 'LOCATION' && rs.locationId.toString() === location._id.toString()) ||
        (level === 'SUBLOCATION' && rs.subLocationId.toString() === sublocation._id.toString());
      
      const effectiveFrom = new Date(rs.effectiveFrom);
      const effectiveTo = rs.effectiveTo ? new Date(rs.effectiveTo) : null;
      const dateOverlap = (testStart >= effectiveFrom || testEnd >= effectiveFrom) && 
                          (!effectiveTo || testStart <= effectiveTo);
      
      return entityMatch && dateOverlap && rs.isActive;
    });
    
    if (applicableRatesheets.length > 0) {
      console.log(`✅ ${applicableRatesheets.length} applicable ratesheet(s) found`);
      console.log('   Should use RATESHEET pricing (NOT default rates)');
      console.log();
      
      // Sort by hierarchy
      const sorted = applicableRatesheets.sort((a, b) => {
        const levelA = a.subLocationId ? 3 : a.locationId ? 2 : 1;
        const levelB = b.subLocationId ? 3 : b.locationId ? 2 : 1;
        if (levelA !== levelB) return levelB - levelA;
        return b.priority - a.priority;
      });
      
      console.log('   Winner:', sorted[0].name);
      console.log('   Priority:', sorted[0].priority);
      console.log('   Expected Price:');
      
      if (sorted[0].timeWindows) {
        sorted[0].timeWindows.forEach((tw: any) => {
          console.log(`     • ${tw.startTime}-${tw.endTime}: $${tw.pricePerHour}/hr`);
        });
      }
    } else {
      console.log('❌ No applicable ratesheets found');
      console.log('   Should use DEFAULT RATE:');
      console.log(`   SubLocation: $${sublocation.defaultHourlyRate || 'Not set'}/hr`);
      console.log(`   Location: $${location.defaultHourlyRate || 'Not set'}/hr`);
      console.log(`   Customer: $${customer?.defaultHourlyRate || 'Not set'}/hr`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

diagnosePricing().catch(console.error);
