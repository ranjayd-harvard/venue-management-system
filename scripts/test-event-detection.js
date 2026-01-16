// scripts/test-event-detection.js
// Test automatic event detection logic
const { MongoClient, ObjectId } = require('mongodb');

async function testEventDetection() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB\n');

    const db = client.db();

    // Test booking time (from test-pricing.json)
    const bookingStartDate = new Date('2026-01-16T20:00:00.000Z'); // 3pm EST
    const bookingEndDate = new Date('2026-01-16T23:00:00.000Z');   // 6pm EST

    console.log('Booking Window:');
    console.log(`  Start: ${bookingStartDate.toISOString()}`);
    console.log(`  End:   ${bookingEndDate.toISOString()}\n`);

    // Find all events first
    const allEvents = await db.collection('events').find({}).toArray();
    console.log(`Total Events in DB: ${allEvents.length}`);
    allEvents.forEach(e => {
      console.log(`  - ${e.name}:`);
      console.log(`    startDate: ${e.startDate} (type: ${typeof e.startDate})`);
      console.log(`    endDate: ${e.endDate} (type: ${typeof e.endDate})`);
      console.log(`    isActive: ${e.isActive}\n`);
    });

    // Find overlapping events using the query from the API
    console.log('Testing Overlap Query:');
    console.log('Query:', JSON.stringify({
      isActive: true,
      endDate: { $gte: bookingStartDate },
      startDate: { $lte: bookingEndDate }
    }, null, 2));

    const overlappingEvents = await db.collection('events').find({
      isActive: true,
      endDate: { $gte: bookingStartDate },
      startDate: { $lte: bookingEndDate }
    }).toArray();

    console.log(`\nOverlapping Events Found: ${overlappingEvents.length}`);
    if (overlappingEvents.length > 0) {
      overlappingEvents.forEach(e => {
        console.log(`\n  ✅ ${e.name}:`);
        console.log(`     Event Start: ${e.startDate}`);
        console.log(`     Event End:   ${e.endDate}`);
        console.log(`     Booking overlaps because:`);
        console.log(`       - Event ends (${e.endDate}) >= Booking starts (${bookingStartDate.toISOString()})`);
        console.log(`       - Event starts (${e.startDate}) <= Booking ends (${bookingEndDate.toISOString()})`);
      });

      // Fetch ratesheets for these events
      const eventIds = overlappingEvents.map(e => e._id);
      const eventRatesheets = await db.collection('ratesheets').find({
        eventId: { $in: eventIds },
        isActive: true
      }).toArray();

      console.log(`\n  Event Ratesheets Found: ${eventRatesheets.length}`);
      eventRatesheets.forEach(rs => {
        console.log(`    - ${rs.name}: Priority ${rs.priority}, $${rs.hourlyRate}/hr`);
      });
    } else {
      console.log('\n  ❌ No overlapping events found!');
      console.log('  This means the query is not working correctly.');
    }

  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

testEventDetection();
