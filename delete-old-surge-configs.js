const BASE_URL = 'http://localhost:3031';

const oldConfigIds = [
  '697edc5990b0dbba01cf3591',  // Test Surge - Low Priority (no priority field)
  '697edc5990b0dbba01cf3592',  // Test Surge - High Priority (no priority field)
  '697edc5990b0dbba01cf3593'   // Test Surge - Medium Priority (no priority field)
];

async function deleteOldConfigs() {
  console.log('\n🧹 Deleting old test configs without priority field...\n');

  for (const id of oldConfigIds) {
    try {
      const response = await fetch(`${BASE_URL}/api/surge-pricing/configs/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        console.log(`   ✅ Deleted config ${id}`);
      } else {
        const error = await response.json();
        console.log(`   ⚠️  Failed to delete ${id}: ${error.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Error deleting ${id}: ${error.message}`);
    }
  }

  console.log('\n✅ Cleanup complete!\n');
  console.log('Now refresh the timeline simulator to see priority working correctly.\n');
}

deleteOldConfigs();
