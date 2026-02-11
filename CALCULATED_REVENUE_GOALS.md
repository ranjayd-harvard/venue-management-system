# Calculated Daily Revenue Goals

## Overview
The system now automatically calculates default daily revenue goals for sublocations based on their hourly rate and capacity.

## Formula
```
Daily Goal = Hourly Rate × Capacity × Hours per Day
```

Where:
- **Hourly Rate**: `sublocation.defaultHourlyRate`
- **Capacity**: Daily capacity for that specific date (can be overridden)
- **Hours per Day**: Configurable per sublocation (default: 24 hours)

## Features

### 1. Automatic Calculation
- When editing a sublocation's daily capacity/goal, the system automatically calculates the default goal
- The calculated value is shown with a clear breakdown of the formula
- Users can see exactly how the goal was computed

### 2. Visual Override Indication
When a user manually overrides the calculated default:
```
Calculated Default:
$1,200 (strikethrough) → $1,500 (Override)

Based on $50/hr × 100 capacity × 24 hours
```

### 3. Auto-Populate Goals
A new button "Auto-Populate Goals" appears for sublocations with a `defaultHourlyRate`:
- Automatically creates daily goals for the entire displayed month
- Uses the formula: `hourlyRate × capacity × hoursPerDay`
- Takes into account any capacity overrides for specific dates
- Overwrites existing goals for those dates

### 4. Recalculation API
**Endpoint**: `POST /api/capacity/auto-populate-goals`

**Body**:
```json
{
  "sublocationId": "string",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "hoursPerDay": 24  // optional, defaults to 24
}
```

**Endpoint**: `PUT /api/capacity/auto-populate-goals`

Recalculates all existing goals for a sublocation (useful after rate changes).

**Body**:
```json
{
  "sublocationId": "string",
  "hoursPerDay": 24  // optional, defaults to 24
}
```

## Configuration

### Hours Per Day
The `hoursPerDay` field is now part of `CapacityConfig`:

```typescript
interface CapacityConfig {
  minCapacity: number;
  maxCapacity: number;
  dailyCapacities: DailyCapacity[];
  revenueGoals: RevenueGoal[];
  hoursPerDay?: number;  // NEW: defaults to 24
}
```

This can be configured per sublocation to account for:
- Business hours (e.g., 12 hours for venues open 9am-9pm)
- Peak hours (e.g., 8 hours for prime time only)
- Full 24-hour operations

## UI Behavior

### Modal Display
1. **No Override**: Shows calculated default as a suggestion
2. **With Override**: Shows strikethrough default → override value
3. **Empty Input**: Auto-saves with calculated default (if available)

### Calendar Cells
- Continue to show actual goal amounts in green
- No visual distinction between calculated and overridden goals (only visible in modal)

## Utility Functions

### `calculateDefaultDailyGoal()`
```typescript
calculateDefaultDailyGoal(hourlyRate: number, capacity: number, hoursPerDay: number): number
```

### `getCalculatedDailyGoal()`
```typescript
getCalculatedDailyGoal(
  sublocation: { defaultHourlyRate?: number; capacityConfig?: CapacityConfig },
  date: string
): number | null
```

Returns null if sublocation doesn't have a `defaultHourlyRate`.

## Example Usage

### Scenario 1: Standard Venue
- **Hourly Rate**: $50
- **Capacity**: 100 people
- **Hours**: 24 (default)
- **Calculated Goal**: $50 × 100 × 24 = **$120,000/day**

### Scenario 2: Business Hours Venue
- **Hourly Rate**: $75
- **Capacity**: 150 people
- **Hours**: 12 (configured)
- **Calculated Goal**: $75 × 150 × 12 = **$135,000/day**

### Scenario 3: Override
- **Calculated Default**: $120,000
- **Manual Override**: $150,000
- **Display**: Shows both with strikethrough on default

## Migration Notes

- Existing revenue goals are not affected
- The `hoursPerDay` field is optional and defaults to 24
- Only sublocations with `defaultHourlyRate` will see calculated defaults
- Customers, Locations, and Events continue to work as before (manual goals only)
