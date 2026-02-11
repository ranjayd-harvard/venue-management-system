const { MongoClient } = require('mongodb');

async function fixSurgeRatesheetType() {
  const uri = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27018/venue_management?authSource=admin';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const ratesheets = db.collection('ratesheets');

    // Find all ratesheets with surgeConfigId (materialized surge ratesheets)
    const surgeRatesheets = await ratesheets.find({
      surgeConfigId: { $exists: true }
    }).toArray();

    console.log(`\n📊 Found ${surgeRatesheets.length} materialized surge ratesheet(s)`);

    if (surgeRatesheets.length === 0) {
      console.log('✅ No surge ratesheets to update');
      return;
    }

    // Display current state
    console.log('\n📋 Current surge ratesheets:');
    surgeRatesheets.forEach((rs, idx) => {
      console.log(`\n${idx + 1}. ${rs.name}`);
      console.log(`   ID: ${rs._id}`);
      console.log(`   Type: ${rs.type}`);
      console.log(`   Priority: ${rs.priority}`);
      console.log(`   Status: ${rs.approvalStatus}`);
      console.log(`   Active: ${rs.isActive}`);
    });

    // Update all surge ratesheets to SURGE_MULTIPLIER type
    console.log('\n🔄 Updating surge ratesheets to SURGE_MULTIPLIER type...');

    const result = await ratesheets.updateMany(
      { surgeConfigId: { $exists: true } },
      {
        $set: {
          type: 'SURGE_MULTIPLIER',
          updatedAt: new Date()
        }
      }
    );

    console.log(`\n✅ Updated ${result.modifiedCount} ratesheet(s)`);

    // Verify the updates
    const updated = await ratesheets.find({
      surgeConfigId: { $exists: true }
    }).toArray();

    console.log('\n📋 Updated surge ratesheets:');
    updated.forEach((rs, idx) => {
      console.log(`\n${idx + 1}. ${rs.name}`);
      console.log(`   Type: ${rs.type} ✓`);
      console.log(`   Priority: ${rs.priority}`);
    });

    console.log('\n✅ All surge ratesheets updated successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Refresh the Timeline Simulator page');
    console.log('   2. Surge ratesheets should now show correct prices (base × multiplier)');
    console.log('   3. Example: $10 base × 0.75 multiplier = $7.50');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

fixSurgeRatesheetType();
