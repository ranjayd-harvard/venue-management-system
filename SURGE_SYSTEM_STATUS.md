# Surge Pricing System - Current Status

**Date**: February 1, 2026
**Status**: ✅ Ready for Testing
**Last Action**: Clean slate completed - all surge configs and ratesheets deleted

---

## System Status

### ✅ Completed Features

1. **Backend Infrastructure**
   - ✅ Surge config data model ([SurgeConfig.ts](src/models/SurgeConfig.ts))
   - ✅ Materialization logic ([surge-materialization.ts](src/lib/surge-materialization.ts))
   - ✅ API endpoints for CRUD and materialization
   - ✅ Pricing engine integration ([price-engine-hourly.ts](src/lib/price-engine-hourly.ts))
   - ✅ SURGE_MULTIPLIER type support

2. **Database Integration**
   - ✅ `surge_configs` collection
   - ✅ `ratesheets` collection with `surgeConfigId` field
   - ✅ Materialized surge ratesheets loaded separately as SURGE level
   - ✅ Proper filtering by approval status

3. **Frontend UI**
   - ✅ Admin surge pricing page ([/admin/surge-pricing](src/app/admin/surge-pricing/page.tsx))
   - ✅ Create/Edit surge config modals
   - ✅ Timeline simulator integration ([/pricing/timeline-simulator](src/app/pricing/timeline-simulator/page.tsx))
   - ✅ "(Virtual)" label for unmaterialized configs
   - ✅ Orange color coding for surge layers
   - ✅ Live Mode vs Simulation Mode display logic

4. **Display & Visualization**
   - ✅ Surge ratesheets appear in waterfall
   - ✅ Correct priority ordering (10000+ range)
   - ✅ Time window constraints display
   - ✅ Calculated surge prices (not raw multipliers)
   - ✅ Mode-based layer type assignment

5. **Documentation**
   - ✅ [SURGE_PRICING.md](SURGE_PRICING.md) - Architecture
   - ✅ [SURGE_TESTING_GUIDE.md](SURGE_TESTING_GUIDE.md) - Testing workflow
   - ✅ [SURGE_FINAL_FIX.md](SURGE_FINAL_FIX.md) - Implementation details
   - ✅ [SURGE_LIVE_MODE_FIX.md](SURGE_LIVE_MODE_FIX.md) - Display fixes
   - ✅ [SURGE_VIRTUAL_LABEL.md](SURGE_VIRTUAL_LABEL.md) - Label feature
   - ✅ [DOCS_INDEX.md](DOCS_INDEX.md) - Updated index

### ⚠️ Manual Workarounds (Temporary)

1. **Approval Workflow**
   - Currently requires manual database updates
   - Must manually set `approvalStatus: 'APPROVED'` and `isActive: true`
   - UI for approval flow not yet built

### 🔧 Database State

**Current State**: Clean slate
```javascript
// All collections cleaned
db.surge_configs.countDocuments()  // → 0
db.ratesheets.countDocuments({ surgeConfigId: { $exists: true } })  // → 0
```

**Last Cleanup**: February 1, 2026
- Deleted 3 surge configs
- Deleted 2 materialized surge ratesheets
- Ready for fresh testing

---

## Key Technical Decisions

### 1. Type System
- **Virtual Surge**: Generated on-the-fly from `surge_configs` when `includeSurge: true`
- **Materialized Surge**: Physical ratesheets in DB with `type: 'SURGE_MULTIPLIER'`
- **Backend Detection**: Checks `level === 'SURGE'` and `type === 'SURGE_MULTIPLIER'`

### 2. Priority Hierarchy
```
SURGE         →  10000 + config.priority  (e.g., 10700)
EVENT         →  5000+
SUBLOCATION   →  300-1000
LOCATION      →  200-500
CUSTOMER      →  100-200
```

### 3. Display Logic
```
Live Mode (surgeEnabled: false):
  - Virtual surge: NOT VISIBLE
  - Materialized surge: VISIBLE as RATESHEET type, NO "(Virtual)" label

Simulation Mode (surgeEnabled: true):
  - Virtual surge: VISIBLE as SURGE type, WITH "(Virtual)" label
  - Materialized surge: VISIBLE as SURGE type, NO "(Virtual)" label
```

### 4. API Loading Strategy
```typescript
// Always load materialized surge ratesheets separately
const materializedSurgeRatesheets = await db.collection('ratesheets').find({
  surgeConfigId: { $exists: true },
  isActive: true,
  approvalStatus: 'APPROVED'
}).toArray();

// Mark as SURGE level for pricing engine
convertedMaterializedSurgeRatesheets.map(rs => ({
  ...rs,
  applyTo: 'SURGE'  // Critical for multiplier logic
}));

// In Simulation Mode, combine with virtual surge
const allSurgeRatesheets = [
  ...materializedSurgeRatesheets,  // Physical, approved
  ...virtualSurgeRatesheets        // Generated from configs
];
```

---

## Testing Workflow

### Quick Start
1. Navigate to [Admin > Surge Pricing](http://localhost:3000/admin/surge-pricing)
2. Create surge config with ACTIVE status
3. Test in [Timeline Simulator](http://localhost:3000/pricing/timeline-simulator) with surge toggle ON
4. Verify "(Virtual)" label appears
5. Materialize config (promote to production)
6. Manually approve in database
7. Test in Live Mode (surge toggle OFF)
8. Verify NO "(Virtual)" label

### Complete Testing Guide
See **[SURGE_TESTING_GUIDE.md](SURGE_TESTING_GUIDE.md)** for detailed phase-by-phase instructions.

---

## Files Modified (Complete List)

### Backend
1. **[/src/models/SurgeConfig.ts](src/models/SurgeConfig.ts)**
   - Added `materializedRatesheetId`, `lastMaterialized` fields
   - Fixed timestamp bug in time window check (line 162)

2. **[/src/lib/surge-materialization.ts](src/lib/surge-materialization.ts)**
   - Line 102: Changed type to `SURGE_MULTIPLIER`
   - Complete materialization logic

3. **[/src/app/api/pricing/calculate-hourly/route.ts](src/app/api/pricing/calculate-hourly/route.ts)**
   - Line 128: Exclude surge from sublocation query
   - Lines 131-150: Load materialized surge ratesheets separately
   - Lines 323-330: Convert and mark as SURGE level
   - Line 367: Add to pricing context as `surgeRatesheets`
   - Lines 533-542: Combine with virtual surge in Simulation Mode

4. **[/src/lib/price-engine-hourly.ts](src/lib/price-engine-hourly.ts)**
   - No changes needed (already supports SURGE_MULTIPLIER at line 184)

### Frontend
1. **[/src/app/pricing/timeline-simulator/page.tsx](src/app/pricing/timeline-simulator/page.tsx)**
   - Lines 858-869: Add "(Virtual)" label to virtual surge configs
   - Lines 871-906: Mode-based layer type for materialized ratesheets
   - Updated color coding for surge layers (orange)

### Migration Scripts
1. **[fix-surge-ratesheet-type.js](fix-surge-ratesheet-type.js)**
   - Updates existing ratesheets to SURGE_MULTIPLIER type

2. **[clean-surge-data.js](clean-surge-data.js)**
   - Deletes all surge configs and materialized ratesheets

### Documentation
1. **[SURGE_PRICING.md](SURGE_PRICING.md)** - Original architecture
2. **[SURGE_TESTING_GUIDE.md](SURGE_TESTING_GUIDE.md)** - NEW: Testing workflow
3. **[SURGE_FINAL_FIX.md](SURGE_FINAL_FIX.md)** - Materialized ratesheets fix
4. **[SURGE_LIVE_MODE_FIX.md](SURGE_LIVE_MODE_FIX.md)** - Display fixes
5. **[SURGE_VIRTUAL_LABEL.md](SURGE_VIRTUAL_LABEL.md)** - Label feature
6. **[SURGE_SYSTEM_STATUS.md](SURGE_SYSTEM_STATUS.md)** - This file
7. **[DOCS_INDEX.md](DOCS_INDEX.md)** - Updated with surge docs

---

## Known Issues & Workarounds

### Issue: No Approval UI
**Description**: Cannot approve ratesheets via UI
**Workaround**: Manual database update
```javascript
db.ratesheets.updateOne(
  { name: "SURGE: ..." },
  {
    $set: {
      approvalStatus: 'APPROVED',
      isActive: true,
      approvedAt: new Date()
    }
  }
)
```
**Future**: Build approval workflow UI

### Issue: Cannot View Ratesheet Details from Surge Config
**Description**: No link from surge config to materialized ratesheet
**Workaround**: Query database manually
```javascript
db.ratesheets.findOne({ surgeConfigId: ObjectId('...') })
```
**Future**: Add "View Ratesheet" button in admin UI

---

## Console Log Reference

### Live Mode (Surge Toggle OFF)
```javascript
🔍 [TIMELINE] Surge enabled: false
📊 [API] includeSurge: false
📊 [API] Materialized Surge: 1
🔍 [RATESHEET] isMaterialized: true
   mode: Live (Materialized)
🏆 [ENGINE] WINNER: SURGE MULTIPLIER
   Final Price: $13.50/hr
```

### Simulation Mode (Surge Toggle ON)
```javascript
🔍 [TIMELINE] Surge enabled: true
📊 [API] includeSurge: true
📊 [API] Virtual Surge: 1
🔍 [RATESHEET] mode: Simulation (Virtual)
🏆 [ENGINE] WINNER: SURGE MULTIPLIER
   Final Price: $13.50/hr
```

---

## Success Metrics

### What Works ✅
1. Virtual surge configs generate temporary pricing
2. Materialization creates physical ratesheets
3. DRAFT ratesheets excluded from Live Mode
4. APPROVED ratesheets appear in Live Mode
5. "(Virtual)" label distinguishes testing from production
6. Priority ordering respected (10000+ range)
7. Time windows constrain surge application
8. Base price × multiplier = correct surge price
9. Orange color coding consistent
10. Mode switching works correctly

### What Requires Manual Steps ⚠️
1. Ratesheet approval (no UI yet)
2. Viewing materialized ratesheet details
3. Recalculating surge multipliers

---

## Next Steps

### Immediate (Testing Phase)
1. **Create test surge config** following [SURGE_TESTING_GUIDE.md](SURGE_TESTING_GUIDE.md)
2. **Verify "(Virtual)" label** in Simulation Mode
3. **Materialize and approve** (manual DB update)
4. **Verify Live Mode** display without label
5. **Document test results** using template in testing guide

### Short Term (UI Enhancements)
1. Build approval workflow UI
2. Add "View Ratesheet" button to surge configs
3. Add "Recalculate Multiplier" button
4. Show materialization status badges

### Long Term (Advanced Features)
1. Automated recalculation based on real-time demand/supply
2. Bulk materialization for multiple configs
3. Surge effectiveness analytics dashboard
4. Machine learning for optimal multipliers
5. Notification system for surge activation/deactivation

---

## API Endpoints

### Surge Config Management
- `GET /api/surge-pricing/configs` - List all configs
- `POST /api/surge-pricing/configs` - Create config
- `GET /api/surge-pricing/configs/:id` - Get config
- `PUT /api/surge-pricing/configs/:id` - Update config
- `DELETE /api/surge-pricing/configs/:id` - Delete config

### Materialization
- `POST /api/surge-pricing/configs/:id/materialize` - Materialize config
- `POST /api/surge-pricing/configs/:id/recalculate` - Recalculate multiplier
- `GET /api/surge-pricing/configs/:id/ratesheet` - Get materialized ratesheet
- `DELETE /api/surge-pricing/configs/:id/ratesheet` - Archive ratesheet

### Pricing (Integrated)
- `GET /api/pricing/calculate-hourly` - Calculate pricing
  - `includeSurge=true` → Simulation Mode (virtual surge)
  - `includeSurge=false` → Live Mode (materialized surge only)

---

## Database Queries

### Find All Surge Configs
```javascript
db.surge_configs.find().pretty()
```

### Find All Materialized Surge Ratesheets
```javascript
db.ratesheets.find({ surgeConfigId: { $exists: true } }).pretty()
```

### Find Approved Surge Ratesheets
```javascript
db.ratesheets.find({
  surgeConfigId: { $exists: true },
  approvalStatus: 'APPROVED',
  isActive: true
}).pretty()
```

### Approve a Surge Ratesheet
```javascript
db.ratesheets.updateOne(
  { name: "SURGE: Weekend Rush Hour" },
  {
    $set: {
      approvalStatus: 'APPROVED',
      isActive: true,
      approvedBy: ObjectId('...'),  // Optional
      approvedAt: new Date()
    }
  }
)
```

### Delete All Surge Data (Clean Slate)
```javascript
// Delete surge configs
db.surge_configs.deleteMany({})

// Delete materialized ratesheets
db.ratesheets.deleteMany({ surgeConfigId: { $exists: true } })

// Verify cleanup
db.surge_configs.countDocuments()  // Should be 0
db.ratesheets.countDocuments({ surgeConfigId: { $exists: true } })  // Should be 0
```

---

## Quick Reference

### Virtual vs Materialized

| Aspect | Virtual Surge | Materialized Surge |
|--------|--------------|-------------------|
| **Source** | `surge_configs` collection | `ratesheets` collection |
| **When Visible** | Simulation Mode only | Both modes |
| **Label** | "(Virtual)" | No label |
| **Layer Type** | SURGE | RATESHEET (Live) / SURGE (Simulation) |
| **Production Ready** | ❌ Testing only | ✅ Approved, production |
| **Can Modify** | ✓ Edit config | ✗ Requires recalculation |
| **Approval Required** | ❌ | ✅ Draft → Pending → Approved |

### Priority Ranges

| Level | Priority Range | Example |
|-------|---------------|---------|
| SURGE | 10000 + config.priority | 10700 (SUBLOCATION) |
| EVENT | 5000+ | 5000-5999 |
| SUBLOCATION | 300-1000 | 700 |
| LOCATION | 200-500 | 400 |
| CUSTOMER | 100-200 | 100 |

### Color Coding

| Layer Type | Color | Gradient |
|-----------|-------|----------|
| SURGE | Orange | `bg-gradient-to-br from-orange-400 to-orange-600` |
| EVENT | Red | `bg-gradient-to-br from-red-400 to-red-600` |
| SUBLOCATION | Purple | `bg-gradient-to-br from-purple-400 to-purple-600` |
| LOCATION | Green | `bg-gradient-to-br from-green-400 to-green-600` |
| CUSTOMER | Blue | `bg-gradient-to-br from-blue-400 to-blue-600` |

---

## Support

### Documentation
- Architecture: [SURGE_PRICING.md](SURGE_PRICING.md)
- Testing: [SURGE_TESTING_GUIDE.md](SURGE_TESTING_GUIDE.md)
- Fixes: [SURGE_FINAL_FIX.md](SURGE_FINAL_FIX.md), [SURGE_LIVE_MODE_FIX.md](SURGE_LIVE_MODE_FIX.md)
- Labels: [SURGE_VIRTUAL_LABEL.md](SURGE_VIRTUAL_LABEL.md)

### Migration Scripts
- Type fix: [fix-surge-ratesheet-type.js](fix-surge-ratesheet-type.js)
- Clean slate: [clean-surge-data.js](clean-surge-data.js)

### Key Files
- Model: [src/models/SurgeConfig.ts](src/models/SurgeConfig.ts)
- Materialization: [src/lib/surge-materialization.ts](src/lib/surge-materialization.ts)
- API: [src/app/api/pricing/calculate-hourly/route.ts](src/app/api/pricing/calculate-hourly/route.ts)
- UI: [src/app/pricing/timeline-simulator/page.tsx](src/app/pricing/timeline-simulator/page.tsx)

---

**Last Updated**: February 1, 2026
**Status**: ✅ Ready for end-to-end testing
**Next Step**: Follow [SURGE_TESTING_GUIDE.md](SURGE_TESTING_GUIDE.md) for complete testing workflow
