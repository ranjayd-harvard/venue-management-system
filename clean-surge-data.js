const { MongoClient } = require('mongodb');

async function cleanSurgeData() {
  const uri = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27018/venue_management?authSource=admin';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();

    // 1. Delete all surge configs
    console.log('\n📋 Step 1: Deleting surge configs...');
    const surgeConfigs = await db.collection('surge_configs').find({}).toArray();
    console.log(`   Found ${surgeConfigs.length} surge config(s):`);
    surgeConfigs.forEach((config, idx) => {
      console.log(`   ${idx + 1}. ${config.name} (Priority: ${config.priority})`);
    });

    const deletedConfigs = await db.collection('surge_configs').deleteMany({});
    console.log(`   ✅ Deleted ${deletedConfigs.deletedCount} surge config(s)`);

    // 2. Delete all materialized surge ratesheets
    console.log('\n📋 Step 2: Deleting materialized surge ratesheets...');
    const surgeRatesheets = await db.collection('ratesheets').find({
      surgeConfigId: { $exists: true }
    }).toArray();
    console.log(`   Found ${surgeRatesheets.length} materialized surge ratesheet(s):`);
    surgeRatesheets.forEach((rs, idx) => {
      console.log(`   ${idx + 1}. ${rs.name} (Priority: ${rs.priority}, Status: ${rs.approvalStatus})`);
    });

    const deletedRatesheets = await db.collection('ratesheets').deleteMany({
      surgeConfigId: { $exists: true }
    });
    console.log(`   ✅ Deleted ${deletedRatesheets.deletedCount} materialized surge ratesheet(s)`);

    // 3. Verify cleanup
    console.log('\n📋 Step 3: Verifying cleanup...');
    const remainingConfigs = await db.collection('surge_configs').countDocuments();
    const remainingSurgeRatesheets = await db.collection('ratesheets').countDocuments({
      surgeConfigId: { $exists: true }
    });

    console.log(`   Remaining surge configs: ${remainingConfigs}`);
    console.log(`   Remaining surge ratesheets: ${remainingSurgeRatesheets}`);

    if (remainingConfigs === 0 && remainingSurgeRatesheets === 0) {
      console.log('\n✅ All surge data cleaned successfully!');
      console.log('\n📝 Next steps:');
      console.log('   1. Navigate to Admin > Surge Pricing');
      console.log('   2. Create new surge configs with test scenarios');
      console.log('   3. Test in Timeline Simulator (Simulation Mode)');
      console.log('   4. Virtual surge layers will show with "(Virtual)" label');
      console.log('   5. Promote to production to materialize');
      console.log('   6. Approve in database');
      console.log('   7. Test in Live Mode (no Virtual label)');
    } else {
      console.log('\n⚠️ Cleanup incomplete - some surge data remains');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

cleanSurgeData();
