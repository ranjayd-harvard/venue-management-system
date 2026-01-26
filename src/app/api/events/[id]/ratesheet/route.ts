import { NextResponse } from 'next/server';
import { EventRepository } from '@/models/Event';
import { findEventRatesheet } from '@/lib/event-ratesheet-utils';

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

    const ratesheet = await findEventRatesheet(event.name, event._id!);

    if (!ratesheet) {
      return NextResponse.json(
        { error: 'Auto-ratesheet not found for this event' },
        { status: 404 }
      );
    }

    return NextResponse.json(ratesheet);
  } catch (error) {
    console.error('Error fetching event ratesheet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event ratesheet' },
      { status: 500 }
    );
  }
}
