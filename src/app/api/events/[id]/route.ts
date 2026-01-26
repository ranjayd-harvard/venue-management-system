import { NextResponse } from 'next/server';
import { EventRepository } from '@/models/Event';
import { generateEventRatesheet } from '@/lib/event-ratesheet-utils';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const event = await EventRepository.findById(params.id);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Validate dates if provided
    if (body.startDate && body.endDate) {
      const startDate = new Date(body.startDate);
      const endDate = new Date(body.endDate);

      if (endDate < startDate) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 }
        );
      }
    }

    const event = await EventRepository.update(params.id, body);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Regenerate auto-ratesheet for the event
    try {
      await generateEventRatesheet(event);
    } catch (error) {
      console.error('Error regenerating auto-ratesheet:', error);
      // Don't fail the event update if ratesheet generation fails
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get event details before deleting
    const event = await EventRepository.findById(params.id);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Mark associated auto-ratesheet as deleted and inactive
    try {
      const { getDb } = await import('@/lib/mongodb');
      const db = await getDb();
      const ratesheetName = `Auto-${event.name}`;

      const ratesheet = await db.collection('ratesheets').findOne({
        name: ratesheetName,
        'appliesTo.level': 'EVENT',
        'appliesTo.entityId': event._id,
      });

      if (ratesheet) {
        await db.collection('ratesheets').updateOne(
          { _id: ratesheet._id },
          {
            $set: {
              name: `DELETED-${ratesheetName}`,
              isActive: false,
              updatedAt: new Date(),
              deletionReason: `Event "${event.name}" was deleted`,
            }
          }
        );
        console.log(`[deleteEvent] Marked ratesheet as DELETED for event: ${event.name}`);
      }
    } catch (error) {
      console.error('Error marking ratesheet as deleted:', error);
      // Don't fail the event deletion if ratesheet update fails
    }

    const deleted = await EventRepository.delete(params.id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}
