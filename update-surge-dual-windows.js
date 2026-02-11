const { MongoClient, ObjectId } = require('mongodb');

async function updateSurgeDualWindows() {
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
    console.log('   Time Windows:', JSON.stringify(config.timeWindows, null, 2));

    // Update with dual time windows: 4-5 AM and 6-8 PM
    const timeWindows = [
      {
        startTime: '04:00',
        endTime: '05:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6]  // All days
      },
      {
        startTime: '18:00',
        endTime: '20:00',
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

    console.log('\n✅ Config updated successfully!');
    console.log('\n📝 Surge will now be active during:');
    console.log('   • 4:00 AM - 5:00 AM (Morning rush)');
    console.log('   • 6:00 PM - 8:00 PM (Evening rush)');
    console.log('\n📝 Next steps:');
    console.log('   1. Refresh Timeline Simulator');
    console.log('   2. Toggle Surge ON');
    console.log('   3. You should see surge active during both time windows');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

updateSurgeDualWindows();
