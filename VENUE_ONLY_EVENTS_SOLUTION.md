# Venue-Only Events: Dynamic SubLocation Resolution

**Date**: January 28, 2026
**Status**: ✅ Implemented

---

## Problem Statement

Events created with only a `venueId` (no `subLocationId`) were not appearing in:
- Digital Ratecard view (`/pricing/digital-ratecard`)
- Pricing calculations (`/api/pricing/calculate-hourly`)
- Conflict detection (`/api/events/conflicts`)

These UI components require a sublocation to be selected, but venue-only events had no sublocation linkage.

### Initial Options Considered:

1. ❌ **Hardcode sublocation on events**: Would create orphaned events when venues move between sublocations
2. ❌ **Create default sublocations**: Still requires manual maintenance when relationships change
3. ✅ **Dynamic resolution via relationships**: Use existing `sublocation_venues` collection to resolve venue→sublocation at query time

---

## Solution: Dynamic Venue→SubLocation Resolution

### Architecture

Events can now be associated at multiple levels:
1. **Customer-level**: Event has `customerId`, no location/sublocation
2. **Location-level**: Event has `locationId`, no sublocation
3. **SubLocation-level**: Event has `subLocationId` (direct link)
4. **Venue-level**: Event has `venueId` only, dynamically resolved via `sublocation_venues`

### Key Concept

When a venue is assigned to a sublocation via the `/relationships` page:
- A relationship is created in the `sublocation_venues` collection
- Pricing and conflict APIs dynamically look up this relationship
- All venue-only events automatically "follow" the venue to its current sublocation

**Benefits:**
- ✅ When you reassign a venue to a different sublocation, all venue events automatically follow
- ✅ No orphaned events
- ✅ Single source of truth (the `sublocation_venues` collection)
- ✅ Events remain truly venue-scoped

---

## Implementation Details

### Modified Files

**1. `/api/pricing/calculate-hourly/route.ts`** (Lines 166-233)

Added dynamic venue resolution:

```typescript
// Step 1: Find venues assigned to this sublocation
const sublocationVenueRelationships = await db.collection('sublocation_venues').find({
  $or: [
    { subLocationId: sublocation._id.toString() },
    { subLocationId: new ObjectId(sublocation._id) }
  ]
}).toArray();

const assignedVenueIds = sublocationVenueRelationships.map(rel => {
  const venueId = rel.venueId;
  return typeof venueId === 'string' ? venueId : venueId.toString();
});

// Step 2: Include venue-only events in the query
if (assignedVenueIds.length > 0) {
  eventQuery.$or.push({
    $and: [
      { $or: venueIdConditions },
      { subLocationId: { $in: [null, undefined] } },
      { locationId: { $in: [null, undefined] } },
      { customerId: { $in: [null, undefined] } }
    ]
  });
}
```

**2. `/api/events/conflicts/route.ts`** (Lines 91-139)

Added the same dynamic venue resolution for conflict detection.

---

## How It Works

### Example Flow

1. **Event Creation**: User creates "event7" with only `venueId: "Venue-3"`, no sublocation
2. **Venue Assignment**: User assigns Venue-3 to SubLocation-5 via `/relationships`
3. **Pricing Query**: User selects SubLocation-5 in digital ratecard
4. **Dynamic Resolution**:
   - API queries `sublocation_venues` for venues assigned to SubLocation-5
   - Finds Venue-3 is assigned
   - Includes event7 in overlapping events query
   - Generates ratesheet for event7 and includes it in pricing

### Database Query Logic

**Before Enhancement:**
```typescript
// Only found events with direct sublocation link
{ subLocationId: sublocation._id }
```

**After Enhancement:**
```typescript
{
  $or: [
    // Direct sublocation events
    { subLocationId: sublocation._id },

    // Venue-only events (if venue assigned to this sublocation)
    {
      $and: [
        { venueId: { $in: assignedVenueIds } },
        { subLocationId: { $in: [null, undefined] } }
      ]
    }
  ]
}
```

---

## Testing

### Test Case: Venue-Only Event in Digital Ratecard

**Setup:**
1. Event: `event7` (Jan 29, 6am-9am EST, $50/hr, venueId only)
2. Venue: Venue-3 assigned to SubLocation-5
3. Query: Pricing for SubLocation-5, Jan 29, 6am-12pm

**Result:**
```
Overlapping Events: event7
Hour  1 (11:00 UTC): $ 50/hr | Auto-event7
Hour  2 (12:00 UTC): $ 50/hr | Auto-event7
Hour  3 (13:00 UTC): $ 50/hr | Auto-event7
Hour  4 (14:00 UTC): $  0/hr | Auto-event7 [GRACE]
Hour  5 (15:00 UTC): $100/hr | DEFAULT_RATE
Hour  6 (16:00 UTC): $100/hr | DEFAULT_RATE

Total: $350.00 for 6 hours
```

✅ **Success**: event7 appeared in pricing even though it has no `subLocationId`

### Test Case: Conflict Detection

**Query:** `/api/events/conflicts?subLocationId=SubLocation-5&startDate=...&endDate=...`

**Result:**
```json
{
  "totalEvents": 1,
  "conflictHours": 0,
  "eventsFound": ["event7"]
}
```

✅ **Success**: event7 detected in conflict check

---

## Workflow: Moving Venues Between Sublocations

### Scenario: Venue-3 moves from SubLocation-5 to SubLocation-6

1. **User Action**: In `/relationships` page, drag Venue-3 from SubLocation-5 to SubLocation-6
2. **System Action**:
   - Deletes relationship: `sublocation_venues` where `subLocationId=SubLocation-5` and `venueId=Venue-3`
   - Creates relationship: `sublocation_venues` where `subLocationId=SubLocation-6` and `venueId=Venue-3`
3. **Result**:
   - Pricing for SubLocation-5: event7 **disappears** (no longer assigned)
   - Pricing for SubLocation-6: event7 **appears** (now assigned)
   - **No event updates required!** The event itself (`event7`) is unchanged

---

## Benefits Over Alternative Approaches

### ❌ Hardcoding SubLocationId on Events

**Problem:**
```typescript
// When venue moves, this becomes orphaned
event = {
  venueId: "Venue-3",
  subLocationId: "SubLocation-5"  // Hardcoded!
}
```

**Issue**: If Venue-3 moves to SubLocation-6, event7 still points to SubLocation-5

### ✅ Dynamic Resolution (Current Solution)

```typescript
// Event remains venue-scoped
event = {
  venueId: "Venue-3",
  subLocationId: null  // No hardcoded link!
}

// At query time, resolve via relationships
sublocation_venues = {
  venueId: "Venue-3",
  subLocationId: "SubLocation-6"  // Current assignment
}
```

**Benefit**: If Venue-3 moves to SubLocation-6, event7 automatically follows

---

## Future Enhancements

### 1. Venue-Level Digital Ratecard (Optional)

Create a dedicated view for venue-level events:
- URL: `/pricing/digital-ratecard?venueId={id}`
- Shows all events for a specific venue across all sublocations
- Useful for venue managers who don't care about sublocation assignments

### 2. Multi-SubLocation Venues

If a venue can be assigned to multiple sublocations simultaneously:
- Modify relationship model to support many-to-many
- Event appears in all assigned sublocations
- Useful for shared spaces or flexible room configurations

### 3. Temporal Venue Assignments

Track venue assignment changes over time:
- Add `effectiveFrom` and `effectiveTo` to `sublocation_venues`
- Historical pricing queries use appropriate assignment for that date
- Useful for seasonal or rotating venue assignments

---

## Summary

✅ **Problem Solved**: Venue-only events now appear in pricing and conflict detection
✅ **Architecture**: Events remain venue-scoped; sublocation resolved dynamically via relationships
✅ **Maintenance**: When venues move between sublocations, events automatically follow
✅ **Zero Breaking Changes**: Existing sublocation-linked events continue to work as before

**Key Insight**: By using the existing `sublocation_venues` collection as the source of truth, we avoided data duplication and maintained referential integrity when venue assignments change.
