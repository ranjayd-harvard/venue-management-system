const { MongoClient } = require('mongodb');

async function updateLowPrioritySurge() {
  const uri = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27018/venue_management?authSource=admin';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const surgeConfigs = db.collection('surge_configs');

    // Find the Low Priority surge config
    const lowPriorityConfig = await surgeConfigs.findOne({
      name: 'Test Surge - Low Priority',
      isActive: true
    });

    if (!lowPriorityConfig) {
      console.log('❌ Low Priority surge config not found');
      return;
    }

    console.log('\n📋 Current Low Priority Surge Config:');
    console.log(`   Name: ${lowPriorityConfig.name}`);
    console.log(`   Priority: ${lowPriorityConfig.priority}`);
    console.log(`   ID: ${lowPriorityConfig._id}`);

    // Update priority from 500 to 10500
    const result = await surgeConfigs.updateOne(
      { _id: lowPriorityConfig._id },
      {
        $set: {
          priority: 10500,
          updatedAt: new Date()
        }
      }
    );

    console.log('\n✅ Updated Low Priority surge config:');
    console.log(`   Matched: ${result.matchedCount}`);
    console.log(`   Modified: ${result.modifiedCount}`);
    console.log(`   New Priority: 10500`);

    // Verify the update
    const updated = await surgeConfigs.findOne({ _id: lowPriorityConfig._id });
    console.log('\n✅ Verification:');
    console.log(`   Name: ${updated.name}`);
    console.log(`   Priority: ${updated.priority}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

updateLowPrioritySurge();
