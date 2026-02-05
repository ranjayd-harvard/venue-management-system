const { MongoClient, ObjectId } = require('mongodb');

async function fixMondayRushTimeWindows() {
  const uri = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27018/venue_management?authSource=admin';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();

    // Find the Monday Rush config
    const config = await db.collection('surge_configs').findOne({
      _id: new ObjectId('698004b6b45cf25db48825ca')
    });

    if (!config) {
      console.log('❌ Config not found');
      return;
    }

    console.log('\n📋 Current config:');
    console.log(`   Name: ${config.name}`);
    console.log('   Time Windows:', config.timeWindows);
    console.log('   Effective From:', config.effectiveFrom);
    console.log('   Effective To:', config.effectiveTo);

    // Add time windows for 24/7 coverage (since timeWindows is empty, it should apply all day)
    const timeWindows = [
      {
        startTime: '00:00',
        endTime: '23:59',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6]  // All days
      }
    ];

    // Update the config
    const result = await db.collection('surge_configs').updateOne(
      { _id: new ObjectId('698004b6b45cf25db48825ca') },
      {
        $set: {
          timeWindows: timeWindows,
          updatedAt: new Date()
        }
      }
    );

    console.log(`\n✅ Updated ${result.modifiedCount} config(s)`);

    // Verify the update
    const updated = await db.collection('surge_configs').findOne({
      _id: new ObjectId('698004b6b45cf25db48825ca')
    });

    console.log('\n📋 Updated config:');
    console.log(`   Name: ${updated.name}`);
    console.log('   Time Windows:', JSON.stringify(updated.timeWindows, null, 2));
    console.log('   Effective From:', updated.effectiveFrom);
    console.log('   Effective To:', updated.effectiveTo);

    console.log('\n✅ Config updated successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Refresh the Timeline Simulator page');
    console.log('   2. Toggle Surge Pricing ON');
    console.log('   3. You should now see the surge layer with "(Virtual)" label');
    console.log('   4. Expected multiplier: ~1.12x (based on your demand/supply)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

fixMondayRushTimeWindows();
