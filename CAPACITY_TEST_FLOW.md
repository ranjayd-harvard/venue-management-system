# Capacity & Revenue Goals - Test Flow

This document provides a comprehensive testing flow for the capacity and revenue goal management system.

---

## Prerequisites

1. Application running locally
2. MongoDB connection established
3. Neo4j connection established (optional for full testing)
4. At least one Customer, Location, and SubLocation in the database

---

## Test Flow Overview

1. **Basic Capacity Bounds Management**
2. **Daily Capacity Overrides**
3. **Revenue Goals Management**
4. **Hierarchical Aggregation**
5. **API Endpoint Testing**
6. **Edge Cases and Validation**
7. **Neo4j Sync Verification**

---

## 1. Basic Capacity Bounds Management

### Test 1.1: View Default Capacity Bounds

**Steps:**
1. Navigate to `/capacity/manage`
2. Select a Customer from the dropdown
3. Observe the "Current Capacity Bounds" section

**Expected Results:**
- Default values should be: Min Capacity = 0, Max Capacity = 100
- Values should be displayed with proper text color (dark gray/black)

**Pass Criteria:** ✅ Default bounds display correctly

---

### Test 1.2: Update Capacity Bounds

**Steps:**
1. Click "Edit Bounds" button
2. Set Min Capacity = 20
3. Set Max Capacity = 150
4. Click "Save"

**Expected Results:**
- Modal closes
- "Current Capacity Bounds" section updates to show Min: 20, Max: 150
- No console errors
- Success indication (could be a toast or visual feedback)

**Pass Criteria:** ✅ Bounds update successfully and persist

---

### Test 1.3: Invalid Bounds Validation

**Steps:**
1. Click "Edit Bounds"
2. Set Min Capacity = 100
3. Set Max Capacity = 50 (less than min)
4. Click "Save"

**Expected Results:**
- Error message displayed
- Modal remains open
- Values not saved

**Pass Criteria:** ✅ Validation prevents invalid bounds

---

## 2. Daily Capacity Overrides

### Test 2.1: Set Daily Capacity

**Steps:**
1. Select a Location entity
2. View the monthly calendar
3. Click on any date cell (e.g., 15th of current month)
4. Set capacity to 75
5. Click "Save"

**Expected Results:**
- Modal closes
- Calendar cell for the 15th shows capacity value of 75
- Cell has a blue border (indicating override)
- Cell color reflects the capacity level (green/yellow/red)

**Pass Criteria:** ✅ Daily capacity is set and visually indicated

---

### Test 2.2: View Capacity for Multiple Dates

**Steps:**
1. Set capacity for multiple dates:
   - 10th: 80
   - 15th: 60
   - 20th: 120
2. Navigate the calendar to view all three dates

**Expected Results:**
- Each date shows its specific capacity value
- Dates with overrides have blue borders
- Color coding reflects capacity levels
- Dates without overrides show maxCapacity (150 from Test 1.2)

**Pass Criteria:** ✅ Multiple daily capacities display correctly

---

### Test 2.3: Delete Daily Capacity Override

**Steps:**
1. Click on the 15th (which has capacity = 60)
2. Click "Delete" button in the modal
3. Observe the calendar

**Expected Results:**
- Modal closes
- Calendar cell for 15th no longer has blue border
- Capacity reverts to maxCapacity (150)
- Other dates with overrides remain unchanged

**Pass Criteria:** ✅ Override deletion works and reverts to max

---

### Test 2.4: Set Capacity for Date Range

**Steps:**
1. Use API or utility function to set capacity for range:
   - Start: March 1, 2026
   - End: March 7, 2026
   - Capacity: 90
2. Navigate calendar to March 2026

**Expected Results:**
- All dates from March 1-7 show capacity of 90
- All have blue borders
- Dates outside the range are unaffected

**Pass Criteria:** ✅ Bulk capacity setting works for date ranges

---

## 3. Revenue Goals Management

### Test 3.1: Add Revenue Goals

**Steps:**
1. Select a SubLocation entity
2. Click "Add Revenue Goal" button
3. Set:
   - Start Date: March 1, 2026
   - End Date: March 31, 2026
   - Daily Goal: 1000
   - Weekly Goal: 7000
   - Monthly Goal: 30000
4. Click "Save"

**Expected Results:**
- Modal closes
- New revenue goal appears in "Revenue Goals" section
- Goal shows date range and all three goal values
- Calendar cells within the date range show target icon (🎯)

**Pass Criteria:** ✅ Revenue goals are created and displayed

---

### Test 3.2: View Multiple Revenue Goals

**Steps:**
1. Add another revenue goal:
   - Start: April 1, 2026
   - End: April 30, 2026
   - Daily Goal: 1200
   - Monthly Goal: 35000 (no weekly goal)
2. View the revenue goals list

**Expected Results:**
- Both goals are listed
- Each shows its specific date range and goal values
- Optional goals (like weekly in the second) show only when set
- Calendar navigation shows target icons for appropriate dates

**Pass Criteria:** ✅ Multiple goals coexist and display correctly

---

### Test 3.3: Delete Revenue Goal

**Steps:**
1. Click "Delete" on the first revenue goal (March)
2. Confirm deletion (if confirmation is implemented)

**Expected Results:**
- Goal is removed from the list
- Calendar cells for March no longer show target icon
- April goal remains intact

**Pass Criteria:** ✅ Goal deletion works without affecting others

---

### Test 3.4: Overlapping Goals Handling

**Steps:**
1. Create a goal for March 1-31
2. Create another goal for March 15-April 15 (overlapping)

**Expected Results:**
- Second goal replaces the first for March 15-31
- April 1-15 shows the second goal
- No duplicate or conflicting goals exist

**Pass Criteria:** ✅ Overlapping goals are handled correctly

---

## 4. Hierarchical Aggregation

### Test 4.1: Customer-Level Aggregation

**Steps:**
1. Select a Customer that has multiple Locations
2. Set capacity for the customer itself: 50
3. Set capacity for Location A: 100
4. Set capacity for Location B: 150
5. Click "View Aggregation" button

**Expected Results:**
- Modal displays total capacity = 300 (50 + 100 + 150)
- Breakdown section shows:
  - Customer: 50
  - Location A: 100
  - Location B: 150
- All values are readable (proper text colors)

**Pass Criteria:** ✅ Customer aggregation sums child locations

---

### Test 4.2: Location-Level Aggregation

**Steps:**
1. Select a Location with multiple SubLocations
2. Set capacity for location: 75
3. Set capacity for SubLocation 1: 60
4. Set capacity for SubLocation 2: 80
5. Click "View Aggregation"

**Expected Results:**
- Total capacity = 215 (75 + 60 + 80)
- Breakdown shows location and all sublocations

**Pass Criteria:** ✅ Location aggregation sums child sublocations

---

### Test 4.3: SubLocation-Level Aggregation

**Steps:**
1. Select a SubLocation with Events
2. Set capacity for sublocation: 40
3. Set capacity for Event 1: 30
4. Set capacity for Event 2: 50
5. Click "View Aggregation"

**Expected Results:**
- Total capacity = 120 (40 + 30 + 50)
- Breakdown shows sublocation and all events

**Pass Criteria:** ✅ SubLocation aggregation sums child events

---

### Test 4.4: Revenue Goals Aggregation

**Steps:**
1. Set revenue goals for Customer: Daily 500, Weekly 3500, Monthly 15000
2. Set revenue goals for Location A: Daily 400, Monthly 12000
3. Set revenue goals for Location B: Weekly 2800
4. View Customer aggregation

**Expected Results:**
- Total Daily Goal = 900 (500 + 400)
- Total Weekly Goal = 6300 (3500 + 2800)
- Total Monthly Goal = 27000 (15000 + 12000)

**Pass Criteria:** ✅ Revenue goals aggregate across hierarchy

---

## 5. API Endpoint Testing

### Test 5.1: GET /api/capacity (Single Date)

**Request:**
```bash
GET /api/capacity?entityType=location&entityId=<LOCATION_ID>&date=2026-03-15
```

**Expected Response:**
```json
{
  "date": "2026-03-15",
  "capacity": 100,
  "bounds": {
    "minCapacity": 20,
    "maxCapacity": 150
  }
}
```

**Pass Criteria:** ✅ Returns correct capacity for specific date

---

### Test 5.2: GET /api/capacity (Date Range)

**Request:**
```bash
GET /api/capacity?entityType=location&entityId=<LOCATION_ID>&startDate=2026-03-01&endDate=2026-03-07
```

**Expected Response:**
```json
{
  "startDate": "2026-03-01",
  "endDate": "2026-03-07",
  "capacities": [
    { "date": "2026-03-01", "capacity": 150 },
    { "date": "2026-03-02", "capacity": 150 },
    ...
  ],
  "bounds": { ... }
}
```

**Pass Criteria:** ✅ Returns array of daily capacities for range

---

### Test 5.3: POST /api/capacity

**Request:**
```bash
POST /api/capacity
Content-Type: application/json

{
  "entityType": "location",
  "entityId": "<LOCATION_ID>",
  "date": "2026-03-20",
  "capacity": 125
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Capacity updated successfully",
  "data": { /* updated entity */ }
}
```

**Pass Criteria:** ✅ Capacity is set and success response returned

---

### Test 5.4: DELETE /api/capacity

**Request:**
```bash
DELETE /api/capacity?entityType=location&entityId=<LOCATION_ID>&date=2026-03-20
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Daily capacity removed successfully",
  "data": { /* updated entity */ }
}
```

**Pass Criteria:** ✅ Override is deleted successfully

---

### Test 5.5: PUT /api/capacity/bounds

**Request:**
```bash
PUT /api/capacity/bounds
Content-Type: application/json

{
  "entityType": "customer",
  "entityId": "<CUSTOMER_ID>",
  "minCapacity": 10,
  "maxCapacity": 200
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Capacity bounds updated successfully",
  "data": { /* updated entity */ }
}
```

**Pass Criteria:** ✅ Bounds are updated successfully

---

### Test 5.6: GET /api/capacity/aggregate

**Request:**
```bash
GET /api/capacity/aggregate?customerId=<CUSTOMER_ID>&date=2026-03-15
```

**Expected Response:**
```json
{
  "entityType": "customer",
  "entityId": "<CUSTOMER_ID>",
  "date": "2026-03-15",
  "totalCapacity": 450,
  "totalGoals": {
    "dailyGoal": 5000,
    "weeklyGoal": 35000,
    "monthlyGoal": 150000
  },
  "breakdown": { ... }
}
```

**Pass Criteria:** ✅ Aggregation calculates and returns correct totals

---

### Test 5.7: POST /api/revenue-goals

**Request:**
```bash
POST /api/revenue-goals
Content-Type: application/json

{
  "entityType": "sublocation",
  "entityId": "<SUBLOCATION_ID>",
  "startDate": "2026-03-01",
  "endDate": "2026-03-31",
  "dailyGoal": 800,
  "weeklyGoal": 5600,
  "monthlyGoal": 24000
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Revenue goals set successfully",
  "data": { /* updated entity */ }
}
```

**Pass Criteria:** ✅ Revenue goals are created successfully

---

### Test 5.8: DELETE /api/revenue-goals

**Request:**
```bash
DELETE /api/revenue-goals?entityType=sublocation&entityId=<SUBLOCATION_ID>&startDate=2026-03-01&endDate=2026-03-31
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Revenue goals removed successfully",
  "data": { /* updated entity */ }
}
```

**Pass Criteria:** ✅ Revenue goals are deleted successfully

---

## 6. Edge Cases and Validation

### Test 6.1: Capacity Outside Bounds

**Steps:**
1. Set bounds: Min = 20, Max = 150
2. Try to set daily capacity = 10 (below min)

**Expected Results:**
- Validation error in UI
- API returns 400 error if called directly
- Capacity is not saved

**Pass Criteria:** ✅ Validation prevents out-of-bounds capacity

---

### Test 6.2: Invalid Date Format

**Steps:**
1. Call API with malformed date:
```bash
POST /api/capacity
{
  "entityType": "location",
  "entityId": "<ID>",
  "date": "2026-15-40",  // Invalid date
  "capacity": 100
}
```

**Expected Results:**
- API returns 400 error
- Error message indicates invalid date format

**Pass Criteria:** ✅ Invalid dates are rejected

---

### Test 6.3: Missing Required Fields

**Steps:**
1. Call API without required fields:
```bash
POST /api/capacity
{
  "entityType": "location",
  "capacity": 100
  // Missing entityId and date
}
```

**Expected Results:**
- API returns 400 error
- Error message lists missing fields

**Pass Criteria:** ✅ Missing fields are caught by validation

---

### Test 6.4: Non-existent Entity

**Steps:**
1. Call API with invalid entity ID:
```bash
GET /api/capacity?entityType=location&entityId=nonexistent123&date=2026-03-15
```

**Expected Results:**
- API returns 404 error
- Error message indicates entity not found

**Pass Criteria:** ✅ Non-existent entities return 404

---

### Test 6.5: Empty Entity (No Capacity Config)

**Steps:**
1. Select an entity that has never had capacity configured
2. View the entity in the UI

**Expected Results:**
- Default bounds shown: Min = 0, Max = 100
- All dates show default capacity of 100
- No revenue goals listed
- System auto-initializes config on first update

**Pass Criteria:** ✅ Backward compatibility with entities lacking capacityConfig

---

### Test 6.6: Negative Capacity Values

**Steps:**
1. Try to set capacity = -50

**Expected Results:**
- Validation error
- Capacity not saved
- UI prevents negative input

**Pass Criteria:** ✅ Negative values are rejected

---

### Test 6.7: Revenue Goal with No Goals Set

**Steps:**
1. Try to create revenue goal with no daily/weekly/monthly values:
```bash
POST /api/revenue-goals
{
  "entityType": "location",
  "entityId": "<ID>",
  "startDate": "2026-03-01",
  "endDate": "2026-03-31"
  // No goals specified
}
```

**Expected Results:**
- API returns 400 error
- Error message indicates at least one goal is required

**Pass Criteria:** ✅ At least one goal type must be provided

---

## 7. Neo4j Sync Verification

### Test 7.1: Verify Capacity in Neo4j

**Steps:**
1. Set capacity bounds and daily capacities for a Location
2. Navigate to `/api/graph/sync` and trigger sync
3. Query Neo4j:
```cypher
MATCH (l:Location {id: "<LOCATION_ID>"})
RETURN l.capacityConfig
```

**Expected Results:**
- `capacityConfig` property exists
- Contains JSON string with capacity data
- JSON can be parsed and matches MongoDB data

**Pass Criteria:** ✅ Capacity data syncs to Neo4j correctly

---

### Test 7.2: Verify Event Nodes

**Steps:**
1. Create an Event with capacity config
2. Sync to Neo4j
3. Query:
```cypher
MATCH (e:Event {id: "<EVENT_ID>"})
RETURN e
```

**Expected Results:**
- Event node exists with capacityConfig property
- Event has relationship to its parent (SubLocation/Location/Customer)

**Pass Criteria:** ✅ Event nodes are created in Neo4j with capacity data

---

### Test 7.3: Verify Hierarchical Relationships

**Steps:**
1. Sync full database to Neo4j
2. Query hierarchy:
```cypher
MATCH path = (c:Customer)-[:HAS_LOCATION]->(l:Location)-[:HAS_SUBLOCATION]->(sl:SubLocation)-[:HAS_EVENT]->(e:Event)
WHERE c.id = "<CUSTOMER_ID>"
RETURN path
```

**Expected Results:**
- Full hierarchy path is visible
- All nodes have capacityConfig properties
- Relationships are correct

**Pass Criteria:** ✅ Complete hierarchy syncs with capacity data

---

## 8. UI/UX Testing

### Test 8.1: Calendar Navigation

**Steps:**
1. Click "Previous Month" button multiple times
2. Click "Next Month" button multiple times
3. Navigate to a future month (e.g., December 2026)

**Expected Results:**
- Calendar updates to show correct month/year
- Capacity data loads for new month
- No visual glitches or layout issues
- All text remains readable

**Pass Criteria:** ✅ Calendar navigation works smoothly

---

### Test 8.2: Entity Cascade Selection

**Steps:**
1. Select a Customer
2. Observe Location dropdown
3. Select a Location
4. Observe SubLocation dropdown
5. Select a SubLocation
6. Observe Event dropdown

**Expected Results:**
- Each dropdown populates with children of selected parent
- Dropdowns clear when parent changes
- Loading states are visible if needed

**Pass Criteria:** ✅ Entity selection cascades properly

---

### Test 8.3: Color Coding Visualization

**Steps:**
1. Set capacities creating different utilization levels:
   - Low: 30 (green)
   - Medium: 75 (yellow)
   - High: 140 (red/orange)
2. View calendar

**Expected Results:**
- Low capacity dates are green
- Medium capacity dates are yellow/amber
- High capacity dates are red/orange
- Colors are clearly distinguishable
- All text on colored backgrounds is readable

**Pass Criteria:** ✅ Color coding provides clear visual feedback

---

### Test 8.4: Modal Interactions

**Steps:**
1. Open bounds modal, then close without saving
2. Open capacity modal, then cancel
3. Open revenue goal modal, change values, then cancel

**Expected Results:**
- All modals open and close smoothly
- Cancel/close actions don't save changes
- No errors in console
- Background is properly dimmed

**Pass Criteria:** ✅ Modal interactions work as expected

---

### Test 8.5: Loading States

**Steps:**
1. Perform an action that triggers loading (save capacity)
2. Observe UI during save

**Expected Results:**
- Loading indicator appears
- Save button shows "Saving..." or is disabled
- UI is not frozen
- Success/error feedback after completion

**Pass Criteria:** ✅ Loading states provide clear feedback

---

## 9. Performance Testing

### Test 9.1: Large Date Range

**Steps:**
1. Set capacity for 365 dates (full year)
2. Navigate calendar through the year

**Expected Results:**
- No significant lag when loading months
- Calendar renders quickly
- Memory usage remains reasonable

**Pass Criteria:** ✅ System handles large date ranges efficiently

---

### Test 9.2: Multiple Revenue Goals

**Steps:**
1. Create 20+ revenue goals with various date ranges
2. View the revenue goals list

**Expected Results:**
- List renders without lag
- Scroll is smooth
- No UI freezing

**Pass Criteria:** ✅ UI handles many revenue goals gracefully

---

### Test 9.3: Deep Hierarchy Aggregation

**Steps:**
1. Create structure: 1 Customer → 5 Locations → 10 SubLocations each → 5 Events each (total 250 events)
2. Set capacity for all entities
3. View Customer aggregation

**Expected Results:**
- Aggregation calculates in reasonable time (< 3 seconds)
- Breakdown displays correctly
- No timeout errors

**Pass Criteria:** ✅ Aggregation performs well with deep hierarchies

---

## 10. Data Integrity Testing

### Test 10.1: Concurrent Updates

**Steps:**
1. Open page in two browser tabs
2. In Tab 1: Set capacity for March 15 = 80
3. In Tab 2: Set capacity for March 15 = 90
4. Refresh both tabs

**Expected Results:**
- Last write wins (capacity = 90)
- Both tabs show same data after refresh
- No data corruption

**Pass Criteria:** ✅ Concurrent updates don't corrupt data

---

### Test 10.2: Database Persistence

**Steps:**
1. Set various capacities and revenue goals
2. Restart the application
3. Navigate back to capacity management

**Expected Results:**
- All capacity data is preserved
- Revenue goals are intact
- No data loss

**Pass Criteria:** ✅ Data persists across restarts

---

### Test 10.3: Entity Deletion Impact

**Steps:**
1. Set capacity for a SubLocation
2. Delete the SubLocation from the system
3. Check that capacity data is removed or orphaned gracefully

**Expected Results:**
- No orphaned capacity data causes errors
- Parent aggregations update correctly
- System remains stable

**Pass Criteria:** ✅ Entity deletions don't break capacity system

---

## Test Summary Template

Use this template to track your testing progress:

| Test ID | Test Name | Status | Notes | Date Tested |
|---------|-----------|--------|-------|-------------|
| 1.1 | View Default Capacity Bounds | ⬜ | | |
| 1.2 | Update Capacity Bounds | ⬜ | | |
| 1.3 | Invalid Bounds Validation | ⬜ | | |
| 2.1 | Set Daily Capacity | ⬜ | | |
| 2.2 | View Capacity for Multiple Dates | ⬜ | | |
| 2.3 | Delete Daily Capacity Override | ⬜ | | |
| 2.4 | Set Capacity for Date Range | ⬜ | | |
| 3.1 | Add Revenue Goals | ⬜ | | |
| 3.2 | View Multiple Revenue Goals | ⬜ | | |
| 3.3 | Delete Revenue Goal | ⬜ | | |
| 3.4 | Overlapping Goals Handling | ⬜ | | |
| 4.1 | Customer-Level Aggregation | ⬜ | | |
| 4.2 | Location-Level Aggregation | ⬜ | | |
| 4.3 | SubLocation-Level Aggregation | ⬜ | | |
| 4.4 | Revenue Goals Aggregation | ⬜ | | |
| 5.1-5.8 | All API Endpoints | ⬜ | | |
| 6.1-6.7 | All Edge Cases | ⬜ | | |
| 7.1-7.3 | Neo4j Sync | ⬜ | | |
| 8.1-8.5 | UI/UX Tests | ⬜ | | |
| 9.1-9.3 | Performance Tests | ⬜ | | |
| 10.1-10.3 | Data Integrity Tests | ⬜ | | |

---

## Quick Smoke Test (15 minutes)

If time is limited, run this abbreviated test flow:

1. ✅ Select a Customer and view default bounds
2. ✅ Update capacity bounds (Test 1.2)
3. ✅ Set capacity for 3 different dates (Test 2.1)
4. ✅ Delete one capacity override (Test 2.3)
5. ✅ Add one revenue goal (Test 3.1)
6. ✅ View aggregation (Test 4.1)
7. ✅ Test one API endpoint via Postman/curl (Test 5.1)
8. ✅ Try setting invalid capacity to check validation (Test 6.1)
9. ✅ Navigate calendar months (Test 8.1)
10. ✅ Verify text is readable throughout (UI color check)

---

## Automated Testing Recommendations

For future implementation, consider:

1. **Unit Tests** (Jest):
   - All functions in `capacity-utils.ts`
   - Date calculations
   - Aggregation logic

2. **Integration Tests** (Jest + MongoDB Memory Server):
   - Repository methods
   - API routes
   - Database operations

3. **E2E Tests** (Playwright/Cypress):
   - Full user flows
   - Calendar interactions
   - Modal workflows

4. **API Tests** (Postman/Newman):
   - All endpoint variations
   - Error scenarios
   - Response validation

---

## Reporting Issues

When reporting bugs, include:

1. Test ID from this document
2. Steps to reproduce
3. Expected vs. actual results
4. Screenshots/console logs
5. Browser/environment details
6. Data state (entity IDs, dates, values)

---

## Success Criteria

The capacity management system is considered fully tested when:

- ✅ All UI tests pass (Section 1-4, 8)
- ✅ All API tests pass (Section 5)
- ✅ All edge cases handled (Section 6)
- ✅ Neo4j sync verified (Section 7)
- ✅ Performance acceptable (Section 9)
- ✅ Data integrity confirmed (Section 10)
- ✅ No critical bugs found
- ✅ Text visibility issues resolved

---

**Document Version:** 1.0
**Last Updated:** 2026-01-16
**Related Documents:**
- [CAPACITY_IMPLEMENTATION_SUMMARY.md](CAPACITY_IMPLEMENTATION_SUMMARY.md)
- [CAPACITY_API.md](CAPACITY_API.md)
