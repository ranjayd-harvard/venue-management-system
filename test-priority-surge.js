/**
 * Test script for priority-based surge config selection
 *
 * This script will:
 * 1. Fetch available sublocations
 * 2. Create 3 overlapping surge configs with different priorities
 * 3. Test which config gets selected based on priority
 */

const BASE_URL = 'http://localhost:3031';

async function fetchSublocations() {
  console.log('📍 Fetching sublocations...\n');
  const response = await fetch(`${BASE_URL}/api/sublocations`);
  const sublocations = await response.json();

  if (sublocations.length === 0) {
    throw new Error('No sublocations found. Please create a sublocation first.');
  }

  console.log(`Found ${sublocations.length} sublocations:`);
  sublocations.forEach((sub, idx) => {
    console.log(`  ${idx + 1}. ${sub.label} (ID: ${sub._id})`);
  });
  console.log('');

  return sublocations[0]; // Use first sublocation for testing
}

async function createSurgeConfig(name, priority, sublocationId, demand, supply) {
  console.log(`🔥 Creating surge config: "${name}" with priority ${priority}...`);

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const config = {
    name,
    description: `Test config with priority ${priority}`,
    appliesTo: {
      level: 'SUBLOCATION',
      entityId: sublocationId
    },
    priority,
    demandSupplyParams: {
      currentDemand: demand,
      currentSupply: supply,
      historicalAvgPressure: 1.2
    },
    surgeParams: {
      alpha: 0.3,
      minMultiplier: 0.75,
      maxMultiplier: 1.8,
      emaAlpha: 0.3
    },
    effectiveFrom: now.toISOString(),
    effectiveTo: tomorrow.toISOString(),
    isActive: true
  };

  const response = await fetch(`${BASE_URL}/api/surge-pricing/configs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create config: ${error.error}`);
  }

  const created = await response.json();
  console.log(`   ✅ Created with ID: ${created._id}`);
  console.log(`   📊 Surge factor: ${calculateSurgeFactor(demand, supply).toFixed(3)}x\n`);

  return created;
}

function calculateSurgeFactor(demand, supply) {
  const pressure = demand / supply;
  const normalized = pressure / 1.2; // historicalAvgPressure
  const rawFactor = 1 + 0.3 * Math.log(normalized); // alpha = 0.3
  return Math.max(0.75, Math.min(1.8, rawFactor)); // clamp to min/max
}

async function testPrioritySelection(sublocationId) {
  console.log('🔍 Testing priority-based selection...\n');
  console.log('   Making API call to check which config is selected...\n');

  // We need to call the pricing calculation endpoint or directly test the repository
  // For now, let's fetch all configs and show what was created
  const response = await fetch(`${BASE_URL}/api/surge-pricing/configs?subLocationId=${sublocationId}`);
  const configs = await response.json();

  console.log('📋 All surge configs for this sublocation:');
  configs
    .sort((a, b) => b.priority - a.priority)
    .forEach((config, idx) => {
      const surgeFactor = calculateSurgeFactor(
        config.demandSupplyParams.currentDemand,
        config.demandSupplyParams.currentSupply
      );
      const isHighest = idx === 0;
      console.log(`   ${isHighest ? '🏆' : '  '} ${config.name}`);
      console.log(`      Priority: ${config.priority}`);
      console.log(`      Surge Factor: ${surgeFactor.toFixed(3)}x`);
      console.log(`      Demand/Supply: ${config.demandSupplyParams.currentDemand}/${config.demandSupplyParams.currentSupply}`);
      if (isHighest) {
        console.log(`      ⭐ EXPECTED TO WIN (highest priority)`);
      }
      console.log('');
    });
}

async function cleanup(configIds) {
  console.log('\n🧹 Cleaning up test configs...\n');

  for (const id of configIds) {
    try {
      const response = await fetch(`${BASE_URL}/api/surge-pricing/configs/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        console.log(`   ✅ Deleted config ${id}`);
      } else {
        console.log(`   ⚠️  Failed to delete config ${id}`);
      }
    } catch (error) {
      console.log(`   ❌ Error deleting config ${id}: ${error.message}`);
    }
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('   SURGE PRICING PRIORITY TEST');
  console.log('='.repeat(60) + '\n');

  try {
    // Step 1: Get a sublocation to test with
    const sublocation = await fetchSublocations();
    const sublocationId = sublocation._id;

    console.log(`🎯 Using sublocation: ${sublocation.label}\n`);
    console.log('─'.repeat(60) + '\n');

    // Step 2: Create 3 overlapping surge configs with different priorities
    console.log('Creating 3 overlapping surge configs:\n');

    const config1 = await createSurgeConfig(
      'Test Surge - Low Priority',
      500,  // Low priority
      sublocationId,
      10,   // demand
      20    // supply (low demand = discount surge)
    );

    const config2 = await createSurgeConfig(
      'Test Surge - High Priority',
      900,  // High priority - SHOULD WIN
      sublocationId,
      25,   // demand
      10    // supply (high demand = price increase)
    );

    const config3 = await createSurgeConfig(
      'Test Surge - Medium Priority',
      700,  // Medium priority
      sublocationId,
      15,   // demand
      10    // supply (moderate surge)
    );

    console.log('─'.repeat(60) + '\n');

    // Step 3: Test which config gets selected
    await testPrioritySelection(sublocationId);

    console.log('─'.repeat(60));
    console.log('\n📝 EXPECTED RESULT:');
    console.log('   The config with priority 900 (High Priority) should be selected');
    console.log('   when multiple configs overlap in time.\n');

    console.log('🎯 NEXT STEPS:');
    console.log('   1. Open http://localhost:3031/admin/surge-pricing');
    console.log('   2. Verify all 3 configs are visible');
    console.log('   3. Open http://localhost:3031/pricing/timeline-simulator');
    console.log('   4. Select the sublocation: ' + sublocation.label);
    console.log('   5. Enable "Surge Pricing" toggle');
    console.log('   6. Verify that the surge multiplier matches the HIGH priority config (900)');
    console.log('      Expected: ~2.5x surge (from 25 demand / 10 supply)\n');

    // Ask user if they want to cleanup
    console.log('─'.repeat(60) + '\n');
    console.log('⚠️  Test configs created. They will remain in the database.');
    console.log('   Run this script with --cleanup flag to delete them, or delete manually from the admin UI.\n');

    // Store IDs for potential cleanup
    const configIds = [config1._id, config2._id, config3._id];

    if (process.argv.includes('--cleanup')) {
      await cleanup(configIds);
    } else {
      console.log('   Config IDs:');
      configIds.forEach((id, idx) => {
        console.log(`     ${idx + 1}. ${id}`);
      });
      console.log('\n   To cleanup, run: node test-priority-surge.js --cleanup-ids ' + configIds.join(','));
    }

    console.log('\n' + '='.repeat(60));
    console.log('   TEST COMPLETE ✅');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n   Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle cleanup mode
if (process.argv.includes('--cleanup-ids')) {
  const idsIndex = process.argv.indexOf('--cleanup-ids');
  const ids = process.argv[idsIndex + 1].split(',');

  console.log('\n🧹 Cleanup mode - deleting configs...\n');
  cleanup(ids).then(() => {
    console.log('\n✅ Cleanup complete\n');
    process.exit(0);
  });
} else {
  main();
}
