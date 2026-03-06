/**
 * Ticket-level state machine types for sublocation inventory tracking.
 *
 * Each ticket represents one unit of capacity within a sublocation.
 * Tickets have two independent state machines:
 *   - Commercial: tracks reservation lifecycle (NONE → RESERVED_UPCOMING → RESERVED_ACTIVE → ...)
 *   - Physical: tracks physical presence (FREE → OCCUPIED_UNCONFIRMED → OCCUPIED → ...)
 *
 * Kept separate from src/models/types.ts to avoid modifying core type definitions.
 */

import { PhysicalStatus, CommercialStatus } from '@/models/types';

// ---------------------------------------------------------------------------
// Domain discriminator
// ---------------------------------------------------------------------------

export type TicketDomain = 'COMMERCIAL' | 'PHYSICAL';

// ---------------------------------------------------------------------------
// State machine event types
// ---------------------------------------------------------------------------

export type CommercialEvent =
  | 'RESERVATION_CREATED'
  | 'RESERVATION_START_TIME_REACHED'
  | 'RESERVATION_END_TIME_REACHED'
  | 'RESERVATION_CANCELLED'
  | 'RELEASE'
  | 'VEHICLE_LEAVES';

export type PhysicalEvent =
  | 'SENSOR_DETECTED'
  | 'ENTRY_SCAN_SUCCESS'
  | 'EXIT_SCAN_SUCCESS'
  | 'SENSOR_CLEARED'
  | 'SENSOR_OFFLINE'
  | 'SENSOR_ONLINE'
  | 'MANUAL_OVERRIDE_FREE'
  | 'MANUAL_OVERRIDE_OCCUPIED'
  | 'MANUAL_OVERRIDE_UNKNOWN';

// ---------------------------------------------------------------------------
// Kafka message schema (published to sublocation.tickets topic)
// ---------------------------------------------------------------------------

export interface TicketTransitionMessage {
  ticketId: string;
  subLocationId: string;
  domain: TicketDomain;
  event: CommercialEvent | PhysicalEvent;
  previousState: string;  // CommercialStatus or PhysicalStatus value
  newState: string;        // CommercialStatus or PhysicalStatus value
  timestamp: string;       // ISO 8601
  metadata?: Record<string, string>;
  producedBy: string;
}

// ---------------------------------------------------------------------------
// MongoDB ticket_states document
// ---------------------------------------------------------------------------

export interface TicketStateDocument {
  _id?: any;
  ticketId: string;
  subLocationId: string;
  commercialState: CommercialStatus;
  physicalState: PhysicalStatus;
  lastCommercialEvent?: CommercialEvent;
  lastPhysicalEvent?: PhysicalEvent;
  lastCommercialTransitionAt?: Date;
  lastPhysicalTransitionAt?: Date;
  reservationStartTime?: Date;
  reservationEndTime?: Date;
  isSynthetic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Commercial transition table
// ---------------------------------------------------------------------------
// Maps "currentState:event" → expected newState
// RESERVATION_END_TIME_REACHED has two outcomes:
//   - OVERSTAY (vehicle present) — the default in the table
//   - NO_SHOW (no vehicle) — generator sets newState explicitly

const COMMERCIAL_TRANSITION_TABLE: Record<string, CommercialStatus> = {
  [`${CommercialStatus.NONE}:RESERVATION_CREATED`]: CommercialStatus.RESERVED_UPCOMING,
  [`${CommercialStatus.RESERVED_UPCOMING}:RESERVATION_START_TIME_REACHED`]: CommercialStatus.RESERVED_ACTIVE,
  [`${CommercialStatus.RESERVED_ACTIVE}:RESERVATION_END_TIME_REACHED`]: CommercialStatus.OVERSTAY,
  [`${CommercialStatus.RESERVED_ACTIVE}:RESERVATION_CANCELLED`]: CommercialStatus.NONE,
  [`${CommercialStatus.NO_SHOW}:RELEASE`]: CommercialStatus.NONE,
  [`${CommercialStatus.OVERSTAY}:VEHICLE_LEAVES`]: CommercialStatus.NONE,
};

// Set of valid (currentState, event, newState) triples that are context-dependent
const COMMERCIAL_CONTEXT_TRANSITIONS: Array<{
  currentState: CommercialStatus;
  event: CommercialEvent;
  newState: CommercialStatus;
}> = [
  // RESERVATION_END_TIME_REACHED can lead to OVERSTAY or NO_SHOW
  // depending on physical presence (determined by generator scenario)
  {
    currentState: CommercialStatus.RESERVED_ACTIVE,
    event: 'RESERVATION_END_TIME_REACHED',
    newState: CommercialStatus.NO_SHOW,
  },
];

/**
 * Validate a commercial state transition.
 * Returns true if the transition (currentState + event → newState) is valid.
 */
export function validateCommercialTransition(
  currentState: CommercialStatus,
  event: CommercialEvent,
  newState: CommercialStatus
): boolean {
  // Check standard table
  const key = `${currentState}:${event}`;
  const expected = COMMERCIAL_TRANSITION_TABLE[key];
  if (expected === newState) return true;

  // Check context-dependent transitions
  return COMMERCIAL_CONTEXT_TRANSITIONS.some(
    (t) =>
      t.currentState === currentState &&
      t.event === event &&
      t.newState === newState
  );
}

// ---------------------------------------------------------------------------
// Physical transition table
// ---------------------------------------------------------------------------

const PHYSICAL_TRANSITION_TABLE: Record<string, PhysicalStatus> = {
  [`${PhysicalStatus.FREE}:SENSOR_DETECTED`]: PhysicalStatus.OCCUPIED_UNCONFIRMED,
  [`${PhysicalStatus.FREE}:ENTRY_SCAN_SUCCESS`]: PhysicalStatus.OCCUPIED,
  [`${PhysicalStatus.OCCUPIED_UNCONFIRMED}:ENTRY_SCAN_SUCCESS`]: PhysicalStatus.OCCUPIED,
  [`${PhysicalStatus.OCCUPIED}:EXIT_SCAN_SUCCESS`]: PhysicalStatus.FREE,
  [`${PhysicalStatus.OCCUPIED}:SENSOR_CLEARED`]: PhysicalStatus.FREE,
  [`${PhysicalStatus.OCCUPIED_UNCONFIRMED}:SENSOR_CLEARED`]: PhysicalStatus.FREE,
  // SENSOR_ONLINE: UNKNOWN → depends on metadata (default FREE)
  [`${PhysicalStatus.UNKNOWN}:SENSOR_ONLINE`]: PhysicalStatus.FREE,
};

/**
 * Validate a physical state transition.
 * Returns true if the transition is valid per the physical transition table.
 *
 * Special rules:
 * - SENSOR_OFFLINE from any state → UNKNOWN (always valid)
 * - MANUAL_OVERRIDE_* from any state → forced state (always valid)
 * - SENSOR_ONLINE from UNKNOWN → FREE or OCCUPIED (both valid)
 */
export function validatePhysicalTransition(
  currentState: PhysicalStatus,
  event: PhysicalEvent,
  newState: PhysicalStatus
): boolean {
  // Manual overrides always succeed
  if (event === 'MANUAL_OVERRIDE_FREE' && newState === PhysicalStatus.FREE) return true;
  if (event === 'MANUAL_OVERRIDE_OCCUPIED' && newState === PhysicalStatus.OCCUPIED) return true;
  if (event === 'MANUAL_OVERRIDE_UNKNOWN' && newState === PhysicalStatus.UNKNOWN) return true;

  // SENSOR_OFFLINE from any state → UNKNOWN
  if (event === 'SENSOR_OFFLINE' && newState === PhysicalStatus.UNKNOWN) return true;

  // SENSOR_ONLINE from UNKNOWN → FREE or OCCUPIED (both valid, determined by metadata)
  if (
    event === 'SENSOR_ONLINE' &&
    currentState === PhysicalStatus.UNKNOWN &&
    (newState === PhysicalStatus.FREE || newState === PhysicalStatus.OCCUPIED)
  ) {
    return true;
  }

  // Check standard table
  const key = `${currentState}:${event}`;
  const expected = PHYSICAL_TRANSITION_TABLE[key];
  return expected === newState;
}
