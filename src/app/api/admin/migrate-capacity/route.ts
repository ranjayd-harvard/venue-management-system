import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST() {
  try {
    const db = await getDb();
    const sublocationsCollection = db.collection('sublocations');

    // Fetch all sublocations
    const allSublocations = await sublocationsCollection.find({}).toArray();

    console.log(`📊 Found ${allSublocations.length} sublocations to migrate`);

    let updated = 0;
    let skipped = 0;

    for (const subloc of allSublocations) {
      // Check if capacity fields are already set
      const hasCapacitySet =
        subloc.minCapacity !== undefined &&
        subloc.maxCapacity !== undefined &&
        subloc.defaultCapacity !== undefined;

      if (hasCapacitySet) {
        console.log(`⏭️  Skipping ${subloc.label} - already has capacity values`);
        skipped++;
        continue;
      }

      // Calculate default values based on allocatedCapacity
      const allocated = subloc.allocatedCapacity || 100;
      const maxCapacity = allocated + 50; // Max is allocated + 50
      const minCapacity = Math.floor(allocated * 0.5); // Min is 50% of allocated
      const defaultCapacity = allocated; // Default equals allocated

      // Update the sublocation
      await sublocationsCollection.updateOne(
        { _id: subloc._id },
        {
          $set: {
            minCapacity,
            maxCapacity,
            defaultCapacity,
            allocatedCapacity: allocated,
            isActive: subloc.isActive !== undefined ? subloc.isActive : true,
            pricingEnabled: subloc.pricingEnabled !== undefined ? subloc.pricingEnabled : true,
            updatedAt: new Date()
          }
        }
      );

      console.log(`✅ Updated ${subloc.label}: min=${minCapacity}, max=${maxCapacity}, default=${defaultCapacity}, allocated=${allocated}`);
      updated++;
    }

    return NextResponse.json({
      success: true,
      message: `Migration complete: ${updated} sublocations updated, ${skipped} skipped`,
      stats: {
        total: allSublocations.length,
        updated,
        skipped
      }
    });

  } catch (error: any) {
    console.error('❌ Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to migrate capacity data',
        details: error.message
      },
      { status: 500 }
    );
  }
}
