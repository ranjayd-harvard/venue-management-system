# Venue Ratecard: Hourly Breakdown Enhancement

**Date**: January 28, 2026
**Status**: ✅ Implemented
**Feature**: Added hourly rate breakdown visualization to Venue Ratecard page

---

## Overview

Enhanced the Venue Ratecard page (`/pricing/venue-ratecard`) to include hourly rate breakdown charts and statistics, similar to the SubLocation Digital Ratecard. This allows venue managers to see detailed hourly pricing when their venue is assigned to a sublocation.

---

## Problem Solved

### Initial State
The Venue Ratecard page showed:
- Venue selection dropdown
- Venue information card
- Time period filters (Today, 7 Days, 30 Days, All)
- List of upcoming events with total pricing

**Missing**: No hourly breakdown showing how rates vary throughout the day

### User Request
> "It would be nice to see the Hourly Rate Breakdown Chart and Hourly rates sections similar to digital-ratecard on venue-ratecard"

---

## Implementation Details

### 1. New State Variables (Lines 78-83)

```typescript
// Hourly breakdown for selected duration
const [selectedDuration, setSelectedDuration] = useState<number>(24);
const [hourlyBreakdown, setHourlyBreakdown] = useState<Array<{
  hour: Date;
  hourEnd: Date;
  rate: number;
  isPartial: boolean;
  ratesheet?: any
}>>([]);
const [hourlyBreakdownLoading, setHourlyBreakdownLoading] = useState(false);

// Venue's assigned sublocation (for pricing calculations)
const [assignedSubLocation, setAssignedSubLocation] = useState<string | null>(null);
```

**Purpose**:
- `selectedDuration`: Controls time window (12h, 24h, or 48h)
- `hourlyBreakdown`: Stores calculated rate for each hour
- `hourlyBreakdownLoading`: Loading state during calculations
- `assignedSubLocation`: Tracks which sublocation the venue is assigned to

---

### 2. Fetch Assigned SubLocation (Lines 211-232)

```typescript
const fetchAssignedSubLocation = async () => {
  if (!currentVenue) return;

  try {
    const response = await fetch('/api/sublocation-venues');
    const relationships = await response.json();

    // Find the relationship where this venue is assigned
    const assignment = relationships.find((rel: any) => rel.venueId === currentVenue._id);

    if (assignment) {
      setAssignedSubLocation(assignment.subLocationId);
      console.log(`[Venue Ratecard] Found venue assignment: ${currentVenue.name} → SubLocation ${assignment.subLocationId}`);
    } else {
      setAssignedSubLocation(null);
      console.log(`[Venue Ratecard] No sublocation assignment found for ${currentVenue.name}`);
    }
  } catch (error) {
    console.error('Failed to fetch sublocation assignment:', error);
    setAssignedSubLocation(null);
  }
};
```

**Key Points**:
- Queries `/api/sublocation-venues` to find venue→sublocation relationships
- Uses the dynamic resolution approach implemented in VENUE_ONLY_EVENTS_SOLUTION.md
- Sets `assignedSubLocation` state for use in pricing calculations
- Logs assignment status for debugging

**Integration**:
- Called in `useEffect` when `currentVenue` changes (Line 116)
- Enables hourly breakdown only if venue is assigned to a sublocation

---

### 3. Calculate Hourly Breakdown (Lines 234-289)

```typescript
const calculateHourlyBreakdown = async () => {
  if (!assignedSubLocation || !currentVenue) {
    setHourlyBreakdown([]);
    return;
  }

  setHourlyBreakdownLoading(true);
  const breakdown = [];

  try {
    for (let i = 0; i < selectedDuration; i++) {
      const hourStart = new Date(bookingStartTime.getTime() + i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      const response = await fetch('/api/pricing/calculate-hourly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subLocationId: assignedSubLocation,
          startTime: hourStart.toISOString(),
          endTime: hourEnd.toISOString(),
          isEventBooking: isEventBooking,
          timezone: 'America/New_York',
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const hourlySegment = result.segments?.[0];

        breakdown.push({
          hour: hourStart,
          hourEnd: hourEnd,
          rate: result.totalPrice || 0,
          isPartial: false,
          ratesheet: hourlySegment?.ratesheet,
        });
      } else {
        // If request fails, add a placeholder
        breakdown.push({
          hour: hourStart,
          hourEnd: hourEnd,
          rate: 0,
          isPartial: false,
        });
      }
    }

    setHourlyBreakdown(breakdown);
  } catch (error) {
    console.error('Failed to calculate hourly breakdown:', error);
    setHourlyBreakdown([]);
  } finally {
    setHourlyBreakdownLoading(false);
  }
};
```

**Key Points**:
- Only calculates if venue is assigned to a sublocation
- Makes sequential API calls to `/api/pricing/calculate-hourly` for each hour
- Respects `isEventBooking` toggle for grace period handling
- Captures ratesheet information for each hour
- Handles API failures gracefully with placeholder data

**Integration**:
- Called in `useEffect` when `assignedSubLocation`, `selectedDuration`, `bookingStartTime`, or `isEventBooking` changes (Line 122)
- Uses the same pricing API that includes venue-only event resolution

---

### 4. Hourly Breakdown UI (Lines 452-627)

#### Duration Selection Buttons
```typescript
<div className="flex gap-2">
  {[12, 24, 48].map((duration) => (
    <button
      key={duration}
      onClick={() => setSelectedDuration(duration)}
      className={`px-4 py-2 rounded-lg font-medium transition-all ${
        selectedDuration === duration
          ? 'bg-indigo-600 text-white shadow-md'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {duration}h
    </button>
  ))}
</div>
```

**Options**: 12h, 24h, 48h time windows

---

#### SVG Bar Chart (Lines 486-534)
```typescript
<svg width="100%" height="200" className="border rounded-lg">
  {(() => {
    const maxRate = Math.max(...hourlyBreakdown.map(h => h.rate), 1);
    const width = 100 / hourlyBreakdown.length;
    const padding = 20;
    const chartHeight = 200 - padding * 2;

    return hourlyBreakdown.map((hour, index) => {
      const barHeight = (hour.rate / maxRate) * chartHeight;
      const x = index * width;
      const y = 200 - padding - barHeight;

      return (
        <g key={index}>
          {/* Bar */}
          <rect
            x={`${x}%`}
            y={y}
            width={`${width * 0.8}%`}
            height={barHeight}
            fill="url(#gradient)"
            className="transition-all hover:opacity-80"
          />
          {/* Rate Label */}
          <text
            x={`${x + width / 2}%`}
            y={y - 5}
            textAnchor="middle"
            className="text-xs fill-gray-700 font-semibold"
          >
            ${hour.rate}
          </text>
        </g>
      );
    });
  })()}
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#6366f1" />
      <stop offset="100%" stopColor="#a855f7" />
    </linearGradient>
  </defs>
</svg>
```

**Features**:
- Auto-scales bars based on max rate
- Gradient fill (indigo → purple)
- Rate labels above each bar
- Responsive width based on number of hours

---

#### Statistics Cards (Lines 537-556)
```typescript
<div className="grid grid-cols-3 gap-4 mb-6">
  {/* Min Rate - Green */}
  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
    <div className="text-sm text-green-700 font-semibold mb-1">Min Rate</div>
    <div className="text-2xl font-bold text-green-800">
      ${Math.min(...hourlyBreakdown.map(h => h.rate)).toFixed(2)}
    </div>
  </div>

  {/* Avg Rate - Blue */}
  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200">
    <div className="text-sm text-blue-700 font-semibold mb-1">Avg Rate</div>
    <div className="text-2xl font-bold text-blue-800">
      ${(hourlyBreakdown.reduce((sum, h) => sum + h.rate, 0) / hourlyBreakdown.length).toFixed(2)}
    </div>
  </div>

  {/* Max Rate - Purple */}
  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border-2 border-purple-200">
    <div className="text-sm text-purple-700 font-semibold mb-1">Max Rate</div>
    <div className="text-2xl font-bold text-purple-800">
      ${Math.max(...hourlyBreakdown.map(h => h.rate)).toFixed(2)}
    </div>
  </div>
</div>
```

**Shows**:
- **Min Rate**: Lowest hourly rate in the selected period
- **Avg Rate**: Average of all hourly rates
- **Max Rate**: Highest hourly rate in the selected period

---

#### Hourly Details List (Lines 559-591)
```typescript
<div className="max-h-96 overflow-y-auto space-y-2">
  {hourlyBreakdown.map((hour, index) => (
    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        {/* Hour Number Badge */}
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
          {index + 1}
        </div>
        <div>
          {/* Time Range */}
          <div className="font-medium text-gray-800">
            {hour.hour.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
            {hour.hourEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          {/* Ratesheet Name */}
          {hour.ratesheet && (
            <div className="text-xs text-gray-500 mt-1">
              {hour.ratesheet.name || 'Default Rate'}
            </div>
          )}
        </div>
      </div>
      {/* Rate */}
      <div className="text-right">
        <div className="text-lg font-bold text-indigo-600">
          ${hour.rate.toFixed(2)}/hr
        </div>
      </div>
    </div>
  ))}
</div>
```

**Features**:
- Scrollable list (max height 96 = 384px)
- Hour number badge with gradient
- Time range (e.g., "09:00 AM - 10:00 AM")
- Ratesheet name (if applicable)
- Hourly rate in indigo

---

### 5. Warning Banner for Unassigned Venues (Lines 609-627)

```typescript
{!assignedSubLocation && currentVenue && (
  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-6">
    <div className="flex items-start gap-3">
      <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
      <div className="text-sm text-yellow-800">
        <p className="font-semibold mb-1">Hourly Breakdown Unavailable</p>
        <p>
          This venue is not currently assigned to any sublocation. To view hourly rate
          breakdowns and detailed pricing calculations, please assign{' '}
          <strong>{currentVenue.name}</strong> to a sublocation via the{' '}
          <a href="/relationships" className="underline font-semibold">
            Relationships
          </a>{' '}
          page.
        </p>
      </div>
    </div>
  </div>
)}
```

**Purpose**:
- Shows when `assignedSubLocation` is `null`
- Explains why hourly breakdown is unavailable
- Provides actionable link to `/relationships` page to assign the venue

---

## How It Works

### Workflow

1. **User selects a venue** from dropdown
2. **System fetches venue details** (`fetchVenueDetails`)
3. **System checks for sublocation assignment** (`fetchAssignedSubLocation`)
   - Queries `/api/sublocation-venues` for relationships
   - If found: Sets `assignedSubLocation` state
   - If not found: Shows warning banner
4. **If assigned, system calculates hourly breakdown** (`calculateHourlyBreakdown`)
   - Makes hourly API calls to `/api/pricing/calculate-hourly`
   - Stores rate and ratesheet info for each hour
5. **System renders UI**:
   - **With assignment**: Shows chart, statistics, and hourly details
   - **Without assignment**: Shows warning banner with link to relationships page

---

## Integration with Dynamic Venue Resolution

This feature leverages the dynamic venue→sublocation resolution implemented in `VENUE_ONLY_EVENTS_SOLUTION.md`:

### Backend Support (Already Implemented)

**`/api/pricing/calculate-hourly/route.ts` (Lines 173-230)**
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

// Step 2: Build query to include venue-only events
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

**Result**: When calculating hourly rates, the API automatically includes:
- Events directly linked to the sublocation
- Venue-only events where the venue is assigned to that sublocation

---

## User Experience

### Scenario 1: Venue Assigned to SubLocation

1. User navigates to `/pricing/venue-ratecard`
2. Selects "Venue-3 (Meeting Room)"
3. System finds Venue-3 is assigned to SubLocation-5
4. **Hourly Breakdown Section Appears**:
   - Duration buttons: 12h | **24h** | 48h (24h selected)
   - SVG bar chart showing rates for next 24 hours
   - Statistics: Min ($50), Avg ($125), Max ($200)
   - Scrollable hourly details list with 24 entries
5. User clicks "48h" button
6. Chart and list update to show 48 hours of data

### Scenario 2: Venue Not Assigned

1. User navigates to `/pricing/venue-ratecard`
2. Selects "Venue-7 (Conference Room)"
3. System finds Venue-7 is NOT assigned to any sublocation
4. **Warning Banner Appears**:
   - Yellow alert icon
   - "Hourly Breakdown Unavailable"
   - Explanation with link to `/relationships` page
5. User clicks "Relationships" link
6. Navigates to `/relationships` page to assign Venue-7

---

## Comparison: Venue Ratecard vs SubLocation Ratecard

| Feature | Venue Ratecard | SubLocation Ratecard |
|---------|----------------|----------------------|
| **Primary View** | Venue-centric | SubLocation-centric |
| **Event List** | All venue events | Sublocation events + venue-only events |
| **Hourly Breakdown** | ✅ (if venue assigned) | ✅ (always available) |
| **Duration Options** | 12h, 24h, 48h | 12h, 24h, 48h |
| **Statistics** | Min, Avg, Max | Min, Avg, Max |
| **Chart Type** | SVG bar chart | SVG bar chart |
| **Pricing Source** | Assigned sublocation's rates | Direct sublocation rates |
| **Use Case** | Venue manager view | Customer booking view |

---

## Technical Details

### File Modified
- **`src/app/pricing/venue-ratecard/page.tsx`**
  - Added state variables (Lines 78-83)
  - Added `fetchAssignedSubLocation` function (Lines 211-232)
  - Added `calculateHourlyBreakdown` function (Lines 234-289)
  - Added UI sections (Lines 452-627)

### Dependencies
- **Lucide React Icons**: `Clock`, `RefreshCw`, `AlertCircle`
- **API Endpoints**:
  - `GET /api/sublocation-venues` - Fetch venue assignments
  - `POST /api/pricing/calculate-hourly` - Calculate hourly rates
- **External References**:
  - `VENUE_ONLY_EVENTS_SOLUTION.md` - Dynamic resolution architecture
  - `src/app/pricing/digital-ratecard/page.tsx` - UI pattern reference

---

## Testing

### Test Case 1: View Hourly Breakdown for Assigned Venue

**Setup**:
1. Venue-3 is assigned to SubLocation-5 via `/relationships`
2. Multiple events exist for Venue-3 (EventA, EventB, EventC)

**Steps**:
1. Navigate to `/pricing/venue-ratecard`
2. Select "Venue-3 (Meeting Room)"
3. Wait for hourly breakdown to load

**Expected Result**:
- ✅ Hourly Breakdown section appears
- ✅ Chart shows 24 bars (default duration)
- ✅ Statistics show Min/Avg/Max rates
- ✅ Hourly details list shows 24 entries with time ranges
- ✅ Rates reflect overlapping event pricing (EventA $100, EventB $150, EventC $200)

---

### Test Case 2: Change Duration

**Setup**: Venue-3 selected with hourly breakdown visible

**Steps**:
1. Click "48h" button
2. Wait for recalculation

**Expected Result**:
- ✅ Loading spinner appears briefly
- ✅ Chart updates to show 48 bars
- ✅ Hourly details list shows 48 entries
- ✅ Statistics recalculate based on 48-hour data

---

### Test Case 3: Unassigned Venue

**Setup**: Venue-7 is NOT assigned to any sublocation

**Steps**:
1. Navigate to `/pricing/venue-ratecard`
2. Select "Venue-7 (Conference Room)"

**Expected Result**:
- ✅ Warning banner appears: "Hourly Breakdown Unavailable"
- ✅ Link to `/relationships` page is visible
- ❌ Hourly Breakdown section does NOT appear

---

### Test Case 4: Event Booking Toggle

**Setup**: Venue-3 selected with EventA having grace periods

**Steps**:
1. Note current hourly rates
2. Toggle "Event Booking" switch ON
3. Wait for recalculation

**Expected Result**:
- ✅ Hours during grace periods change from $0/hr to actual event rates
- ✅ Chart and statistics update accordingly
- ✅ Total pricing reflects grace period inclusion

---

## Design Philosophy

### 1. Consistency
- Matches SubLocation Digital Ratecard UI patterns
- Same gradient colors (indigo → purple)
- Same duration options (12h, 24h, 48h)
- Same statistics layout (Min, Avg, Max)

### 2. Conditional Rendering
- Only shows hourly breakdown if venue is assigned
- Provides helpful guidance when unavailable
- Links to actionable pages (relationships)

### 3. Performance
- Sequential API calls for accuracy (not parallel to avoid rate limits)
- Loading states during calculations
- Graceful error handling with placeholders

### 4. User Guidance
- Clear warning messages
- Contextual links to resolve issues
- Console logging for debugging

---

## Future Enhancements

### 1. Parallel API Requests
**Current**: Sequential hourly API calls (slow for 48h)
**Improvement**: Batch requests or single API call for multiple hours
```typescript
// Instead of 48 individual calls:
for (let i = 0; i < 48; i++) { await fetch(...) }

// Batch request:
const response = await fetch('/api/pricing/calculate-hourly-batch', {
  body: JSON.stringify({
    subLocationId: assignedSubLocation,
    startTime: bookingStartTime,
    duration: 48
  })
});
```

### 2. Caching
**Current**: Recalculates on every duration change
**Improvement**: Cache hourly rates, only fetch missing hours
```typescript
const cachedRates = new Map<string, HourlyRate>();
// Check cache before API call
if (!cachedRates.has(hourKey)) {
  // Fetch from API
}
```

### 3. Real-time Updates
**Current**: Static data until user refreshes or changes duration
**Improvement**: WebSocket updates when events/ratesheets change
```typescript
useEffect(() => {
  const ws = new WebSocket('wss://...');
  ws.onmessage = (event) => {
    if (event.data.type === 'RATESHEET_UPDATE') {
      recalculateHourlyBreakdown();
    }
  };
}, []);
```

### 4. Export Functionality
**Current**: View-only
**Improvement**: Export hourly breakdown to CSV/PDF
```typescript
const exportToCSV = () => {
  const csv = hourlyBreakdown.map(h =>
    `${h.hour},${h.rate},${h.ratesheet?.name}`
  ).join('\n');
  downloadFile('hourly-rates.csv', csv);
};
```

### 5. Historical Data
**Current**: Only shows future rates
**Improvement**: Show historical hourly rates for analysis
```typescript
const [historicalMode, setHistoricalMode] = useState(false);
// Allow users to select past date ranges
```

---

## Summary

✅ **Implemented**: Hourly rate breakdown visualization for Venue Ratecard page
✅ **Features**: SVG chart, statistics cards, hourly details list, duration selection
✅ **Integration**: Uses dynamic venue→sublocation resolution from existing backend
✅ **UX**: Clear warning when venue not assigned, actionable links
✅ **Consistency**: Matches SubLocation Digital Ratecard patterns

**Key Benefit**: Venue managers can now see detailed hourly pricing for their assigned venues, making it easier to understand rate fluctuations throughout the day caused by overlapping events and time-based ratesheets.

---

## Related Documentation

- `VENUE_RATECARD_PAGE.md` - Original Venue Ratecard implementation
- `VENUE_ONLY_EVENTS_SOLUTION.md` - Dynamic venue→sublocation resolution
- `src/app/pricing/digital-ratecard/page.tsx` - Reference implementation for UI patterns
- `src/app/api/pricing/calculate-hourly/route.ts` - Pricing API with venue resolution
