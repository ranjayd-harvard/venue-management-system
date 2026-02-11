// Script to create test ratesheets for demonstrating empty layer visibility in Simulation mode
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27018/venue_management?authSource=admin';

async function createTestRatesheets() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const ratesheets = db.collection('ratesheets');
    const sublocations = db.collection('sublocations');

    // Get the first sublocation
    const sublocation = await sublocations.findOne({});
    if (!sublocation) {
      console.error('No sublocation found. Please create a sublocation first.');
      return;
    }

    console.log('Found sublocation:', sublocation.label);

    // Test Ratesheet 1: Early Morning Special (12 AM - 6 AM)
    // This will be OUTSIDE the typical 6 AM - 10 PM view window
    const earlyMorningRatesheet = {
      name: 'Early Morning Special',
      type: 'TIME_WINDOW',
      applyTo: 'SUBLOCATION',
      subLocationId: sublocation._id,  // ObjectId, not string!
      sublocation: {
        _id: sublocation._id,
        label: sublocation.label
      },
      priority: 350,
      effectiveFrom: new Date('2026-02-01T00:00:00.000Z'),
      effectiveTo: new Date('2026-02-10T23:59:59.999Z'),
      timeWindows: [
        {
          windowType: 'ABSOLUTE_TIME',
          startTime: '00:00',
          endTime: '06:00',
          pricePerHour: 15
        }
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Test Ratesheet 2: Late Night Premium (10 PM - 2 AM)
    // This will be partially outside the typical view window
    const lateNightRatesheet = {
      name: 'Late Night Premium',
      type: 'TIME_WINDOW',
      applyTo: 'SUBLOCATION',
      subLocationId: sublocation._id,  // ObjectId, not string!
      sublocation: {
        _id: sublocation._id,
        label: sublocation.label
      },
      priority: 360,
      effectiveFrom: new Date('2026-02-01T00:00:00.000Z'),
      effectiveTo: new Date('2026-02-10T23:59:59.999Z'),
      timeWindows: [
        {
          windowType: 'ABSOLUTE_TIME',
          startTime: '22:00',
          endTime: '02:00',
          pricePerHour: 35
        }
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Test Ratesheet 3: Future Date Ratesheet (Feb 5-7)
    // This will be in the range but possibly outside the current view depending on selected date
    const futureDateRatesheet = {
      name: 'Weekend Premium',
      type: 'TIME_WINDOW',
      applyTo: 'SUBLOCATION',
      subLocationId: sublocation._id,  // ObjectId, not string!
      sublocation: {
        _id: sublocation._id,
        label: sublocation.label
      },
      priority: 370,
      effectiveFrom: new Date('2026-02-05T00:00:00.000Z'),
      effectiveTo: new Date('2026-02-07T23:59:59.999Z'),
      timeWindows: [
        {
          windowType: 'ABSOLUTE_TIME',
          startTime: '09:00',
          endTime: '18:00',
          pricePerHour: 45
        }
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert the test ratesheets
    const result = await ratesheets.insertMany([
      earlyMorningRatesheet,
      lateNightRatesheet,
      futureDateRatesheet
    ]);

    console.log('\n✅ Created 3 test ratesheets:');
    console.log('1. Early Morning Special (12 AM - 6 AM) - Outside typical view');
    console.log('2. Late Night Premium (10 PM - 2 AM) - Partially outside view');
    console.log('3. Weekend Premium (Feb 5-7, 9 AM - 6 PM) - Future date range');
    console.log('\nInserted IDs:', Object.values(result.insertedIds));
    console.log('\n📝 Instructions:');
    console.log('1. Go to the Timeline Simulator');
    console.log('2. Select SubLocation-1');
    console.log('3. Set booking time to Feb 2, 6:00 AM - 6:00 PM (12 hours)');
    console.log('4. Switch to "Simulation" mode');
    console.log('5. Expand the waterfall');
    console.log('6. You should see "Early Morning Special" with NO active tiles (grayed out)');
    console.log('7. You can toggle it ON to see its pricing impact if you change the view window');

  } catch (error) {
    console.error('Error creating test ratesheets:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

createTestRatesheets();
