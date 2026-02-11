# Project Decisions & Session Notes

## Session: 2026-02-11 - Custom Category Revenue Goals & Validation

### Key Decisions

#### 1. Custom Category Revenue Goals Persistence
**Decision**: Extend the revenue goals system to persist individual category allocations (transient, events, reserved, unavailable, readyToUse) alongside the computed dailyGoal.

**Rationale**: Users need to set custom allocations per category, and these values must survive page reloads and persist to the database.

**Implementation Stack**:
- `src/models/types.ts` - Extended `RevenueGoal` interface with `customCategoryGoals`
- `src/lib/capacity-utils.ts` - Updated `setRevenueGoal()` to accept and store category values
- `src/models/SubLocation.ts` - Updated repository method signature
- `src/app/api/revenue-goals/route.ts` - API accepts and passes through `customCategoryGoals`
- `src/app/capacity/manage/page.tsx` - UI saves and restores custom values

#### 2. Max Capacity Validation for Custom Goals
**Decision**: Validate that the sum of all custom category allocations does not exceed the sublocation's max capacity.

**Behavior**:
- Prevents exceeding max capacity with informative alert
- Allows free redistribution between categories as long as total stays within limit
- Shows visual warning when approaching or at capacity limit
- Alert message: "Total capacity (X) would exceed maximum capacity (Y). You can redistribute capacity between categories, but the total cannot exceed Y."

#### 3. Revenue Goal Type Options
**Values**:
- `max` - Use max capacity for revenue calculation
- `allocated` - Use allocated capacity
- `custom` - User-defined per-category allocations

---

## Capacity Allocation Model

### 5-Category System
| Category | Color | Description |
|----------|-------|-------------|
| Transient | #14B8A6 (teal) | Walk-in capacity |
| Events | #EC4899 (pink) | Event bookings |
| Reserved | #8B5CF6 (violet) | Pre-reserved slots |
| Unavailable | #9CA3AF (gray) | Closed/Blackout periods |
| Ready To Use | #F59E0B (amber) | Available capacity |

### UNKNOWN Value Convention
- Value `-9` indicates unknown/not tracked for a given hour
- UI displays "-" for unknown values
- Used when hourly breakdown doesn't have data for specific categories

---

## Data Flow Patterns

### Revenue Goal Save Flow
```
UI (customCategoryGoals state)
  ↓
API POST /api/revenue-goals (with customCategoryGoals in body)
  ↓
SubLocationRepository.setRevenueGoal (passes customCategoryGoals)
  ↓
capacity-utils.setRevenueGoal (stores in RevenueGoal object)
  ↓
MongoDB (capacityConfig.revenueGoals array)
```

### Revenue Goal Load Flow
```
API GET /api/capacity/calculate (returns hourlyBreakdown per segment)
  ↓
UI loads cell data with revenueGoal object
  ↓
Modal initialization checks for saved customCategoryGoals
  ↓
Falls back to calculating from hourlyBreakdown if no saved values
```
