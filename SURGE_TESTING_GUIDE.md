# Surge Pricing Testing Guide - Clean Slate Workflow

**Date**: February 1, 2026
**Status**: Ready for Testing
**Prerequisites**: All surge configs and ratesheets cleaned (completed)

---

## Overview

This guide walks through testing the complete surge pricing materialization workflow from scratch, after cleaning all existing surge data.

### What We're Testing

1. **Virtual Surge Pricing** - Create surge configs and test in Simulation Mode
2. **Virtual Label Display** - Verify "(Virtual)" label appears correctly
3. **Materialization Process** - Convert virtual configs to physical ratesheets
4. **Approval Workflow** - Approve ratesheets for production use
5. **Live Mode Display** - Verify materialized ratesheets work without "(Virtual)" label
6. **Pricing Calculations** - Verify correct surge prices throughout workflow

---

## Test Scenario: Weekend Rush Hour Surge

We'll create a simple surge pricing scenario for weekend peak hours.

### Scenario Details

- **Name**: Weekend Rush Hour
- **Level**: SUBLOCATION (priority 700)
- **Time Windows**: Saturday-Sunday, 10:00 AM - 6:00 PM
- **Demand/Supply**: 150 demand / 50 supply (3x pressure)
- **Expected Multiplier**: ~1.35x (based on logarithmic formula)
- **Effective Dates**: Next weekend (Feb 8-9, 2026)
- **Base Price**: $10.00/hr
- **Expected Surge Price**: $13.50/hr

---

## Phase 1: Create Virtual Surge Config

### Steps

1. **Navigate to Admin > Surge Pricing**
   ```
   URL: http://localhost:3000/admin/surge-pricing
   ```

2. **Click "Create Surge Config"**

3. **Fill in the form**:
   ```
   Name: Weekend Rush Hour
   Description: Premium pricing for weekend peak hours

   Level: SUBLOCATION
   Entity: Select your test sublocation
   Priority: 700

   Demand/Supply Parameters:
   - Current Demand: 150
   - Current Supply: 50
   - Historical Avg Pressure: 1.0

   Surge Parameters:
   - Alpha: 0.5
   - Min Multiplier: 1.0
   - Max Multiplier: 2.0
   - EMA Alpha: 0.3

   Temporal Settings:
   - Effective From: 2026-02-08 00:00
   - Effective To: 2026-02-09 23:59

   Time Windows:
   - Start Time: 10:00
   - End Time: 18:00
   - Days: Saturday, Sunday

   Status: ACTIVE ✓
   ```

4. **Save the config**

### Expected Results

✅ Surge config created with ID (e.g., `67a1b2c3d4e5f6789...`)
✅ Config shows as ACTIVE in admin list
✅ No materialized ratesheet yet (`materializedRatesheetId: null`)

---

## Phase 2: Test Virtual Surge in Simulation Mode

### Steps

1. **Navigate to Timeline Simulator**
   ```
   URL: http://localhost:3000/pricing/timeline-simulator
   ```

2. **Select Test Parameters**:
   - Customer: Select your test customer
   - Location: Select location with the sublocation used in config
   - SubLocation: Select sublocation from surge config
   - Date Range: Feb 8-9, 2026 (Saturday-Sunday)

3. **Enable Surge Pricing Toggle**:
   - Click the "Surge Pricing" toggle to ON
   - Indicator should turn orange

4. **Click "Calculate Pricing"**

### Expected Results

✅ **Waterfall Display** shows:
```
🟠 SURGE: Weekend Rush Hour (Virtual)     Priority: 10700, 1.35x
🟣 SubLocation-1 Default                  Priority: 700
🟢 Location-1 (USPS Manhattan Midtown)   Priority: 500
🔵 Customer-1 Default                     Priority: 100
```

✅ **"(Virtual)" label** appears on surge layer
✅ **Orange color** for surge layer
✅ **Priority 10700** (10000 + 700)
✅ **Time windows**: Only 10 AM - 6 PM on Sat-Sun show surge
✅ **Surge tiles**: Show calculated price ($13.50) not multiplier (1.35)

### Console Logs to Check

```javascript
🔍 [TIMELINE] Surge enabled: true
📊 [API] includeSurge: true
🎯 [API] Found 1 applicable surge config(s)
   - Weekend Rush Hour (Priority: 700)
🏆 [ENGINE] WINNER: SURGE MULTIPLIER
   [ENGINE]    Surge Config: SURGE: Weekend Rush Hour (Virtual)
   [ENGINE]    Base: SubLocation-1 Default ($10.00/hr)
   [ENGINE]    Multiplier: 1.35x
   [ENGINE]    Final Price: $13.50/hr
```

### Screenshots to Capture

1. Waterfall with "(Virtual)" label
2. Winning section showing surge as winner
3. Console logs showing virtual surge processing

---

## Phase 3: Test Virtual Surge Adjustments

### Purpose
Verify that virtual surge configs can be modified and retested without materialization.

### Steps

1. **Return to Admin > Surge Pricing**

2. **Edit the surge config**:
   - Change demand from 150 to 200 (4x pressure)
   - Expected new multiplier: ~1.5x

3. **Save and return to Timeline Simulator**

4. **Recalculate with surge toggle ON**

### Expected Results

✅ Surge multiplier updates to 1.5x
✅ Surge price updates to $15.00/hr
✅ Still shows "(Virtual)" label
✅ No database ratesheets created

---

## Phase 4: Materialize Surge Config

### Steps

1. **Navigate to Admin > Surge Pricing**

2. **Find "Weekend Rush Hour" config**

3. **Click "Activate & Materialize"**
   - (Or equivalent button to trigger materialization)

4. **Verify materialization API call**:
   ```
   POST /api/surge-pricing/configs/{id}/materialize
   ```

5. **Check database**:
   ```javascript
   // MongoDB query
   db.ratesheets.find({ surgeConfigId: { $exists: true } })
   ```

### Expected Results

✅ **API Response**:
```json
{
  "ratesheet": {
    "_id": "67a1b2c3d4e5f6789...",
    "name": "SURGE: Weekend Rush Hour",
    "type": "SURGE_MULTIPLIER",
    "priority": 10700,
    "approvalStatus": "DRAFT",
    "isActive": false,
    "surgeConfigId": "67a1b2c3d4e5f6789...",
    "surgeMultiplierSnapshot": 1.5,
    "timeWindows": [
      {
        "startTime": "10:00",
        "endTime": "18:00",
        "daysOfWeek": [6, 0],
        "pricePerHour": 1.5
      }
    ]
  },
  "multiplier": 1.5
}
```

✅ **Surge Config Updated**:
- `materializedRatesheetId`: Points to new ratesheet
- `lastMaterialized`: Current timestamp

✅ **Ratesheet in Database**:
- Status: DRAFT
- Type: SURGE_MULTIPLIER
- Priority: 10700
- Has `surgeConfigId` field

---

## Phase 5: Test DRAFT Status (Should Not Affect Pricing)

### Steps

1. **Navigate to Timeline Simulator**

2. **Disable Surge Toggle** (Live Mode)

3. **Calculate pricing**

### Expected Results

✅ **No surge layers appear** in waterfall
✅ SubLocation Default wins (priority 700)
✅ Price shows base price ($10.00), not surge ($15.00)
✅ Console logs show:
```javascript
📊 [API] includeSurge: false
📊 [API] Materialized Surge: 0 (ratesheets loaded but filtered out - DRAFT status)
```

**Why**: DRAFT ratesheets are excluded by `approvalStatus: 'APPROVED'` filter in API.

---

## Phase 6: Approve Ratesheet (Manual Database Update)

### Steps

1. **Open MongoDB client** (Compass, CLI, or script)

2. **Find the materialized ratesheet**:
   ```javascript
   db.ratesheets.find({
     name: "SURGE: Weekend Rush Hour"
   })
   ```

3. **Update approval status**:
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

4. **Verify update**:
   ```javascript
   db.ratesheets.findOne({ name: "SURGE: Weekend Rush Hour" })
   ```

### Expected Results

✅ Ratesheet updated:
```json
{
  "_id": "...",
  "name": "SURGE: Weekend Rush Hour",
  "approvalStatus": "APPROVED",
  "isActive": true,
  "approvedAt": ISODate("2026-02-01T...")
}
```

---

## Phase 7: Test Materialized Surge in Live Mode

### Steps

1. **Refresh Timeline Simulator page**
   - Important: Refresh to clear any cached data

2. **Ensure Surge Toggle is OFF** (Live Mode)

3. **Select same parameters**:
   - Same customer/location/sublocation
   - Same date range (Feb 8-9)

4. **Calculate pricing**

### Expected Results - Waterfall Display

✅ **Surge layer appears** WITHOUT "(Virtual)" label:
```
🟠 SURGE: Weekend Rush Hour              Priority: 10700
🟣 SubLocation-1 Default                  Priority: 700
🟢 Location-1 (USPS Manhattan Midtown)   Priority: 500
🔵 Customer-1 Default                     Priority: 100
```

✅ **Orange color** maintained
✅ **No "(Virtual)" label** (this is the key difference!)
✅ **Priority 10700**
✅ **Surge wins** over sublocation default

### Expected Results - Pricing

✅ **10 AM - 6 PM Saturday**: $15.00/hr (surge applied)
✅ **10 AM - 6 PM Sunday**: $15.00/hr (surge applied)
✅ **Other hours**: $10.00/hr (base price, no surge)

### Expected Results - Console Logs

```javascript
🔍 [TIMELINE] Surge enabled: false
📊 [API] includeSurge: false
📊 [API] Fetched ratesheets:
   [API]   Customer: 0
   [API]   Location: 1
   [API]   Sublocation: 6
   [API]   Materialized Surge: 1  ← KEY: Loaded separately
   [API]   Virtual Surge: 0

🔍 [RATESHEET] Processing: SURGE: Weekend Rush Hour
   hasSurgeConfigId: true
   surgeConfigId: 67a1b2c3d4e5f6789...
   isMaterialized: true
   priority: 10700
   surgeEnabled: false
   mode: Live (Materialized)

🏆 [ENGINE] WINNER: SURGE MULTIPLIER
   [ENGINE]    Level: SURGE (priority: 10700)
   [ENGINE]    Type: SURGE_MULTIPLIER
   [ENGINE]    Surge Config: SURGE: Weekend Rush Hour
   [ENGINE]    Base: SubLocation-1 Default ($10.00/hr)
   [ENGINE]    Multiplier: 1.5x
   [ENGINE]    Final Price: $15.00/hr
```

---

## Phase 8: Test Both Modes Side-by-Side

### Purpose
Verify the distinction between virtual and materialized surge ratesheets.

### Steps

1. **Live Mode (Toggle OFF)**:
   - Calculate pricing
   - Screenshot waterfall - should show "SURGE: Weekend Rush Hour" (no label)

2. **Simulation Mode (Toggle ON)**:
   - Calculate pricing
   - Screenshot waterfall - should STILL show "SURGE: Weekend Rush Hour" (no label)

### Expected Results

✅ **Live Mode**:
- Surge layer: "SURGE: Weekend Rush Hour" (no label)
- Layer type: RATESHEET
- Uses regular ratesheet pricing logic

✅ **Simulation Mode**:
- Same surge layer: "SURGE: Weekend Rush Hour" (no label)
- Layer type: SURGE
- Can combine with virtual surge configs if any exist

**Important**: Since this surge config has been materialized, it will NOT show "(Virtual)" label in either mode. The "(Virtual)" label only appears for unmaterialized surge configs.

---

## Phase 9: Create Second Virtual Surge Config (For Label Testing)

### Purpose
Test "(Virtual)" label by having both materialized and virtual surge configs.

### Steps

1. **Create a new surge config**:
   ```
   Name: Evening Premium
   Level: SUBLOCATION (same sublocation)
   Priority: 800
   Time Windows: Monday-Friday, 5 PM - 9 PM
   Demand: 100, Supply: 50
   Status: ACTIVE
   ```

2. **Do NOT materialize** this config

3. **Go to Timeline Simulator**

4. **Enable Surge Toggle** (Simulation Mode)

5. **Calculate pricing**

### Expected Results - Waterfall Display

✅ Should show BOTH surge layers:
```
🟠 SURGE: Evening Premium (Virtual)       Priority: 10800  ← Virtual, has label
🟠 SURGE: Weekend Rush Hour               Priority: 10700  ← Materialized, no label
🟣 SubLocation-1 Default                  Priority: 700
🟢 Location-1 (USPS Manhattan Midtown)   Priority: 500
🔵 Customer-1 Default                     Priority: 100
```

✅ **Evening Premium has "(Virtual)" label** - unmaterialized config
✅ **Weekend Rush Hour has NO label** - materialized ratesheet
✅ **Clear visual distinction** between testing and production

---

## Phase 10: Test Priority Ordering

### Purpose
Verify that multiple surge ratesheets respect priority ordering.

### Test Case 1: Non-Overlapping Time Windows

**Scenario**: Weekend Rush (Sat-Sun 10-18) vs Evening Premium (Mon-Fri 17-21)

**Expected**: No overlap, each surge applies during its time window

### Test Case 2: Create Overlapping Surge Config

**Steps**:
1. Create third surge config:
   ```
   Name: Super Peak
   Priority: 900
   Time Windows: Saturday-Sunday, 2 PM - 4 PM
   ```

2. Test on Saturday at 3 PM

**Expected**: Super Peak wins (priority 10900) over Weekend Rush (priority 10700)

---

## Verification Checklist

### Visual Checks

- [ ] Virtual surge configs show "(Virtual)" label in Simulation Mode
- [ ] Materialized surge ratesheets do NOT show "(Virtual)" label
- [ ] All surge layers are orange colored
- [ ] Priority values in 10000+ range
- [ ] Time windows display correctly
- [ ] Surge tiles show calculated prices (not multipliers)

### Functional Checks

- [ ] Virtual surge pricing works in Simulation Mode
- [ ] Materialized surge pricing works in Live Mode
- [ ] DRAFT ratesheets do not affect pricing
- [ ] APPROVED ratesheets affect pricing
- [ ] Priority ordering respected with multiple surge configs
- [ ] Time windows constrain surge application correctly
- [ ] Date ranges constrain surge application correctly

### Data Integrity Checks

- [ ] Surge configs have `materializedRatesheetId` after materialization
- [ ] Ratesheets have `surgeConfigId` linking back to config
- [ ] Ratesheet type is `SURGE_MULTIPLIER`
- [ ] Ratesheet priority is `10000 + config.priority`
- [ ] Time windows copied correctly from config to ratesheet
- [ ] Surge multiplier snapshot recorded in ratesheet

### API Checks

- [ ] `GET /api/pricing/calculate-hourly` with `includeSurge: false` loads materialized ratesheets
- [ ] `GET /api/pricing/calculate-hourly` with `includeSurge: true` loads both virtual and materialized
- [ ] Console logs show correct surge ratesheet counts
- [ ] Pricing calculations show SURGE_MULTIPLIER logic being applied
- [ ] Base price × multiplier = surge price (math checks out)

---

## Common Issues & Solutions

### Issue 1: "(Virtual)" Label Not Appearing

**Symptoms**: All surge layers show without label

**Root Cause**: All surge configs have been materialized

**Solution**: Create new surge config without materializing it

### Issue 2: Surge Not Appearing in Live Mode

**Symptoms**: Materialized ratesheets don't show in waterfall

**Checklist**:
- [ ] Ratesheet `approvalStatus` is `APPROVED`
- [ ] Ratesheet `isActive` is `true`
- [ ] Date range includes ratesheet `effectiveFrom`/`effectiveTo`
- [ ] Time windows match selected date/time
- [ ] Console shows "Materialized Surge: 1+"

### Issue 3: Showing Multiplier Instead of Price

**Symptoms**: Tiles show "$1.5" instead of "$15.00"

**Root Cause**: Ratesheet type is not `SURGE_MULTIPLIER`

**Solution**:
```javascript
// Fix ratesheet type
db.ratesheets.updateOne(
  { surgeConfigId: { $exists: true } },
  { $set: { type: 'SURGE_MULTIPLIER' } }
)
```

### Issue 4: Wrong Priority Range

**Symptoms**: Priority shows 20000+ instead of 10000+

**Root Cause**: Surge config has priority 10700 instead of 700

**Solution**: Update surge config priority to correct range (100-1000)

---

## Success Criteria

### Phase 1-3: Virtual Surge (Testing)
✅ Surge configs work as virtual pricing rules
✅ "(Virtual)" label appears in Simulation Mode
✅ Can test and adjust without affecting production
✅ No database ratesheets created

### Phase 4-6: Materialization (Transition)
✅ Materialization creates physical ratesheet
✅ DRAFT status prevents affecting production
✅ Approval process works (manual DB update for now)
✅ Ratesheet correctly linked to source config

### Phase 7-8: Production (Live)
✅ Approved ratesheets appear in Live Mode
✅ No "(Virtual)" label on materialized ratesheets
✅ Correct surge prices calculated
✅ Priority ordering respected

### Phase 9-10: Mixed Scenarios
✅ Can have both virtual and materialized surge configs
✅ Visual distinction clear (with/without label)
✅ Multiple surge configs with priority ordering work
✅ Overlapping time windows handled correctly

---

## Next Steps After Testing

1. **Document any issues found** in testing
2. **Create approval workflow UI** (currently manual DB update)
3. **Add bulk materialization** for multiple configs
4. **Build monitoring dashboard** for surge effectiveness
5. **Implement automated recalculation** based on real-time demand/supply
6. **Add notification system** for surge activation/deactivation

---

## Documentation References

- **[SURGE_PRICING.md](SURGE_PRICING.md)** - Complete surge pricing system architecture
- **[SURGE_FINAL_FIX.md](SURGE_FINAL_FIX.md)** - Materialized ratesheet implementation details
- **[SURGE_LIVE_MODE_FIX.md](SURGE_LIVE_MODE_FIX.md)** - Layer type and display fixes
- **[SURGE_VIRTUAL_LABEL.md](SURGE_VIRTUAL_LABEL.md)** - "(Virtual)" label feature documentation
- **[TIMELINE_SIMULATOR.md](TIMELINE_SIMULATOR.md)** - Timeline simulator usage guide

---

## Test Results Template

Use this template to document test results:

```
## Test Results - [Date]

### Environment
- Database: [MongoDB connection string]
- Server: [http://localhost:3000]
- Browser: [Chrome/Firefox/Safari]

### Phase 1: Create Virtual Surge Config
- [✓/✗] Config created successfully
- [✓/✗] Shows as ACTIVE
- Notes: ___________

### Phase 2: Test Virtual Surge in Simulation Mode
- [✓/✗] "(Virtual)" label appears
- [✓/✗] Orange color correct
- [✓/✗] Priority 10000+ range
- [✓/✗] Surge price calculated correctly
- Screenshots: ___________
- Notes: ___________

### Phase 3: Test Virtual Surge Adjustments
- [✓/✗] Config updates reflected
- [✓/✗] No ratesheets created
- Notes: ___________

### Phase 4: Materialize Surge Config
- [✓/✗] Materialization successful
- [✓/✗] DRAFT ratesheet created
- [✓/✗] Type is SURGE_MULTIPLIER
- [✓/✗] Priority correct
- Notes: ___________

### Phase 5: Test DRAFT Status
- [✓/✗] No surge in Live Mode
- [✓/✗] DRAFT excluded from pricing
- Notes: ___________

### Phase 6: Approve Ratesheet
- [✓/✗] Approval update successful
- [✓/✗] Status is APPROVED
- [✓/✗] isActive is true
- Notes: ___________

### Phase 7: Test Materialized Surge in Live Mode
- [✓/✗] Surge layer appears
- [✓/✗] NO "(Virtual)" label
- [✓/✗] Surge price correct
- [✓/✗] Priority ordering correct
- Screenshots: ___________
- Notes: ___________

### Phase 8: Test Both Modes Side-by-Side
- [✓/✗] Live Mode: No label
- [✓/✗] Simulation Mode: No label
- [✓/✗] Both modes work correctly
- Screenshots: ___________
- Notes: ___________

### Phase 9: Create Second Virtual Surge Config
- [✓/✗] Second config created
- [✓/✗] "(Virtual)" label appears on second
- [✓/✗] No label on first (materialized)
- [✓/✗] Clear distinction visible
- Screenshots: ___________
- Notes: ___________

### Phase 10: Test Priority Ordering
- [✓/✗] Non-overlapping windows work
- [✓/✗] Overlapping windows respect priority
- [✓/✗] Highest priority wins
- Notes: ___________

### Overall Result
- [✓/✗] All critical tests passed
- Issues found: ___________
- Action items: ___________
```

---

**Ready to test!** Follow the phases in order to verify the complete surge pricing workflow. Good luck! 🚀
