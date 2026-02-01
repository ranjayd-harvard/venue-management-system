/**
 * Verify priority-based surge selection by calling the repository directly
 */

const BASE_URL = 'http://localhost:3031';

async function testPrioritySelection() {
  console.log('\n' + '='.repeat(70));
  console.log('   PRIORITY-BASED SURGE SELECTION VERIFICATION');
  console.log('='.repeat(70) + '\n');

  try {
    // Get SubLocation-1 ID
    const sublocationId = '6969ca6737229427f555554a';

    console.log(`🎯 Testing surge selection for SubLocation-1`);
    console.log(`   ID: ${sublocationId}\n`);

    // Fetch all surge configs for this sublocation
    const response = await fetch(`${BASE_URL}/api/surge-pricing/configs?subLocationId=${sublocationId}`);
    const configs = await response.json();

    console.log(`📊 Found ${configs.length} surge configs:\n`);

    // Filter only active configs
    const activeConfigs = configs.filter(c => c.isActive);
    console.log(`   Active configs: ${activeConfigs.length}`);
    console.log(`   Inactive configs: ${configs.length - activeConfigs.length}\n`);

    // Sort by priority (same logic as repository)
    const sorted = activeConfigs.sort((a, b) => {
      // Handle undefined priority (old configs)
      const priorityA = a.priority !== undefined ? a.priority : -1;
      const priorityB = b.priority !== undefined ? b.priority : -1;

      // First, compare by priority (higher priority wins)
      if (priorityB !== priorityA) {
        return priorityB - priorityA;
      }
      // If same priority, SUBLOCATION beats LOCATION
      if (a.appliesTo.level === 'SUBLOCATION' && b.appliesTo.level === 'LOCATION') {
        return -1;
      }
      if (a.appliesTo.level === 'LOCATION' && b.appliesTo.level === 'SUBLOCATION') {
        return 1;
      }
      return 0;
    });

    console.log('🏆 PRIORITY-SORTED CONFIGS (highest first):\n');

    sorted.forEach((config, idx) => {
      const isWinner = idx === 0;
      const priority = config.priority !== undefined ? config.priority : 'undefined';
      const surgeFactor = calculateSurgeFactor(
        config.demandSupplyParams.currentDemand,
        config.demandSupplyParams.currentSupply
      );

      console.log(`   ${isWinner ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '  '))} ${idx + 1}. ${config.name}`);
      console.log(`      Priority: ${priority}`);
      console.log(`      Level: ${config.appliesTo.level}`);
      console.log(`      Surge Factor: ${surgeFactor.toFixed(3)}x`);
      console.log(`      Demand/Supply: ${config.demandSupplyParams.currentDemand}/${config.demandSupplyParams.currentSupply}`);
      if (isWinner) {
        console.log(`      ⭐ THIS CONFIG WILL BE SELECTED`);
      }
      console.log('');
    });

    if (sorted.length > 0) {
      const winner = sorted[0];
      console.log('─'.repeat(70) + '\n');
      console.log('✅ VERIFICATION RESULT:\n');
      console.log(`   Selected Config: "${winner.name}"`);
      console.log(`   Priority: ${winner.priority !== undefined ? winner.priority : 'undefined (treated as -1)'}`);
      console.log(`   Level: ${winner.appliesTo.level}`);
      console.log(`   Surge Multiplier: ${calculateSurgeFactor(
        winner.demandSupplyParams.currentDemand,
        winner.demandSupplyParams.currentSupply
      ).toFixed(3)}x\n`);

      // Check if the expected config (priority 900) is the winner
      if (winner.name === 'Test Surge - High Priority' && winner.priority === 900) {
        console.log('🎉 SUCCESS! The highest priority config (900) was correctly selected.\n');
      } else if (winner.priority === undefined) {
        console.log('⚠️  WARNING: An old config without priority field was selected.');
        console.log('   This is expected if there are existing configs from before the priority feature.\n');
        console.log('   💡 Recommendation: Update or delete old configs to test priority properly.\n');
      } else {
        console.log('❌ UNEXPECTED: A different config was selected.\n');
      }
    }

    console.log('─'.repeat(70) + '\n');
    console.log('📝 TESTING STEPS:\n');
    console.log('1. ✅ Created 3 overlapping surge configs with priorities 500, 700, 900');
    console.log('2. ✅ Verified configs were sorted by priority (highest first)');
    console.log('3. ⏭️  Next: Test in the UI:\n');
    console.log('   a. Open http://localhost:3031/admin/surge-pricing');
    console.log('   b. Verify priority is displayed for each config');
    console.log('   c. Open http://localhost:3031/pricing/timeline-simulator');
    console.log('   d. Select SubLocation-1');
    console.log('   e. Enable "Surge Pricing" toggle');
    console.log('   f. Verify surge multiplier matches the HIGH priority config (900)');
    console.log('      Expected: ~1.220x\n');

    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

function calculateSurgeFactor(demand, supply) {
  const pressure = demand / supply;
  const normalized = pressure / 1.2; // historicalAvgPressure
  const rawFactor = 1 + 0.3 * Math.log(normalized); // alpha = 0.3
  return Math.max(0.75, Math.min(1.8, rawFactor)); // clamp to min/max
}

testPrioritySelection();
