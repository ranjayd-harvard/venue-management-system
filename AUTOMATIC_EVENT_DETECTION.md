# Automatic Event Detection - Implementation Summary

## Overview
The pricing system now automatically detects and applies event-specific pricing when a booking overlaps with any active event, ensuring that special event rates are always considered without requiring manual event selection.

## What Changed

### 1. Event Date Storage Fix
**Problem**: Events were storing dates as ISO strings instead of Date objects, causing MongoDB date comparison queries to fail.

**Solution**: Modified `EventRepository` in [src/models/Event.ts](src/models/Event.ts):
- `create()` method now converts `startDate` and `endDate` to Date objects before insertion
- `update()` method converts dates to Date objects when updating events
- Created migration script to convert existing events from strings to Date objects

**Migration**: Run `node scripts/migrate-event-dates.js` to convert existing events

### 2. Automatic Event Detection
**Location**: [src/app/api/pricing/calculate-hourly/route.ts](src/app/api/pricing/calculate-hourly/route.ts) (Lines 82-101)

**How it works**:
1. For each pricing calculation, the system queries for ALL active events that overlap with the booking period
2. Overlap logic: `event.endDate >= booking.startDate AND event.startDate <= booking.endDate`
3. Fetches ratesheets for all overlapping events automatically
4. Includes detected events in the response metadata for transparency

**Code**:
```typescript
// Find all active events that overlap with the booking time
const overlappingEvents = await db.collection('events').find({
  isActive: true,
  endDate: { $gte: bookingStartDate },
  startDate: { $lte: bookingEndDate }
}).toArray();

// Fetch ratesheets for all overlapping events
const eventRatesheets = overlappingEvents.length > 0
  ? await db.collection('ratesheets').find({
      eventId: { $in: overlappingEvents.map(e => e._id) },
      isActive: true
    }).toArray()
  : [];
```

### 3. Timeline View Automatic Detection
**Location**: [src/app/pricing/timeline-view/page.tsx](src/app/pricing/timeline-view/page.tsx) (Lines 319-410)

**How it works**:
1. When viewing a timeline, the system fetches all active events
2. Filters events to find those that overlap with the timeline date range
3. Automatically fetches ratesheets for ALL overlapping events (unless a specific event is manually selected)
4. Displays a visual indicator showing how many event ratesheets were auto-detected

**UI Features**:
- Event dropdown now shows "Auto-detect overlapping events" as default option
- Shows "✨ Auto: Detected X event ratesheet(s)" when automatic detection is active
- Shows "📅 Manual: Showing only this event" when a specific event is selected
- Event ratesheets appear in the timeline visualization with pink color coding (highest priority)

### 4. Enhanced Response Metadata
The pricing API response now includes:
- `overlappingEvents[]`: List of events detected that overlap with the booking
- `ratesheetSummary.event`: Count of event ratesheets applied

## Testing

### Test Scenarios

**Scenario 1: Partial Event Overlap**
- Booking: 3pm-6pm EST (Jan 16, 2026)
- Event: 5pm-9pm EST (Ranjay-EVent1)
- Event Ratesheet: $100/hr for 3pm-6pm EST
- Result:
  - 3pm-4pm: $20/hr (default rate)
  - 4pm-5pm: $100/hr (event ratesheet)
  - 5pm-6pm: $100/hr (event ratesheet)
  - Total: $220

**Scenario 2: Full Event Coverage**
- Booking: 5pm-8pm EST (Jan 16, 2026)
- Event: 5pm-9pm EST (Ranjay-EVent1)
- Event Ratesheet: $100/hr for 3pm-6pm EST
- Result:
  - 5pm-6pm: $100/hr (event ratesheet)
  - 6pm-7pm: $20/hr (outside ratesheet time window)
  - 7pm-8pm: $20/hr (outside ratesheet time window)
  - Total: $140

### Running Tests

```bash
# Test automatic event detection logic
MONGODB_URI="your_mongodb_uri" node scripts/test-event-detection.js

# Test pricing API
curl -X POST http://localhost:3031/api/pricing/calculate-hourly \
  -H "Content-Type: application/json" \
  -d '{
    "subLocationId": "69669dee7e6882578d3f93d9",
    "startTime": "2026-01-16T20:00:00.000Z",
    "endTime": "2026-01-16T23:00:00.000Z",
    "timezone": "America/New_York"
  }'
```

## Priority Hierarchy

The system maintains a 4-level priority hierarchy:

1. **CUSTOMER** (Priority 1000-1999) - Lowest priority
2. **LOCATION** (Priority 2000-2999)
3. **SUBLOCATION** (Priority 3000-3999)
4. **EVENT** (Priority 4000-4999) - **Highest priority**

When multiple ratesheets apply to the same hour, the one with the highest priority wins. Event-level ratesheets will always override customer, location, and sublocation rates.

## User Benefits

1. **No Manual Selection Required**: Users don't need to remember to select events when making bookings or viewing timelines
2. **Automatic Rate Application**: Event pricing is always applied when bookings fall during events
3. **Transparent Detection**: Both the pricing API and timeline view show which events were detected and applied
4. **Correct Pricing**: Ensures special event rates (higher or lower) are always considered
5. **Timeline View**: The timeline visualization automatically shows all event ratesheets that overlap with the selected date range

## Files Modified

1. `/src/models/Event.ts` - Fixed date storage
2. `/src/app/api/pricing/calculate-hourly/route.ts` - Added automatic event detection for pricing API
3. `/src/app/pricing/timeline-view/page.tsx` - Added automatic event detection for timeline view
4. `/scripts/migrate-event-dates.js` - Migration script for existing events
5. `/scripts/test-event-detection.js` - Test script for event detection logic

## Database Changes

Events in MongoDB now store dates as Date objects instead of ISO strings:

```javascript
// Before (string)
{
  "startDate": "2026-01-16T22:00:00.000Z",
  "endDate": "2026-01-17T02:00:00.000Z"
}

// After (Date object)
{
  "startDate": ISODate("2026-01-16T22:00:00.000Z"),
  "endDate": ISODate("2026-01-17T02:00:00.000Z")
}
```

This enables MongoDB's native date comparison operators to work correctly.

## Future Considerations

1. **Performance**: If the number of events grows large, consider adding indexes on `events.startDate`, `events.endDate`, and `events.isActive`
2. **Caching**: For frequently queried time periods, consider caching overlapping event lookups
3. **UI Indicator**: Consider showing an indicator in the UI when event pricing is automatically applied
