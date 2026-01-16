// scripts/migrate-event-dates.js
// Migrate event dates from strings to Date objects
const { MongoClient } = require('mongodb');

async function migrate() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const eventsCollection = db.collection('events');

    // Find all events
    const events = await eventsCollection.find({}).toArray();
    console.log(`Found ${events.length} events`);

    let migrated = 0;
    let skipped = 0;

    for (const event of events) {
      // Check if dates are strings (need migration)
      const needsMigration =
        typeof event.startDate === 'string' ||
        typeof event.endDate === 'string';

      if (needsMigration) {
        console.log(`Migrating event: ${event.name} (${event._id})`);
        console.log(`  Old startDate: ${event.startDate} (${typeof event.startDate})`);
        console.log(`  Old endDate: ${event.endDate} (${typeof event.endDate})`);

        await eventsCollection.updateOne(
          { _id: event._id },
          {
            $set: {
              startDate: new Date(event.startDate),
              endDate: new Date(event.endDate),
              updatedAt: new Date()
            }
          }
        );

        // Verify the change
        const updated = await eventsCollection.findOne({ _id: event._id });
        console.log(`  New startDate: ${updated.startDate} (${typeof updated.startDate})`);
        console.log(`  New endDate: ${updated.endDate} (${typeof updated.endDate})`);

        migrated++;
      } else {
        console.log(`Skipping event: ${event.name} (already Date objects)`);
        skipped++;
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Migrated: ${migrated} events`);
    console.log(`   Skipped: ${skipped} events`);

  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrate();
