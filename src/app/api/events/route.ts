import { NextResponse } from 'next/server';
import { EventRepository } from '@/models/Event';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const locationId = searchParams.get('locationId');
    const subLocationId = searchParams.get('subLocationId');
    const filter = searchParams.get('filter'); // 'active', 'upcoming', or 'all'

    let events;

    if (customerId) {
      events = await EventRepository.findByCustomer(customerId);
    } else if (locationId) {
      events = await EventRepository.findByLocation(locationId);
    } else if (subLocationId) {
      events = await EventRepository.findBySubLocation(subLocationId);
    } else if (filter === 'active') {
      events = await EventRepository.findActiveEvents();
    } else if (filter === 'upcoming') {
      events = await EventRepository.findUpcomingEvents();
    } else {
      events = await EventRepository.findAll();
    }

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: name, startDate, endDate' },
        { status: 400 }
      );
    }

    // Validate dates
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);

    if (endDate < startDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    const event = await EventRepository.create({
      ...body,
      startDate,
      endDate,
      isActive: body.isActive !== undefined ? body.isActive : true,
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
