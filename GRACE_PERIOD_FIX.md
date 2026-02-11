# Grace Period Conflict Fix

**Date**: January 28, 2026
**Issue**: Grace periods from non-winning events were overriding actual event rates
**Status**: ✅ Fixed

---

## Problem Description

When `isEventBooking=true`, users were seeing $0 rates (grace periods) from overlapping events instead of the actual event rates.

### Example Issue:
- **EventA**: 9am-11am @ $100/hr (priority 4900)
- **EventB**: 10am-3pm @ $150/hr (priority 4900) with 60min grace before

At 10:00 AM:
- ❌ **Before Fix**: $0/hr (EventB's grace period was selected)
- ✅ **After Fix**: $100/hr (EventA's actual rate is selected)

---

## Root Cause

The pricing engine was adding **all** overlapping ratesheets to the `applicableRatesheets` array, including grace periods from every event. When sorting by priority, grace periods ($0/hr) were randomly selected over actual event rates because:

1. All events had the same priority (4900)
2. The sort was not stable - no tiebreaker for same priority
3. Grace periods were treated equally to event rates

### Code Flow (Before):
```
Hour 10:00 AM evaluation:
1. Find applicable ratesheets:
   - EventA: $100/hr (priority 4900)
   - EventB Grace: $0/hr (priority 4900)  ← Same priority!
2. Sort by priority: No clear winner
3. Array.sort() picks unpredictably → might pick $0/hr
4. Result: $0/hr charged (WRONG!)
```

---

## Solution

Modified the sorting logic in [price-engine-hourly.ts:319-341](src/lib/price-engine-hourly.ts#L319-L341) to add a tiebreaker:

**When two ratesheets have the same priority, prefer non-zero rates over grace periods.**

### New Sorting Logic:
```typescript
return applicable.sort((a, b) => {
  // 1. Level hierarchy: EVENT > SUBLOCATION > LOCATION > CUSTOMER
  const levelA = ...;
  const levelB = ...;
  if (levelA !== levelB) {
    return levelB - levelA;
  }

  // 2. Same level: higher priority first
  if (b.ratesheet.priority !== a.ratesheet.priority) {
    return b.ratesheet.priority - a.ratesheet.priority;
  }

  // 3. NEW: Same priority: prefer non-zero rates over grace periods
  if (a.pricePerHour === 0 && b.pricePerHour > 0) {
    return 1; // b wins (non-zero)
  }
  if (b.pricePerHour === 0 && a.pricePerHour > 0) {
    return -1; // a wins (non-zero)
  }

  // 4. Both zero or both non-zero: stable sort
  return 0;
});
```

### Code Flow (After):
```
Hour 10:00 AM evaluation:
1. Find applicable ratesheets:
   - EventA: $100/hr (priority 4900)
   - EventB Grace: $0/hr (priority 4900)
2. Sort by priority: Tied at 4900
3. Tiebreaker: Non-zero ($100) beats zero ($0)
4. Result: $100/hr charged (CORRECT!)
```

---

## Test Results

### Before Fix:
```
isEventBooking: true
Hour  1 (08:00 EST): $0/hr   [Grace from EventA]
Hour  2 (09:00 EST): $0/hr   [Grace from EventB] ← WRONG!
Hour  3 (10:00 EST): $0/hr   [Grace from EventB] ← WRONG!
...
Total: ~$200 for 12 hours (mostly grace periods)
```

### After Fix:
```
isEventBooking: true
Hour  1 (08:00 EST): $  0/hr | Auto-EventA-Morning [GRACE $0] ✓
Hour  2 (09:00 EST): $100/hr | Auto-EventA-Morning            ✓
Hour  3 (10:00 EST): $100/hr | Auto-EventA-Morning            ✓ Fixed!
Hour  4 (11:00 EST): $150/hr | Auto-EventB-Midday             ✓
Hour  5 (12:00 EST): $150/hr | Auto-EventB-Midday             ✓
Hour  6 (13:00 EST): $150/hr | Auto-EventB-Midday             ✓
Hour  7 (14:00 EST): $150/hr | Auto-EventB-Midday             ✓ Fixed!
Hour  8 (15:00 EST): $200/hr | Auto-EventC-Afternoon          ✓
Hour  9 (16:00 EST): $200/hr | Auto-EventC-Afternoon          ✓
Hour 10 (17:00 EST): $200/hr | Auto-EventC-Afternoon          ✓
Hour 11 (18:00 EST): $  0/hr | Auto-EventC-Afternoon [GRACE]  ✓
Hour 12 (19:00 EST): $  0/hr | Auto-EventC-Afternoon [GRACE]  ✓

Total: $1,400 for 12 hours ✓ Correct!
```

---

## Behavior Matrix

| Scenario | isEventBooking | Result |
|----------|---------------|---------|
| **Single event hour** | true | Event rate charged |
| **Single event hour** | false | Event rate charged (grace skipped) |
| **Grace period only** | true | $0/hr (correct) |
| **Grace period only** | false | Falls back to default rate |
| **Event rate + Grace period overlap (same priority)** | true | **Event rate wins** ✓ |
| **Event rate + Grace period overlap (same priority)** | false | Event rate (grace skipped) |
| **Two event rates overlap (same priority)** | true/false | Insertion order determines winner |

---

## Impact

This fix ensures that:
✅ Event rates are always charged when events overlap at the same priority
✅ Grace periods only apply when there are NO other event rates available
✅ `isEventBooking=true` correctly charges for occupied hours
✅ Walk-in pricing (`isEventBooking=false`) still skips grace periods entirely

**No Breaking Changes**: This is a bug fix, not a behavior change. The system now works as originally intended.

---

## Files Modified

- **`src/lib/price-engine-hourly.ts`** (Lines 319-341)
  - Added non-zero rate preference in sorting logic
  - Ensures stable sort behavior for same-priority ratesheets

---

## Testing

### Manual Test:
```bash
# Create overlapping events with grace periods
# Test with isEventBooking=true
curl -X POST http://localhost:3031/api/pricing/calculate-hourly \
  -H "Content-Type: application/json" \
  -d '{
    "subLocationId": "...",
    "startTime": "2026-01-28T13:00:00.000Z",
    "endTime": "2026-01-29T01:00:00.000Z",
    "isEventBooking": true
  }'

# Verify: Non-grace hours should show event rates, not $0
```

### Expected Output:
- Hours with overlapping event rates should charge the rate (not $0)
- Hours with ONLY grace periods should be $0
- Total should reflect actual event rates, not dominated by grace periods

---

## Related Issues

- **Phase 1**: Custom Priority Field ✅
- **Phase 2**: Conflict Detection API ✅
- **Phase 3**: Conflict Resolution UI ✅
- **Grace Period Fix**: Event rates beat grace periods ✅

---

## Summary

The grace period conflict fix ensures that when multiple events overlap at the same priority level, actual event rates take precedence over grace periods from other events. This prevents $0 rates from incorrectly dominating event booking pricing.

**Result**: Event booking pricing (`isEventBooking=true`) now correctly charges event rates during occupied hours, with grace periods only applying when no other events are actively using that time.
