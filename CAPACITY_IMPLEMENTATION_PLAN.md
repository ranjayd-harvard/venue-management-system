# Capacity Management System - Implementation Plan

## Executive Summary

This plan outlines the implementation of a comprehensive **Capacity Management System** that mirrors the existing **Pricing System** architecture. The system will enable dynamic, rule-based capacity allocation across the organizational hierarchy with priority-based conflict resolution and an approval workflow.

---

## Quick Reference

### Key Files to Create

#### Models & Engines
- `src/models/CapacitySheet.ts` - Core data model and repository
- `src/lib/capacity-engine-hourly.ts` - Hourly capacity calculation engine

#### API Endpoints
- `src/app/api/capacitysheets/route.ts` - List/Create capacity sheets
- `src/app/api/capacitysheets/[id]/route.ts` - Get/Update/Delete capacity sheet
- `src/app/api/capacitysheets/[id]/approve/route.ts` - Approve workflow
- `src/app/api/capacitysheets/[id]/reject/route.ts` - Reject workflow
- `src/app/api/capacity/calculate/route.ts` - Calculate capacity for booking

#### Admin UI
- `src/app/admin/capacity-sheets/page.tsx` - Main management page
- `src/components/CapacitySheetForm.tsx` - Create/Edit form
- `src/components/CapacitySheetCard.tsx` - Display card
- `src/components/CapacityApprovalPanel.tsx` - Approval workflow UI

#### User Tools
- `src/app/capacity/calculator/page.tsx` - Interactive capacity calculator
- `src/app/capacity/timeline/page.tsx` - Visual timeline

#### Utilities & Migration
- `scripts/migrate-capacity-to-sheets.js` - Migration script
- Update `src/app/api/admin/seed/route.ts` - Add sample capacity sheets

### Key Files to Update
- `src/models/types.ts` - Add capacity interfaces
- `src/components/NavigationLayout.tsx` - Add navigation items
- `CLAUDE.md` - Document capacity system (✅ DONE)

---

## Architecture Parallels

### Pricing System → Capacity System Mapping

| Pricing Component | Capacity Equivalent | Purpose |
|-------------------|---------------------|---------|
| `Ratesheet` | `CapacitySheet` | Rule definition |
| `RatesheetRepository` | `CapacitySheetRepository` | Data access |
| `price-engine-hourly.ts` | `capacity-engine-hourly.ts` | Calculation logic |
| `TimeWindow.pricePerHour` | `TimeCapacityWindow.{min,max,default,allocated}` | Rule values |
| `HourlyPricingResult` | `HourlyCapacityResult` | Calculation output |
| `/admin/pricing` | `/admin/capacity-sheets` | Management UI |
| `/pricing/view` | `/capacity/calculator` | User calculator |

---

## Data Model

### CapacitySheet Types

1. **TIME_BASED** - Capacity varies by time of day
   ```typescript
   timeWindows: [{
     startTime: "09:00",
     endTime: "17:00",
     minCapacity: 50,
     maxCapacity: 200,
     defaultCapacity: 100,
     allocatedCapacity: 80
   }]
   ```

2. **DATE_BASED** - Capacity varies by date range
   ```typescript
   dateRanges: [{
     startDate: "2024-01-01",
     endDate: "2024-12-31",
     minCapacity: 100,
     maxCapacity: 500,
     defaultCapacity: 300,
     allocatedCapacity: 250
   }]
   ```

3. **EVENT_BASED** - Capacity for specific events
   ```typescript
   eventCapacity: {
     minCapacity: 200,
     maxCapacity: 1000,
     defaultCapacity: 600,
     reservedCapacity: 500
   }
   ```

---

## Priority Resolution Logic

### Hierarchy (Highest to Lowest)
1. **Event-level CapacitySheets** (if event specified)
2. **SubLocation-level CapacitySheets**
3. **Location-level CapacitySheets**
4. **Customer-level CapacitySheets**
5. **Default capacity values** (from entity configs)

### Conflict Resolution Strategies
When multiple capacity sheets apply at the same level:
- `PRIORITY` - Use highest priority number
- `HIGHEST_CAPACITY` - Use sheet with highest capacity values
- `LOWEST_CAPACITY` - Use sheet with lowest capacity values (conservative)

---

## API Endpoints

### Capacity Sheet Management

#### List/Create Capacity Sheets
```
GET  /api/capacitysheets
POST /api/capacitysheets
```

**Query Parameters (GET)**:
- `level` - Filter by CUSTOMER/LOCATION/SUBLOCATION/EVENT
- `entityId` - Filter by specific entity
- `status` - Filter by approval status
- `startDate` - Filter by effective date range
- `endDate` - Filter by effective date range

**Request Body (POST)**:
```json
{
  "name": "Weekend Peak Capacity",
  "description": "Increased capacity for weekends",
  "type": "TIME_BASED",
  "appliesTo": {
    "level": "SUBLOCATION",
    "entityId": "64abc123..."
  },
  "priority": 100,
  "conflictResolution": "PRIORITY",
  "effectiveFrom": "2024-01-01T00:00:00Z",
  "effectiveTo": null,
  "timeWindows": [
    {
      "startTime": "09:00",
      "endTime": "21:00",
      "minCapacity": 100,
      "maxCapacity": 400,
      "defaultCapacity": 250,
      "allocatedCapacity": 200
    }
  ],
  "recurrence": {
    "pattern": "WEEKLY",
    "daysOfWeek": ["SATURDAY", "SUNDAY"]
  },
  "isActive": true,
  "approvalStatus": "DRAFT"
}
```

#### Get/Update/Delete Specific Capacity Sheet
```
GET    /api/capacitysheets/[id]
PATCH  /api/capacitysheets/[id]
DELETE /api/capacitysheets/[id]
```

#### Approval Workflow
```
POST /api/capacitysheets/[id]/approve
POST /api/capacitysheets/[id]/reject
```

### Capacity Calculation

#### Calculate Capacity for Booking
```
POST /api/capacity/calculate
```

**Request Body**:
```json
{
  "customerId": "64abc...",
  "locationId": "64def...",
  "subLocationId": "64ghi...",
  "eventId": "64jkl...",  // optional
  "startDateTime": "2024-01-15T10:00:00Z",
  "endDateTime": "2024-01-15T18:00:00Z",
  "timezone": "America/New_York"
}
```

**Response**:
```json
{
  "segments": [
    {
      "startTime": "2024-01-15T10:00:00Z",
      "endTime": "2024-01-15T11:00:00Z",
      "durationHours": 1,
      "minCapacity": 50,
      "maxCapacity": 200,
      "defaultCapacity": 100,
      "allocatedCapacity": 80,
      "availableCapacity": 120,
      "capacitySheet": {
        "id": "64...",
        "name": "Weekend Peak Hours",
        "type": "TIME_BASED",
        "priority": 100,
        "level": "SUBLOCATION"
      },
      "source": "CAPACITYSHEET"
    }
  ],
  "summary": {
    "totalHours": 8,
    "avgMinCapacity": 50,
    "avgMaxCapacity": 200,
    "avgDefaultCapacity": 100,
    "avgAllocatedCapacity": 85,
    "avgAvailableCapacity": 115
  },
  "decisionLog": [...]
}
```

---

## UI Pages

### Admin Pages

#### `/admin/capacity-sheets` - Manage CapacitySheets
**Features**:
- Tabbed interface: All | Draft | Pending | Approved | Rejected
- Filter by level, entity, date range
- Search by name
- Create new capacity sheet
- Edit/Delete capacity sheets
- Approve/Reject workflow
- Bulk actions (activate, deactivate, delete)

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ Manage CapacitySheets               [+ New]     │
├─────────────────────────────────────────────────┤
│ [All] [Draft] [Pending] [Approved] [Rejected]  │
├─────────────────────────────────────────────────┤
│ Filters: [Level ▼] [Entity ▼] [Date Range]     │
├─────────────────────────────────────────────────┤
│                                                  │
│ ┌─────────────────────────────────────────┐    │
│ │ Weekend Peak Capacity          Priority: 100│
│ │ SubLocation: Main Hall                   │    │
│ │ Effective: 2024-01-01 - Indefinite       │    │
│ │ Status: [Approved]                       │    │
│ │ [Edit] [Deactivate] [Delete]             │    │
│ └─────────────────────────────────────────┘    │
│                                                  │
│ ┌─────────────────────────────────────────┐    │
│ │ Holiday Capacity Reduction    Priority: 90│    │
│ │ Location: Downtown Center                │    │
│ │ Effective: 2024-12-20 - 2024-12-31       │    │
│ │ Status: [Pending Approval]               │    │
│ │ [Approve] [Reject] [Edit]                │    │
│ └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

#### `/admin/capacity-settings` - Enhanced
**Add**:
- Button: "Manage CapacitySheets" → `/admin/capacity-sheets`
- Section: "Active Capacity Sheets" (show count per sublocation)

### User Tools

#### `/capacity/calculator` - Interactive Calculator
**Features**:
- Entity selection dropdowns (Customer → Location → SubLocation → Event)
- Date/time range picker
- Timezone selector
- Calculate button
- Results display:
  - Hourly breakdown table
  - Summary statistics
  - Decision log (expandable)
  - Applied capacity sheets list
- Export to CSV/JSON

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ Capacity Calculator                             │
├─────────────────────────────────────────────────┤
│ Customer:    [Select Customer     ▼]            │
│ Location:    [Select Location     ▼]            │
│ SubLocation: [Select SubLocation  ▼]            │
│ Event:       [Select Event (Opt)  ▼]            │
│                                                  │
│ Start:  [2024-01-15] [10:00 AM]                 │
│ End:    [2024-01-15] [06:00 PM]                 │
│ Timezone: [America/New_York ▼]                  │
│                           [Calculate Capacity]  │
├─────────────────────────────────────────────────┤
│ Results (8 hours)                               │
│                                                  │
│ Hour  Time        Min  Max  Default  Allocated  │
│ ───────────────────────────────────────────────│
│  1   10:00-11:00  50   200    100       80      │
│  2   11:00-12:00  50   200    100       85      │
│  ...                                            │
│                                                  │
│ Summary:                                        │
│ • Avg Min: 50  • Avg Max: 200                  │
│ • Avg Default: 100  • Avg Allocated: 85        │
│ • Avg Available: 115                            │
│                                                  │
│ [View Decision Log] [Export CSV]                │
└─────────────────────────────────────────────────┘
```

#### `/capacity/timeline` - Visual Timeline
**Features**:
- Similar to pricing timeline
- Shows capacity over time
- Color-coded bands for min/max/default
- Hover tooltips with details
- Filter by sublocation
- Zoom/pan controls

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal**: Core data model and capacity engine

Tasks:
1. Create `src/models/CapacitySheet.ts`
   - Define interfaces
   - Implement CapacitySheetRepository
   - Add approval workflow methods
2. Update `src/models/types.ts`
   - Export capacity interfaces
3. Create `src/lib/capacity-engine-hourly.ts`
   - Implement HourlyCapacityEngine
   - Mirror pricing engine structure
   - Add capacity-specific logic

**Deliverable**: Can create capacity sheets in DB, calculate capacity programmatically

---

### Phase 2: API Layer (Week 2)
**Goal**: Complete REST API for capacity sheets

Tasks:
1. Create API endpoints:
   - `/api/capacitysheets` (GET, POST)
   - `/api/capacitysheets/[id]` (GET, PATCH, DELETE)
   - `/api/capacitysheets/[id]/approve` (POST)
   - `/api/capacitysheets/[id]/reject` (POST)
   - `/api/capacity/calculate` (POST)
2. Add request validation
3. Add error handling
4. Write API tests

**Deliverable**: Full CRUD API for capacity sheets, calculation endpoint

---

### Phase 3: Admin UI (Week 3)
**Goal**: Management interface for capacity sheets

Tasks:
1. Create `/admin/capacity-sheets` page
   - List view with tabs
   - Filters and search
   - Status badges
2. Create `CapacitySheetForm` component
   - Dynamic form based on type
   - Validation
   - Entity selection
3. Create `CapacitySheetCard` component
   - Summary display
   - Action buttons
4. Create `CapacityApprovalPanel` component
   - Pending list
   - Approve/reject actions

**Deliverable**: Full admin UI for managing capacity sheets

---

### Phase 4: User Tools (Week 4)
**Goal**: Interactive capacity calculator and timeline

Tasks:
1. Create `/capacity/calculator` page
   - Entity selectors
   - Date/time pickers
   - Calculate functionality
   - Results display
2. Create `/capacity/timeline` page
   - Visual timeline component
   - Capacity bands
   - Interactive controls
3. Update `/admin/capacity-settings`
   - Add link to capacity sheets
   - Show active sheets count

**Deliverable**: User-facing capacity tools

---

### Phase 5: Integration & Migration (Week 5)
**Goal**: Migrate existing data, update navigation

Tasks:
1. Create `scripts/migrate-capacity-to-sheets.js`
   - Convert existing capacity config
   - Create capacity sheets from current values
2. Update seed script
   - Add sample capacity sheets
   - Various types and scenarios
3. Update `NavigationLayout`
   - Add "Manage CapacitySheets"
   - Add "Capacity Calculator"
   - Add "Capacity Timeline"
4. Update documentation
5. End-to-end testing

**Deliverable**: Production-ready capacity management system

---

## Testing Strategy

### Unit Tests
- CapacitySheetRepository CRUD operations
- HourlyCapacityEngine calculation logic
- Priority resolution
- Conflict resolution strategies

### Integration Tests
- API endpoints (request/response)
- Database queries
- Capacity calculation with real data

### E2E Tests
- Create capacity sheet flow
- Approval workflow
- Calculate capacity flow
- Timeline visualization

---

## Rollout Strategy

### Phase 1: Internal Testing
- Deploy to staging
- Create test capacity sheets
- Validate calculations
- Test approval workflow

### Phase 2: Pilot
- Enable for select sublocations
- Monitor capacity calculations
- Gather feedback
- Refine UI/UX

### Phase 3: Full Rollout
- Migrate all capacity to capacity sheets
- Train users on new system
- Monitor performance
- Iterate based on feedback

---

## Success Metrics

1. **Data Migration**: 100% of sublocations have capacity sheets
2. **Calculation Accuracy**: Capacity calculations match expected values
3. **Performance**: Capacity calculation < 500ms for 24-hour period
4. **User Adoption**: 80% of capacity changes via capacity sheets (not manual edits)
5. **Approval Workflow**: < 24 hour average approval time
6. **UI Usability**: < 5 clicks to create basic capacity sheet

---

## Risks & Mitigation

### Risk: Complexity
**Mitigation**: Start with TIME_BASED type only, add DATE_BASED and EVENT_BASED later

### Risk: Performance
**Mitigation**: Add database indexes, cache frequently accessed capacity sheets

### Risk: Data Migration
**Mitigation**: Thorough testing, backup before migration, rollback plan

### Risk: User Training
**Mitigation**: Documentation, tooltips, guided tutorials in UI

---

## Future Enhancements

1. **Capacity Forecasting** - Predict future capacity needs based on historical data
2. **Automated Adjustments** - Auto-adjust capacity based on demand patterns
3. **Capacity Alerts** - Notify when allocated approaches max
4. **Capacity Analytics** - Dashboard with utilization trends
5. **Integration with Booking** - Real-time capacity deduction on booking
6. **Capacity Templates** - Reusable capacity sheet templates
7. **Bulk Import/Export** - CSV/Excel import for capacity sheets
8. **API Rate Limiting** - Protect capacity calculation endpoint

---

## Questions for Review

1. Should capacity sheets support negative values (e.g., for capacity reductions)?
2. How should we handle overlapping capacity sheets with same priority?
3. Should events automatically create EVENT-level capacity sheets?
4. What should happen when allocated > max (reject booking vs adjust max)?
5. Should we support "buffer" capacity (emergency overflow)?
6. How granular should capacity tracking be (hourly vs 15-min intervals)?
7. Should capacity be enforced at booking time or just advisory?

---

## Documentation Updates Needed

- ✅ CLAUDE.md - Add capacity system to architecture overview
- ✅ CAPACITY_SYSTEM_DESIGN.md - Detailed design document
- ✅ CAPACITY_IMPLEMENTATION_PLAN.md - This document
- ⏳ API_DOCUMENTATION.md - Add capacity endpoints
- ⏳ USER_GUIDE.md - How to use capacity management
- ⏳ ADMIN_GUIDE.md - How to manage capacity sheets
- ⏳ MIGRATION_GUIDE.md - How to migrate existing capacity data

---

## Next Steps

1. Review this plan with stakeholders
2. Get approval for implementation
3. Set up project tracking (Jira/GitHub Issues)
4. Assign developers to phases
5. Begin Phase 1 implementation
6. Schedule regular check-ins

---

**Document Version**: 1.0
**Created**: 2026-01-20
**Author**: Claude (AI Assistant)
**Status**: Pending Review
