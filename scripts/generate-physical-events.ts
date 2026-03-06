/**
 * Generate synthetic PHYSICAL ticket state transitions for testing capacity/inventory.
 *
 * Each ticket walks through the physical state machine:
 *   FREE → OCCUPIED_UNCONFIRMED → OCCUPIED → FREE (and variants)
 *
 * Usage:
 *   npx tsx scripts/generate-physical-events.ts --sublocation <id> --tickets 5 --scenario NORMAL_ENTRY --rate 1
 *   npx tsx scripts/generate-physical-events.ts --sublocation <id> --tickets 10 --scenario MIXED --rate 2
 *
 * Scenarios:
 *   NORMAL_ENTRY   - FREE → OCCUPIED_UNCONFIRMED → OCCUPIED (2 msgs/ticket)
 *   DIRECT_SCAN    - FREE → OCCUPIED (1 msg/ticket)
 *   FULL_CYCLE     - FREE → OCCUPIED_UNCONFIRMED → OCCUPIED → FREE (3 msgs/ticket)
 *   GHOST_DETECT   - FREE → OCCUPIED_UNCONFIRMED → FREE (2 msgs/ticket)
 *   SENSOR_ISSUES  - Random SENSOR_OFFLINE / SENSOR_ONLINE (1-2 msgs/ticket)
 *   MIXED          - Realistic mix of all above
 */

import { getProducer, disconnectKafka } from '../src/lib/kafka';
import { PhysicalStatus } from '../src/models/types';
import type { PhysicalEvent, TicketTransitionMessage } from '../src/lib/ticket-state-types';

const TOPIC = 'sublocation.tickets';

type Scenario = 'NORMAL_ENTRY' | 'DIRECT_SCAN' | 'FULL_CYCLE' | 'GHOST_DETECT' | 'SENSOR_ISSUES' | 'MIXED';

const SCENARIOS: Scenario[] = ['NORMAL_ENTRY', 'DIRECT_SCAN', 'FULL_CYCLE', 'GHOST_DETECT', 'SENSOR_ISSUES', 'MIXED'];

interface Transition {
  ticketId: string;
  event: PhysicalEvent;
  previousState: PhysicalStatus;
  newState: PhysicalStatus;
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
 * Pick a random effective scenario for MIXED mode.
 */
function pickMixedScenario(): Exclude<Scenario, 'MIXED'> {
  const r = Math.random();
  if (r < 0.50) return 'NORMAL_ENTRY';
  if (r < 0.70) return 'DIRECT_SCAN';
  if (r < 0.85) return 'FULL_CYCLE';
  if (r < 0.95) return 'GHOST_DETECT';
  return 'SENSOR_ISSUES';
}

/**
 * Build the lifecycle transitions for one ticket based on scenario.
 */
function buildTicketLifecycle(ticketId: string, scenario: Scenario): Transition[] {
  const effectiveScenario = scenario === 'MIXED' ? pickMixedScenario() : scenario;

  switch (effectiveScenario) {
    case 'NORMAL_ENTRY':
      // FREE → OCCUPIED_UNCONFIRMED (sensor) → OCCUPIED (scan confirms)
      return [
        {
          ticketId,
          event: 'SENSOR_DETECTED',
          previousState: PhysicalStatus.FREE,
          newState: PhysicalStatus.OCCUPIED_UNCONFIRMED,
        },
        {
          ticketId,
          event: 'ENTRY_SCAN_SUCCESS',
          previousState: PhysicalStatus.OCCUPIED_UNCONFIRMED,
          newState: PhysicalStatus.OCCUPIED,
        },
      ];

    case 'DIRECT_SCAN':
      // FREE → OCCUPIED (scan without prior sensor)
      return [
        {
          ticketId,
          event: 'ENTRY_SCAN_SUCCESS',
          previousState: PhysicalStatus.FREE,
          newState: PhysicalStatus.OCCUPIED,
        },
      ];

    case 'FULL_CYCLE':
      // FREE → OCCUPIED_UNCONFIRMED → OCCUPIED → FREE
      return [
        {
          ticketId,
          event: 'SENSOR_DETECTED',
          previousState: PhysicalStatus.FREE,
          newState: PhysicalStatus.OCCUPIED_UNCONFIRMED,
        },
        {
          ticketId,
          event: 'ENTRY_SCAN_SUCCESS',
          previousState: PhysicalStatus.OCCUPIED_UNCONFIRMED,
          newState: PhysicalStatus.OCCUPIED,
        },
        {
          ticketId,
          event: 'EXIT_SCAN_SUCCESS',
          previousState: PhysicalStatus.OCCUPIED,
          newState: PhysicalStatus.FREE,
        },
      ];

    case 'GHOST_DETECT':
      // FREE → OCCUPIED_UNCONFIRMED → FREE (sensor cleared, ghost)
      return [
        {
          ticketId,
          event: 'SENSOR_DETECTED',
          previousState: PhysicalStatus.FREE,
          newState: PhysicalStatus.OCCUPIED_UNCONFIRMED,
        },
        {
          ticketId,
          event: 'SENSOR_CLEARED',
          previousState: PhysicalStatus.OCCUPIED_UNCONFIRMED,
          newState: PhysicalStatus.FREE,
        },
      ];

    case 'SENSOR_ISSUES': {
      // Random: SENSOR_OFFLINE → UNKNOWN, then SENSOR_ONLINE → FREE
      const transitions: Transition[] = [
        {
          ticketId,
          event: 'SENSOR_OFFLINE',
          previousState: PhysicalStatus.FREE,
          newState: PhysicalStatus.UNKNOWN,
        },
      ];
      // 50% chance of coming back online
      if (Math.random() < 0.5) {
        transitions.push({
          ticketId,
          event: 'SENSOR_ONLINE',
          previousState: PhysicalStatus.UNKNOWN,
          newState: PhysicalStatus.FREE,
        });
      }
      return transitions;
    }

    default:
      return [];
  }
}

/**
 * Build all transitions for all tickets, interleaved by lifecycle step.
 */
function buildAllTransitions(
  ticketCount: number,
  scenario: Scenario
): Transition[] {
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
      domain: 'PHYSICAL',
      event: transition.event,
      previousState: transition.previousState,
      newState: transition.newState,
      timestamp: new Date().toISOString(),
      producedBy: 'synthetic-physical-generator',
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
    console.error('Usage: npx tsx scripts/generate-physical-events.ts --sublocation <ID> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --tickets <n>     Number of tickets to generate (default: 5)');
    console.error('  --scenario <name> Scenario: NORMAL_ENTRY, DIRECT_SCAN, FULL_CYCLE, GHOST_DETECT, SENSOR_ISSUES, MIXED');
    console.error('  --rate <n>        Messages per second (default: 1)');
    process.exit(1);
  }

  const ticketCount = parseInt(getArg('--tickets') || '5');
  const scenario = (getArg('--scenario') || 'NORMAL_ENTRY') as Scenario;
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

  const transitions = buildAllTransitions(ticketCount, scenario);

  console.log(`🚀 Physical generator starting:`, {
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

  console.log(`\n✅ Generated ${transitions.length} physical transitions for ${ticketCount} tickets on topic "${TOPIC}"`);
  console.log('\nNext steps:');
  console.log('1. View messages: /admin/kafka-topics → select "SubLocation Tickets"');
  console.log('2. Aggregate: Click "Aggregate Ticket States" on Kafka Monitoring page');
  console.log('3. View 4D status: /capacity/inventory-status');

  await disconnectKafka();
  process.exit(0);
}

main();
