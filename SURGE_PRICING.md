# Surge Pricing System - Technical Documentation

## Overview

The Surge Pricing system provides dynamic price adjustments based on demand and supply pressure. It implements a multiplicative pricing model where surge factors are applied to base prices in real-time.

**Admin Interface**: `/admin/surge-pricing`
**Implementation Date**: January 2026

## Architecture

### Design Philosophy

Surge pricing is implemented as a **post-processing multiplier layer** rather than traditional ratesheets:

1. **Standard pricing waterfall runs first** (priorities 1000-4999)
2. **Base price is determined** from highest priority applicable layer
3. **Surge multiplier is applied**: `final_price = base_price * surge_factor`
4. **Result is displayed** with surge indicator

**Why Not Priority 10000+ Ratesheets?**

Initial consideration was to use very high priority ratesheets (10000+) for surge. However, the pricing engine sorts by **hierarchy level first, then priority**:

```
Hierarchy: EVENT (4) > SUBLOCATION (3) > LOCATION (2) > CUSTOMER (1)
```

This means an EVENT ratesheet at priority 4001 beats a SUBLOCATION surge at priority 10000.

**Solution**: Surge is a **virtual layer** generated at runtime with type `SURGE_MULTIPLIER`, storing multipliers (e.g., 1.5x) instead of absolute prices.

## Database Schema

### Collection: `surge_configs`

```typescript
interface SurgeConfig {
  _id?: ObjectId;
  name: string;                    // e.g., "Holiday Surge - Convention Center"
  description?: string;

  // Hierarchy scope
  appliesTo: {
    level: 'SUBLOCATION' | 'LOCATION';
    entityId: ObjectId;
  };

  // Manual demand/supply parameters (simulation mode)
  demandSupplyParams: {
    currentDemand: number;         // e.g., 15 bookings/hour
    currentSupply: number;         // e.g., 10 available slots/hour
    historicalAvgPressure: number; // e.g., 1.2 baseline ratio
  };

  // Surge calculation parameters
  surgeParams: {
    alpha: number;                 // Sensitivity coefficient (0.1-1.0)
    minMultiplier: number;         // Floor (e.g., 0.75 = 25% discount)
    maxMultiplier: number;         // Ceiling (e.g., 1.8 = 80% surge)
    emaAlpha: number;              // EMA smoothing (0.1-0.5)
  };

  // Time-based applicability
  effectiveFrom: Date;
  effectiveTo?: Date;              // Optional end date
  timeWindows?: Array<{
    daysOfWeek?: number[];         // 0=Sun, 6=Sat (optional)
    startTime?: string;            // "HH:MM" (optional)
    endTime?: string;              // "HH:MM" (optional)
  }>;

  // Status
  isActive: boolean;
  createdBy?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

### Example Documents

```javascript
// High-demand holiday surge
{
  _id: ObjectId("..."),
  name: "New Year's Eve Surge",
  description: "Increased pricing for NYE bookings",
  appliesTo: {
    level: "SUBLOCATION",
    entityId: ObjectId("...")  // Convention Center Main Hall
  },
  demandSupplyParams: {
    currentDemand: 25,    // 25 bookings/hour
    currentSupply: 10,    // 10 slots/hour
    historicalAvgPressure: 1.5
  },
  surgeParams: {
    alpha: 0.4,           // Higher sensitivity
    minMultiplier: 1.0,   // No discounts during NYE
    maxMultiplier: 2.5,   // Up to 2.5x surge
    emaAlpha: 0.2
  },
  effectiveFrom: ISODate("2024-12-31T00:00:00Z"),
  effectiveTo: ISODate("2025-01-01T06:00:00Z"),
  timeWindows: [
    {
      daysOfWeek: [6, 0],  // Saturday & Sunday
      startTime: "19:00",
      endTime: "03:00"     // 7 PM - 3 AM
    }
  ],
  isActive: true,
  createdAt: ISODate("2024-12-01T10:00:00Z"),
  updatedAt: ISODate("2024-12-01T10:00:00Z")
}

// Low-demand discount pricing
{
  _id: ObjectId("..."),
  name: "Weekday Discount",
  appliesTo: {
    level: "LOCATION",
    entityId: ObjectId("...")
  },
  demandSupplyParams: {
    currentDemand: 5,     // Low demand
    currentSupply: 20,    // High availability
    historicalAvgPressure: 1.2
  },
  surgeParams: {
    alpha: 0.3,
    minMultiplier: 0.75,  // Up to 25% discount
    maxMultiplier: 1.5,
    emaAlpha: 0.3
  },
  effectiveFrom: ISODate("2024-01-01T00:00:00Z"),
  timeWindows: [
    {
      daysOfWeek: [1, 2, 3, 4],  // Mon-Thu
      startTime: "09:00",
      endTime: "17:00"
    }
  ],
  isActive: true,
  createdAt: ISODate("2024-01-01T08:00:00Z"),
  updatedAt: ISODate("2024-01-01T08:00:00Z")
}
```

## Surge Calculation Formula

### Mathematical Model

The surge factor is calculated using a logarithmic pressure model with exponential moving average (EMA) smoothing:

```
Step 1: Calculate Pressure
pressure = demand / supply

Step 2: Normalize Against Historical Average
normalized_pressure = pressure / historical_avg_pressure

Step 3: Apply EMA Smoothing
smoothed_pressure = α_ema × normalized_pressure + (1 - α_ema) × previous_smoothed

Step 4: Calculate Raw Surge Factor
raw_factor = 1 + α × log(smoothed_pressure)

Step 5: Clamp to Configured Bounds
surge_factor = clamp(raw_factor, min_multiplier, max_multiplier)
```

### Implementation

**File**: `src/lib/surge-pricing-engine.ts`

```typescript
export function calculateSurgeFactor(params: {
  demand: number;
  supply: number;
  historicalAvgPressure: number;
  alpha: number;
  minMultiplier: number;
  maxMultiplier: number;
  previousSmoothedPressure?: number;
  emaAlpha: number;
}): SurgeCalculationResult {
  // Step 1: Calculate current pressure
  const pressure = params.demand / params.supply;

  // Step 2: Normalize against historical average
  const normalized_pressure = pressure / params.historicalAvgPressure;

  // Step 3: Apply EMA smoothing
  const smoothed_pressure = params.previousSmoothedPressure
    ? params.emaAlpha * normalized_pressure +
      (1 - params.emaAlpha) * params.previousSmoothedPressure
    : normalized_pressure;  // First call, no history

  // Step 4: Calculate surge factor
  const raw_factor = 1 + params.alpha * Math.log(smoothed_pressure);

  // Step 5: Clamp to min/max bounds
  const surge_factor = Math.max(
    params.minMultiplier,
    Math.min(params.maxMultiplier, raw_factor)
  );

  return {
    surge_factor,
    pressure,
    normalized_pressure,
    smoothed_pressure,
    raw_factor,
    applied: true
  };
}

export function applySurgeToPrice(
  basePrice: number,
  surgeResult: SurgeCalculationResult
): number {
  return basePrice * surgeResult.surge_factor;
}
```

### Example Calculations

#### Example 1: High Demand (Surge Increase)
```
Input:
  demand: 20 bookings/hour
  supply: 10 slots/hour
  historical_avg: 1.2
  alpha: 0.3
  min: 0.75, max: 1.8
  ema_alpha: 0.3

Calculation:
  pressure = 20/10 = 2.0
  normalized = 2.0/1.2 = 1.667
  smoothed = 1.667 (first call, no history)
  raw_factor = 1 + 0.3 × log(1.667) = 1 + 0.3 × 0.511 = 1.153
  surge_factor = clamp(1.153, 0.75, 1.8) = 1.153

Result: 1.15x surge (15.3% price increase)
  $100 → $115.30
```

#### Example 2: Low Demand (Discount)
```
Input:
  demand: 5 bookings/hour
  supply: 20 slots/hour
  historical_avg: 1.2
  alpha: 0.3
  min: 0.75, max: 1.8

Calculation:
  pressure = 5/20 = 0.25
  normalized = 0.25/1.2 = 0.208
  smoothed = 0.208
  raw_factor = 1 + 0.3 × log(0.208) = 1 + 0.3 × (-1.57) = 0.529
  surge_factor = clamp(0.529, 0.75, 1.8) = 0.75

Result: 0.75x multiplier (25% discount - hit floor)
  $100 → $75.00
```

#### Example 3: Balanced Demand (No Surge)
```
Input:
  demand: 12 bookings/hour
  supply: 10 slots/hour
  historical_avg: 1.2
  alpha: 0.3

Calculation:
  pressure = 12/10 = 1.2
  normalized = 1.2/1.2 = 1.0
  smoothed = 1.0
  raw_factor = 1 + 0.3 × log(1.0) = 1 + 0.3 × 0 = 1.0
  surge_factor = 1.0

Result: 1.0x (no change)
  $100 → $100.00
```

## API Integration

### Generate Surge Ratesheets

**Endpoint**: `/api/pricing/calculate-hourly`

When `includeSurge: true` and an active surge config exists, the API:

1. **Runs base pricing calculation** (without surge)
2. **Finds active surge config** for sublocation/time
3. **Calculates surge factor** using formula above
4. **Generates virtual SURGE ratesheet**:
   ```typescript
   {
     _id: ObjectId(),
     name: "SURGE: surge1",
     type: "SURGE_MULTIPLIER",  // Special type
     priority: 10000,
     timeWindows: [
       {
         startTime: "10:00",
         endTime: "11:00",
         pricePerHour: 1.15,     // MULTIPLIER, not price
         windowType: "ABSOLUTE_TIME",
         surgeMultiplier: 1.15   // Explicit reference
       }
       // ... hourly windows
     ],
     surgeMultiplier: 1.15,      // Base multiplier
     isActive: true,
     approvalStatus: "APPROVED"
   }
   ```
5. **Re-runs pricing engine** with surge ratesheet included
6. **Returns combined result**

### Request Format

```json
POST /api/pricing/calculate-hourly
{
  "subLocationId": "507f1f77bcf86cd799439011",
  "startTime": "2024-01-15T10:00:00Z",
  "endTime": "2024-01-15T22:00:00Z",
  "includeSurge": true
}
```

### Response Format

```json
{
  "totalPrice": 1506.60,
  "totalHours": 12,
  "segments": [
    {
      "startTime": "2024-01-15T10:00:00Z",
      "endTime": "2024-01-15T11:00:00Z",
      "pricePerHour": 125.55,
      "ratesheet": {
        "name": "SURGE: surge1",
        "type": "SURGE_MULTIPLIER",
        "priority": 10000,
        "level": "SURGE"
      },
      "basePrice": 120.00,
      "surgeMultiplier": 1.046
    }
    // ... 11 more hourly segments
  ],
  "metadata": {
    "customer": "Austin Convention Center",
    "location": "Downtown Austin",
    "subLocation": "Main Hall",
    "surgeApplied": true
  }
}
```

## Repository Methods

**File**: `src/models/SurgeConfig.ts`

### Core Methods

```typescript
class SurgeConfigRepository {
  // Create new surge configuration
  static async create(config: Omit<SurgeConfig, '_id' | 'createdAt' | 'updatedAt'>): Promise<SurgeConfig>

  // Find by ID
  static async findById(id: string | ObjectId): Promise<SurgeConfig | null>

  // Find all configs
  static async findAll(): Promise<SurgeConfig[]>

  // Find active configs for sublocation at specific time
  static async findActiveBySubLocation(
    subLocationId: string | ObjectId,
    timestamp: Date = new Date()
  ): Promise<SurgeConfig | null>

  // Find by hierarchy level and entity
  static async findByAppliesTo(
    level: 'SUBLOCATION' | 'LOCATION',
    entityId: string | ObjectId
  ): Promise<SurgeConfig[]>

  // Update configuration
  static async update(
    id: string | ObjectId,
    updates: Partial<SurgeConfig>
  ): Promise<SurgeConfig | null>

  // Delete configuration
  static async delete(id: string | ObjectId): Promise<boolean>

  // Toggle active status
  static async toggleActive(id: string | ObjectId): Promise<SurgeConfig | null>

  // Find all active configs
  static async findActive(): Promise<SurgeConfig[]>
}
```

### Hierarchy Resolution

The `findActiveBySubLocation` method implements cascade logic:

1. **Query both levels**: Searches for configs at SUBLOCATION and LOCATION levels
2. **Filter by date**: Checks `effectiveFrom` and `effectiveTo`
3. **Prefer specificity**: SubLocation config overrides Location config
4. **Check time windows**: Validates day-of-week and time-of-day constraints

```typescript
// Preference order:
1. Active SUBLOCATION config matching time windows
2. Active LOCATION config matching time windows
3. null (no surge)
```

## Time Window Logic

### Day of Week Matching

```typescript
// daysOfWeek: [0=Sunday, 1=Monday, ..., 6=Saturday]
const dayOfWeek = timestamp.getDay();
const matchesDay = window.daysOfWeek?.includes(dayOfWeek) ?? true;
```

### Time Range Matching

**Same-Day Range** (e.g., 09:00 - 17:00):
```typescript
if (timeStr >= window.startTime && timeStr < window.endTime) {
  // Matches
}
```

**Overnight Range** (e.g., 19:00 - 07:00):
```typescript
if (window.startTime > window.endTime) {
  // Overnight: matches if time >= start OR time < end
  if (timeStr >= window.startTime || timeStr < window.endTime) {
    // Matches
  }
}
```

### Example Time Windows

```typescript
// Weekday business hours
{
  daysOfWeek: [1, 2, 3, 4, 5],  // Mon-Fri
  startTime: "09:00",
  endTime: "17:00"
}

// Weekend nights (overnight)
{
  daysOfWeek: [5, 6],  // Fri-Sat
  startTime: "19:00",
  endTime: "07:00"     // Next morning
}

// All day Sunday
{
  daysOfWeek: [0],     // Sunday only
  startTime: null,     // No time restriction
  endTime: null
}

// Every day, specific hours
{
  daysOfWeek: null,    // All days
  startTime: "18:00",
  endTime: "23:00"
}
```

## Admin Interface

### Create Surge Configuration

**Route**: `/admin/surge-pricing`

**Modal**: `src/components/CreateSurgeConfigModal.tsx`

#### Form Sections

1. **Basic Info**
   - Name (required)
   - Description (optional)
   - Hierarchy Level: LOCATION or SUBLOCATION
   - Entity Selector (dropdown)

2. **Demand & Supply Parameters**
   - Current Demand (number) - e.g., 15 bookings/hour
   - Current Supply (number) - e.g., 10 slots/hour
   - Historical Avg Pressure (number) - e.g., 1.2

3. **Surge Calculation Parameters**
   - Alpha (α) - Slider: 0.1-1.0 (default 0.3)
   - Min Multiplier - Slider: 0.5-1.0 (default 0.75)
   - Max Multiplier - Slider: 1.0-3.0 (default 1.8)
   - EMA Alpha - Slider: 0.1-0.5 (default 0.3)

4. **Live Preview Panel**
   - Shows calculated surge factor in real-time
   - Displays formula breakdown
   - Example price conversion (e.g., $100 → $107)

5. **Time Applicability** (Optional)
   - Effective From (date picker)
   - Effective To (date picker, optional)
   - Days of Week (checkboxes)
   - Time Range (HH:MM inputs)

6. **Status**
   - Active toggle (default: true)

#### Live Preview Example

```
┌─────────────────────────────────────────────┐
│ 🔥 Surge Multiplier: 1.153x                 │
│                                             │
│ Prices will increase by 15.3%               │
├─────────────────────────────────────────────┤
│ Calculation Breakdown:                      │
│                                             │
│ Pressure:       15 / 10 = 1.500            │
│ Normalized:     1.500 / 1.2 = 1.250        │
│ Smoothed:       1.250 (EMA)                │
│ Raw Factor:     1 + 0.3 × log(1.25) = 1.067│
│ Final:          1.153 (clamped)            │
│                                             │
│ Example: $100.00 → $115.30                 │
└─────────────────────────────────────────────┘
```

### Edit Surge Configuration

**Modal**: `src/components/EditSurgeConfigModal.tsx`

Same form as Create, pre-populated with existing values. Live preview updates as values change.

### Config Card Display

```
┌─────────────────────────────────────────────────┐
│ 📍 Holiday Surge - Convention Center           │
│ SubLocation: Convention Center Main Hall       │
│                                                 │
│ 🔥 Surge: 1.15x  (15 demand / 10 supply)       │
│ Range: 0.75x - 1.8x                            │
│ Baseline Pressure: 1.2                         │
│                                                 │
│ 📅 Effective: Jan 1, 2024 - Jan 7, 2024       │
│ ⏰ Fri-Sat, 7:00 PM - 3:00 AM                  │
│                                                 │
│ 🟢 Active   [Edit] [Delete] [Test]            │
└─────────────────────────────────────────────────┘
```

## Integration with Timeline Simulator

### Surge Toggle Hierarchy

```
Simulation (Parent)
  ├── Surge Pricing (Child)
  └── Planning (Child)
      ├── Save Scenario
      ├── Load Scenario
      └── Clear Scenario
```

### Surge Activation Flow

1. User enables **Simulation** mode
2. System captures baseline price
3. User enables **Surge Pricing** toggle
4. System:
   - Loads active surge config for selected sublocation
   - Adds virtual SURGE layer to waterfall
   - Recalculates prices with surge applied
   - Updates display with surge badge (e.g., "1.5x")
5. Price display shows:
   - Baseline (strikethrough)
   - Surge-adjusted price (main, orange/red gradient)
   - Difference indicator

### Layer Toggle Behavior

**Surge Layer Enabled:**
- Appears at top of waterfall (priority 10000)
- Shows multiplier value in tile
- Orange gradient color
- Can be toggled off in simulation mode

**Surge Layer Disabled:**
- Removes surge from price calculation
- Falls back to next highest priority layer
- Price reverts to base amount
- Display updates to show base price as main

## Performance Optimization

### Caching Strategy

1. **Surge Config Cache** (Frontend)
   ```typescript
   // Cache active config per sublocation
   const configCache = new Map<string, SurgeConfig>();
   ```

2. **Pricing Calculation Cache** (API)
   ```typescript
   // Cache base pricing for time range
   // Only recalculate when layers change
   ```

3. **EMA State** (Future)
   ```typescript
   // Store previous smoothed pressure
   // Enables continuous EMA across requests
   ```

### Debouncing

```typescript
// Debounce layer toggle changes
const debouncedRecalculate = debounce(calculateTimeSlots, 300);
```

## Testing

### Unit Tests

**File**: `src/lib/surge-pricing-engine.test.ts`

```typescript
describe('calculateSurgeFactor', () => {
  it('should calculate surge for high demand', () => {
    const result = calculateSurgeFactor({
      demand: 20,
      supply: 10,
      historicalAvgPressure: 1.2,
      alpha: 0.3,
      minMultiplier: 0.75,
      maxMultiplier: 1.8,
      emaAlpha: 0.3
    });

    expect(result.pressure).toBe(2.0);
    expect(result.normalized_pressure).toBeCloseTo(1.667);
    expect(result.surge_factor).toBeGreaterThan(1.0);
    expect(result.surge_factor).toBeLessThanOrEqual(1.8);
  });

  it('should apply floor when demand is very low', () => {
    const result = calculateSurgeFactor({
      demand: 2,
      supply: 20,
      historicalAvgPressure: 1.2,
      alpha: 0.3,
      minMultiplier: 0.75,
      maxMultiplier: 1.8,
      emaAlpha: 0.3
    });

    expect(result.surge_factor).toBe(0.75); // Hit floor
  });

  it('should apply ceiling when demand is extreme', () => {
    const result = calculateSurgeFactor({
      demand: 100,
      supply: 5,
      historicalAvgPressure: 1.2,
      alpha: 0.5,
      minMultiplier: 0.75,
      maxMultiplier: 1.8,
      emaAlpha: 0.3
    });

    expect(result.surge_factor).toBe(1.8); // Hit ceiling
  });
});
```

### Integration Tests

```typescript
describe('Surge Pricing API', () => {
  it('should apply surge to base pricing', async () => {
    // Create surge config
    const config = await createSurgeConfig({...});

    // Calculate pricing with surge
    const response = await POST('/api/pricing/calculate-hourly', {
      subLocationId: testSubLocationId,
      includeSurge: true,
      ...
    });

    expect(response.segments[0].surgeMultiplier).toBeGreaterThan(1.0);
    expect(response.segments[0].pricePerHour).toBeGreaterThan(
      response.segments[0].basePrice
    );
  });

  it('should respect time windows', async () => {
    const config = await createSurgeConfig({
      timeWindows: [{
        daysOfWeek: [1, 2, 3],  // Mon-Wed only
        startTime: "09:00",
        endTime: "17:00"
      }]
    });

    // Friday 10 AM - should NOT have surge
    const fridayResponse = await calculatePricing(
      new Date('2024-01-12T10:00:00Z')  // Friday
    );
    expect(fridayResponse.segments[0].surgeMultiplier).toBe(1.0);

    // Monday 10 AM - should have surge
    const mondayResponse = await calculatePricing(
      new Date('2024-01-15T10:00:00Z')  // Monday
    );
    expect(mondayResponse.segments[0].surgeMultiplier).toBeGreaterThan(1.0);
  });
});
```

## Monitoring & Analytics

### Metrics to Track

1. **Surge Application Rate**: % of bookings with surge applied
2. **Average Surge Factor**: Mean multiplier across all surges
3. **Revenue Impact**: Additional revenue from surge pricing
4. **Conversion Rate**: Booking rate with vs. without surge
5. **Price Velocity**: Rate of price changes over time

### Logging

```typescript
console.log('🔥 Surge Applied:', {
  config: surgeConfig.name,
  demand: surgeConfig.demandSupplyParams.currentDemand,
  supply: surgeConfig.demandSupplyParams.currentSupply,
  pressure: surgeResult.pressure,
  factor: surgeResult.surge_factor,
  basePrice: 120.00,
  surgedPrice: 138.60,
  increase: '+15.5%'
});
```

## Security Considerations

### Access Control

- Only admins can create/edit/delete surge configs
- Read-only access for standard users
- Audit trail for configuration changes

### Rate Limiting

- Prevent rapid surge config updates
- Throttle pricing API calls
- Cache surge calculations

### Validation

```typescript
// Server-side validation
if (alpha < 0.1 || alpha > 1.0) {
  throw new Error('Alpha must be between 0.1 and 1.0');
}

if (minMultiplier < 0.5 || minMultiplier > 1.0) {
  throw new Error('Min multiplier must be between 0.5 and 1.0');
}

if (maxMultiplier < 1.0 || maxMultiplier > 3.0) {
  throw new Error('Max multiplier must be between 1.0 and 3.0');
}

if (currentDemand <= 0 || currentSupply <= 0) {
  throw new Error('Demand and supply must be positive');
}
```

## Migration & Rollback

### Enabling Surge Pricing

1. Deploy backend surge calculation engine
2. Deploy admin UI for configuration management
3. Deploy timeline simulator surge toggle
4. Create initial surge configs for testing
5. Monitor metrics and adjust parameters
6. Roll out to production

### Rollback Plan

1. Disable surge toggle in UI (config flag)
2. Set `includeSurge: false` in API calls
3. Surge configs remain in database (inactive)
4. Can re-enable anytime without data loss

## Future Enhancements

### Planned Improvements

1. **Automated Demand Tracking**
   - Query `events` and `bookings` collections
   - Calculate real-time demand from actual data
   - Replace manual input with live metrics

2. **Historical Analytics**
   - Track past surge patterns
   - Calculate optimal historical averages
   - Predict future demand

3. **Machine Learning Integration**
   - Predict demand based on seasonality, weather, events
   - Auto-adjust surge parameters
   - A/B test different surge strategies

4. **Price Velocity Limits**
   - Prevent rapid price swings
   - Smooth transitions between surge levels
   - User-configurable velocity caps

5. **Multi-Factor Surge**
   - Combine demand, weather, competitor pricing
   - Weighted factor model
   - External API integrations

6. **Customer-Specific Caps**
   - VIP customers never pay more than X
   - Loyalty program discounts
   - Negotiated rate contracts

## Troubleshooting

### Common Issues

#### Issue: Surge not applying
**Symptoms**: Surge toggle enabled but multiplier shows 1.0x

**Possible Causes:**
1. No active surge config for selected sublocation
2. Current time outside surge config's time windows
3. Surge config inactive

**Debug Steps:**
```bash
# Check for active configs
db.surge_configs.find({ isActive: true })

# Check time window matching
# Verify daysOfWeek and startTime/endTime
```

#### Issue: Incorrect surge factor
**Symptoms**: Calculated factor doesn't match expectations

**Debug:**
```javascript
// Log full calculation
console.log('Demand:', demand);
console.log('Supply:', supply);
console.log('Pressure:', demand / supply);
console.log('Normalized:', (demand/supply) / historicalAvg);
console.log('Raw Factor:', 1 + alpha * Math.log(normalized));
console.log('Clamped:', clamp(rawFactor, min, max));
```

#### Issue: Surge applies to wrong hours
**Symptoms**: Surge active during unexpected times

**Check:**
1. Time zone handling (all timestamps UTC?)
2. Time window logic (overnight ranges)
3. Day-of-week calculation (0-indexed)

## Related Documentation

- **[TIMELINE_SIMULATOR.md](TIMELINE_SIMULATOR.md)**: Timeline simulator integration
- **[SCHEMA.md](SCHEMA.md)**: Database schema
- **[README.md](README.md)**: Main project documentation

---

**Last Updated**: January 31, 2026
**Version**: 1.0
**Maintained By**: Development Team
