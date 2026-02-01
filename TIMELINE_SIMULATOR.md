# Timeline Simulator - Documentation

## Overview

The Timeline Simulator is an interactive pricing visualization and simulation tool for the venue management system. It provides real-time pricing calculations with support for dynamic surge pricing, scenario planning, and layer-based price adjustments.

**Location**: `/pricing/timeline-simulator`
**Main Component**: `src/app/pricing/timeline-simulator/page.tsx`

## Key Features

### 1. Real-Time Pricing Visualization
- **Hourly Timeline View**: Visual timeline showing pricing for each hour in the selected time range
- **Multi-Layer Pricing Display**: Shows all active pricing layers in a waterfall view
- **Winning Price Highlighting**: Clearly indicates which layer is providing the current price
- **Capacity & Revenue Metrics**: Displays capacity and revenue potential for each time slot

### 2. Surge Pricing Integration
- **Dynamic Surge Calculations**: Real-time surge multiplier application based on demand/supply
- **Surge Factor Display**: Shows current surge multiplier (e.g., 1.5x)
- **Visual Surge Indicators**: Orange/red gradient for price increases, green for discounts
- **Time Window Support**: Surge pricing can be limited to specific days/hours

### 3. Simulation Mode
- **Layer Toggle**: Enable/disable individual pricing layers to test scenarios
- **Pre-Simulation Baseline**: Tracks original price before simulation begins
- **Dynamic Price Updates**: Prices recalculate instantly when layers are toggled
- **Dual-Price Display**: Shows both baseline and current price when in simulation mode

### 4. Planning & Scenarios
- **Save Scenarios**: Save current configuration for later reference
- **Load Scenarios**: Restore previously saved pricing configurations
- **Scenario Management**: View, edit, and delete saved scenarios

## User Interface Structure

### Hierarchical Mode Toggles

```
├── Simulation (Top Level)
│   ├── Surge Pricing (Child - orange/red theme)
│   └── Planning (Child - purple theme)
│       ├── Save Scenario
│       ├── Load Scenario
│       └── Clear Scenario
```

### Mode Behavior

1. **Default State** (No modes enabled)
   - Shows standard pricing based on active ratesheets
   - All layers visible but cannot be toggled
   - Single price display

2. **Simulation Mode** (Enabled)
   - Captures baseline price when first enabled
   - Allows toggling individual layers in waterfall
   - Shows dual-price display when price differs from baseline
   - Enables Surge Pricing toggle

3. **Surge Pricing** (Child of Simulation)
   - Only available when Simulation is enabled
   - Adds virtual SURGE layer to pricing waterfall
   - Displays surge multiplier badge (e.g., "1.5x")
   - Color-coded: orange/red for increases, green for decreases

4. **Planning Mode** (Child of Simulation)
   - Only available when Simulation is enabled
   - Reveals Save/Load Scenario controls
   - Allows saving current configuration for later use

## Price Display Logic

### Standard Display (No Simulation)
```
┌─────────────────────┐
│    $120.00          │  ← Single price in slate gradient
└─────────────────────┘
```

### Simulation Display (Price Changed)
```
┌─────────────────────────────────┐
│    $120.00          $125.55     │
│    ─────────
│    Baseline         Current      │
│    (strikethrough)  (main)       │
│                                  │
│    +$5.55 (+4.6%)               │  ← Difference indicator
└─────────────────────────────────┘
```

**Key Rules:**
- Strikethrough price = Pre-simulation baseline (what you had before enabling Simulation)
- Main price = Current calculated price based on active layers
- Color coding:
  - **Increase**: Orange/red gradient
  - **Decrease**: Green gradient
  - **No change**: Slate gradient (no strikethrough)

### Price Formatting
- Dollars displayed in large font size
- Cents displayed as superscript for space efficiency
- Example: $120<sup>.00</sup>

## Pricing Waterfall

The waterfall displays all pricing layers in priority order:

### Layer Types
1. **SURGE** (Priority 10000+) - Dynamic multiplier layer
2. **EVENT** (Priority 4000-4999) - Event-specific pricing
3. **SUBLOCATION** (Priority 3000-3999) - SubLocation pricing
4. **LOCATION** (Priority 2000-2999) - Location pricing
5. **CUSTOMER** (Priority 1000-1999) - Customer-specific pricing
6. **DEFAULT** (Base) - Fallback default rates

### Layer Toggle Behavior

**Simulation Disabled:**
- All toggles are locked (grayed out)
- Cannot modify layer state
- Shows actual applied pricing

**Simulation Enabled:**
- Can toggle individual layers on/off
- At least one DEFAULT layer must remain enabled
- Price recalculates instantly when toggled
- Changes affect main price display

## Surge Pricing Implementation

### Architecture

Surge pricing is implemented as a **virtual runtime-generated layer** rather than a stored ratesheet:

1. **Surge Configuration** (`surge_configs` collection)
   - Stores demand/supply parameters
   - Defines surge calculation parameters (alpha, min/max multipliers)
   - Specifies time windows for applicability

2. **Dynamic Generation** (API: `/api/pricing/calculate-hourly`)
   - When surge is enabled, generates virtual SURGE ratesheet
   - Stores **multiplier** (e.g., 1.5x) not absolute prices
   - Priority: 10000 (very high)
   - Type: `SURGE_MULTIPLIER`

3. **Multiplier Application** (Pricing Engine)
   - Finds base price from next highest priority layer
   - Applies multiplier: `surge_price = base_price * surge_factor`
   - Dynamic calculation ensures accurate surge on changing base prices

### Surge Calculation Formula

```javascript
// Step 1: Calculate pressure
pressure = demand / supply

// Step 2: Normalize against historical average
normalized_pressure = pressure / historical_avg_pressure

// Step 3: Apply EMA smoothing
smoothed_pressure = EMA(normalized_pressure)

// Step 4: Calculate surge factor
raw_factor = 1 + α * log(smoothed_pressure)

// Step 5: Clamp to bounds
surge_factor = clamp(raw_factor, min_multiplier, max_multiplier)

// Example: demand=15, supply=10, historical_avg=1.2, α=0.3
// pressure = 15/10 = 1.5
// normalized = 1.5/1.2 = 1.25
// raw_factor = 1 + 0.3 * log(1.25) = 1.067
// surge_factor = 1.067 (within 0.75-1.8 range)
```

### Surge Configuration Parameters

**Demand/Supply:**
- `currentDemand`: Number of bookings/hour (manual input for simulation)
- `currentSupply`: Available capacity (manual input)
- `historicalAvgPressure`: Baseline pressure ratio (e.g., 1.2)

**Surge Parameters:**
- `alpha`: Sensitivity coefficient (0.1-1.0, default 0.3)
- `minMultiplier`: Floor multiplier (e.g., 0.75 = 25% discount)
- `maxMultiplier`: Ceiling multiplier (e.g., 1.8 = 80% increase)
- `emaAlpha`: Smoothing factor (0.1-0.5, default 0.3)

**Time Applicability:**
- `effectiveFrom`/`effectiveTo`: Date range
- `timeWindows`: Optional day/time restrictions
  - `daysOfWeek`: [0-6] where 0=Sunday
  - `startTime`/`endTime`: HH:MM format

## State Management

### Key State Variables

```typescript
// Mode toggles
const [isSimulationEnabled, setIsSimulationEnabled] = useState(false);
const [isPlanningEnabled, setIsPlanningEnabled] = useState(false);
const [surgeEnabled, setSurgeEnabled] = useState(false);

// Baseline tracking
const [preSimulationBaselinePrice, setPreSimulationBaselinePrice] = useState(0);

// Layer state
const [enabledLayers, setEnabledLayers] = useState<Set<string>>(new Set());

// Surge config
const [activeSurgeConfig, setActiveSurgeConfig] = useState<SurgeConfig | null>(null);

// Timeline data
const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
```

### TimeSlot Interface

```typescript
interface TimeSlot {
  hour: number;                   // Hour index
  label: string;                  // Display label (e.g., "2:00 PM")
  date: Date;                     // Actual timestamp

  // Layer information
  layers: Array<{
    layer: PricingLayer;
    price: number | null;
    isActive: boolean;
  }>;

  // Winning price info
  winningLayer?: PricingLayer;
  winningPrice?: number;          // Current final price

  // Surge-specific
  basePrice?: number;             // Base price (without surge)
  surgePrice?: number;            // Surge-adjusted price
  surgeMultiplier?: number;       // Applied surge factor

  // Capacity
  capacity?: {
    min: number;
    max: number;
    target: number;
  };
}
```

## API Integration

### Primary Endpoint: `/api/pricing/calculate-hourly`

**Request:**
```json
{
  "subLocationId": "507f1f77bcf86cd799439011",
  "eventId": "507f1f77bcf86cd799439012",  // Optional
  "startTime": "2024-01-15T10:00:00Z",
  "endTime": "2024-01-15T22:00:00Z",
  "includeSurge": true,
  "isEventBooking": false
}
```

**Response:**
```json
{
  "totalPrice": 1500.00,
  "totalHours": 12,
  "segments": [
    {
      "startTime": "2024-01-15T10:00:00Z",
      "endTime": "2024-01-15T11:00:00Z",
      "pricePerHour": 125.00,
      "ratesheet": {
        "name": "SURGE: surge1",
        "type": "SURGE_MULTIPLIER",
        "priority": 10000,
        "level": "SURGE"
      },
      "basePrice": 120.00,
      "surgeMultiplier": 1.04
    }
    // ... more segments
  ],
  "metadata": {
    "customer": "Customer Name",
    "location": "Location Name",
    "subLocation": "SubLocation Label",
    "event": "Event Name"
  }
}
```

### Surge Configuration APIs

**List Configs:** `GET /api/surge-pricing/configs`
```json
{
  "configs": [
    {
      "_id": "...",
      "name": "Holiday Surge - Convention Center",
      "appliesTo": {
        "level": "SUBLOCATION",
        "entityId": "..."
      },
      "demandSupplyParams": {
        "currentDemand": 15,
        "currentSupply": 10,
        "historicalAvgPressure": 1.2
      },
      "surgeParams": {
        "alpha": 0.3,
        "minMultiplier": 0.75,
        "maxMultiplier": 1.8,
        "emaAlpha": 0.3
      },
      "isActive": true
    }
  ]
}
```

**Create Config:** `POST /api/surge-pricing/configs`
**Update Config:** `PATCH /api/surge-pricing/configs/[id]`
**Delete Config:** `DELETE /api/surge-pricing/configs/[id]`

## Usage Workflows

### Workflow 1: Basic Price Viewing
1. Select Customer, Location, SubLocation
2. Choose time range (12-hour default)
3. View pricing timeline and layers
4. Click time slots to see decision details

### Workflow 2: Enable Surge Pricing
1. Complete basic setup (above)
2. Enable **Simulation** mode
3. Enable **Surge Pricing** toggle
4. Observe price changes with surge applied
5. View surge multiplier in badge and waterfall

### Workflow 3: Test Layer Combinations
1. Enable **Simulation** mode
2. Toggle individual layers on/off in waterfall
3. Observe real-time price updates
4. Compare against baseline (strikethrough price)
5. Note: At least one DEFAULT layer must stay enabled

### Workflow 4: Save & Load Scenarios
1. Enable both **Simulation** and **Planning** modes
2. Configure desired layer states and settings
3. Click **Save Scenario**
4. Enter name and description
5. Later: Click **Load Scenario** to restore configuration

### Workflow 5: Create Surge Configuration
1. Navigate to `/admin/surge-pricing`
2. Click **Create Surge Config**
3. Fill in modal:
   - Name, Description
   - Hierarchy Level (Location/SubLocation)
   - Demand/Supply parameters
   - Surge calculation parameters
   - Time applicability (optional)
4. Review live preview showing calculated surge factor
5. Save configuration
6. Return to timeline simulator to test

## Technical Implementation Details

### Baseline Price Capture

When simulation mode is enabled, the system captures a baseline:

```typescript
useEffect(() => {
  if (isSimulationEnabled && timeSlots.length > 0 && preSimulationBaselinePrice === 0) {
    // Capture baseline only on first enable
    const currentTotal = timeSlots.reduce((sum, slot) =>
      sum + (slot.winningPrice || 0), 0
    );
    setPreSimulationBaselinePrice(currentTotal);
  }

  // Reset when simulation disabled
  if (!isSimulationEnabled && preSimulationBaselinePrice > 0) {
    setPreSimulationBaselinePrice(0);
  }
}, [isSimulationEnabled, timeSlots, preSimulationBaselinePrice]);
```

### Price Calculation

```typescript
// Current total based on active layers
const getTotalCost = (): number => {
  return timeSlots.reduce((sum, slot) =>
    sum + (slot.winningPrice || 0), 0
  );
};
```

### Display Logic

```typescript
// Show dual prices if in simulation AND price changed
{isSimulationEnabled &&
 preSimulationBaselinePrice > 0 &&
 getTotalCost() !== preSimulationBaselinePrice ? (
  <DualPriceDisplay
    baseline={preSimulationBaselinePrice}
    current={getTotalCost()}
  />
) : (
  <SinglePriceDisplay price={getTotalCost()} />
)}
```

## Color Scheme

### Mode Colors
- **Simulation**: Purple/indigo gradient
- **Surge Pricing**: Orange/red gradient (increases), green (decreases)
- **Planning**: Purple theme

### Layer Colors (Waterfall)
- **SURGE**: Orange gradient
- **EVENT**: Blue
- **SUBLOCATION**: Green
- **LOCATION**: Indigo
- **CUSTOMER**: Purple
- **DEFAULT**: Gray

### Status Colors
- **Active/Enabled**: Green
- **Inactive/Disabled**: Gray
- **Warning**: Yellow/Orange
- **Error**: Red

## Performance Considerations

### Optimization Strategies
1. **Memoization**: Price calculations cached per time range
2. **Debounced Updates**: Layer toggles debounced to prevent excessive recalcs
3. **Lazy Loading**: Only fetch pricing data when needed
4. **Virtual Scrolling**: Timeline can handle 100+ hours efficiently

### Known Limitations
1. **EMA Continuity**: Surge smoothing resets on each API call (no persistent state)
2. **Real-Time Updates**: Manual refresh required for external changes
3. **Concurrent Edits**: No conflict resolution for simultaneous scenario edits

## Troubleshooting

### Issue: Surge not showing in waterfall
**Cause**: Simulation mode not enabled
**Solution**: Enable Simulation mode first, then enable Surge toggle

### Issue: Cannot toggle layers
**Cause**: Simulation mode disabled
**Solution**: Enable Simulation mode to unlock layer toggles

### Issue: Strikethrough price incorrect
**Cause**: Baseline not captured correctly
**Solution**:
1. Disable simulation mode
2. Wait for price to stabilize
3. Re-enable simulation mode to capture fresh baseline

### Issue: "Cannot disable layer" error
**Cause**: Attempting to disable last DEFAULT layer
**Solution**: At least one DEFAULT layer must remain enabled (ensures fallback pricing)

### Issue: Surge multiplier shows 1.0x (no surge)
**Causes**:
1. No active surge config for selected sublocation
2. Current time outside surge config's time windows
3. Surge config inactive

**Solution**: Check `/admin/surge-pricing` to verify config exists and is active

## Related Documentation

- **[SURGE_PRICING.md](SURGE_PRICING.md)**: Detailed surge pricing architecture
- **[ADMIN_SURGE_PRICING.md](ADMIN_SURGE_PRICING.md)**: Surge config management
- **[SCHEMA.md](SCHEMA.md)**: Database schema including surge_configs
- **[README.md](README.md)**: Overall project documentation

## File Locations

### Main Component
- `src/app/pricing/timeline-simulator/page.tsx` - Timeline simulator page

### Related Components
- `src/components/PricingFiltersModal.tsx` - Filter selection modal
- `src/components/CreateSurgeConfigModal.tsx` - Create surge config
- `src/components/EditSurgeConfigModal.tsx` - Edit surge config

### API Routes
- `src/app/api/pricing/calculate-hourly/route.ts` - Main pricing endpoint
- `src/app/api/surge-pricing/configs/route.ts` - Surge config CRUD
- `src/app/api/surge-pricing/calculate/route.ts` - Surge calculation

### Backend Logic
- `src/lib/price-engine-hourly.ts` - Hourly pricing engine
- `src/lib/surge-pricing-engine.ts` - Surge calculation logic
- `src/models/SurgeConfig.ts` - Surge config repository
- `src/models/types.ts` - TypeScript interfaces

## Keyboard Shortcuts

*Coming soon: Planned keyboard shortcuts for power users*

## Future Enhancements

### Planned Features
1. **Real-Time Demand Tracking**: Replace manual input with actual booking data
2. **Historical Analytics**: View past surge patterns and pricing history
3. **Predictive Surge**: ML-based demand prediction
4. **Collaborative Scenarios**: Share scenarios with team members
5. **Export Options**: Export pricing data to CSV/Excel
6. **Notification System**: Alerts for price changes or surge activation
7. **Mobile Optimization**: Responsive design improvements
8. **Undo/Redo**: Action history for scenario changes

### Under Consideration
- WebSocket integration for real-time updates
- Price velocity limits (prevent rapid price swings)
- A/B testing framework for surge parameters
- Customer-specific surge caps
- Multi-factor surge (weather, events, competitor pricing)

---

**Last Updated**: January 31, 2026
**Version**: 2.0 (with Surge Pricing)
**Maintained By**: Development Team
