#!/usr/bin/env node

/**
 * Diagnostic script to check ratesheets in the database
 * Run with: node scripts/check-ratesheets.js
 */

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = 'mongodb://admin:password123@localhost:27018/venue_management?authSource=admin';
const DB_NAME = 'venue_management';

async function checkRatesheets() {
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db(DB_NAME);
  const collection = db.collection('ratesheets');

  console.log('\n========================================');
  console.log('RATESHEET DATABASE DIAGNOSTIC');
  console.log('========================================\n');

  // Get all ratesheets
  const allRatesheets = await collection.find({}).toArray();
  console.log(`Total ratesheets in database: ${allRatesheets.length}\n`);

  if (allRatesheets.length === 0) {
    console.log('❌ No ratesheets found in database!');
    await client.close();
    return;
  }

  // Show each ratesheet
  for (const rs of allRatesheets) {
    console.log('━'.repeat(60));
    console.log(`📋 ${rs.name}`);
    console.log('━'.repeat(60));
    console.log(`ID: ${rs._id}`);
    console.log(`Status: ${rs.approvalStatus || rs.status || 'UNKNOWN'}`);
    console.log(`Active: ${rs.isActive}`);
    console.log(`Type: ${rs.type}`);
    console.log(`Priority: ${rs.priority}`);
    console.log(`Conflict Resolution: ${rs.conflictResolution}`);
    
    // Check structure
    if (rs.layer && rs.entityId) {
      console.log(`\nStructure: NEW (layer/entityId)`);
      console.log(`  Layer: ${rs.layer}`);
      console.log(`  Entity ID: ${rs.entityId}`);
    } else if (rs.appliesTo) {
      console.log(`\nStructure: OLD (appliesTo)`);
      console.log(`  Level: ${rs.appliesTo.level}`);
      console.log(`  Entity ID: ${rs.appliesTo.entityId}`);
    } else {
      console.log(`\n⚠️  Structure: UNKNOWN (no layer or appliesTo field)`);
    }
    
    // Dates
    console.log(`\nEffective Period:`);
    console.log(`  From: ${rs.effectiveFrom}`);
    console.log(`  To: ${rs.effectiveTo || 'No end date (indefinite)'}`);
    
    // Recurrence
    if (rs.recurrence && rs.recurrence.pattern !== 'NONE') {
      console.log(`\nRecurrence: ${rs.recurrence.pattern}`);
      if (rs.recurrence.daysOfWeek) {
        console.log(`  Days: ${rs.recurrence.daysOfWeek.join(', ')}`);
      }
    }
    
    // Time windows
    if (rs.type === 'TIMING_BASED' && rs.timeWindows) {
      console.log(`\nTime Windows (${rs.timeWindows.length}):`);
      rs.timeWindows.forEach((tw, idx) => {
        console.log(`  ${idx + 1}. ${tw.startTime} - ${tw.endTime}: $${tw.pricePerHour}/hr`);
      });
    }
    
    // Duration rules
    if (rs.type === 'DURATION_BASED' && rs.durationRules) {
      console.log(`\nDuration Rules (${rs.durationRules.length}):`);
      rs.durationRules.forEach((dr, idx) => {
        console.log(`  ${idx + 1}. ${dr.durationHours} hours: $${dr.totalPrice} (${dr.description || 'No description'})`);
      });
    }
    
    console.log();
  }

  // Check for approved ratesheets
  console.log('\n========================================');
  console.log('APPROVED RATESHEETS');
  console.log('========================================\n');
  
  const approved = allRatesheets.filter(rs => 
    (rs.approvalStatus === 'APPROVED' || rs.status === 'APPROVED') && rs.isActive
  );
  
  console.log(`${approved.length} approved and active ratesheets:`);
  approved.forEach(rs => {
    console.log(`  ✅ ${rs.name} (Priority: ${rs.priority})`);
  });
  
  // Check for a specific sublocation
  console.log('\n========================================');
  console.log('SUBLOCATION-SPECIFIC CHECK');
  console.log('========================================\n');
  
  const sublocations = await db.collection('sublocations').find({}).toArray();
  
  if (sublocations.length > 0) {
    const subloc = sublocations[0];
    console.log(`Checking for SubLocation: ${subloc.label} (${subloc._id})\n`);
    
    const sublocRatesheets = allRatesheets.filter(rs => {
      // Check both old and new structure
      if (rs.layer === 'SUBLOCATION' && rs.entityId?.toString() === subloc._id.toString()) {
        return true;
      }
      if (rs.appliesTo?.level === 'SUBLOCATION' && rs.appliesTo?.entityId?.toString() === subloc._id.toString()) {
        return true;
      }
      return false;
    });
    
    console.log(`Found ${sublocRatesheets.length} ratesheets for this sublocation:`);
    sublocRatesheets.forEach(rs => {
      const statusIcon = (rs.approvalStatus === 'APPROVED' || rs.status === 'APPROVED') && rs.isActive ? '✅' : '❌';
      console.log(`  ${statusIcon} ${rs.name} (${rs.approvalStatus || rs.status})`);
    });
  }
  
  console.log('\n========================================\n');
  
  await client.close();
}

checkRatesheets().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
