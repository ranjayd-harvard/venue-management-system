import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function POST() {
  try {
    const db = await getDb();

    // Find all events
    const events = await db.collection('events').find({}).toArray();

    let migrated = 0;
    let skipped = 0;

    for (const event of events) {
      // Check if dates are strings (need migration)
      const needsMigration =
        typeof event.startDate === 'string' ||
        typeof event.endDate === 'string';

      if (needsMigration) {
        await db.collection('events').updateOne(
          { _id: event._id },
          {
            $set: {
              startDate: new Date(event.startDate),
              endDate: new Date(event.endDate),
              updatedAt: new Date()
            }
          }
        );
        migrated++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migration complete. Migrated ${migrated} events, skipped ${skipped} events.`,
      migrated,
      skipped
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error.message || 'Migration failed' },
      { status: 500 }
    );
  }
}
