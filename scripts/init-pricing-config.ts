// scripts/init-pricing-config.ts
// Initialize pricing configuration in MongoDB

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/venue-management';

async function initPricingConfig() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('🔧 Initializing Pricing Configuration...\n');
    
    // Check if config already exists
    const existing = await db.collection('pricing_configs').findOne({});
    
    if (existing) {
      console.log('✅ Pricing config already exists:');
      console.log(JSON.stringify(existing, null, 2));
      return;
    }
    
    // Create default pricing config
    const config = {
      customerPriorityRange: { min: 1000, max: 1999 },
      locationPriorityRange: { min: 2000, max: 2999 },
      sublocationPriorityRange: { min: 3000, max: 3999 },
      defaultTimezone: 'America/Detroit',
      defaultHourlyRate: 50, // Fallback if no hierarchy defaults
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('pricing_configs').insertOne(config);
    
    console.log('✅ Created pricing config:');
    console.log(JSON.stringify(config, null, 2));
    console.log(`\nInserted ID: ${result.insertedId}`);
    
    // Also create priority configs for the admin UI
    console.log('\n🎨 Creating priority configs for admin UI...');
    
    const priorityConfigs = [
      {
        level: 'CUSTOMER',
        minPriority: 1000,
        maxPriority: 1999,
        color: '#3B82F6', // Blue
        description: 'Customer-level ratesheets have lowest priority and apply across all locations',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        level: 'LOCATION',
        minPriority: 2000,
        maxPriority: 2999,
        color: '#10B981', // Green
        description: 'Location-level ratesheets override customer rates for specific locations',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        level: 'SUBLOCATION',
        minPriority: 3000,
        maxPriority: 3999,
        color: '#F59E0B', // Orange
        description: 'SubLocation-level ratesheets have highest priority for specific spaces',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        level: 'EVENT',
        minPriority: 4000,
        maxPriority: 4999,
        color: '#EC4899', // Pink
        description: 'Event-level ratesheets have highest priority and override all other rates for specific events',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Check if priority configs exist
    const existingPriorityConfigs = await db.collection('priority_configs').countDocuments();
    
    if (existingPriorityConfigs === 0) {
      await db.collection('priority_configs').insertMany(priorityConfigs);
      console.log('✅ Created 4 priority configs');
    } else {
      console.log('ℹ️  Priority configs already exist');
    }
    
    console.log('\n✅ Pricing configuration initialized successfully!');
    console.log('\nYou can now:');
    console.log('1. Create ratesheets with priorities in the configured ranges');
    console.log('2. Run pricing calculations');
    console.log('3. Manage priority configs via /api/pricing/config');
    
  } catch (error) {
    console.error('❌ Error initializing pricing config:', error);
    throw error;
  } finally {
    await client.close();
  }
}

initPricingConfig().catch(console.error);
