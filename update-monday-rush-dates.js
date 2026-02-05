const { MongoClient, ObjectId } = require('mongodb');

async function updateMondayRushDates() {
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
    console.log('   Name:', config.name);
    console.log('   Effective From:', config.effectiveFrom);
    console.log('   Effective To:', config.effectiveTo);

    // Update to cover Feb 2, all day (in UTC)
    // Feb 2, 2026 00:00:00 UTC to Feb 2, 2026 23:59:59 UTC
    const result = await db.collection('surge_configs').updateOne(
      { _id: new ObjectId('698004b6b45cf25db48825ca') },
      {
        $set: {
          effectiveFrom: new Date('2026-02-02T00:00:00.000Z'),
          effectiveTo: new Date('2026-02-02T23:59:59.000Z'),
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
    console.log('   Name:', updated.name);
    console.log('   Effective From:', updated.effectiveFrom);
    console.log('   Effective To:', updated.effectiveTo);
    console.log('\n✅ Config now covers all day on Feb 2, 2026 (UTC)');
    console.log('\n📝 Next steps:');
    console.log('   1. Refresh Timeline Simulator');
    console.log('   2. Toggle Surge ON');
    console.log('   3. Surge layer should now appear!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

updateMondayRushDates();
