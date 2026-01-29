# Venue-Level Digital Ratecard

**Date**: January 28, 2026
**Status**: ✅ Implemented
**URL**: `/pricing/venue-ratecard`

---

## Overview

A dedicated digital ratecard view for venue managers who want to see all events and pricing for a specific venue, regardless of sublocation assignments.

### Key Features

1. **Venue Selection**: Dropdown to select any venue in the system
2. **Event List**: Shows all upcoming events for the selected venue
3. **Time Period Filters**: Today, Next 7 Days, Next 30 Days, All Future Events
4. **Event Details**: Start/end times, grace periods, hourly rates, total pricing
5. **Venue Information**: Displays venue type, capacity, and description

---

## Why This Page?

### Problem Solved

Before this page existed:
- Venue managers had to select a sublocation to view pricing
- Venue-only events were invisible until sublocations were assigned
- No way to see all events for a venue across multiple sublocations

### Use Cases

1. **Venue Managers**: See all bookings for their venue without worrying about sublocation assignments
2. **Event Coordinators**: Quick view of all venue events in a time period
3. **Pre-Assignment View**: See venue-only events before they're assigned to sublocations
4. **Multi-Sublocation Venues**: See all events across different sublocation assignments

---

## How It Works

### Event Filtering Logic

The page fetches all events where:
```typescript
event.venueId === selectedVenueId
```

This includes:
- **Venue-only events**: Events with only `venueId` (no sublocation)
- **Sublocation events**: Events linked to both venue and sublocation
- **All assignment types**: Regardless of hierarchy level

### Time Period Filtering

```typescript
timePeriod options:
- 'today': Events today only
- 'week': Events in next 7 days
- 'month': Events in next 30 days
- 'all': All future events (up to 1 year)
```

---

## UI Components

### 1. Venue Selection
```tsx
<select>
  <option>Venue-1 (Ballroom) - Capacity: 75</option>
  <option>Venue-3 (Meeting Room) - Capacity: 125</option>
  ...
</select>
```

### 2. Venue Info Card
Displays after venue selection:
- Venue name (large heading)
- Venue type (e.g., Ballroom, Meeting Room)
- Capacity
- Description

### 3. Info Banner
Explains that this is a venue-level view and links to the SubLocation Digital Ratecard for detailed pricing calculations.

### 4. Time Period Toggle
Four buttons to switch between time periods:
- **Today**: Shows events happening today
- **7 Days**: Shows events in next week
- **30 Days**: Shows events in next month
- **All**: Shows all future events

### 5. Events List
Collapsible section showing:
- Event name and description
- Start and end date/time
- Grace period before/after
- Hourly rate
- Total event price (calculated including grace periods)

Each event card shows:
```
┌─────────────────────────────────────────────────┐
│ EventA-Morning                          $100/hr │
│ Morning event to test overlapping ratesheets    │
│                                                  │
│ 🕐 Jan 28, 09:00 AM  →  Jan 28, 11:00 AM       │
│ ⏱️ Grace Before: 60 min                         │
│ ⏱️ Grace After: 120 min                         │
│                                 Total: $200.00   │
└─────────────────────────────────────────────────┘
```

---

## Example Usage

### Scenario: Viewing Venue-3 Events

1. **User Action**: Navigate to `/pricing/venue-ratecard`
2. **Select Venue**: Choose "Venue-3 (Meeting Room)"
3. **View Loads**:
   - Venue info card shows: "Venue-3, Meeting Room, Capacity: 125"
   - Time period defaults to "Next 7 Days"
4. **Events Appear**:
   - EventA-Morning: Jan 28, 9am-11am @ $100/hr
   - EventB-Midday: Jan 28, 10am-3pm @ $150/hr
   - event7: Jan 29, 6am-9am @ $50/hr
5. **Filter**: Click "Today" to see only today's events
6. **Result**: Shows EventA and EventB, hides event7 (tomorrow)

---

## Comparison: Venue Ratecard vs SubLocation Ratecard

| Feature | Venue Ratecard | SubLocation Ratecard |
|---------|----------------|---------------------|
| **Selection** | Select a venue | Select sublocation |
| **Events Shown** | All venue events | Only sublocation events |
| **Pricing Calculation** | Event-based only | Full pricing engine with ratesheets |
| **Duration Cards** | Not available | Shows 1hr, 2hr, 4hr, etc. cards |
| **Hourly Breakdown** | Not available | Shows hour-by-hour pricing |
| **Grace Periods** | Shown in event details | Applied in pricing calculation |
| **Use Case** | Venue manager view | Customer booking view |

---

## Implementation Details

### File Created

**`src/app/pricing/venue-ratecard/page.tsx`**
- React component using Next.js App Router
- Client-side component (`'use client'`)
- Uses Lucide icons for UI
- Responsive design with Tailwind CSS

### Navigation Integration

**Modified**: `src/components/NavigationLayout.tsx`

Added to `pricingSubItems`:
```typescript
{
  href: '/pricing/venue-ratecard',
  icon: Users,
  label: 'Venue Ratecard',
  description: 'Venue-specific pricing view'
}
```

---

## Technical Architecture

### State Management

```typescript
// Venue state
const [selectedVenue, setSelectedVenue] = useState<string>('');
const [currentVenue, setCurrentVenue] = useState<Venue | null>(null);
const [venues, setVenues] = useState<Venue[]>([]);

// Events state
const [activeEvents, setActiveEvents] = useState<Event[]>([]);
const [eventPrices, setEventPrices] = useState<Map<string, number>>(new Map());

// Filter state
const [timePeriod, setTimePeriod] = useState<'all' | 'today' | 'week' | 'month'>('week');
const [eventsCollapsed, setEventsCollapsed] = useState<boolean>(true);
```

### Data Flow

1. **Venue Selection** → Fetch venue details
2. **Venue Loaded** → Fetch all events for venue
3. **Events Loaded** → Filter by time period
4. **Filtered Events** → Calculate pricing for each event
5. **Display** → Render event cards with pricing

### Event Pricing Calculation

```typescript
const calculateEventPricing = async (events: Event[]) => {
  for (const event of events) {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);

    // Event hours only (grace periods are $0)
    const eventHours = (eventEnd - eventStart) / (1000 * 60 * 60);
    const totalPrice = eventHours * (event.defaultHourlyRate || 0);

    prices.set(event._id, totalPrice);
  }
};
```

---

## Future Enhancements

### 1. Venue Pricing Calculator
Add a mini pricing calculator that allows:
- Select date range
- Calculate total price for venue booking
- Show breakdown by event

### 2. Venue Availability
Show which time slots are available vs booked:
```
Jan 28, 2026:
  8am-9am: ✅ Available
  9am-11am: ❌ Booked (EventA)
  11am-2pm: ✅ Available
  2pm-6pm: ❌ Booked (EventC)
```

### 3. Multi-SubLocation Events
If a venue is assigned to multiple sublocations:
- Show which sublocation each event belongs to
- Color-code by sublocation
- Filter by sublocation

### 4. Export/Print
Add buttons to:
- Export events to CSV
- Print venue schedule
- Generate PDF report

### 5. Conflict Detection
Highlight overlapping events:
```
⚠️ Conflict Detected:
  EventA (9am-11am) overlaps with EventB (10am-3pm)
  Resolution needed for 10am-11am slot
```

---

## Testing

### Test Case 1: View Venue with Events

**Steps:**
1. Navigate to `/pricing/venue-ratecard`
2. Select "Venue-3 (Meeting Room)"
3. Verify venue info displays correctly
4. Verify events list shows all Venue-3 events

**Expected Result:**
- EventA-Morning appears
- EventB-Midday appears
- event7 appears (even though it has no sublocation)

### Test Case 2: Time Period Filter

**Steps:**
1. Select Venue-3
2. Click "Today" button
3. Verify only today's events show
4. Click "7 Days" button
5. Verify events in next week show

**Expected Result:**
- "Today" shows EventA, EventB (Jan 28)
- "7 Days" adds event7 (Jan 29)

### Test Case 3: Empty State

**Steps:**
1. Select a venue with no events
2. Verify empty state displays

**Expected Result:**
```
📅
No events found in this time period
Events for this venue will appear here
```

---

## Design Philosophy

### Simplicity
- One venue selection at a time
- Clear event cards with all relevant info
- No complex pricing calculations (that's for SubLocation Ratecard)

### Venue-Centric
- Everything is scoped to the selected venue
- Shows all events regardless of sublocation
- Perfect for venue managers

### Complementary
- Doesn't replace SubLocation Ratecard
- Serves a different use case (venue management vs. customer pricing)
- Links to SubLocation Ratecard for detailed pricing

---

## Summary

✅ **Created**: Venue-Level Digital Ratecard at `/pricing/venue-ratecard`
✅ **Features**: Venue selection, event list, time filters, pricing display
✅ **Navigation**: Added to Pricing submenu in sidebar
✅ **Use Case**: Venue managers can see all events for their venue
✅ **Integration**: Works seamlessly with existing venue-only events

**Key Benefit**: Venue managers now have a dedicated view to manage their venue's schedule without needing to understand sublocation assignments or pricing hierarchies.
