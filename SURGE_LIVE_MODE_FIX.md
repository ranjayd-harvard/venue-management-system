# Surge Live Mode Fix

**Date**: February 1, 2026
**Issue**: Materialized surge ratesheets not appearing in waterfall in Live Mode

---

## Problem

After materializing surge configs and approving the ratesheets in the database, the surge layers were not appearing in the waterfall in Live Mode, despite:
- Ratesheets being correctly stored in database with `isActive: true` and `approvalStatus: 'APPROVED'`
- Console logs showing ratesheets being loaded: `isSurgeRatesheet: true`, `priority: 10700`
- Backend API correctly returning surge ratesheets in pricing calculations

---

## Root Cause

The issue was in the frontend layer type assignment:

**Previous Logic** (line 901 in `timeline-simulator/page.tsx`):
```typescript
type: isSurgeRatesheet ? 'SURGE' : 'RATESHEET'
```

This always created SURGE type layers for materialized surge ratesheets, regardless of mode.

**Problem with SURGE Type Layers**:
- SURGE type layers get their pricing data from `surgePricingData` (lines 1162-1192)
- `surgePricingData` is only populated when `surgeEnabled: true` (Simulation Mode)
- In Live Mode (`surgeEnabled: false`), the API is called with `includeSurge: false`
- Therefore, `surgePricingData` is empty, and all SURGE type layers have `isActive: false`
- Layers with no active tiles are filtered out of the waterfall (line 2841)

---

## Solution

Materialized surge ratesheets should be displayed differently based on mode:

### Simulation Mode (`surgeEnabled: true`)
- **Layer Type**: `SURGE`
- **Data Source**: `surgePricingData` (virtual surge pricing)
- **Purpose**: Show virtual surge configs for testing/planning

### Live Mode (`surgeEnabled: false`)
- **Layer Type**: `RATESHEET`
- **Data Source**: Regular ratesheet pricing logic (lines 1193-1237)
- **Purpose**: Show materialized surge ratesheets as physical ratesheets

**New Logic**:
```typescript
const shouldBeSurgeType = isSurgeRatesheet && surgeEnabled;

layers.push({
  id: rs._id,
  name,
  type: shouldBeSurgeType ? 'SURGE' : 'RATESHEET',
  priority: rs.priority,
  // Orange color preserved for surge ratesheets in both modes
  color: isSurgeRatesheet
    ? 'bg-gradient-to-br from-orange-400 to-orange-600'
    : getLayerColor(rs.applyTo, rs.priority),
  applyTo: isSurgeRatesheet ? 'SURGE' : rs.applyTo
});
```

---

## Additional Fix: Surge Ratesheet Type (Feb 1, 2026 - Second Issue)

**Problem**: After fixing the layer type issue, surge ratesheets were showing "$0.75" instead of "$7.50" because:
- Materialized surge ratesheets had `type: 'TIMING_BASED'`
- Backend pricing engine needs `type: 'SURGE_MULTIPLIER'` to apply multiplier logic
- Without correct type, ratesheets showed raw multiplier (0.75) as price, not calculated price ($10 × 0.75 = $7.50)

**Solution**: Change materialization to create `SURGE_MULTIPLIER` type ratesheets.

### File: `/src/lib/surge-materialization.ts`

**Line 102**: Changed ratesheet type
```typescript
// Before:
type: 'TIMING_BASED',

// After:
type: 'SURGE_MULTIPLIER',  // CRITICAL: Backend applies multiplier to base price
```

**Impact**:
- Backend pricing engine at [price-engine-hourly.ts:184](src/lib/price-engine-hourly.ts#L184) recognizes surge ratesheets
- Correctly finds base price and multiplies: `surgePrice = basePrice × multiplier`
- Example: Base $10 × 0.75 multiplier = **$7.50** (not $0.75) ✓

### Migration Script: `fix-surge-ratesheet-type.js`

Updates existing materialized ratesheets to correct type:
```bash
node fix-surge-ratesheet-type.js
```

**Results**:
```
✅ Updated 2 ratesheet(s)

1. SURGE: Test Surge - Low Priority
   Type: SURGE_MULTIPLIER ✓
   Priority: 10500

2. SURGE: Test Surge - Medium Priority
   Type: SURGE_MULTIPLIER ✓
   Priority: 10700
```

---

## Key Changes

### File: `/src/app/pricing/timeline-simulator/page.tsx`

**Lines 871-906**: Updated ratesheet layer creation logic

```typescript
// CRITICAL: In Live Mode, materialized surge ratesheets should be RATESHEET type (not SURGE)
// In Simulation Mode, they appear as SURGE type to work with virtual surge pricing
// This ensures materialized surge ratesheets show up in Live Mode waterfall
const shouldBeSurgeType = isSurgeRatesheet && surgeEnabled;
```

**Added Debug Logging**:
```typescript
if (rs.name.includes('SURGE:')) {
  console.log('🔍 Processing ratesheet:', {
    name: rs.name,
    hasSurgeConfigId: !!(rs as any).surgeConfigId,
    surgeConfigId: (rs as any).surgeConfigId,
    isSurgeRatesheet,
    priority: rs.priority,
    surgeEnabled,
    mode: surgeEnabled ? 'Simulation (Virtual)' : 'Live (Materialized)'
  });
}
```

---

## Expected Behavior After Fix

### Live Mode
1. Materialized surge ratesheets appear as orange RATESHEET type layers
2. They use regular ratesheet pricing logic (time windows, date ranges, etc.)
3. Backend returns surge prices (base × multiplier already baked in)
4. Waterfall displays surge ratesheets with priority 10000+ (winning over all other layers)
5. Tiles show actual surge prices (e.g., $10.70 for base $10 × 1.07 multiplier)

### Simulation Mode
1. Materialized surge ratesheets appear as orange SURGE type layers
2. They use virtual surge pricing logic (for testing adjustments)
3. Can toggle surge on/off to compare pricing scenarios
4. Virtual surge configs also appear as SURGE type layers

---

## Testing

### Live Mode Test
1. Navigate to Timeline Simulator
2. Select sublocation with materialized surge ratesheets
3. Ensure "Surge Pricing" toggle is OFF (Live Mode)
4. **Expected**:
   - Orange surge layers visible in waterfall
   - Surge layers show actual prices (e.g., $10.70)
   - Surge layers win based on priority (10000+)
   - Time windows from ratesheet apply correctly

### Simulation Mode Test
1. Toggle "Surge Pricing" ON (Simulation Mode)
2. **Expected**:
   - Same orange surge layers visible
   - Now treated as SURGE type (can test virtual adjustments)
   - Virtual surge configs also appear if any exist

---

## Related Files

- `/src/app/pricing/timeline-simulator/page.tsx` - Frontend layer creation logic
- `/src/app/api/pricing/calculate-hourly/route.ts` - Backend pricing engine
- `/src/lib/surge-materialization.ts` - Materialization logic
- `SURGE_DISPLAY_FIXES.md` - Previous display fixes (price, color, priority)
- `SURGE_MATERIALIZATION_IMPLEMENTATION.md` - Original implementation docs

---

## Summary

The fix ensures that materialized surge ratesheets behave correctly in both modes:
- **Live Mode**: Physical ratesheets with surge pricing baked in (RATESHEET type)
- **Simulation Mode**: Virtual surge configs for testing scenarios (SURGE type)

This completes the surge materialization feature, enabling the full lifecycle:
1. Create surge config
2. Test in Simulation Mode
3. Materialize to DRAFT ratesheet
4. Approve ratesheet
5. View in Live Mode waterfall
6. Surge pricing automatically applied to bookings
