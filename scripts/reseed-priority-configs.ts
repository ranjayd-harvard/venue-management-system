// scripts/reseed-priority-configs.ts
// Reseed priority_configs collection with correct schema

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/venue-management';

async function reseedPriorityConfigs() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    console.log('🔄 Reseeding Priority Configs...\n');

    // Drop existing priority configs
    await db.collection('priority_configs').deleteMany({});
    console.log('✅ Deleted old priority_configs\n');

    // Insert new priority configs with correct schema
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
        description: 'Event-level ratesheets have highest priority and override all other rates for specific events (4900-4999: Auto-generated event ratesheets)',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await db.collection('priority_configs').insertMany(priorityConfigs);
    console.log('✅ Created 4 new priority configs with correct schema\n');

    // Show the new configs
    const configs = await db.collection('priority_configs').find({}).toArray();
    console.log('📋 New Priority Configs:');
    configs.forEach(config => {
      console.log(`\n${config.level}:`);
      console.log(`  Range: ${config.minPriority}-${config.maxPriority}`);
      console.log(`  Color: ${config.color}`);
      console.log(`  Description: ${config.description}`);
      console.log(`  Enabled: ${config.enabled}`);
    });

    console.log('\n✅ Priority configs reseeded successfully!');

  } catch (error) {
    console.error('❌ Error reseeding priority configs:', error);
    throw error;
  } finally {
    await client.close();
  }
}

reseedPriorityConfigs().catch(console.error);
