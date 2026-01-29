# Overlapping Events & Automatic Ratesheet Priority Resolution - Analysis Report

**Date**: January 28, 2026
**Test Scenario**: Three overlapping events with different hourly rates
**Purpose**: Understand automatic ratesheet priority resolution behavior

---

## Executive Summary

This analysis tested how the venue management system handles multiple overlapping events at the same priority level (4900) with different hourly rates. The key finding: **the system uses INSERTION ORDER** - the first created event wins when events overlap at the same priority, regardless of rate value.

---

## Test Scenario

### Events Created (All on January 28, 2026, EST timezone)

| Event | Time (EST) | Rate | Grace Before | Grace After |
|-------|-----------|------|--------------|-------------|
| **EventA-Morning** | 9:00 AM - 11:00 AM | $100/hr | 60 min | 120 min |
| **EventB-Midday** | 10:00 AM - 3:00 PM | $150/hr | 60 min | 120 min |
| **EventC-Afternoon** | 2:00 PM - 6:00 PM | $200/hr | 60 min | 120 min |

### Effective Time Windows (with Grace Periods)

- **EventA**: 8:00 AM - 1:00 PM (5 hours total)
- **EventB**: 9:00 AM - 5:00 PM (8 hours total)
- **EventC**: 1:00 PM - 8:00 PM (7 hours total)

### Critical Overlaps

```
Time         EventA           EventB           EventC
8:00 AM      Grace ($0)       -                -
9:00 AM      Event ($100)     Grace ($0)       -
10:00 AM     Event ($100)     Event ($150)     -           ← CONFLICT #1
11:00 AM     Grace ($0)       Event ($150)     -
12:00 PM     Grace ($0)       Event ($150)     -
1:00 PM      Grace ($0)       Event ($150)     Grace ($0)
2:00 PM      -                Event ($150)     Event ($200) ← CONFLICT #2
3:00 PM      -                Grace ($0)       Event ($200)
4:00 PM      -                Grace ($0)       Event ($200)
5:00 PM      -                Grace ($0)       Event ($200)
6:00 PM      -                -                Grace ($0)
7:00 PM      -                -                Grace ($0)
8:00 PM      -                -                Grace ($0)
```

---

## Key Findings

### 1. Priority Resolution: INSERTION ORDER WINS

**Test Result for Conflict #1 (10:00-11:00 AM EST):**
- **Competing**: EventA ($100/hr) vs EventB ($150/hr)
- **Winner**: EventA ($100/hr)
- **Conclusion**: First created event wins

**Test Result for Conflict #2 (2:00-3:00 PM EST):**
- **Competing**: EventB ($150/hr) vs EventC ($200/hr)
- **Winner**: EventB ($150/hr)
- **Conclusion**: First created event wins (confirmed)

**Key Insight**: When multiple events overlap at the same priority (4900), the pricing engine uses **insertion order** (first created wins). The rate value ($100 vs $150 vs $200) does NOT affect conflict resolution.

### 2. Automatic Ratesheet Generation

All events automatically generated ratesheets with:
- **Name Pattern**: `Auto-{EventName}`
- **Priority**: 4900 (fixed for all auto-generated event ratesheets)
- **Type**: `TIMING_BASED`
- **Window Type**: `DURATION_BASED`
- **Approval Status**: `APPROVED` by system
- **Conflict Resolution**: `PRIORITY`

**Time Window Structure** (3 windows per event):
1. **Grace Before**: X minutes @ $0/hr
2. **Event Duration**: Y minutes @ event rate
3. **Grace After**: Z minutes @ $0/hr

### 3. Grace Period Behavior

#### Walk-In Booking (`isEventBooking: false`)
- Grace period $0/hr windows are **SKIPPED**
- Pricing falls back to next-best applicable ratesheet
- **Total for 8am-8pm**: $1,430 for 12 hours
- **Breakdown**: 9 hours at event rates + 3 hours at default rate

#### Event Booking (`isEventBooking: true`)
- Grace period $0/hr windows are **INCLUDED**
- Event organizers get free setup/teardown time
- **Total for 8am-8pm**: $700 for 12 hours
- **Breakdown**: 3 hours at event rates + 6 hours grace ($0) + 3 hours grace ($0)

**Purpose**: This design prevents walk-in customers from exploiting free buffer time while allowing event bookings to benefit from setup/teardown periods at no cost.

---

## Walk-In Pricing Analysis (Hour-by-Hour)

```
Hour  1 (08:00-09:00 EST): $ 10/hr | DEFAULT_RATE
Hour  2 (09:00-10:00 EST): $100/hr | Auto-EventA-Morning
Hour  3 (10:00-11:00 EST): $100/hr | Auto-EventA-Morning (wins over EventB $150)
Hour  4 (11:00-12:00 EST): $150/hr | Auto-EventB-Midday
Hour  5 (12:00-13:00 EST): $150/hr | Auto-EventB-Midday
Hour  6 (13:00-14:00 EST): $150/hr | Auto-EventB-Midday
Hour  7 (14:00-15:00 EST): $150/hr | Auto-EventB-Midday (wins over EventC $200)
Hour  8 (15:00-16:00 EST): $200/hr | Auto-EventC-Afternoon
Hour  9 (16:00-17:00 EST): $200/hr | Auto-EventC-Afternoon
Hour 10 (17:00-18:00 EST): $200/hr | Auto-EventC-Afternoon
Hour 11 (18:00-19:00 EST): $ 10/hr | DEFAULT_RATE
Hour 12 (19:00-20:00 EST): $ 10/hr | DEFAULT_RATE

TOTAL: $1,430 for 12 hours
```

---

## Event Booking Pricing Analysis (Hour-by-Hour)

```
Hour  1 (08:00-09:00 EST): $  0/hr | Auto-EventA-Morning [GRACE]
Hour  2 (09:00-10:00 EST): $100/hr | Auto-EventA-Morning
Hour  3 (10:00-11:00 EST): $100/hr | Auto-EventA-Morning (wins over EventB)
Hour  4 (11:00-12:00 EST): $  0/hr | Auto-EventA-Morning [GRACE]
Hour  5 (12:00-13:00 EST): $  0/hr | Auto-EventA-Morning [GRACE]
Hour  6 (13:00-14:00 EST): $150/hr | Auto-EventB-Midday
Hour  7 (14:00-15:00 EST): $150/hr | Auto-EventB-Midday (wins over EventC)
Hour  8 (15:00-16:00 EST): $  0/hr | Auto-EventB-Midday [GRACE]
Hour  9 (16:00-17:00 EST): $  0/hr | Auto-EventB-Midday [GRACE]
Hour 10 (17:00-18:00 EST): $200/hr | Auto-EventC-Afternoon
Hour 11 (18:00-19:00 EST): $  0/hr | Auto-EventC-Afternoon [GRACE]
Hour 12 (19:00-20:00 EST): $  0/hr | Auto-EventC-Afternoon [GRACE]

TOTAL: $700 for 12 hours (51% savings vs walk-in due to grace periods)
```

---

## Implications & Recommendations

### Current System Behavior
1. **No explicit conflict detection**: System doesn't warn when events overlap at same venue/sublocation
2. **Insertion order determines winner**: First created event takes precedence
3. **Rate value is ignored**: $100/hr event can override $200/hr event if created first
4. **No manual override**: All auto-generated event ratesheets have fixed priority 4900

### Recommendations for Managing Overlapping Events

If you need specific precedence for overlapping events:

**Option 1: Create Events in Priority Order**
- Create highest-priority events first
- They will automatically override later-created events during overlaps

**Option 2: Use Manual Event Ratesheets**
- Delete auto-generated ratesheets
- Manually create event ratesheets with custom priorities (4000-4899)
- Higher priority number = higher precedence
- Example: VIP event at 4850 > Standard event at 4800

**Option 3: Event Scheduling**
- Avoid overlapping events at the same venue/sublocation
- Use grace periods strategically to create buffers between events
- Consider splitting events across different venues

### When Insertion Order Works Well

The current system is ideal when:
- Events are booked chronologically (first-come, first-served)
- Earlier bookings should have priority over later ones
- You want to prevent last-minute high-value bookings from displacing existing events

---

## System Architecture Notes

### Priority Hierarchy
```
Level          Priority Range    Conflict Resolution
---------------------------------------------------
CUSTOMER       1000-1999         Lower precedence
LOCATION       2000-2999         ↑
SUBLOCATION    3000-3999         ↑
EVENT          4000-4999         Highest precedence
  ├─ Manual    4000-4899         (custom priorities)
  └─ Auto      4900              (fixed)
```

### Sorting Algorithm (price-engine-hourly.ts)
1. **Level Check**: EVENT (4) > SUBLOCATION (3) > LOCATION (2) > CUSTOMER (1)
2. **Priority Value Check**: Higher number wins within same level
3. **Insertion Order**: First matched ratesheet wins if priority is tied

### Grace Period Logic (price-engine-hourly.ts:252-256)
```typescript
if (context.isEventBooking === false && tw.pricePerHour === 0 && level === 'EVENT') {
  continue; // Skip $0/hr grace periods for walk-ins
}
```

---

## Reproducibility

### Running the Test Script

```bash
# Make script executable
chmod +x scripts/test-overlapping-events.sh

# Run the automated test
./scripts/test-overlapping-events.sh
```

The script will:
1. Fetch Venue-3 ObjectId automatically
2. Clean up conflicting events
3. Create all 3 test events with full hierarchy
4. Fetch auto-generated ratesheets
5. Run walk-in pricing calculation
6. Run event booking pricing calculation
7. Display formatted results with conflict analysis

### Manual Testing

```bash
# Fetch Venue-3
curl http://localhost:3031/api/venues | jq '.[] | select(.name == "Venue-3")'

# Create EventA
curl -X POST http://localhost:3031/api/events \
  -H "Content-Type: application/json" \
  -d '{"name":"EventA-Morning","venueId":"<VENUE_ID>","subLocationId":"<SUBLOC_ID>","locationId":"<LOC_ID>","customerId":"<CUST_ID>","startDate":"2026-01-28T14:00:00.000Z","endDate":"2026-01-28T16:00:00.000Z","gracePeriodBefore":60,"gracePeriodAfter":120,"defaultHourlyRate":100,"attendees":50,"timezone":"America/New_York","isActive":true}'

# (Repeat for EventB and EventC with different rates and times)

# Calculate walk-in pricing
curl -X POST http://localhost:3031/api/pricing/calculate-hourly \
  -H "Content-Type: application/json" \
  -d '{"subLocationId":"<SUBLOC_ID>","startTime":"2026-01-28T13:00:00.000Z","endTime":"2026-01-29T01:00:00.000Z","isEventBooking":false}'

# Calculate event booking pricing
curl -X POST http://localhost:3031/api/pricing/calculate-hourly \
  -H "Content-Type: application/json" \
  -d '{"subLocationId":"<SUBLOC_ID>","startTime":"2026-01-28T13:00:00.000Z","endTime":"2026-01-29T01:00:00.000Z","isEventBooking":true}'
```

---

## Critical Files

- [Event Creation API](src/app/api/events/route.ts) - POST handler, triggers ratesheet generation
- [Event Update API](src/app/api/events/[id]/route.ts) - PATCH handler, regenerates ratesheet
- [Auto-Ratesheet Generator](src/lib/event-ratesheet-utils.ts) - Core logic for time windows
- [Pricing Engine](src/lib/price-engine-hourly.ts) - Priority resolution & grace period handling
- [Event Repository](src/models/Event.ts) - CRUD operations
- [Priority Config API](src/app/api/pricing/priority-config/route.ts) - Priority hierarchy

---

## Conclusion

The venue management system handles overlapping events predictably using **insertion order** as the tiebreaker when priorities are equal. This behavior is consistent and reproducible, making it suitable for first-come-first-served booking scenarios. For use cases requiring explicit priority control, manual event ratesheets with custom priority values (4000-4899) should be used instead of auto-generated ratesheets.

The grace period mechanism effectively differentiates between walk-in bookings and event bookings, preventing exploitation while providing value to event organizers.
