import { NextResponse } from 'next/server';
import { EventRepository } from '@/models/Event';
import { generateEventRatesheet } from '@/lib/event-ratesheet-utils';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const locationId = searchParams.get('locationId');
    const subLocationId = searchParams.get('subLocationId');
    const venueId = searchParams.get('venueId');
    const filter = searchParams.get('filter'); // 'active', 'upcoming', or 'all'
    const simple = searchParams.get('simple'); // 'true' for simple mode without aggregation

    let events;

    // Use aggregation methods to populate related data (customer, location, sublocation, venue)
    if (customerId) {
      events = await EventRepository.findByCustomer(customerId);
    } else if (locationId) {
      events = await EventRepository.findByLocation(locationId);
    } else if (subLocationId) {
      events = await EventRepository.findBySubLocation(subLocationId);
    } else if (venueId) {
      events = await EventRepository.findByVenue(venueId);
    } else if (filter === 'active') {
      events = await EventRepository.findActiveEventsWithDetails();
    } else if (filter === 'upcoming') {
      events = await EventRepository.findUpcomingEventsWithDetails();
    } else if (simple === 'true') {
      // Simple mode - no aggregation
      events = await EventRepository.findAll();
    } else {
      // For findAll, use aggregation to populate related data
      events = await EventRepository.findAllWithDetails();
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

    // Generate auto-ratesheet for the event
    try {
      await generateEventRatesheet(event);
    } catch (error) {
      console.error('Error generating auto-ratesheet:', error);
      // Don't fail the event creation if ratesheet generation fails
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
