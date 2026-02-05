# Surge Ratesheet Visual Labels

**Date**: February 1, 2026
**Enhancement**: Add "(Virtual)" label to distinguish virtual surge configs from materialized surge ratesheets

---

## Problem

When switching between Live Mode and Simulation Mode, it was unclear which surge ratesheets were:
- **Virtual** - Generated on-the-fly from surge configs (simulation only)
- **Materialized** - Physical ratesheets approved in database (production ready)

This caused confusion when debugging, especially when both types appear together in Simulation Mode.

---

## Solution

Added "(Virtual)" label to surge layers generated from configs.

### Visual Distinction

#### Live Mode (Surge Toggle OFF)
```
Waterfall Display:
┌─────────────────────────────────────────────────┐
│ 🟠 SURGE: Test Surge - Medium Priority         │  ← Materialized (no label)
│ 🟠 SURGE: Test Surge - Low Priority            │  ← Materialized (no label)
│ 🟣 SubLocation-1 Default                        │
│ 🟢 Location-1 (USPS Manhattan Midtown)         │
│ 🔵 Customer-1 Default                           │
└─────────────────────────────────────────────────┘
```

#### Simulation Mode (Surge Toggle ON)
```
Waterfall Display:
┌─────────────────────────────────────────────────┐
│ 🟠 SURGE: Test Surge - High Priority (Virtual) │  ← Virtual from config
│ 🟠 SURGE: Test Surge - Medium Priority         │  ← Materialized
│ 🟠 SURGE: Test Surge - Low Priority            │  ← Materialized
│ 🟣 SubLocation-1 Default                        │
│ 🟢 Location-1 (USPS Manhattan Midtown)         │
│ 🔵 Customer-1 Default                           │
└─────────────────────────────────────────────────┘
```

---

## Code Changes

### File: `/src/app/pricing/timeline-simulator/page.tsx`

**Lines 858-869**: Add "(Virtual)" label to surge configs

```typescript
// Add SURGE layers from the applied surge ratesheets (extracted from API response)
// These are VIRTUAL surge configs generated on-the-fly for simulation
if (surgeEnabled && appliedSurgeRatesheets.length > 0) {
  appliedSurgeRatesheets.forEach(surge => {
    layers.push({
      id: surge.id,
      name: `${surge.name} (Virtual)`,  // ← Add "Virtual" label for clarity
      type: 'SURGE',
      priority: surge.priority,
      color: 'bg-gradient-to-br from-orange-400 to-orange-600',
      applyTo: 'SURGE'
    });
  });
}
```

**Lines 871-889**: Updated comments to clarify materialized ratesheets

```typescript
// Add ratesheets (already sorted by priority)
ratesheets.forEach((rs) => {
  // Check if this is a materialized surge ratesheet (has surgeConfigId)
  // Materialized surge ratesheets are PHYSICAL ratesheets that have been approved
  // They DON'T get "(Virtual)" label since they're real, approved ratesheets
  const isSurgeRatesheet = !!(rs as any).surgeConfigId;

  // ... rest of logic
});
```

---

## Quick Reference

### Surge Ratesheet Types

| Type | Label | Mode | Source | Production Ready |
|------|-------|------|--------|-----------------|
| **Virtual** | `(Virtual)` | Simulation only | Generated from surge configs | ❌ Testing only |
| **Materialized** | No label | Both modes | Physical DB ratesheet | ✅ Approved, production ready |

### When You See "(Virtual)"
- 🧪 **Testing scenario** - Not yet materialized
- 🔄 **Can be modified** - Adjust configs to test different multipliers
- ⚠️ **Not in production** - Won't affect real bookings
- 🎯 **Ready to materialize** - Click "Promote to Production" when satisfied

### When You See No Label (Materialized)
- ✅ **Production ready** - Approved ratesheet in database
- 🔒 **Stable** - Won't change unless recalculated and re-approved
- 📊 **Tracked** - Has approval history and audit trail
- 🚀 **Live** - Actively used in booking calculations

---

## Benefits

### Quick Visual Debugging
```
🔍 Debugging Scenario:

User: "Why is this surge price different than expected?"

Before (confusing):
- SURGE: Weekend Rush Hour (priority 10700)
- SURGE: Holiday Surge (priority 10800)
→ Which one is live? Which is being tested?

After (clear):
- SURGE: Weekend Rush Hour (priority 10700)
- SURGE: Holiday Surge (Virtual) (priority 10800)
→ Holiday is virtual (testing), Weekend is materialized (live)
```

### Mode Switching Clarity
```
Switching from Live → Simulation:

Live Mode:
- 2 materialized surge ratesheets (no labels)

Simulation Mode:
- Same 2 materialized (no labels)
- 3 new virtual configs (with "Virtual" labels)
→ Instantly see which are real vs. testing
```

### Development Workflow
```
1. Create surge config → Shows as "(Virtual)"
2. Test in simulator → Adjust configs, see "(Virtual)" update
3. Promote to production → Creates materialized (no label)
4. Approve in database → Materialized now live
5. View in Live Mode → Only materialized visible (no Virtual ones)
```

---

## Examples

### Scenario 1: Testing New Surge Config

**Simulation Mode**:
```
🟠 SURGE: Black Friday Rush (Virtual)        Priority: 10900, 2.5x
🟠 SURGE: Regular Weekend Surge              Priority: 10700, 1.5x
🟠 SURGE: Weekday Off-Peak Discount          Priority: 10500, 0.8x
```

**Interpretation**:
- Black Friday is being tested (Virtual)
- Weekend and Off-Peak are live (materialized)
- Can safely test Black Friday without affecting production

---

### Scenario 2: Multiple Virtual Configs

**Simulation Mode**:
```
🟠 SURGE: Test A - Aggressive (Virtual)       Priority: 10800, 3.0x
🟠 SURGE: Test B - Moderate (Virtual)         Priority: 10700, 1.8x
🟠 SURGE: Test C - Conservative (Virtual)     Priority: 10600, 1.2x
🟠 SURGE: Current Production                  Priority: 10500, 1.5x
```

**Interpretation**:
- Testing 3 different surge strategies
- Current production surge still visible (materialized)
- Easy A/B/C comparison with current baseline

---

### Scenario 3: After Materialization

**Before Materialization (Simulation)**:
```
🟠 SURGE: Holiday Rush (Virtual)              Priority: 10700, 2.0x
```

**After Materialization & Approval (Live)**:
```
🟠 SURGE: Holiday Rush                        Priority: 10700
```

**Interpretation**:
- "(Virtual)" label removed
- Now a real, approved ratesheet
- Ready for production use

---

## Testing Checklist

- [ ] **Live Mode**: No "(Virtual)" labels visible
- [ ] **Simulation Mode with configs**: Virtual surges show "(Virtual)"
- [ ] **Simulation Mode with materialized**: No "(Virtual)" on materialized
- [ ] **Both types together**: Can distinguish virtual from materialized
- [ ] **After promotion**: Newly materialized lose "(Virtual)" label
- [ ] **Console logs**: Show "isMaterialized: true/false" correctly

---

## Notes

- "(Virtual)" label is purely cosmetic for UX clarity
- Does not affect pricing calculations or backend behavior
- Only appears in frontend waterfall display
- Backend continues to distinguish via `surgeConfigId` field
- Virtual surge ratesheets are generated by API when `includeSurge: true`
- Materialized surge ratesheets are loaded from DB regardless of `includeSurge`

---

## Related Documentation

- `SURGE_FINAL_FIX.md` - Complete fix for materialized surge pricing
- `SURGE_LIVE_MODE_FIX.md` - Initial Live Mode display fixes
- `SURGE_MATERIALIZATION_IMPLEMENTATION.md` - Original implementation docs
