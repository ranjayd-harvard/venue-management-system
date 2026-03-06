// src/lib/inventory-status-engine.ts
// 4-Dimensional Inventory Status Engine
//
// Computes all 4 orthogonal status dimensions for a SubLocation:
//   1. CapacityStatus  (planning layer)  — passed through from stored DefaultCapacities
//   2. PhysicalStatus  (reality layer)   — stored on SubLocation
//   3. CommercialStatus(contract layer)  — computed from events + current time
//   4. OperationalStatus(action layer)   — derived via cross-tabulation of Physical x Commercial

import {
  Event,
  DefaultCapacities,
  PhysicalStatus,
  CommercialStatus,
  OperationalStatus,
  PhysicalStatusCounts,
  CommercialStatusCounts,
  OperationalStatusCounts,
  PhysicalStatusSnapshot,
  InventoryStatus4D,
  CrossTabulationCell,
  CrossTabulationResult,
  AllocationConsumption,
  CategoryConsumption,
  CapacityCategory,
} from '@/models/types';

// Input context for computing inventory status
export interface InventoryStatusContext {
  subLocationId: string;
  subLocationLabel: string;
  totalCapacity: number; // maxCapacity from SubLocation

  // Dimension 1: Already stored (pass-through)
  capacityStatus: DefaultCapacities | null;

  // Dimension 2: Stored on SubLocation (or null if not yet set)
  physicalStatus: PhysicalStatusSnapshot | null;

  // Events overlapping the query time for this SubLocation
  overlappingEvents: Event[];

  // Current time for derivation
  currentTime: Date;

  // Optional overrides: when ticket_states collection provides pre-computed
  // aggregate counts, these bypass the stored snapshot / event-based derivation.
  physicalStatusOverride?: PhysicalStatusCounts;
  commercialStatusOverride?: CommercialStatusCounts;
}

// Per-event commercial status determination
interface EventCommercialDetail {
  eventId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  attendees: number;
  commercialStatus: CommercialStatus;
}

export class InventoryStatusEngine {

  /**
   * Compute all 4 dimensions given context.
   * CapacityStatus is passed through. PhysicalStatus is resolved from stored or defaulted.
   * CommercialStatus is computed from events + time. OperationalStatus is derived via cross-tab.
   */
  computeStatus(context: InventoryStatusContext): InventoryStatus4D {
    // Step 1: Resolve PhysicalStatus — use override, stored, or default to all-UNKNOWN
    const physical = context.physicalStatusOverride
      ? context.physicalStatusOverride
      : this.resolvePhysicalStatus(context);

    // Step 2: Compute CommercialStatus — use override or derive from events + current time
    const { counts: commercial, eventDetails } = context.commercialStatusOverride
      ? { counts: context.commercialStatusOverride, eventDetails: [] as EventCommercialDetail[] }
      : this.computeCommercialStatus(context);

    // Step 3: Derive OperationalStatus via cross-tabulation of Physical x Commercial
    const { counts: operational, crossTabulation } = this.deriveOperationalStatus(
      physical,
      commercial,
      context.totalCapacity,
      eventDetails
    );

    // Step 4: Compute allocation consumption (bridges D1 planning with D2-D4 reality)
    const allocationConsumption = this.computeAllocationConsumption(
      context.capacityStatus,
      crossTabulation,
      commercial,
      eventDetails,
      context.totalCapacity
    );

    return {
      subLocationId: context.subLocationId,
      subLocationLabel: context.subLocationLabel,
      timestamp: context.currentTime,
      totalCapacity: context.totalCapacity,
      capacityStatus: context.capacityStatus,
      physicalStatus: physical,
      commercialStatus: commercial,
      operationalStatus: operational,
      crossTabulation,
      activeEvents: eventDetails,
      allocationConsumption,
    };
  }

  // ---------------------------------------------------------------------------
  // Dimension 2: PhysicalStatus resolution
  // ---------------------------------------------------------------------------

  private resolvePhysicalStatus(context: InventoryStatusContext): PhysicalStatusCounts {
    if (context.physicalStatus) {
      const { counts } = context.physicalStatus;
      const sum = counts.free + counts.occupied + counts.occupiedUnconfirmed + counts.unknown;
      // If stored counts match total capacity, use them directly
      if (sum === context.totalCapacity) {
        return { ...counts };
      }
      // If mismatch, scale proportionally or fall back
      if (sum > 0) {
        const ratio = context.totalCapacity / sum;
        return {
          free: Math.round(counts.free * ratio),
          occupied: Math.round(counts.occupied * ratio),
          occupiedUnconfirmed: Math.round(counts.occupiedUnconfirmed * ratio),
          unknown: Math.max(0, context.totalCapacity -
            Math.round(counts.free * ratio) -
            Math.round(counts.occupied * ratio) -
            Math.round(counts.occupiedUnconfirmed * ratio)),
        };
      }
    }

    // Default: all unknown
    return {
      free: 0,
      occupied: 0,
      occupiedUnconfirmed: 0,
      unknown: context.totalCapacity,
    };
  }

  // ---------------------------------------------------------------------------
  // Dimension 3: CommercialStatus computation
  // ---------------------------------------------------------------------------

  private computeCommercialStatus(context: InventoryStatusContext): {
    counts: CommercialStatusCounts;
    eventDetails: EventCommercialDetail[];
  } {
    const { overlappingEvents, currentTime, totalCapacity } = context;
    const eventDetails: EventCommercialDetail[] = [];

    let reservedUpcoming = 0;
    let reservedActive = 0;
    let overstayCandidate = 0;

    for (const event of overlappingEvents) {
      if (!event.isActive) continue;

      const attendees = event.attendees || 0;
      if (attendees <= 0) continue;

      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);
      const graceBeforeMs = (event.gracePeriodBefore || 0) * 60 * 1000;
      const graceAfterMs = (event.gracePeriodAfter || 0) * 60 * 1000;

      const effectiveStart = new Date(startDate.getTime() - graceBeforeMs);
      const effectiveEnd = new Date(endDate.getTime() + graceAfterMs);

      const now = currentTime.getTime();
      let status: CommercialStatus;

      if (now < startDate.getTime() && now >= effectiveStart.getTime()) {
        // Within grace-before window — upcoming
        status = CommercialStatus.RESERVED_UPCOMING;
        reservedUpcoming += attendees;
      } else if (now < startDate.getTime()) {
        // Before event start (and before grace window) — upcoming
        status = CommercialStatus.RESERVED_UPCOMING;
        reservedUpcoming += attendees;
      } else if (now >= startDate.getTime() && now <= endDate.getTime()) {
        // During event — active
        status = CommercialStatus.RESERVED_ACTIVE;
        reservedActive += attendees;
      } else if (now > endDate.getTime() && now <= effectiveEnd.getTime()) {
        // Past end but within grace-after — still active (grace period)
        status = CommercialStatus.RESERVED_ACTIVE;
        reservedActive += attendees;
      } else if (now > effectiveEnd.getTime()) {
        // Past grace-after — overstay candidate (finalized during cross-tab)
        status = CommercialStatus.OVERSTAY;
        overstayCandidate += attendees;
      } else {
        continue;
      }

      eventDetails.push({
        eventId: event._id?.toString() || '',
        name: event.name,
        startDate,
        endDate,
        attendees,
        commercialStatus: status,
      });
    }

    // Cap totals at totalCapacity
    reservedUpcoming = Math.min(reservedUpcoming, totalCapacity);
    reservedActive = Math.min(reservedActive, totalCapacity - reservedUpcoming);
    overstayCandidate = Math.min(overstayCandidate, totalCapacity - reservedUpcoming - reservedActive);

    // Remaining capacity has no commercial reservation
    const committedCapacity = reservedUpcoming + reservedActive + overstayCandidate;
    const noneCapacity = Math.max(0, totalCapacity - committedCapacity);

    // Note: NO_SHOW count is determined during cross-tabulation (requires physical status)
    return {
      counts: {
        none: noneCapacity,
        reservedUpcoming,
        reservedActive,
        noShow: 0, // Will be refined in cross-tabulation
        overstay: overstayCandidate,
      },
      eventDetails,
    };
  }

  // ---------------------------------------------------------------------------
  // Dimension 4: OperationalStatus derivation via cross-tabulation
  // ---------------------------------------------------------------------------

  private deriveOperationalStatus(
    physical: PhysicalStatusCounts,
    commercial: CommercialStatusCounts,
    totalCapacity: number,
    eventDetails: EventCommercialDetail[]
  ): {
    counts: OperationalStatusCounts;
    crossTabulation: CrossTabulationResult;
  } {
    const cells: CrossTabulationCell[] = [];
    const assumptions: string[] = [];

    // Working pools: remaining capacity in each dimension to be allocated
    let remainingFree = physical.free;
    let remainingOccupied = physical.occupied;
    const unconfirmed = physical.occupiedUnconfirmed;
    const unknown = physical.unknown;

    let remainingUpcoming = commercial.reservedUpcoming;
    let remainingActive = commercial.reservedActive;
    let remainingNone = commercial.none;
    let remainingOverstay = commercial.overstay;

    // Operational counters
    let sellable = 0;
    let nonSellable = 0;
    let attentionRequired = 0;
    let billingRequired = 0;
    let other = 0;

    // Refined commercial counters (for updating noShow/overstay)
    let noShowCount = 0;
    let confirmedOverstay = 0;

    assumptions.push(
      'Anonymous spots are matched using waterfall priority: confirmed matches first, then anomalies.'
    );

    // R1: OCCUPIED + RESERVED_ACTIVE → NON_SELLABLE (normal operation)
    {
      const count = Math.min(remainingOccupied, remainingActive);
      if (count > 0) {
        cells.push({
          physicalStatus: PhysicalStatus.OCCUPIED,
          commercialStatus: CommercialStatus.RESERVED_ACTIVE,
          count,
          operationalStatus: OperationalStatus.NON_SELLABLE,
          reason: 'Normal operation — guest present with active reservation',
        });
        nonSellable += count;
        remainingOccupied -= count;
        remainingActive -= count;
      }
    }

    // R2: FREE + RESERVED_UPCOMING → NON_SELLABLE (held for incoming guest)
    {
      const count = Math.min(remainingFree, remainingUpcoming);
      if (count > 0) {
        cells.push({
          physicalStatus: PhysicalStatus.FREE,
          commercialStatus: CommercialStatus.RESERVED_UPCOMING,
          count,
          operationalStatus: OperationalStatus.NON_SELLABLE,
          reason: 'Held for incoming guest — reservation upcoming',
        });
        nonSellable += count;
        remainingFree -= count;
        remainingUpcoming -= count;
      }
    }

    // R3: FREE + RESERVED_ACTIVE → ATTENTION_REQUIRED (potential no-show)
    {
      const count = Math.min(remainingFree, remainingActive);
      if (count > 0) {
        cells.push({
          physicalStatus: PhysicalStatus.FREE,
          commercialStatus: CommercialStatus.NO_SHOW,
          count,
          operationalStatus: OperationalStatus.ATTENTION_REQUIRED,
          reason: 'Potential no-show — reservation active but spot is free',
        });
        attentionRequired += count;
        noShowCount += count;
        remainingFree -= count;
        remainingActive -= count;
      }
    }

    // R4: OCCUPIED + OVERSTAY → BILLING_REQUIRED
    {
      const count = Math.min(remainingOccupied, remainingOverstay);
      if (count > 0) {
        cells.push({
          physicalStatus: PhysicalStatus.OCCUPIED,
          commercialStatus: CommercialStatus.OVERSTAY,
          count,
          operationalStatus: OperationalStatus.BILLING_REQUIRED,
          reason: 'Overstay — reservation ended but guest still present',
        });
        billingRequired += count;
        confirmedOverstay += count;
        remainingOccupied -= count;
        remainingOverstay -= count;
      }
    }

    // R5: OCCUPIED + NONE → ATTENTION_REQUIRED (unauthorized occupancy)
    {
      const count = Math.min(remainingOccupied, remainingNone);
      if (count > 0) {
        cells.push({
          physicalStatus: PhysicalStatus.OCCUPIED,
          commercialStatus: CommercialStatus.NONE,
          count,
          operationalStatus: OperationalStatus.ATTENTION_REQUIRED,
          reason: 'Unauthorized occupancy — spot occupied without reservation',
        });
        attentionRequired += count;
        remainingOccupied -= count;
        remainingNone -= count;
      }
    }

    // R6: FREE + NONE → SELLABLE
    {
      const count = Math.min(remainingFree, remainingNone);
      if (count > 0) {
        cells.push({
          physicalStatus: PhysicalStatus.FREE,
          commercialStatus: CommercialStatus.NONE,
          count,
          operationalStatus: OperationalStatus.SELLABLE,
          reason: 'Available for sale — free with no reservation',
        });
        sellable += count;
        remainingFree -= count;
        remainingNone -= count;
      }
    }

    // R7: Handle remaining unmatched occupied (edge case)
    {
      const remaining = remainingOccupied + remainingUpcoming;
      if (remainingOccupied > 0 && remainingUpcoming > 0) {
        const count = Math.min(remainingOccupied, remainingUpcoming);
        cells.push({
          physicalStatus: PhysicalStatus.OCCUPIED,
          commercialStatus: CommercialStatus.RESERVED_UPCOMING,
          count,
          operationalStatus: OperationalStatus.OTHER,
          reason: 'Occupied before reservation start time — early arrival or misattribution',
        });
        other += count;
        remainingOccupied -= count;
        remainingUpcoming -= count;
      }
    }

    // R8: OCCUPIED_UNCONFIRMED → OTHER
    if (unconfirmed > 0) {
      cells.push({
        physicalStatus: PhysicalStatus.OCCUPIED_UNCONFIRMED,
        commercialStatus: CommercialStatus.NONE,
        count: unconfirmed,
        operationalStatus: OperationalStatus.OTHER,
        reason: 'Unconfirmed occupancy — needs verification',
      });
      other += unconfirmed;
    }

    // R9: UNKNOWN → OTHER
    if (unknown > 0) {
      cells.push({
        physicalStatus: PhysicalStatus.UNKNOWN,
        commercialStatus: CommercialStatus.NONE,
        count: unknown,
        operationalStatus: OperationalStatus.OTHER,
        reason: 'No physical status data available',
      });
      other += unknown;
    }

    // Handle any leftover from rounding or edge cases
    const accountedFor = sellable + nonSellable + attentionRequired + billingRequired + other;
    if (accountedFor < totalCapacity) {
      const leftover = totalCapacity - accountedFor;
      other += leftover;
      if (leftover > 0) {
        assumptions.push(
          `${leftover} spot(s) could not be matched to a specific rule and are classified as OTHER.`
        );
      }
    }

    // Update commercial counts with cross-tab refinements
    commercial.noShow = noShowCount;
    commercial.overstay = confirmedOverstay;
    // Overstay candidates that weren't physically occupied revert to NONE
    if (remainingOverstay > 0) {
      commercial.none += remainingOverstay;
      commercial.overstay -= remainingOverstay;
      assumptions.push(
        `${remainingOverstay} overstay candidate(s) are not physically occupied — reclassified as NONE.`
      );
    }

    return {
      counts: {
        sellable,
        nonSellable,
        attentionRequired,
        billingRequired,
        other,
      },
      crossTabulation: { cells, assumptions },
    };
  }

  // ---------------------------------------------------------------------------
  // Allocation Consumption: Bridges D1 (planning) with D2-D4 (reality)
  // ---------------------------------------------------------------------------

  private computeAllocationConsumption(
    capacityStatus: DefaultCapacities | null,
    crossTabulation: CrossTabulationResult,
    commercial: CommercialStatusCounts,
    eventDetails: EventCommercialDetail[],
    totalCapacity: number
  ): AllocationConsumption | undefined {
    if (!capacityStatus) return undefined;

    const assumptions: string[] = [];
    assumptions.push('Event attendees are attributed to the "events" capacity category first.');
    assumptions.push('Non-event occupancy is attributed to "transient" (walk-ins).');

    // --- Gather event-driven attendees by commercial status ---
    const eventActive = eventDetails
      .filter(e => e.commercialStatus === CommercialStatus.RESERVED_ACTIVE)
      .reduce((sum, e) => sum + e.attendees, 0);
    const eventUpcoming = eventDetails
      .filter(e => e.commercialStatus === CommercialStatus.RESERVED_UPCOMING)
      .reduce((sum, e) => sum + e.attendees, 0);
    const eventOverstay = eventDetails
      .filter(e => e.commercialStatus === CommercialStatus.OVERSTAY)
      .reduce((sum, e) => sum + e.attendees, 0);

    // --- Gather cross-tab cell counts by operational outcome ---
    const cellCounts = {
      occupiedActive: 0,   // R1: OCCUPIED + RESERVED_ACTIVE
      freeUpcoming: 0,     // R2: FREE + RESERVED_UPCOMING
      noShow: 0,           // R3: FREE + NO_SHOW
      overstay: 0,         // R4: OCCUPIED + OVERSTAY
      unauthorized: 0,     // R5: OCCUPIED + NONE
      sellable: 0,         // R6: FREE + NONE
      unconfirmed: 0,      // R8: OCCUPIED_UNCONFIRMED
      unknown: 0,          // R9: UNKNOWN
    };
    for (const cell of crossTabulation.cells) {
      if (cell.physicalStatus === PhysicalStatus.OCCUPIED && cell.commercialStatus === CommercialStatus.RESERVED_ACTIVE) {
        cellCounts.occupiedActive += cell.count;
      } else if (cell.physicalStatus === PhysicalStatus.FREE && cell.commercialStatus === CommercialStatus.RESERVED_UPCOMING) {
        cellCounts.freeUpcoming += cell.count;
      } else if (cell.commercialStatus === CommercialStatus.NO_SHOW) {
        cellCounts.noShow += cell.count;
      } else if (cell.commercialStatus === CommercialStatus.OVERSTAY) {
        cellCounts.overstay += cell.count;
      } else if (cell.physicalStatus === PhysicalStatus.OCCUPIED && cell.commercialStatus === CommercialStatus.NONE) {
        cellCounts.unauthorized += cell.count;
      } else if (cell.physicalStatus === PhysicalStatus.FREE && cell.commercialStatus === CommercialStatus.NONE) {
        cellCounts.sellable += cell.count;
      } else if (cell.physicalStatus === PhysicalStatus.OCCUPIED_UNCONFIRMED) {
        cellCounts.unconfirmed += cell.count;
      } else if (cell.physicalStatus === PhysicalStatus.UNKNOWN) {
        cellCounts.unknown += cell.count;
      }
    }

    // ============================================================
    // EVENTS category: attributed from event-driven commercial activity
    // ============================================================
    const eventsPlanned = capacityStatus.allocated.events;
    let eventsRemaining = eventsPlanned;

    // Consumed: actively occupied with reservation (from cross-tab R1, capped by event attendees)
    const eventsConsumed = Math.min(
      Math.min(eventActive, cellCounts.occupiedActive), // event-driven active, within physical reality
      eventsRemaining
    );
    eventsRemaining -= eventsConsumed;

    // Upcoming: held for incoming event (from cross-tab R2, capped by event attendees)
    const eventsUpcoming = Math.min(
      Math.min(eventUpcoming, cellCounts.freeUpcoming),
      eventsRemaining
    );
    eventsRemaining -= eventsUpcoming;

    // No-show: expected by event but not physically present (from cross-tab R3)
    const eventsNoShow = Math.min(cellCounts.noShow, eventsRemaining);
    eventsRemaining -= eventsNoShow;

    // Overstay: event past end but still occupied (from cross-tab R4)
    const eventsOverstay = Math.min(
      Math.min(eventOverstay, cellCounts.overstay),
      eventsRemaining
    );
    eventsRemaining -= eventsOverstay;

    const eventsAvailable = Math.max(0, eventsRemaining);

    // ============================================================
    // TRANSIENT category: non-event physical activity (walk-ins)
    // ============================================================
    const transientPlanned = capacityStatus.allocated.transient;
    let transientRemaining = transientPlanned;

    // Consumed: occupied spots not attributed to events
    const remainingOccupiedActive = cellCounts.occupiedActive - eventsConsumed;
    const transientConsumed = Math.min(remainingOccupiedActive, transientRemaining);
    transientRemaining -= transientConsumed;

    // Unauthorized: occupied with no reservation, not event-related
    const transientUnauthorized = Math.min(cellCounts.unauthorized, transientRemaining);
    transientRemaining -= transientUnauthorized;

    const transientAvailable = Math.max(0, transientRemaining);

    // ============================================================
    // RESERVED category: pre-set capacity (not from events)
    // ============================================================
    const reservedPlanned = capacityStatus.allocated.reserved;
    let reservedRemaining = reservedPlanned;

    // Upcoming: remaining upcoming reservations not attributed to events
    const remainingUpcoming = cellCounts.freeUpcoming - eventsUpcoming;
    const reservedUpcoming = Math.min(remainingUpcoming, reservedRemaining);
    reservedRemaining -= reservedUpcoming;

    // Consumed: remaining occupied+active not attributed above
    const reservedConsumed = Math.min(
      Math.max(0, remainingOccupiedActive - transientConsumed),
      reservedRemaining
    );
    reservedRemaining -= reservedConsumed;

    const reservedAvailable = Math.max(0, reservedRemaining);

    // ============================================================
    // UNAVAILABLE category: blocked/maintenance/unknown
    // ============================================================
    const unavailablePlanned = capacityStatus.unallocated.unavailable;
    const unavailableConsumed = Math.min(
      cellCounts.unconfirmed + cellCounts.unknown,
      unavailablePlanned
    );
    const unavailableAvailable = Math.max(0, unavailablePlanned - unavailableConsumed);

    // ============================================================
    // READYTOUSE category: available for future allocation
    // ============================================================
    const readyToUsePlanned = capacityStatus.unallocated.readyToUse;
    const readyToUseAvailable = Math.min(cellCounts.sellable, readyToUsePlanned);
    const readyToUseConsumed = 0; // This category is inherently available

    // ============================================================
    // Build result
    // ============================================================
    const pct = (consumed: number, planned: number) =>
      planned > 0 ? Math.round((consumed / planned) * 100) : 0;

    const categories: CategoryConsumption[] = [
      {
        category: 'events',
        planned: eventsPlanned,
        consumed: eventsConsumed,
        upcoming: eventsUpcoming,
        noShow: eventsNoShow,
        overstay: eventsOverstay,
        unauthorized: 0,
        available: eventsAvailable,
        utilizationPct: pct(eventsConsumed, eventsPlanned),
      },
      {
        category: 'transient',
        planned: transientPlanned,
        consumed: transientConsumed,
        upcoming: 0,
        noShow: 0,
        overstay: 0,
        unauthorized: transientUnauthorized,
        available: transientAvailable,
        utilizationPct: pct(transientConsumed, transientPlanned),
      },
      {
        category: 'reserved',
        planned: reservedPlanned,
        consumed: reservedConsumed,
        upcoming: reservedUpcoming,
        noShow: 0,
        overstay: 0,
        unauthorized: 0,
        available: reservedAvailable,
        utilizationPct: pct(reservedConsumed, reservedPlanned),
      },
      {
        category: 'unavailable',
        planned: unavailablePlanned,
        consumed: unavailableConsumed,
        upcoming: 0,
        noShow: 0,
        overstay: 0,
        unauthorized: 0,
        available: unavailableAvailable,
        utilizationPct: pct(unavailableConsumed, unavailablePlanned),
      },
      {
        category: 'readyToUse',
        planned: readyToUsePlanned,
        consumed: readyToUseConsumed,
        upcoming: 0,
        noShow: 0,
        overstay: 0,
        unauthorized: 0,
        available: readyToUseAvailable,
        utilizationPct: pct(readyToUseConsumed, readyToUsePlanned),
      },
    ];

    const totalPlanned = categories.reduce((s, c) => s + c.planned, 0);
    const totalConsumed = categories.reduce((s, c) => s + c.consumed, 0);
    const totalAvailable = categories.reduce((s, c) => s + c.available, 0);

    return {
      categories,
      totalPlanned,
      totalConsumed,
      totalAvailable,
      overallUtilizationPct: pct(totalConsumed, totalPlanned),
      attributionAssumptions: assumptions,
    };
  }
}
