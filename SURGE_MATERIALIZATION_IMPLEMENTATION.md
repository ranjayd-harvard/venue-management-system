# Surge Materialization Implementation Summary

**Date**: February 13, 2026
**Status**: ✅ Phase 1 & 2 Complete (Backend + Core UI + Temporal Scoping)

## Overview

Successfully implemented surge materialization feature that transforms virtual surge pricing configurations into physical, manageable surge ratesheets following the standard approval workflow.

---

## What Was Implemented

### 1. Data Model Updates

#### SurgeConfig Model ([src/models/types.ts](src/models/types.ts))
Added materialization tracking and duration fields:
```typescript
materializedRatesheetId?: ObjectId;  // Reference to physical ratesheet
lastMaterialized?: Date;              // Timestamp of last materialization
surgeDurationHours?: number;          // Duration of materialized ratesheet (default: 1 hour)
```

#### Ratesheet Model ([src/models/Ratesheet.ts](src/models/Ratesheet.ts))
Added surge metadata fields:
```typescript
surgeConfigId?: ObjectId;             // Back-reference to source config
surgeMultiplierSnapshot?: number;     // Multiplier at materialization time
demandSupplySnapshot?: {              // Historical demand/supply data
  demand: number;
  supply: number;
  pressure: number;
  timestamp: Date;
};
```

**Bug Fix**: Fixed line 162 in [src/models/SurgeConfig.ts](src/models/SurgeConfig.ts) - replaced `timestamp` with `rangeStart`.

---

### 2. Core Materialization Logic

Created [src/lib/surge-materialization.ts](src/lib/surge-materialization.ts) with the following functions:

#### `calculateSurgeMultiplier(config: SurgeConfig): number`
- Calculates surge multiplier using logarithmic scaling
- Formula: `1 + alpha * log(pressure / historicalAvgPressure)`
- Clamps result to `[minMultiplier, maxMultiplier]` bounds
- Returns the surge factor (e.g., 1.35 for 35% increase)

#### `generateTimeWindows(config: SurgeConfig, multiplier: number, demandHour?: Date): TimeWindow[]`
- Converts surge config time windows to ratesheet time windows
- If `demandHour` provided (demand-driven): returns single window for next hour, duration from `config.surgeDurationHours` (default: 1)
- If no time windows specified: returns 24/7 coverage
- Preserves `daysOfWeek` from surge config time windows when present
- Stores multiplier in `pricePerHour` field

#### `materializeSurgeConfig(configId, userId?, options?): Promise<Ratesheet>`
- Creates a physical DRAFT surge ratesheet from a config
- **Always temporary**: `effectiveTo = effectiveFrom + surgeDurationHours` (default: 1 hour)
- `options.demandHour` (optional): when provided, scopes ratesheet to next hour from demand observation
- Without `demandHour` (manual path): starts from config's `effectiveFrom`
- Priority: `10000 + config.priority` (ensures surge wins over all other layers)
- Captures demand/supply snapshot at materialization time
- Updates surge config with `materializedRatesheetId` reference

#### `recalculateSurgeConfig(configId): Promise<{oldMultiplier, newMultiplier, ratesheet}>`
- Recalculates surge multiplier with latest demand/supply data
- Creates new DRAFT ratesheet with updated multiplier
- Returns comparison showing percentage change

#### `archiveSurgeRatesheet(configId): Promise<boolean>`
- Soft-deletes materialized ratesheet (sets `isActive = false`)
- Does not delete the ratesheet, just deactivates it

#### `getMaterializedRatesheet(configId): Promise<{ratesheet, status}>`
- Retrieves the materialized ratesheet for a config
- Returns status: 'none' | 'draft' | 'pending' | 'approved' | 'rejected'

---

### 3. API Endpoints

#### POST `/api/surge-pricing/configs/[id]/materialize`
**Purpose**: Materialize a surge config into a physical ratesheet
**Request**: `{ userId?: string }` (optional)
**Response**:
```json
{
  "success": true,
  "ratesheet": { ... },
  "multiplier": 1.35
}
```

#### POST `/api/surge-pricing/configs/[id]/recalculate`
**Purpose**: Recalculate multiplier and create new DRAFT
**Response**:
```json
{
  "success": true,
  "oldMultiplier": 1.35,
  "newMultiplier": 1.47,
  "ratesheet": { ... },
  "changePercent": "8.9%"
}
```

#### GET `/api/surge-pricing/configs/[id]/ratesheet`
**Purpose**: Get materialized ratesheet status
**Response**:
```json
{
  "ratesheet": { ... } | null,
  "status": "approved"
}
```

#### DELETE `/api/surge-pricing/configs/[id]/ratesheet`
**Purpose**: Archive materialized ratesheet
**Response**:
```json
{
  "success": true
}
```

---

### 4. Admin UI Updates

Enhanced [src/app/admin/surge-pricing/page.tsx](src/app/admin/surge-pricing/page.tsx) with:

#### Materialization Status Badge
Shows status for each surge config:
- 🔴 **Not Materialized**: No ratesheet created yet
- 📄 **Draft**: Ratesheet created but not submitted
- ⏰ **Pending Approval**: Submitted and awaiting review
- ✅ **Approved**: Live and active
- ❌ **Rejected**: Rejected by approver

#### Action Buttons
**For non-materialized configs**:
- 🚀 **Materialize to Ratesheet** - Creates DRAFT ratesheet

**For materialized configs**:
- 🔄 **Recalculate** - Updates multiplier with fresh demand/supply data
- 📄 **View Ratesheet** - Opens ratesheet in new tab (for approval workflow)

#### Live Multiplier Display
Shows last materialized multiplier: "Last materialized: 1.350x"

---

### 5. Timeline Simulator - Promote to Production

Enhanced [src/app/pricing/timeline-simulator/page.tsx](src/app/pricing/timeline-simulator/page.tsx) with:

#### Promote to Production Button
- Only visible when:
  - A scenario is loaded
  - Surge pricing is enabled
  - At least one surge config is active
- Shows count: "Materialize 2 surge configs"

#### Promotion Flow
1. User clicks "Promote to Production"
2. System finds all active surge configs used in the scenario
3. Materializes each config into a DRAFT ratesheet
4. Shows results summary:
   ```
   🎉 Promotion Complete!

   ✅ Test Surge - High Priority: 1.350x
   ✅ Test Surge - Low Priority: 1.070x

   ✅ Success: 2
   ❌ Failed: 0

   Navigate to Admin > Surge Pricing to review and submit for approval.
   ```
5. Optionally opens admin page for review

---

## Architecture Highlights

### Priority Hierarchy
Surge ratesheets use priority `10000 + config.priority`:
```
SURGE RATESHEETS     →  Priority 10000+  (Highest - always wins)
EVENT RATESHEETS     →  Priority 5000+
SUBLOCATION RATESHEETS → Priority 300-1000
LOCATION RATESHEETS   →  Priority 200-500
CUSTOMER RATESHEETS   →  Priority 100-200
```

### Approval Workflow
Surge ratesheets follow the same workflow as regular ratesheets:
1. **DRAFT** - Created by materialization, not yet submitted
2. **PENDING_APPROVAL** - Submitted for review
3. **APPROVED** - Live and active in pricing engine
4. **REJECTED** - Rejected by approver, needs revision

### Lifecycle State Machine
```
[Surge Config INACTIVE]
         │
         │ User clicks "Activate & Materialize"
         ↓
[Materialization Process]
   - Calculate surge multiplier
   - Generate time windows
   - Create DRAFT ratesheet
         │
         ↓
[Surge Ratesheet DRAFT]
         │
         │ User submits for approval
         ↓
[Surge Ratesheet PENDING]
         │
         ├─→ [APPROVED] → Goes live in pricing engine
         └─→ [REJECTED] → Needs revision
```

---

## How It Works - End-to-End Example

### Scenario: Weekend Rush Hour Surge

1. **Planning (Timeline Simulator)**:
   - User creates surge config:
     - Name: "Weekend Rush Hour"
     - Level: SUBLOCATION
     - Demand: 150, Supply: 50 (3x pressure)
     - Time windows: Sat-Sun, 10:00-18:00
   - Tests in simulation mode
   - Saves as scenario "Weekend Rush Strategy"

2. **Promotion**:
   - User clicks "Promote to Production"
   - System materializes surge config
   - Creates DRAFT ratesheet:
     - Name: "SURGE: Weekend Rush Hour"
     - Priority: 10700 (10000 + 700)
     - Multiplier: 1.35x (calculated from 3x pressure)
     - Time windows: Sat-Sun 10:00-18:00 (with daysOfWeek preserved)
     - Duration: `effectiveFrom` + `surgeDurationHours` (e.g. 1 hour)
     - Status: DRAFT

3. **Approval**:
   - User navigates to Admin > Surge Pricing
   - Sees materialization status: "Draft"
   - Clicks "View Ratesheet"
   - Submits for approval
   - Manager approves

4. **Goes Live**:
   - Pricing engine automatically picks up APPROVED surge ratesheet
   - Weekend bookings 10 AM - 6 PM now have 1.35x multiplier
   - Surge layer appears in timeline waterfall

5. **Recalculation**:
   - Demand increases to 200 (4x pressure)
   - User clicks "Recalculate"
   - System creates new DRAFT with 1.5x multiplier
   - Old APPROVED ratesheet remains active until new one is approved

---

## Testing Checklist

### ✅ Data Model
- [x] SurgeConfig has materialization fields
- [x] Ratesheet has surge metadata fields
- [x] Bug fix: timestamp → rangeStart

### ✅ Core Logic
- [x] Surge multiplier calculation works correctly
- [x] Time window generation handles all cases
- [x] Materialization creates DRAFT ratesheets
- [x] Recalculation shows old vs new multiplier
- [x] Archive soft-deletes ratesheets

### ✅ API Endpoints
- [x] POST /materialize creates ratesheet
- [x] POST /recalculate updates multiplier
- [x] GET /ratesheet returns status
- [x] DELETE /ratesheet archives

### ✅ Admin UI
- [x] Materialization status badges display
- [x] Materialize button creates DRAFT
- [x] Recalculate button updates multiplier
- [x] View Ratesheet opens in new tab

### ✅ Timeline Simulator
- [x] Promote to Production button appears
- [x] Promotion materializes all surge configs
- [x] Success/failure results displayed
- [x] Navigation to admin page

---

## Next Steps (Future Enhancements)

### Phase 3: Advanced Features (Not Implemented Yet)
1. **Automated Recalculation**: Scheduled job to recalculate surge multipliers
2. **ML-Powered Surge**: Machine learning to predict optimal multipliers
3. **Surge Templates**: Pre-defined patterns (Holiday Rush, Weather Event, etc.)
4. **Bulk Import**: CSV upload for multiple surge configs
5. **Analytics Dashboard**: Track surge effectiveness, revenue impact

### Phase 4: Production Deployment
1. **Database Migrations**: Add indexes for performance
2. **User Permissions**: Role-based access for approval workflow
3. **Notifications**: Email/Slack when surge ratesheets need approval
4. **Conflict Detection**: Warn if surge configs overlap
5. **Audit Trail**: Track all materialization/recalculation events

---

## Files Modified

### Models
- `src/models/types.ts` - Added materialization fields and `surgeDurationHours` to SurgeConfig
- `src/models/Ratesheet.ts` - Added surge metadata fields
- `src/models/SurgeConfig.ts` - Fixed timestamp bug

### Core Logic
- `src/lib/surge-materialization.ts` - **NEW** - All materialization functions
  - `generateTimeWindows()` - Supports `demandHour` for predictive scoping, preserves `daysOfWeek`
  - `materializeSurgeConfig()` - Supports `options.demandHour`, always-temporary via `surgeDurationHours`

### API Routes
- `src/app/api/surge-pricing/configs/[id]/materialize/route.ts` - **NEW**
- `src/app/api/surge-pricing/configs/[id]/recalculate/route.ts` - **NEW**
- `src/app/api/surge-pricing/configs/[id]/ratesheet/route.ts` - **NEW**

### UI Pages
- `src/app/admin/surge-pricing/page.tsx` - Added materialization UI, shows `surgeDurationHours` in config tile
- `src/components/CreateSurgeConfigModal.tsx` - Added `surgeDurationHours` field
- `src/components/EditSurgeConfigModal.tsx` - Added `surgeDurationHours` field
- `src/app/pricing/timeline-simulator/page.tsx` - Added Promote to Production, surge multiplier on orange waterfall tiles

---

## Summary

✅ **Complete**: Backend infrastructure, core logic, API endpoints, and admin UI
✅ **Ready**: For testing and initial production use
⏳ **Pending**: Advanced features, analytics, automation (future phases)

The surge materialization feature successfully bridges the gap between simulation and production, enabling users to:
1. Test surge pricing in simulation mode
2. Promote successful scenarios to production
3. Follow standard approval workflow
4. Manage surge ratesheets like any other ratesheet

This provides full lifecycle management from planning → simulation → production → analytics.
