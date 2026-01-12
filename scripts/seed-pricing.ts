import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ObjectId } from 'mongodb';
import { getDb } from '../src/lib/mongodb.js';
import { SubLocationRepository } from '../src/models/SubLocation.js';
import { LocationRepository } from '../src/models/Location.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });

// Verify MongoDB URI is loaded
if (!process.env.MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI not found in .env.local');
  console.error('Current directory:', process.cwd());
  console.error('Looking for .env.local at:', resolve(__dirname, '..', '.env.local'));
  process.exit(1);
}

async function seedPricingSystem() {
  console.log('🌱 Seeding Pricing System...\n');

  try {
    const db = await getDb();

    // Get existing locations
    const locations = await db.collection('locations').find({}).toArray();
    if (locations.length === 0) {
      console.log('⚠️  No locations found. Please run the main seed script first.');
      console.log('   Run: npm run seed:dynamic');
      process.exit(1);
    }

    const location = locations[0];
    console.log(`✅ Using location: ${location.name}\n`);

    // Create 3 sample sublocations with pricing enabled
    console.log('📍 Creating Sub-Locations...');
    const sublocationIds: ObjectId[] = [];

    const sublocations = [
      {
        locationId: location._id,
        label: 'Grand Ballroom East',
        description: 'Large ballroom for corporate events',
        allocatedCapacity: 500,
        pricingEnabled: true,
        isActive: true,
        defaultHourlyRate: 100,
        attributes: [
          { key: 'floor', value: '2' },
          { key: 'hasStage', value: 'true' }
        ]
      },
      {
        locationId: location._id,
        label: 'Conference Room A',
        description: 'Executive meeting space',
        allocatedCapacity: 50,
        pricingEnabled: true,
        isActive: true,
        defaultHourlyRate: 75,
        attributes: [
          { key: 'floor', value: '3' },
          { key: 'hasAV', value: 'true' }
        ]
      },
      {
        locationId: location._id,
        label: 'Rooftop Terrace',
        description: 'Outdoor event space with city views',
        allocatedCapacity: 200,
        pricingEnabled: true,
        isActive: true,
        defaultHourlyRate: 150,
        attributes: [
          { key: 'outdoor', value: 'true' },
          { key: 'hasHeating', value: 'true' }
        ]
      }
    ];

    for (const subloc of sublocations) {
      const result = await db.collection('sublocations').insertOne({
        ...subloc,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      sublocationIds.push(result.insertedId);
      console.log(`  ✓ ${subloc.label} (ID: ${result.insertedId.toString().slice(-6)}...)`);
    }

    // Create sample ratesheets
    console.log('\n💰 Creating Ratesheets...\n');

    // Ratesheet 1: Base pricing (TIMING_BASED, Priority 1)
    const baseRatesheet = {
      name: 'Base Standard Pricing',
      description: 'Standard hourly rates for regular business hours',
      type: 'TIMING_BASED',
      priority: 1,
      conflictResolution: 'PRIORITY',
      appliesTo: {
        level: 'SUBLOCATION',
        entityId: sublocationIds[0]
      },
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: null,
      timeWindows: [
        { startTime: '09:00', endTime: '17:00', pricePerHour: 100 },
        { startTime: '17:00', endTime: '22:00', pricePerHour: 120 },
        { startTime: '22:00', endTime: '23:59', pricePerHour: 150 }
      ],
      isActive: true,
      approvalStatus: 'APPROVED',
      approvedBy: 'admin@example.com',
      approvedAt: new Date(),
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const baseResult = await db.collection('ratesheets').insertOne(baseRatesheet);
    console.log(`✅ Created: ${baseRatesheet.name}`);
    console.log(`   Priority: ${baseRatesheet.priority} | Type: ${baseRatesheet.type}`);
    console.log(`   ID: ${baseResult.insertedId.toString()}\n`);

    // Ratesheet 2: Weekend premium (TIMING_BASED, Priority 3)
    const weekendRatesheet = {
      name: 'Weekend Premium',
      description: '+25% surcharge for weekend events',
      type: 'TIMING_BASED',
      priority: 3,
      conflictResolution: 'PRIORITY',
      appliesTo: {
        level: 'SUBLOCATION',
        entityId: sublocationIds[0]
      },
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: null,
      recurrence: {
        pattern: 'WEEKLY',
        daysOfWeek: ['SATURDAY', 'SUNDAY']
      },
      timeWindows: [
        { startTime: '00:00', endTime: '23:59', pricePerHour: 125 }
      ],
      isActive: true,
      approvalStatus: 'APPROVED',
      approvedBy: 'admin@example.com',
      approvedAt: new Date(),
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const weekendResult = await db.collection('ratesheets').insertOne(weekendRatesheet);
    console.log(`✅ Created: ${weekendRatesheet.name}`);
    console.log(`   Priority: ${weekendRatesheet.priority} | Recurrence: WEEKLY (Sat-Sun)`);
    console.log(`   ID: ${weekendResult.insertedId.toString()}\n`);

    // Ratesheet 3: Summer peak season (TIMING_BASED, Priority 5)
    const summerRatesheet = {
      name: 'Summer Peak Season',
      description: 'Premium pricing for June-August peak season',
      type: 'TIMING_BASED',
      priority: 5,
      conflictResolution: 'HIGHEST_PRICE',
      appliesTo: {
        level: 'SUBLOCATION',
        entityId: sublocationIds[0]
      },
      effectiveFrom: new Date('2025-06-01'),
      effectiveTo: new Date('2025-08-31'),
      timeWindows: [
        { startTime: '14:00', endTime: '18:00', pricePerHour: 200 },
        { startTime: '18:00', endTime: '23:00', pricePerHour: 250 }
      ],
      isActive: true,
      approvalStatus: 'APPROVED',
      approvedBy: 'admin@example.com',
      approvedAt: new Date(),
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const summerResult = await db.collection('ratesheets').insertOne(summerRatesheet);
    console.log(`✅ Created: ${summerRatesheet.name}`);
    console.log(`   Priority: ${summerRatesheet.priority} | Conflict: HIGHEST_PRICE`);
    console.log(`   Effective: Jun 1 - Aug 31, 2025`);
    console.log(`   ID: ${summerResult.insertedId.toString()}\n`);

    // Ratesheet 4: Duration-based package (DURATION_BASED, Priority 2)
    const packageRatesheet = {
      name: 'Half-Day Package',
      description: 'Special rates for 4-6 hour bookings',
      type: 'DURATION_BASED',
      priority: 2,
      conflictResolution: 'LOWEST_PRICE',
      appliesTo: {
        level: 'SUBLOCATION',
        entityId: sublocationIds[1]
      },
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: null,
      durationRules: [
        { 
          durationHours: 4, 
          totalPrice: 350,
          description: '4-hour meeting package'
        },
        { 
          durationHours: 6, 
          totalPrice: 500,
          description: '6-hour event package'
        }
      ],
      isActive: true,
      approvalStatus: 'APPROVED',
      approvedBy: 'admin@example.com',
      approvedAt: new Date(),
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const packageResult = await db.collection('ratesheets').insertOne(packageRatesheet);
    console.log(`✅ Created: ${packageRatesheet.name}`);
    console.log(`   Priority: ${packageRatesheet.priority} | Type: DURATION_BASED`);
    console.log(`   ID: ${packageResult.insertedId.toString()}\n`);

    // Ratesheet 5: Pending approval (for testing workflow)
    const pendingRatesheet = {
      name: 'Holiday Special Pricing',
      description: 'Special rates for December holidays',
      type: 'TIMING_BASED',
      priority: 4,
      conflictResolution: 'PRIORITY',
      appliesTo: {
        level: 'SUBLOCATION',
        entityId: sublocationIds[2]
      },
      effectiveFrom: new Date('2025-12-15'),
      effectiveTo: new Date('2025-12-31'),
      timeWindows: [
        { startTime: '00:00', endTime: '23:59', pricePerHour: 300 }
      ],
      isActive: false,
      approvalStatus: 'PENDING_APPROVAL',
      createdBy: 'manager@example.com',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const pendingResult = await db.collection('ratesheets').insertOne(pendingRatesheet);
    console.log(`✅ Created: ${pendingRatesheet.name} (⏳ Pending Approval)`);
    console.log(`   Priority: ${pendingRatesheet.priority}`);
    console.log(`   ID: ${pendingResult.insertedId.toString()}\n`);

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Seeding Summary:');
    console.log(`   ✓ ${sublocationIds.length} Sub-Locations created`);
    console.log(`   ✓ 5 Ratesheets created`);
    console.log(`     - 4 Approved & Active`);
    console.log(`     - 1 Pending Approval`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎉 Pricing System seeded successfully!\n');
    console.log('📍 Test Sub-Location ID (copy for testing):');
    console.log(`   ${sublocationIds[0].toString()}\n`);
    
    console.log('🌐 Access the application:');
    console.log('   Admin Page: http://localhost:3031/admin/pricing');
    console.log('   View Page:  http://localhost:3031/pricing/view\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedPricingSystem();
