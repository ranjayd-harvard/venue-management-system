import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PhysicalStatus, CommercialStatus } from '@/models/types';
import {
  validateCommercialTransition,
  validatePhysicalTransition,
} from '@/lib/ticket-state-types';
import type {
  TicketTransitionMessage,
  CommercialEvent,
  PhysicalEvent,
} from '@/lib/ticket-state-types';

const execAsync = promisify(exec);

/**
 * POST /api/kafka/aggregate-inventory
 * Read ticket state transitions from sublocation.tickets Kafka topic
 * and upsert into the ticket_states MongoDB collection.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subLocationId } = body;

    if (!subLocationId) {
      return NextResponse.json(
        { error: 'subLocationId is required' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Read messages from Kafka topic
    console.log(`📦 Reading ticket transitions from Kafka for ${subLocationId}...`);

    const command = `docker exec venue-kafka kafka-console-consumer \
      --bootstrap-server kafka:29092 \
      --topic sublocation.tickets \
      --partition 0 \
      --offset earliest \
      --max-messages 1000 \
      --timeout-ms 5000 2>&1`;

    let stdout = '';
    try {
      const result = await execAsync(command, {
        maxBuffer: 1024 * 1024 * 10,
        timeout: 15000,
      });
      stdout = result.stdout;
    } catch (error: any) {
      if (error.killed && error.stdout) {
        stdout = error.stdout;
      } else {
        throw error;
      }
    }

    // Parse Kafka messages
    const lines = stdout
      .trim()
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return (
          trimmed.length > 0 &&
          trimmed.startsWith('{') &&
          !line.includes('Processed a total of')
        );
      });

    const kafkaMessages: TicketTransitionMessage[] = [];
    for (const line of lines) {
      try {
        const msg = JSON.parse(line) as TicketTransitionMessage;
        if (msg.subLocationId === subLocationId && msg.domain && msg.ticketId) {
          kafkaMessages.push(msg);
        }
      } catch {
        // Skip unparseable lines
      }
    }

    console.log(`📦 Found ${kafkaMessages.length} ticket transitions for sublocation`);

    if (kafkaMessages.length === 0) {
      return NextResponse.json(
        {
          error: 'No ticket transitions found for this sublocation',
          details: 'Generate ticket events first using the ticket state machine generators',
        },
        { status: 404 }
      );
    }

    // Process each transition
    let created = 0;
    let updated = 0;
    const rejected: Array<{ ticketId: string; event: string; reason: string }> = [];

    for (const msg of kafkaMessages) {
      const existing = await db.collection('ticket_states').findOne({
        ticketId: msg.ticketId,
        subLocationId: msg.subLocationId,
      });

      if (msg.domain === 'COMMERCIAL') {
        const currentState = (existing?.commercialState || CommercialStatus.NONE) as CommercialStatus;

        // Validate transition
        if (currentState !== msg.previousState) {
          rejected.push({
            ticketId: msg.ticketId,
            event: msg.event,
            reason: `State mismatch: expected previousState=${msg.previousState}, actual=${currentState}`,
          });
          continue;
        }

        const isValid = validateCommercialTransition(
          currentState,
          msg.event as CommercialEvent,
          msg.newState as CommercialStatus
        );

        if (!isValid) {
          rejected.push({
            ticketId: msg.ticketId,
            event: msg.event,
            reason: `Invalid transition: ${currentState} + ${msg.event} → ${msg.newState}`,
          });
          continue;
        }

        // Upsert the ticket state
        const updateFields: Record<string, any> = {
          commercialState: msg.newState,
          lastCommercialEvent: msg.event,
          lastCommercialTransitionAt: new Date(msg.timestamp),
          updatedAt: new Date(),
        };

        if (msg.metadata?.reservationStartTime) {
          updateFields.reservationStartTime = new Date(msg.metadata.reservationStartTime);
        }
        if (msg.metadata?.reservationEndTime) {
          updateFields.reservationEndTime = new Date(msg.metadata.reservationEndTime);
        }

        const result = await db.collection('ticket_states').updateOne(
          { ticketId: msg.ticketId, subLocationId: msg.subLocationId },
          {
            $set: updateFields,
            $setOnInsert: {
              physicalState: PhysicalStatus.FREE,
              isSynthetic: msg.producedBy.includes('synthetic'),
              createdAt: new Date(),
            },
          },
          { upsert: true }
        );

        if (result.upsertedCount > 0) created++;
        else updated++;
      } else if (msg.domain === 'PHYSICAL') {
        const currentState = (existing?.physicalState || PhysicalStatus.FREE) as PhysicalStatus;

        // Validate transition
        if (currentState !== msg.previousState) {
          rejected.push({
            ticketId: msg.ticketId,
            event: msg.event,
            reason: `State mismatch: expected previousState=${msg.previousState}, actual=${currentState}`,
          });
          continue;
        }

        const isValid = validatePhysicalTransition(
          currentState,
          msg.event as PhysicalEvent,
          msg.newState as PhysicalStatus
        );

        if (!isValid) {
          rejected.push({
            ticketId: msg.ticketId,
            event: msg.event,
            reason: `Invalid transition: ${currentState} + ${msg.event} → ${msg.newState}`,
          });
          continue;
        }

        const result = await db.collection('ticket_states').updateOne(
          { ticketId: msg.ticketId, subLocationId: msg.subLocationId },
          {
            $set: {
              physicalState: msg.newState,
              lastPhysicalEvent: msg.event,
              lastPhysicalTransitionAt: new Date(msg.timestamp),
              updatedAt: new Date(),
            },
            $setOnInsert: {
              commercialState: CommercialStatus.NONE,
              isSynthetic: msg.producedBy.includes('synthetic'),
              createdAt: new Date(),
            },
          },
          { upsert: true }
        );

        if (result.upsertedCount > 0) created++;
        else updated++;
      } else {
        rejected.push({
          ticketId: msg.ticketId,
          event: msg.event,
          reason: `Unknown domain: ${msg.domain}`,
        });
      }
    }

    // Build ticket summary from current state of all tickets
    const allTickets = await db
      .collection('ticket_states')
      .find({ subLocationId })
      .toArray();

    const physicalSummary: Record<string, number> = {};
    const commercialSummary: Record<string, number> = {};
    for (const t of allTickets) {
      physicalSummary[t.physicalState] = (physicalSummary[t.physicalState] || 0) + 1;
      commercialSummary[t.commercialState] = (commercialSummary[t.commercialState] || 0) + 1;
    }

    console.log(`✅ Aggregated: ${created} created, ${updated} updated, ${rejected.length} rejected`);

    return NextResponse.json({
      success: true,
      message: 'Ticket states aggregated',
      processed: kafkaMessages.length,
      created,
      updated,
      rejected: rejected.length,
      rejectedDetails: rejected.slice(0, 20), // cap to avoid huge responses
      ticketCount: allTickets.length,
      physicalSummary,
      commercialSummary,
      subLocationId,
    });
  } catch (error) {
    console.error('Error aggregating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to aggregate inventory', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/kafka/aggregate-inventory?subLocationId=<id>
 * Clean up synthetic ticket states for a sublocation
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subLocationId = searchParams.get('subLocationId');

    if (!subLocationId) {
      return NextResponse.json(
        { error: 'subLocationId is required' },
        { status: 400 }
      );
    }

    const db = await getDb();

    const result = await db.collection('ticket_states').deleteMany({
      subLocationId,
      isSynthetic: true,
    });

    console.log(`🗑️ Cleaned ${result.deletedCount} synthetic ticket states for ${subLocationId}`);

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
      subLocationId,
    });
  } catch (error) {
    console.error('Error cleaning synthetic ticket states:', error);
    return NextResponse.json(
      { error: 'Failed to clean synthetic ticket states', details: String(error) },
      { status: 500 }
    );
  }
}
