/**
 * Initialize Database Indexes for CapacitySheets Collection
 *
 * This script creates the necessary indexes for the capacitysheets collection
 * to ensure optimal query performance.
 *
 * Usage: node scripts/init-capacity-indexes.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/venue-management';

async function initializeIndexes() {
  console.log('🔧 Initializing CapacitySheets Collection Indexes\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db();
    const collection = db.collection('capacitysheets');

    // Check if collection exists
    const collections = await db.listCollections({ name: 'capacitysheets' }).toArray();
    if (collections.length === 0) {
      console.log('📝 Creating capacitysheets collection...');
      await db.createCollection('capacitysheets');
      console.log('✅ Collection created\n');
    } else {
      console.log('✅ Collection exists\n');
    }

    // Create indexes
    console.log('📊 Creating indexes...\n');

    // Index 1: appliesTo.entityId + effectiveFrom (for quick lookup by entity and date)
    console.log('Creating index: appliesTo.entityId + effectiveFrom...');
    await collection.createIndex(
      { 'appliesTo.entityId': 1, effectiveFrom: 1 },
      { name: 'entityId_effectiveFrom_idx' }
    );
    console.log('✅ Index created: entityId_effectiveFrom_idx\n');

    // Index 2: appliesTo.level + isActive (for filtering by level and active status)
    console.log('Creating index: appliesTo.level + isActive...');
    await collection.createIndex(
      { 'appliesTo.level': 1, isActive: 1 },
      { name: 'level_isActive_idx' }
    );
    console.log('✅ Index created: level_isActive_idx\n');

    // Index 3: priority (descending for sorting)
    console.log('Creating index: priority (descending)...');
    await collection.createIndex(
      { priority: -1 },
      { name: 'priority_desc_idx' }
    );
    console.log('✅ Index created: priority_desc_idx\n');

    // Index 4: approvalStatus (for filtering by approval status)
    console.log('Creating index: approvalStatus...');
    await collection.createIndex(
      { approvalStatus: 1 },
      { name: 'approvalStatus_idx' }
    );
    console.log('✅ Index created: approvalStatus_idx\n');

    // Index 5: Compound index for hierarchy queries
    console.log('Creating compound index: appliesTo.level + appliesTo.entityId + isActive + approvalStatus...');
    await collection.createIndex(
      {
        'appliesTo.level': 1,
        'appliesTo.entityId': 1,
        isActive: 1,
        approvalStatus: 1
      },
      { name: 'hierarchy_query_idx' }
    );
    console.log('✅ Index created: hierarchy_query_idx\n');

    // Index 6: effectiveFrom + effectiveTo (for date range queries)
    console.log('Creating index: effectiveFrom + effectiveTo...');
    await collection.createIndex(
      { effectiveFrom: 1, effectiveTo: 1 },
      { name: 'dateRange_idx' }
    );
    console.log('✅ Index created: dateRange_idx\n');

    // Index 7: type (for filtering by capacity sheet type)
    console.log('Creating index: type...');
    await collection.createIndex(
      { type: 1 },
      { name: 'type_idx' }
    );
    console.log('✅ Index created: type_idx\n');

    // List all indexes
    console.log('📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('\n✅ All indexes created successfully!');
    console.log('\n📈 Performance Optimization Complete\n');

    // Display index usage recommendations
    console.log('💡 Recommended Query Patterns:\n');
    console.log('1. Find by entity and date:');
    console.log('   db.capacitysheets.find({ "appliesTo.entityId": ObjectId("..."), effectiveFrom: { $lte: date } })\n');

    console.log('2. Find by level and status:');
    console.log('   db.capacitysheets.find({ "appliesTo.level": "SUBLOCATION", isActive: true })\n');

    console.log('3. Find approved sheets by priority:');
    console.log('   db.capacitysheets.find({ approvalStatus: "APPROVED" }).sort({ priority: -1 })\n');

    console.log('4. Find applicable sheets for hierarchy:');
    console.log('   db.capacitysheets.find({');
    console.log('     "appliesTo.level": "SUBLOCATION",');
    console.log('     "appliesTo.entityId": ObjectId("..."),');
    console.log('     isActive: true,');
    console.log('     approvalStatus: "APPROVED"');
    console.log('   })\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

initializeIndexes();
