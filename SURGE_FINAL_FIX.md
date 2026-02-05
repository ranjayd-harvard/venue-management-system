# Surge Pricing Final Fix - Materialized Ratesheets in Live Mode

**Date**: February 1, 2026
**Issue**: Materialized surge ratesheets showing multiplier value ($0.75, $1.07) instead of calculated surge price ($7.50, $10.70)

---

## Root Cause Analysis

After the previous fixes got materialized surge ratesheets appearing in Live Mode, they were showing the wrong prices because:

1. **Materialized surge ratesheets have `type: 'SURGE_MULTIPLIER'`** ✓ (Fixed earlier)
2. **Backend pricing engine has special logic for SURGE_MULTIPLIER** at [price-engine-hourly.ts:184](src/lib/price-engine-hourly.ts#L184):
   - Finds surge ratesheet (winner)
   - Finds base price (next non-SURGE ratesheet)
   - Calculates: `finalPrice = basePrice × surgeMultiplier`
3. **BUT**: This logic only applies when `selected.level === 'SURGE'` (line 184)
4. **Problem**: Materialized surge ratesheets were loaded as SUBLOCATION ratesheets, not SURGE ratesheets
5. **Result**: They were treated as regular ratesheets with absolute prices, showing raw multiplier values

---

## The Fix

### Problem Flow (Before Fix)
```
API Request (includeSurge: false)
  ↓
Load sublocation ratesheets
  ↓ (includes materialized surge ratesheets because appliesTo.level = 'SUBLOCATION')
Materialized surge ratesheets loaded as SUBLOCATION level
  ↓
Pass to pricing engine as sublocationRatesheets
  ↓
Engine treats them as regular ratesheets (not SURGE level)
  ↓
Returns raw multiplier value (0.75) as price
  ↓
Frontend displays $0.75 instead of $7.50
```

### Solution Flow (After Fix)
```
API Request (includeSurge: false)
  ↓
Load sublocation ratesheets (EXCLUDING surge ratesheets)
Load materialized surge ratesheets separately (WHERE surgeConfigId EXISTS)
  ↓
Mark materialized surge ratesheets as level = 'SURGE'
  ↓
Pass to pricing engine as surgeRatesheets (not sublocationRatesheets)
  ↓
Engine recognizes SURGE level + SURGE_MULTIPLIER type
Engine finds base price ($10.00) and calculates: $10.00 × 0.75 = $7.50
  ↓
Returns calculated surge price ($7.50)
  ↓
Frontend displays $7.50 ✓
```

---

## Code Changes

### File: `/src/app/api/pricing/calculate-hourly/route.ts`

#### Change 1: Exclude Materialized Surge from Sublocation Ratesheets (Line 128)

**Added filter**:
```typescript
const sublocationRatesheets = await db.collection('ratesheets').find({
  $or: [ /* existing filters */ ],
  isActive: true,
  // CRITICAL: Exclude materialized surge ratesheets (we load them separately)
  surgeConfigId: { $exists: false }  // ← NEW
}).toArray();
```

**Why**: Prevents materialized surge ratesheets from being loaded as sublocation ratesheets.

---

#### Change 2: Load Materialized Surge Ratesheets Separately (Lines 131-150)

**New code**:
```typescript
// ALWAYS load materialized surge ratesheets (regardless of includeSurge flag)
// These are physical ratesheets that have been approved and should be applied
const materializedSurgeRatesheets = await db.collection('ratesheets').find({
  $or: [
    // Surge ratesheets at sublocation level
    {
      'appliesTo.level': 'SUBLOCATION',
      'appliesTo.entityId': new ObjectId(sublocation._id),
      surgeConfigId: { $exists: true }
    },
    // Surge ratesheets at location level
    {
      'appliesTo.level': 'LOCATION',
      'appliesTo.entityId': new ObjectId(location._id),
      surgeConfigId: { $exists: true }
    }
  ],
  isActive: true,
  approvalStatus: 'APPROVED'  // Only include approved surge ratesheets
}).toArray();
```

**Why**:
- Loads materialized surge ratesheets separately from other ratesheets
- Only loads APPROVED ratesheets (DRAFT/PENDING are excluded)
- Works in both Live Mode and Simulation Mode
- Checks both SUBLOCATION and LOCATION levels

---

#### Change 3: Convert and Mark as SURGE Level (Lines 323-330)

**New code**:
```typescript
// Convert materialized surge ratesheets - they will be treated as SURGE level in pricing engine
const convertedMaterializedSurgeRatesheets = materializedSurgeRatesheets.map(rs => ({
  ...rs,
  effectiveFrom: new Date(rs.effectiveFrom),
  effectiveTo: rs.effectiveTo ? new Date(rs.effectiveTo) : null,
  applyTo: 'SURGE'  // Mark as SURGE level for pricing engine
}));
```

**Why**:
- Converts date strings to Date objects (required by pricing engine)
- **Critical**: Sets `applyTo: 'SURGE'` so engine treats them as SURGE level ratesheets

---

#### Change 4: Add to Pricing Context (Line 367)

**Modified**:
```typescript
const context: PricingContext = {
  // ... other fields ...
  customerRatesheets: convertedCustomerRatesheets as any[],
  locationRatesheets: convertedLocationRatesheets as any[],
  sublocationRatesheets: convertedSublocationRatesheets as any[],
  eventRatesheets: convertedEventRatesheets as any[],
  // CRITICAL: Always include materialized surge ratesheets (physical, approved surge pricing)
  surgeRatesheets: convertedMaterializedSurgeRatesheets as any[],  // ← NEW
  // ... other fields ...
};
```

**Why**: Passes materialized surge ratesheets to pricing engine as `surgeRatesheets` (SURGE level).

---

#### Change 5: Combine with Virtual Surge in Simulation Mode (Lines 533-542)

**Modified**:
```typescript
// Re-run pricing engine with BOTH materialized AND virtual surge ratesheets
const allSurgeRatesheets = [
  ...(context.surgeRatesheets || []),  // Materialized surge ratesheets (physical, approved)
  ...surgeRatesheets  // Virtual surge ratesheets (generated from configs for simulation)
];
console.log(`   Total surge ratesheets: ${allSurgeRatesheets.length} (${context.surgeRatesheets?.length || 0} materialized + ${surgeRatesheets.length} virtual)`);

const surgeContext = {
  ...context,
  surgeRatesheets: allSurgeRatesheets  // ← Combine both types
};
```

**Why**:
- In Simulation Mode, supports BOTH materialized and virtual surge ratesheets
- Materialized ratesheets are physical (approved in DB)
- Virtual ratesheets are generated on-the-fly from surge configs
- Allows testing new surge configs alongside existing materialized ones

---

#### Change 6: Updated Response Metadata (Lines 586-593)

**Modified**:
```typescript
ratesheetSummary: {
  total: customerRatesheets.length + locationRatesheets.length + sublocationRatesheets.length + eventRatesheets.length + materializedSurgeRatesheets.length + surgeRatesheets.length,
  customer: customerRatesheets.length,
  location: locationRatesheets.length,
  sublocation: sublocationRatesheets.length,
  event: eventRatesheets.length,
  materializedSurge: materializedSurgeRatesheets.length,  // Physical, approved surge ratesheets
  virtualSurge: surgeRatesheets.length  // Virtual surge ratesheets (simulation only)
}
```

**Why**: Provides visibility into both types of surge ratesheets in API response.

---

## How Backend Pricing Engine Processes SURGE Ratesheets

From [price-engine-hourly.ts:184-226](src/lib/price-engine-hourly.ts#L184-L226):

```typescript
// Check if SURGE_MULTIPLIER is the winner
if (selected.level === 'SURGE' && selected.ratesheet.type === 'SURGE_MULTIPLIER') {
  // Surge is a multiplier - find the base price (next non-SURGE winner)
  const baseRatesheet = applicableRatesheets.find(rs => rs.level !== 'SURGE');

  let basePrice: number;
  if (baseRatesheet) {
    basePrice = baseRatesheet.pricePerHour;  // e.g., $10.00
  } else {
    basePrice = this.getDefaultRate(context);  // Fall back to default
  }

  // Apply surge multiplier to base price
  const surgeMultiplier = selected.pricePerHour;  // e.g., 0.75
  const finalPrice = basePrice * surgeMultiplier;  // e.g., $10.00 × 0.75 = $7.50

  return {
    pricePerHour: finalPrice,  // Returns $7.50
    // ... other fields ...
  };
}
```

**Key Points**:
1. Checks if winner is SURGE level with SURGE_MULTIPLIER type
2. Finds the next non-SURGE ratesheet to use as base price
3. Multiplies: `finalPrice = basePrice × surgeMultiplier`
4. Returns calculated surge price (not raw multiplier)

---

## Expected Behavior After Fix

### Live Mode
**Refresh the Timeline Simulator page**, you should now see:

1. **Orange surge layers** appear in waterfall
2. **Correct prices** displayed:
   - 7 AM - 9 AM: **$7.50/hr** (Low Priority: $10 base × 0.75 multiplier)
   - 9 AM - 11 AM: **$10.70/hr** (Medium Priority: $10 base × 1.07 multiplier)
3. **Backend logs** show:
   ```
   📊 [API] Fetched ratesheets:
   [API]   Customer: 0
   [API]   Location: 0
   [API]   Sublocation: 6
   [API]   Materialized Surge: 2  ← NEW

   🏆 [ENGINE] WINNER: SURGE MULTIPLIER
   [ENGINE]    Surge Config: SURGE: Test Surge - Low Priority
   [ENGINE]    Base: Default ($10.00/hr)
   [ENGINE]    Multiplier: 0.75x
   [ENGINE]    Final Price: $7.50/hr  ← CALCULATED
   ```

### Simulation Mode
With surge toggle ON:
- Materialized surge ratesheets (physical, approved)
- Virtual surge configs (testing scenarios)
- Both appear as SURGE type layers
- Can compare different surge strategies

---

## Testing Checklist

### Live Mode Test
- [ ] Navigate to Timeline Simulator
- [ ] Ensure "Surge Pricing" toggle is OFF
- [ ] Select sublocation with materialized surge ratesheets
- [ ] **Verify**: Orange surge layers visible
- [ ] **Verify**: 7-9 AM shows $7.50 (not $0.75)
- [ ] **Verify**: 9-11 AM shows $10.70 (not $1.07)
- [ ] **Verify**: Surge layers win (priority 10500/10700)
- [ ] **Verify**: Backend logs show "Materialized Surge: 2"
- [ ] **Verify**: Backend logs show calculated prices ($7.50, $10.70)

### Simulation Mode Test
- [ ] Toggle "Surge Pricing" ON
- [ ] **Verify**: Same surge layers still visible
- [ ] **Verify**: Can create virtual surge configs
- [ ] **Verify**: Both materialized and virtual surge work together

---

## What Changed vs. Previous Fixes

### Previous Fix #1 (Layer Type)
- **What**: Changed frontend to treat materialized surge ratesheets as RATESHEET type in Live Mode
- **Result**: Surge layers appeared, but showed wrong prices ($0.75 instead of $7.50)

### Previous Fix #2 (Ratesheet Type)
- **What**: Changed materialization to create `SURGE_MULTIPLIER` type ratesheets
- **Result**: Type was correct, but ratesheets loaded as SUBLOCATION level, not SURGE level

### Current Fix #3 (Load as SURGE Level)
- **What**: Load materialized surge ratesheets separately and mark as SURGE level
- **Result**: Backend applies multiplier logic correctly, returns calculated prices ✓

---

## Summary

The complete fix requires **three components working together**:

1. **Materialization** ([surge-materialization.ts:102](src/lib/surge-materialization.ts#L102)): Create ratesheets with `type: 'SURGE_MULTIPLIER'` ✓
2. **API Loading** ([calculate-hourly/route.ts:131-367](src/app/api/pricing/calculate-hourly/route.ts#L131-L367)): Load materialized surge ratesheets separately and mark as SURGE level ✓
3. **Backend Engine** ([price-engine-hourly.ts:184](src/lib/price-engine-hourly.ts#L184)): Apply multiplier logic when SURGE level + SURGE_MULTIPLIER type detected ✓

All three are now in place, and materialized surge ratesheets should work correctly in Live Mode!

---

## Files Modified

1. `/src/lib/surge-materialization.ts` - Line 102: Use SURGE_MULTIPLIER type
2. `/src/app/api/pricing/calculate-hourly/route.ts` - Lines 128-593: Load and process materialized surge ratesheets
3. `/src/app/pricing/timeline-simulator/page.tsx` - Lines 871-906: Display surge ratesheets based on mode
4. `fix-surge-ratesheet-type.js` - Migration script to update existing ratesheets

---

## Next Steps

1. **Refresh** the Timeline Simulator page
2. **Verify** surge prices are correct ($7.50, $10.70)
3. **Test** booking flow with surge pricing
4. **Test** approval workflow for new surge ratesheets
5. Consider building approval UI (currently requires manual DB updates)
