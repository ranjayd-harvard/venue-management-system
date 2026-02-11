# Capacity Management System - Design Document

## Overview
This document outlines the design for a comprehensive capacity management system that mirrors the existing pricing system architecture. The capacity system will manage dynamic capacity allocations across the hierarchy (Customer → Location → SubLocation → Event) using CapacitySheets with priority-based resolution.

---

## System Architecture

### 1. Core Concepts

#### Capacity Hierarchy
- **Customer** → Base capacity defaults
- **Location** → Location-specific capacity rules
- **SubLocation** → Sublocation-specific capacity rules
- **Event** → Event-specific capacity overrides (HIGHEST PRIORITY)

#### Priority Resolution
Similar to pricing, capacity resolution follows:
1. **Event-level CapacitySheets** (if event exists, HIGHEST priority)
2. **SubLocation-level CapacitySheets**
3. **Location-level CapacitySheets**
4. **Customer-level CapacitySheets**
5. **Default capacity values** (fallback: sublocation → location → customer)

---

## Data Model

### CapacitySheet Interface

```typescript
export interface CapacitySheet {
  _id?: ObjectId;

  // Identity
  name: string;
  description?: string;

  // Type
  type: 'TIME_BASED' | 'DATE_BASED' | 'EVENT_BASED';

  // Hierarchy application
  appliesTo: {
    level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
    entityId: ObjectId;
  };

  // Priority and Conflicts
  priority: number; // Higher = higher priority
  conflictResolution: 'PRIORITY' | 'HIGHEST_CAPACITY' | 'LOWEST_CAPACITY';

  // Date Validity
  effectiveFrom: Date;
  effectiveTo?: Date; // null = indefinite

  // Recurrence (for recurring patterns)
  recurrence?: RecurrenceRule;

  // Capacity Rules (based on type)
  timeWindows?: TimeCapacityWindow[];     // For TIME_BASED
  dateRanges?: DateCapacityRange[];       // For DATE_BASED
  eventCapacity?: EventCapacityRule;      // For EVENT_BASED

  // Metadata
  isActive: boolean;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;

  // Approval Workflow (matches Ratesheet)
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
}

export interface TimeCapacityWindow {
  startTime: string; // HH:mm format (24-hour)
  endTime: string;
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity?: number; // Optional: pre-allocated for this window
}

export interface DateCapacityRange {
  startDate: Date;
  endDate: Date;
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity?: number;
}

export interface EventCapacityRule {
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  reservedCapacity?: number; // Capacity reserved specifically for this event
}

export interface RecurrenceRule {
  pattern: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
  daysOfWeek?: DayOfWeek[];
  dayOfMonth?: number;
  customExpression?: string; // Cron-like
}
```

---

## Implementation Plan

### Phase 1: Core Data Model & Repository

#### Files to Create:
1. **`src/models/CapacitySheet.ts`**
   - CapacitySheet interface
   - CapacitySheetRepository class (mirrors RatesheetRepository)
   - Methods:
     - `findAll()`
     - `findById(id)`
     - `findApplicableCapacitySheets(subLocationId, locationId, customerId, startDate, endDate)`
     - `findByEntityId(entityId)`
     - `findPendingApproval()`
     - `create(capacitysheet)`
     - `update(id, updates)`
     - `delete(id)`
     - `submitForApproval(id)`
     - `approve(id, approvedBy)`
     - `reject(id, rejectionReason)`

2. **Update `src/models/types.ts`**
   - Add CapacitySheet type exports
   - Add capacity-related interfaces to central types

#### Database Collections:
- `capacitysheets` - Stores all capacity sheets
- Reuse existing `priority_config` collection for capacity priority rules

---

### Phase 2: Capacity Calculation Engine

#### Files to Create:
1. **`src/lib/capacity-engine-hourly.ts`**
   - Mirror structure of `price-engine-hourly.ts`
   - Classes:
     - `HourlyCapacityEngine`
   - Interfaces:
     - `HourlyCapacitySegment`
     - `HourlyCapacityResult`
     - `CapacityContext`
   - Methods:
     - `calculateCapacity(context)` - Returns hourly capacity breakdown
     - `splitIntoHourlySlots(start, end, timezone)`
     - `evaluateHourSegment(slot, context)`
     - `findApplicableCapacitySheetsForHour(hourStart, context)`
     - `getDefaultCapacity(context)` - Hierarchy fallback

2. **`src/lib/capacity-utils.ts`** (Already exists - enhance)
   - Keep existing daily capacity methods
   - Add helper functions for capacity sheet evaluation
   - Add capacity conflict resolution logic

---

### Phase 3: API Endpoints

#### Files to Create:

1. **`src/app/api/capacitysheets/route.ts`**
   - `GET` - List all capacity sheets (with filters)
   - `POST` - Create new capacity sheet
   - Query params: `entityId`, `level`, `startDate`, `endDate`, `status`

2. **`src/app/api/capacitysheets/[id]/route.ts`**
   - `GET` - Get specific capacity sheet
   - `PATCH` - Update capacity sheet
   - `DELETE` - Delete capacity sheet

3. **`src/app/api/capacitysheets/[id]/approve/route.ts`**
   - `POST` - Approve capacity sheet

4. **`src/app/api/capacitysheets/[id]/reject/route.ts`**
   - `POST` - Reject capacity sheet

5. **`src/app/api/capacity/calculate/route.ts`**
   - `POST` - Calculate capacity for a booking period
   - Request body:
     ```json
     {
       "subLocationId": "...",
       "locationId": "...",
       "customerId": "...",
       "eventId": "...", // optional
       "startDateTime": "2024-01-15T10:00:00Z",
       "endDateTime": "2024-01-15T18:00:00Z",
       "timezone": "America/New_York"
     }
     ```
   - Response: Hourly capacity breakdown with decision log

6. **`src/app/api/admin/migrate-capacitysheets/route.ts`**
   - `POST` - Migration endpoint to convert existing capacity data to capacity sheets

---

### Phase 4: Admin UI - Manage CapacitySheets

#### Files to Create:

1. **`src/app/admin/capacity-sheets/page.tsx`**
   - Main management page (mirrors `/admin/pricing`)
   - Features:
     - List all capacity sheets (grouped by status)
     - Filter by: level, entity, status, date range
     - Create new capacity sheet (modal/form)
     - Edit existing capacity sheets
     - Approve/Reject workflow
     - Delete capacity sheets
     - Bulk actions
   - UI Components:
     - Tabs: All | Draft | Pending Approval | Approved | Rejected
     - Capacity sheet card with:
       - Name, description, type
       - Entity level & name
       - Effective dates
       - Priority
       - Status badge
       - Quick actions (Edit, Approve, Reject, Delete)

2. **`src/components/CapacitySheetForm.tsx`**
   - Form component for creating/editing capacity sheets
   - Fields:
     - Basic info (name, description, type)
     - Entity selection (level + specific entity)
     - Priority
     - Effective dates
     - Recurrence settings
     - Capacity rules (based on type):
       - Time windows (for TIME_BASED)
       - Date ranges (for DATE_BASED)
       - Event capacity (for EVENT_BASED)
     - Conflict resolution strategy

3. **`src/components/CapacitySheetCard.tsx`**
   - Display component for capacity sheet summary
   - Shows key info, status, actions

4. **`src/components/CapacityApprovalPanel.tsx`**
   - Approval workflow UI
   - Shows pending capacity sheets
   - Approve/Reject actions with reason

---

### Phase 5: Capacity Calculator & Visualization

#### Files to Create/Update:

1. **`src/app/capacity/calculator/page.tsx`**
   - Interactive capacity calculator
   - Select: Customer, Location, SubLocation, Event (optional)
   - Date/time range picker
   - Calculate button
   - Results:
     - Hourly capacity breakdown table
     - Visual timeline (similar to pricing timeline)
     - Decision log (which capacity sheet applied per hour)
     - Min/Max/Default/Allocated for each hour

2. **`src/app/capacity/timeline/page.tsx`**
   - Visual timeline of capacity (similar to pricing timeline)
   - Shows capacity changes over time
   - Color-coded by source (capacity sheet vs default)

3. **Update `/admin/capacity-settings/page.tsx`**
   - Add link to "Manage CapacitySheets" page
   - Add "Calculate Capacity" button

---

### Phase 6: Integration & Migration

#### Files to Create:

1. **`scripts/migrate-capacity-to-sheets.js`**
   - Convert existing static capacity config to CapacitySheets
   - For each sublocation:
     - Create a SUBLOCATION-level capacity sheet with current values
     - Set as APPROVED and active
     - Preserve min/max/default/allocated

2. **Update seed script** (`src/app/api/admin/seed/route.ts`)
   - Create sample capacity sheets for demo data
   - Various types (TIME_BASED, DATE_BASED, EVENT_BASED)
   - Different priority levels
   - Some in DRAFT, some APPROVED

---

### Phase 7: Navigation & Documentation

#### Files to Update:

1. **`src/components/NavigationLayout.tsx`**
   - Add to Capacity submenu:
     - "Capacity Calculator" → `/capacity/calculator`
     - "Capacity Timeline" → `/capacity/timeline`
     - "Manage CapacitySheets" → `/admin/capacity-sheets`
     - Keep existing "Capacity Settings" → `/admin/capacity-settings`

2. **`CLAUDE.md`**
   - Document capacity system architecture
   - Mark capacity engine as HIGH-RISK
   - Add capacity model to READ-ONLY zones

---

## API Response Formats

### Capacity Calculation Response

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
        "id": "...",
        "name": "Weekend Peak Hours",
        "type": "TIME_BASED",
        "priority": 100,
        "level": "SUBLOCATION"
      },
      "source": "CAPACITYSHEET",
      "timeWindow": {
        "start": "10:00",
        "end": "18:00"
      }
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
  "breakdown": {
    "capacitySheetSegments": 6,
    "defaultCapacitySegments": 2
  },
  "decisionLog": [
    {
      "hour": 1,
      "timestamp": "2024-01-15T10:00:00Z",
      "timeSlot": "10:00 AM - 11:00 AM",
      "applicableCapacitySheets": 2,
      "selectedCapacitySheet": "Weekend Peak Hours",
      "capacity": {
        "min": 50,
        "max": 200,
        "default": 100,
        "allocated": 80
      },
      "source": "CAPACITYSHEET"
    }
  ],
  "timezone": "America/New_York"
}
```

---

## Database Schema

### CapacitySheets Collection

```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  type: "TIME_BASED" | "DATE_BASED" | "EVENT_BASED",
  appliesTo: {
    level: "CUSTOMER" | "LOCATION" | "SUBLOCATION" | "EVENT",
    entityId: ObjectId
  },
  priority: Number,
  conflictResolution: "PRIORITY" | "HIGHEST_CAPACITY" | "LOWEST_CAPACITY",
  effectiveFrom: Date,
  effectiveTo: Date | null,
  recurrence: {
    pattern: String,
    daysOfWeek: [String],
    dayOfMonth: Number,
    customExpression: String
  },
  timeWindows: [{
    startTime: String,
    endTime: String,
    minCapacity: Number,
    maxCapacity: Number,
    defaultCapacity: Number,
    allocatedCapacity: Number
  }],
  dateRanges: [{
    startDate: Date,
    endDate: Date,
    minCapacity: Number,
    maxCapacity: Number,
    defaultCapacity: Number,
    allocatedCapacity: Number
  }],
  eventCapacity: {
    minCapacity: Number,
    maxCapacity: Number,
    defaultCapacity: Number,
    reservedCapacity: Number
  },
  isActive: Boolean,
  createdBy: String,
  createdAt: Date,
  updatedAt: Date,
  approvalStatus: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED",
  approvedBy: String,
  approvedAt: Date,
  rejectionReason: String
}
```

### Indexes

```javascript
db.capacitysheets.createIndex({ "appliesTo.entityId": 1, effectiveFrom: 1, effectiveTo: 1 });
db.capacitysheets.createIndex({ "appliesTo.level": 1, isActive: 1, approvalStatus: 1 });
db.capacitysheets.createIndex({ priority: -1 });
db.capacitysheets.createIndex({ approvalStatus: 1 });
```

---

## Implementation Order

### Week 1: Foundation
1. ✅ Create CapacitySheet model and repository
2. ✅ Update types.ts with capacity interfaces
3. ✅ Create capacity-engine-hourly.ts

### Week 2: API Layer
4. ✅ Create all capacity sheet API endpoints
5. ✅ Create capacity calculation endpoint
6. ✅ Write migration script

### Week 3: Admin UI
7. ✅ Build Manage CapacitySheets page
8. ✅ Build CapacitySheet form component
9. ✅ Build approval workflow UI

### Week 4: User-Facing Tools
10. ✅ Build Capacity Calculator page
11. ✅ Build Capacity Timeline visualization
12. ✅ Update navigation

### Week 5: Testing & Polish
13. ✅ End-to-end testing
14. ✅ Documentation updates
15. ✅ Seed data generation

---

## Benefits of This Approach

1. **Consistency** - Mirrors proven pricing system architecture
2. **Flexibility** - Dynamic capacity rules without code changes
3. **Auditability** - Full approval workflow and decision logs
4. **Hierarchy** - Respects organizational structure (Customer → Location → SubLocation → Event)
5. **Priority-based** - Clear conflict resolution
6. **Temporal** - Time-based, date-based, and event-based rules
7. **Scalability** - Handles complex scenarios without performance issues

---

## Reused Patterns from Pricing System

1. **Repository Pattern** - Same CRUD structure as RatesheetRepository
2. **Approval Workflow** - Draft → Pending → Approved/Rejected
3. **Priority Resolution** - Higher priority wins, level hierarchy
4. **Hourly Evaluation** - Calculate capacity hour-by-hour
5. **Decision Logging** - Track which capacity sheet applied when
6. **Admin UI** - Similar layout to pricing management
7. **Calculator Tool** - Interactive capacity calculation with breakdown
8. **Timeline Visualization** - Visual representation over time
9. **Entity Hierarchy** - Customer → Location → SubLocation → Event
10. **Recurrence Rules** - Weekly, monthly, yearly patterns

---

## Notes for Implementation

- All capacity values should be non-negative integers
- `allocatedCapacity` must always be between `minCapacity` and `maxCapacity`
- `defaultCapacity` should typically be between min and max
- When multiple capacity sheets apply, use `conflictResolution` strategy
- Event-level capacity sheets ALWAYS override lower levels (regardless of priority)
- Inactive or non-approved capacity sheets are never applied
- Decision log is critical for debugging and transparency
