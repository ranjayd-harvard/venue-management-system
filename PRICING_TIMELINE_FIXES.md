# Pricing Timeline Simulator - Critical Fixes

**Date:** February 3, 2026
**File:** `src/app/pricing/timeline-simulator/page.tsx`
**Status:** ✅ Resolved

## Overview

This document captures critical fixes applied to the Pricing Timeline Simulator's hourly rate breakdown chart. These fixes resolve rendering issues that caused inconsistent line display and timeline positioning bugs.

---

## Issues Resolved

### 1. Timeline Positioning Bug on Initial Load

**Problem:**
On initial page load, the timeline range selector extended beyond the left boundary of the container, causing visual misalignment.

**Root Cause:**
Multiple `useState` hooks were calling `new Date()` independently, creating millisecond timing drift between `rangeStart`, `rangeEnd`, `viewStart`, `viewEnd`, and `bookingStartTime`.

**Solution:**
Lines 136-160: Synchronized all date initialization from a single `now` reference:

```typescript
// Initialize all dates from the same timestamp to prevent timing drift
const [initialDates] = useState(() => {
  const now = new Date();
  return {
    rangeStart: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    rangeEnd: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    viewStart: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    viewEnd: new Date(now.getTime() + 6 * 60 * 60 * 1000)
  };
});

const [rangeStart, setRangeStart] = useState<Date>(initialDates.rangeStart);
const [rangeEnd, setRangeEnd] = useState<Date>(initialDates.rangeEnd);
const [viewStart, setViewStart] = useState<Date>(initialDates.viewStart);
const [viewEnd, setViewEnd] = useState<Date>(initialDates.viewEnd);
const [bookingStartTime, setBookingStartTime] = useState<Date>(initialDates.viewStart);
```

---

### 2. Missing Line on Flat Prices

**Problem:**
When all hourly rates were identical (flat line), the connecting line between dots was invisible or missing entirely, while varying prices displayed correctly.

**Root Cause - Part A: Invalid minPrice Calculation**
Line 2716: When all prices were 0, `Math.min(...prices.filter(p => p > 0))` returned `Infinity`, cascading into `NaN` coordinates.

**Solution A:**
Lines 2714-2717: Added safe minPrice calculation:

```typescript
const prices = timeSlots.map(s => s.winningPrice || 0);
const maxPrice = Math.max(...prices);
const validPrices = prices.filter(p => p > 0);
const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : maxPrice;
const range = maxPrice - minPrice || 1;
```

**Root Cause - Part B: Y-Axis Range Edge Cases**
When `range < 1`, edge cases could produce invalid `yAxisRange` values.

**Solution B:**
Lines 2749-2753: Added safety check:

```typescript
// Safety check: ensure yAxisRange is always at least 1 to prevent division by zero
if (!isFinite(yAxisRange) || yAxisRange < 0.1) {
  yAxisRange = 1;
  yAxisMax = maxPrice + 0.5;
  yAxisMin = maxPrice - 0.5;
}
```

**Root Cause - Part C: Gradient Coordinate System**
The gradient used default `objectBoundingBox` coordinates, which caused issues for flat horizontal lines with narrow bounding boxes.

**Solution C:**
Lines 2697-2701: Changed gradient to use absolute coordinates:

```typescript
<linearGradient id="lineGradient" x1="0" y1="0" x2="1000" y2="0" gradientUnits="userSpaceOnUse">
  <stop offset="0%" stopColor="#3b82f6" />
  <stop offset="50%" stopColor="#8b5cf6" />
  <stop offset="100%" stopColor="#ec4899" />
</linearGradient>
```

**Root Cause - Part D: No Fallback Stroke Color**
When gradient URL reference failed, polylines had no fallback color, rendering invisible lines.

**Solution D:**
Lines 2806-2829: Added three-layer rendering with solid fallback:

```typescript
{/* Fallback solid color base - ensures line always visible */}
<polyline
  points={pointsStr}
  fill="none"
  stroke="#8b5cf6"
  strokeWidth="3"
  strokeLinecap="round"
  strokeLinejoin="round"
/>

{/* Glow effect with gradient */}
<polyline
  points={pointsStr}
  fill="none"
  stroke="url(#lineGradient)"
  strokeWidth="6"
  strokeLinecap="round"
  strokeLinejoin="round"
  opacity="0.2"
  filter="blur(4px)"
/>

{/* Main line with gradient overlay */}
<polyline
  points={pointsStr}
  fill="none"
  stroke="url(#lineGradient)"
  strokeWidth="3"
  strokeLinecap="round"
  strokeLinejoin="round"
/>
```

---

## Technical Details

### SVG Gradient Coordinate Systems

**objectBoundingBox (default):**
- Coordinates are percentages relative to the shape's bounding box
- For horizontal lines with narrow bounding boxes, this can fail
- Example: `x1="0%" x2="100%"`

**userSpaceOnUse (our fix):**
- Coordinates are absolute within the SVG viewport
- Consistent rendering regardless of shape geometry
- Example: `x1="0" x2="1000"` (matches SVG viewBox width)

### Why This Matters

The chart uses a 1000px wide SVG viewBox. By setting the gradient to span from `x1="0"` to `x2="1000"` with `gradientUnits="userSpaceOnUse"`, the gradient:
- Starts at the left edge of the chart (blue)
- Transitions through purple at center
- Ends at the right edge (pink)
- Works identically for flat and varying price lines

---

## Visual Result

### Before Fixes
- ❌ Timeline misaligned on initial load
- ❌ Flat price lines invisible or inconsistent
- ❌ Gradient missing on horizontal lines
- ❌ Chart breaks with all-zero prices

### After Fixes
- ✅ Timeline perfectly positioned on load
- ✅ Solid purple fallback ensures visibility
- ✅ Blue→purple→pink gradient on all lines
- ✅ Robust handling of edge cases

---

## Files Modified

1. **`src/app/pricing/timeline-simulator/page.tsx`**
   - Lines 136-160: Date synchronization
   - Lines 2697-2701: Gradient definition with userSpaceOnUse
   - Lines 2714-2717: Safe minPrice calculation
   - Lines 2749-2753: Y-axis range safety check
   - Lines 2806-2829: Three-layer line rendering with fallback

---

## Testing Checklist

When modifying this component, verify:

- [ ] Timeline selector stays within container on initial load
- [ ] Flat price lines ($10, $10, $10...) show gradient
- [ ] Varying price lines show gradient
- [ ] All-zero prices render without errors
- [ ] Gradient transitions smoothly from blue→purple→pink
- [ ] Line is visible even if gradient fails to load
- [ ] No NaN or Infinity in calculated coordinates
- [ ] Chart works across different time ranges
- [ ] Responsive behavior maintained

---

## Critical Code Patterns

### ❌ NEVER DO THIS
```typescript
// Don't initialize dates separately (causes timing drift)
const [rangeStart] = useState(() => new Date(Date.now() - 86400000));
const [viewStart] = useState(() => new Date(Date.now() - 21600000));

// Don't use objectBoundingBox for line gradients
<linearGradient id="grad" x1="0%" x2="100%">

// Don't rely solely on gradient URL without fallback
<polyline stroke="url(#lineGradient)" />
```

### ✅ ALWAYS DO THIS
```typescript
// Initialize all dates from single timestamp
const [initialDates] = useState(() => {
  const now = new Date();
  return { rangeStart: ..., viewStart: ... };
});

// Use userSpaceOnUse for chart gradients
<linearGradient id="grad" x1="0" x2="1000" gradientUnits="userSpaceOnUse">

// Layer fallback color + gradient
<polyline stroke="#8b5cf6" />
<polyline stroke="url(#lineGradient)" />
```

---

## Debugging Tips

If the line disappears again:

1. **Check browser console** for NaN/Infinity warnings
2. **Inspect SVG** - verify `<polyline points="..."` contains valid coordinates
3. **Check gradient** - ensure `#lineGradient` is defined in `<defs>`
4. **Verify bounding box** - use browser DevTools to inspect shape bounds
5. **Test with different data** - flat prices, varying prices, zeros

---

## Related Issues

- Initial timeline positioning: Fixed date synchronization
- Gradient not showing: Changed to userSpaceOnUse coordinates
- Line visibility: Added solid color fallback layer
- Edge case crashes: Added validation and safety checks

---

## Maintenance Notes

⚠️ **Do not modify the gradient coordinate system back to percentages** - this will break flat line rendering.

⚠️ **Do not remove the solid color fallback layer** - gradient URLs can fail during initial render.

⚠️ **Do not separate date initializations** - keep all dates synchronized to single timestamp.

---

## Author Notes

These fixes were implemented after extensive debugging sessions that revealed SVG gradient rendering quirks with horizontal lines. The final solution uses a defense-in-depth approach:

1. **Synchronized state** - prevents timing issues
2. **Safe calculations** - handles edge cases
3. **Fallback rendering** - ensures visibility
4. **Absolute gradients** - consistent across shapes

This combination ensures the chart works reliably across all scenarios.
