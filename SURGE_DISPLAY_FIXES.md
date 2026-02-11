# Surge Display Fixes

**Date**: February 1, 2026
**Issues Fixed**: Priority and Display

## Issues Reported

1. **Surge tiles showing "$1.07" instead of "$10.70"**
   - Expected: Base price × surge multiplier (e.g., $10 × 1.07 = $10.70)
   - Actual: Just showing the multiplier as a dollar amount

2. **Surge tiles are purple instead of orange**
   - Expected: Orange gradient (surge color)
   - Actual: Purple gradient (sublocation color)

3. **Surge priority in 20k range instead of 10k range**
   - Expected: 10000 + config.priority (e.g., 10700 for sublocation surge)
   - Actual: Priority showing as 20000+

## Root Causes

### Issue 1: Price Display
**Location**: `src/app/pricing/timeline-simulator/page.tsx` lines 1148-1191

**Problem**:
- SURGE layers were storing just the multiplier (1.07) in `price`
- Display logic was then showing this multiplier as "$1.07"

**Solution**:
- Changed to store the actual surge price (base × multiplier) directly
- Backend already returns the final surge price in `segment.pricePerHour`
- Removed the frontend multiplier calculation logic (lines 1236-1254)
- Updated display to show all prices as dollar amounts (removed "x" suffix)

### Issue 2: Purple Color
**Location**: `src/app/pricing/timeline-simulator/page.tsx` lines 871-892

**Problem**:
- Materialized surge ratesheets have `appliesTo.level = 'SUBLOCATION'`
- When loaded as ratesheets, they were treated as regular SUBLOCATION ratesheets
- Got purple color from `getLayerColor('SUBLOCATION')` (line 944)

**Solution**:
- Added check for `surgeConfigId` field to identify materialized surge ratesheets
- If `surgeConfigId` exists, create SURGE type layer with orange color
- Otherwise, create regular RATESHEET layer with level-based color

### Issue 3: Priority Range
**Location**: `src/app/api/pricing/calculate-hourly/route.ts` line 480

**Problem**:
- Surge ratesheets were using `config.priority` (500-700 range)
- Should use `10000 + config.priority` to win over all other layers

**Solution**:
- Changed line 480 from `priority: config.priority` to `priority: 10000 + config.priority`

## Files Modified

### 1. `/src/app/api/pricing/calculate-hourly/route.ts`
**Line 480**: Priority calculation
```typescript
// Before:
priority: config.priority,

// After:
priority: 10000 + config.priority, // Surge priority: 10000+ to win over all other layers
```

### 2. `/src/app/pricing/timeline-simulator/page.tsx`

**Lines 1148-1171**: SURGE layer price storage
```typescript
// Before: Store multiplier
const surgeMultiplier = segment.pricePerHour / baseSegment.pricePerHour;
price = surgeMultiplier; // Store multiplier for later application

// After: Store actual surge price
price = segment.pricePerHour; // Store the actual surge price (backend already calculated)
```

**Lines 1232-1239**: Removed multiplier application logic
```typescript
// REMOVED:
// If SURGE layer won, apply multiplier to base price dynamically
// const surgePrice = baseWinner.price * surgeMultiplier;

// REPLACED WITH:
// SURGE layer prices are already calculated (base × multiplier) from the backend
// No need to recalculate here
```

**Lines 871-893**: Identify materialized surge ratesheets
```typescript
// Added check for surgeConfigId
const isSurgeRatesheet = !!(rs as any).surgeConfigId;

layers.push({
  id: rs._id,
  name,
  type: isSurgeRatesheet ? 'SURGE' : 'RATESHEET', // ← NEW
  priority: rs.priority,
  color: isSurgeRatesheet
    ? 'bg-gradient-to-br from-orange-400 to-orange-600'  // ← NEW
    : getLayerColor(rs.applyTo, rs.priority),
  applyTo: isSurgeRatesheet ? 'SURGE' : rs.applyTo // ← NEW
});
```

**Line 2972**: Display all prices as dollar amounts
```typescript
// Before:
{layer.type === 'SURGE'
  ? `${layerData.price.toFixed(2)}x`
  : `$${layerData.price.toFixed(2)}`
}

// After:
${typeof layerData.price === 'number' ? layerData.price.toFixed(2) : layerData.price}
```

**Lines 2947-2950**: Updated tooltip text
```typescript
// Before:
layer.type === 'SURGE' ? `${layerData.price}x multiplier` : `$${layerData.price}/hr`

// After:
$${layerData.price}/hr
```

## Expected Behavior After Fix

### Waterfall Display
- **Orange tiles** for surge ratesheets (both virtual and materialized)
- **Dollar amounts** showing calculated surge prices:
  - 5 AM: $10.70 (base $10 × 1.07)
  - 6 AM: $7.50 (base $10 × 0.75)
  - etc.

### Priority Hierarchy
```
SURGE RATESHEETS     →  Priority 10700  (10000 + 700)
SUBLOCATION DEFAULT  →  Priority 300
```

### Winning Tiles
- Show the surge-adjusted price (e.g., $10.70)
- Display strikethrough base price if surge is active

## Testing Checklist

- [x] Surge priority is 10000+ range
- [x] Surge tiles show orange color (not purple)
- [x] Surge tiles show dollar amounts (e.g., "$10.70") not multipliers (e.g., "$1.07")
- [x] Winning tiles show correct surge-adjusted prices
- [ ] Test with materialized surge ratesheets (approve in admin)
- [ ] Verify surge layers can be toggled on/off
- [ ] Verify surge beats all other layers when active

## Notes

- Virtual surge configs and materialized surge ratesheets now both display consistently
- Backend already calculates surge prices (base × multiplier), frontend just displays them
- Materialized surge ratesheets are identified by presence of `surgeConfigId` field
- All surge layers (virtual and materialized) now use same orange color and SURGE type
