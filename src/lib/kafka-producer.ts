import { getProducer } from './kafka';
import { Event } from '@/models/types';

const TOPIC_BOOKING_EVENTS = process.env.KAFKA_TOPIC_BOOKING_EVENTS || 'venue.booking.events';

export interface EmitBookingEventOptions {
  action: 'CREATED' | 'UPDATED' | 'DELETED' | 'CAPACITY_CHANGED';
  event: Event;
  previousEvent?: Event;  // For UPDATED action
  correlationId?: string;
}

/**
 * Emit booking event to Kafka
 * Called from EventRepository methods
 *
 * Non-blocking: Failures are logged but don't fail the API request
 */
export async function emitBookingEvent(options: EmitBookingEventOptions): Promise<void> {
  const { action, event, previousEvent, correlationId } = options;

  if (!event.subLocationId) {
    console.warn('⚠️ Skipping Kafka emit: event has no subLocationId');
    return;
  }

  try {
    const producer = await getProducer();

    // Calculate capacity delta for UPDATED events
    let capacityDelta: number | undefined;
    let previousAttendees: number | undefined;
    if (action === 'UPDATED' && previousEvent) {
      const newAttendees = event.attendees || 0;
      const oldAttendees = previousEvent.attendees || 0;
      capacityDelta = newAttendees - oldAttendees;
      previousAttendees = oldAttendees;
    }

    const message = {
      eventId: event._id!.toString(),
      action,
      timestamp: new Date().toISOString(),
      customerId: event.customerId?.toString(),
      locationId: event.locationId?.toString(),
      subLocationId: event.subLocationId.toString(),
      venueId: event.venueId?.toString(),
      eventName: event.name,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      attendees: event.attendees,
      capacityDelta,
      previousAttendees,
      producedBy: 'api' as const,
      correlationId
    };

    await producer.send({
      topic: TOPIC_BOOKING_EVENTS,
      messages: [{
        key: event.subLocationId.toString(),  // Partition by sublocation
        value: JSON.stringify(message),
        timestamp: Date.now().toString()
      }]
    });

    console.log(`📤 Emitted booking.${action.toLowerCase()} event:`, {
      eventId: message.eventId,
      subLocationId: message.subLocationId,
      action
    });

  } catch (error) {
    // Non-blocking: log error but don't fail the API request
    console.error('❌ Failed to emit Kafka event:', error);
    // TODO: Consider dead-letter queue or retry mechanism
  }
}
