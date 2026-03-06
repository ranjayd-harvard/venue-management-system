/**
 * Generate synthetic COMMERCIAL ticket state transitions for testing capacity/inventory.
 *
 * Each ticket walks through the commercial state machine:
 *   NONE → RESERVED_UPCOMING → RESERVED_ACTIVE → (OVERSTAY | NO_SHOW | NONE)
 *
 * Usage:
 *   npx tsx scripts/generate-sublocation-events.ts --sublocation <id> --tickets 5 --scenario RESERVATION_FLOW --rate 1
 *   npx tsx scripts/generate-sublocation-events.ts --sublocation <id> --tickets 10 --scenario NO_SHOW_MIX --rate 2
 *
 * Scenarios:
 *   RESERVATION_FLOW  - NONE → RESERVED_UPCOMING → RESERVED_ACTIVE (2 msgs/ticket)
 *   FULL_LIFECYCLE    - Full cycle back to NONE (3 msgs/ticket)
 *   NO_SHOW_MIX       - 70% normal, 30% become NO_SHOW (2-5 msgs/ticket)
 *   OVERSTAY_MIX      - 70% normal, 20% overstay, 10% no-show (2-5 msgs/ticket)
 *   CANCELLATION      - 80% normal, 20% cancelled from RESERVED_ACTIVE (2-3 msgs/ticket)
 */

import { getProducer, disconnectKafka } from '../src/lib/kafka';
import { CommercialStatus } from '../src/models/types';
import type { CommercialEvent, TicketTransitionMessage } from '../src/lib/ticket-state-types';

const TOPIC = 'sublocation.tickets';

type Scenario = 'RESERVATION_FLOW' | 'FULL_LIFECYCLE' | 'NO_SHOW_MIX' | 'OVERSTAY_MIX' | 'CANCELLATION';

const SCENARIOS: Scenario[] = ['RESERVATION_FLOW', 'FULL_LIFECYCLE', 'NO_SHOW_MIX', 'OVERSTAY_MIX', 'CANCELLATION'];

interface Transition {
  ticketId: string;
  event: CommercialEvent;
  previousState: CommercialStatus;
  newState: CommercialStatus;
  metadata?: Record<string, string>;
}

function sleep(ms: number): Promise<void> {
  const duration = Math.max(0, Math.floor(ms));
  if (!isFinite(duration) || duration <= 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, duration));
}

function padTicketId(index: number): string {
  return `TKT-${String(index).padStart(3, '0')}`;
}

/**
 * Build the lifecycle transitions for one ticket based on scenario.
 */
function buildTicketLifecycle(ticketId: string, scenario: Scenario): Transition[] {
  const now = new Date();
  const reservationStart = new Date(now.getTime() + 30 * 60 * 1000); // 30 min from now
  const reservationEnd = new Date(now.getTime() + 150 * 60 * 1000);  // 2.5h from now
  const meta = {
    reservationStartTime: reservationStart.toISOString(),
    reservationEndTime: reservationEnd.toISOString(),
  };

  // Base flow: NONE → RESERVED_UPCOMING → RESERVED_ACTIVE
  const base: Transition[] = [
    {
      ticketId,
      event: 'RESERVATION_CREATED',
      previousState: CommercialStatus.NONE,
      newState: CommercialStatus.RESERVED_UPCOMING,
      metadata: meta,
    },
    {
      ticketId,
      event: 'RESERVATION_START_TIME_REACHED',
      previousState: CommercialStatus.RESERVED_UPCOMING,
      newState: CommercialStatus.RESERVED_ACTIVE,
    },
  ];

  switch (scenario) {
    case 'RESERVATION_FLOW':
      return base;

    case 'FULL_LIFECYCLE':
      return [
        ...base,
        {
          ticketId,
          event: 'RESERVATION_CANCELLED',
          previousState: CommercialStatus.RESERVED_ACTIVE,
          newState: CommercialStatus.NONE,
        },
      ];

    case 'NO_SHOW_MIX': {
      // 70% stay at RESERVED_ACTIVE, 30% become NO_SHOW → RELEASE → NONE
      if (Math.random() < 0.3) {
        return [
          ...base,
          {
            ticketId,
            event: 'RESERVATION_END_TIME_REACHED',
            previousState: CommercialStatus.RESERVED_ACTIVE,
            newState: CommercialStatus.NO_SHOW,
          },
          {
            ticketId,
            event: 'RELEASE',
            previousState: CommercialStatus.NO_SHOW,
            newState: CommercialStatus.NONE,
          },
        ];
      }
      return base;
    }

    case 'OVERSTAY_MIX': {
      // 70% normal, 20% overstay, 10% no-show
      const r = Math.random();
      if (r < 0.2) {
        // Overstay: RESERVED_ACTIVE → OVERSTAY → VEHICLE_LEAVES → NONE
        return [
          ...base,
          {
            ticketId,
            event: 'RESERVATION_END_TIME_REACHED',
            previousState: CommercialStatus.RESERVED_ACTIVE,
            newState: CommercialStatus.OVERSTAY,
          },
          {
            ticketId,
            event: 'VEHICLE_LEAVES',
            previousState: CommercialStatus.OVERSTAY,
            newState: CommercialStatus.NONE,
          },
        ];
      } else if (r < 0.3) {
        // No-show
        return [
          ...base,
          {
            ticketId,
            event: 'RESERVATION_END_TIME_REACHED',
            previousState: CommercialStatus.RESERVED_ACTIVE,
            newState: CommercialStatus.NO_SHOW,
          },
          {
            ticketId,
            event: 'RELEASE',
            previousState: CommercialStatus.NO_SHOW,
            newState: CommercialStatus.NONE,
          },
        ];
      }
      return base;
    }

    case 'CANCELLATION': {
      // 80% normal, 20% cancelled
      if (Math.random() < 0.2) {
        return [
          ...base,
          {
            ticketId,
            event: 'RESERVATION_CANCELLED',
            previousState: CommercialStatus.RESERVED_ACTIVE,
            newState: CommercialStatus.NONE,
          },
        ];
      }
      return base;
    }

    default:
      return base;
  }
}

/**
 * Build all transitions for all tickets, interleaved by lifecycle step.
 * Step 1 of all tickets first, then step 2, etc. — simulates realistic arrival order.
 */
function buildAllTransitions(
  subLocationId: string,
  ticketCount: number,
  scenario: Scenario
): Transition[] {
  // Build per-ticket lifecycles
  const lifecycles: Transition[][] = [];
  for (let i = 1; i <= ticketCount; i++) {
    const ticketId = padTicketId(i);
    lifecycles.push(buildTicketLifecycle(ticketId, scenario));
  }

  // Interleave: emit step N for all tickets, then step N+1, etc.
  const maxSteps = Math.max(...lifecycles.map(lc => lc.length));
  const result: Transition[] = [];
  for (let step = 0; step < maxSteps; step++) {
    for (const lc of lifecycles) {
      if (step < lc.length) {
        result.push(lc[step]);
      }
    }
  }

  return result;
}

async function emitTransition(
  subLocationId: string,
  transition: Transition,
  index: number
): Promise<void> {
  try {
    const producer = await getProducer();

    const message: TicketTransitionMessage = {
      ticketId: transition.ticketId,
      subLocationId,
      domain: 'COMMERCIAL',
      event: transition.event,
      previousState: transition.previousState,
      newState: transition.newState,
      timestamp: new Date().toISOString(),
      metadata: transition.metadata,
      producedBy: 'synthetic-commercial-generator',
    };

    await producer.send({
      topic: TOPIC,
      messages: [{
        key: subLocationId,
        value: JSON.stringify(message),
      }],
    });

    console.log(`📤 [${index}] ${transition.ticketId}: ${transition.previousState} → ${transition.newState} (${transition.event})`);
  } catch (error) {
    console.error(`❌ [${index}] Failed to emit:`, error);
  }
}

async function main() {
  const args = process.argv.slice(2);

  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const subLocationId = getArg('--sublocation');
  if (!subLocationId) {
    console.error('Usage: npx tsx scripts/generate-sublocation-events.ts --sublocation <ID> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --tickets <n>     Number of tickets to generate (default: 5)');
    console.error('  --scenario <name> Scenario: RESERVATION_FLOW, FULL_LIFECYCLE, NO_SHOW_MIX, OVERSTAY_MIX, CANCELLATION');
    console.error('  --rate <n>        Messages per second (default: 1)');
    process.exit(1);
  }

  const ticketCount = parseInt(getArg('--tickets') || '5');
  const scenario = (getArg('--scenario') || 'RESERVATION_FLOW') as Scenario;
  const rate = parseFloat(getArg('--rate') || '1');

  if (!SCENARIOS.includes(scenario)) {
    console.error(`Unknown scenario: ${scenario}. Available: ${SCENARIOS.join(', ')}`);
    process.exit(1);
  }

  const intervalMs = Math.floor(1000 / rate);
  if (intervalMs <= 0 || !isFinite(intervalMs)) {
    console.error(`Invalid rate: ${rate}`);
    process.exit(1);
  }

  // Build all transitions
  const transitions = buildAllTransitions(subLocationId, ticketCount, scenario);

  console.log(`🚀 Commercial generator starting:`, {
    scenario,
    tickets: ticketCount,
    totalMessages: transitions.length,
    rate: `${rate} msgs/sec`,
    subLocationId,
  });
  console.log('⏳ Waiting for Kafka topic initialization...');
  await sleep(2000);

  for (let i = 0; i < transitions.length; i++) {
    await emitTransition(subLocationId, transitions[i], i + 1);
    if (i < transitions.length - 1) {
      await sleep(intervalMs);
    }
  }

  console.log(`\n✅ Generated ${transitions.length} commercial transitions for ${ticketCount} tickets on topic "${TOPIC}"`);
  console.log('\nNext steps:');
  console.log('1. View messages: /admin/kafka-topics → select "SubLocation Tickets"');
  console.log('2. Aggregate: Click "Aggregate Ticket States" on Kafka Monitoring page');
  console.log('3. View 4D status: /capacity/inventory-status');

  await disconnectKafka();
  process.exit(0);
}

main();
