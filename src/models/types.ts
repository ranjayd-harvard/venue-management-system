import { ObjectId } from 'mongodb';

export interface Attribute {
  key: string;
  value: string;
}

// ===== CAPACITY & REVENUE GOAL TYPES =====

export interface CapacityBounds {
  minCapacity: number; // default: 0
  maxCapacity: number; // default: 100
}

export interface DailyCapacity {
  date: string; // ISO date string (YYYY-MM-DD)
  capacity: number; // Must be between minCapacity and maxCapacity
}

export interface HourlyCapacityOverride {
  date: string; // ISO date string (YYYY-MM-DD)
  hour: number; // 0-23
  minCapacity?: number;
  maxCapacity?: number;
  defaultCapacity?: number;
  allocatedCapacity?: number;
}

export interface RevenueGoal {
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string;   // ISO date string (YYYY-MM-DD)
  dailyGoal?: number;
  weeklyGoal?: number;
  monthlyGoal?: number;
  revenueGoalType?: RevenueGoalType; // Which calculation method was used for this goal
}

export interface CapacityConfig extends CapacityBounds {
  dailyCapacities: DailyCapacity[]; // Explicit daily overrides (deprecated - use hourlyCapacities)
  hourlyCapacities?: HourlyCapacityOverride[]; // Hour-level capacity overrides
  revenueGoals: RevenueGoal[];      // Time-varying goals
  hoursPerDay?: number;             // Hours per day for revenue calculation (default: 24)
}

export interface Customer {
  _id?: ObjectId;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  attributes?: Attribute[];
  defaultHourlyRate?: number;
  // Aggregated capacity from all locations
  minCapacity?: number;       // Sum of all location minCapacity values
  maxCapacity?: number;       // Sum of all location maxCapacity values
  defaultCapacity?: number;   // Sum of all location defaultCapacity values
  allocatedCapacity?: number; // Sum of all location allocatedCapacity values
  timezone?: string;
  capacityConfig?: CapacityConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  _id?: ObjectId;
  customerId: ObjectId;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  totalCapacity?: number;
  // Aggregated capacity from sublocations
  minCapacity?: number;       // Sum of all sublocation minCapacity values
  maxCapacity?: number;       // Sum of all sublocation maxCapacity values
  defaultCapacity?: number;   // Sum of all sublocation defaultCapacity values
  allocatedCapacity?: number; // Sum of all sublocation allocatedCapacity values
  attributes?: Attribute[];
  defaultHourlyRate?: number;
  timezone?: string;
  capacityConfig?: CapacityConfig;
  createdAt: Date;
  updatedAt: Date;
}

export type RevenueGoalType = 'max' | 'allocated' | 'custom';

export interface SubLocation {
  _id?: ObjectId;
  locationId: ObjectId;
  label: string;
  description?: string;
  // Capacity settings (at sublocation level)
  minCapacity?: number;       // Minimum capacity constraint
  maxCapacity?: number;       // Maximum capacity constraint
  defaultCapacity?: number;   // Default capacity value (must be within min-max)
  allocatedCapacity?: number; // Currently allocated capacity (must be within min-max)
  attributes?: Attribute[];
  defaultHourlyRate?: number;
  pricingEnabled: boolean;
  isActive: boolean;
  timezone?: string;
  capacityConfig?: CapacityConfig;
  revenueGoalType?: RevenueGoalType; // Which calculation method to use for revenue goals (default: 'max')
  createdAt: Date;
  updatedAt: Date;
}

export interface Venue {
  _id?: ObjectId;
  name: string;
  description?: string;
  capacity?: number;
  venueType: string;
  attributes?: Attribute[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Event {
  _id?: ObjectId;
  name: string;
  description?: string;
  // Event association: Indicates which level this event is primarily associated with
  eventAssociatedTo: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'VENUE';
  // Hierarchy fields: Preserved for context and filtering
  venueId?: ObjectId;        // Venue where event takes place
  subLocationId?: ObjectId;
  locationId?: ObjectId;
  customerId?: ObjectId;
  startDate: Date;
  endDate: Date;
  gracePeriodBefore?: number; // Grace period in minutes before event start
  gracePeriodAfter?: number;  // Grace period in minutes after event end
  attendees?: number;
  attributes?: Attribute[];
  defaultHourlyRate?: number;
  customPriority?: number;    // Optional: 4000-4999 for manual priority control (defaults to 4900)
  timezone?: string;
  isActive: boolean;
  capacityConfig?: CapacityConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubLocationVenue {
  _id?: ObjectId;
  subLocationId: ObjectId;
  venueId: ObjectId;
  createdAt: Date;
}

export interface LocationVenue {
  _id?: ObjectId;
  locationId: ObjectId;
  venueId: ObjectId;
  createdAt: Date;
}

// ===== PRICING TYPES =====

export interface TimeWindow {
  // Window type: ABSOLUTE_TIME uses clock time, DURATION_BASED uses minutes from booking start
  windowType?: 'ABSOLUTE_TIME' | 'DURATION_BASED'; // Defaults to ABSOLUTE_TIME for backward compatibility

  // Absolute time mode (HH:MM format)
  startTime?: string; // Format: "HH:MM" (24-hour)
  endTime?: string;   // Format: "HH:MM" (24-hour)

  // Duration-based mode (minutes from booking start)
  startMinute?: number;  // e.g., 0 = booking start, 120 = 2 hours from start
  endMinute?: number;    // e.g., 240 = 4 hours from start

  // Common fields
  pricePerHour: number;
  daysOfWeek?: number[]; // 0=Sunday, 6=Saturday
}

export interface Package {
  name: string;
  durationHours: number;
  price: number;
  description?: string;
}

export interface RateSheet {
  _id?: ObjectId;
  name: string;
  description?: string;
  type: 'TIMING_BASED' | 'PACKAGE_BASED' | 'SURGE_MULTIPLIER';

  // Application scope
  applyTo: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
  customerId?: ObjectId;
  locationId?: ObjectId;
  subLocationId?: ObjectId;
  eventId?: ObjectId;

  // Priority (higher = more important)
  priority: number;
  
  // Date range
  effectiveFrom: Date;
  effectiveTo?: Date;
  
  // Timezone
  timezone?: string;
  
  // Timing-based rates
  timeWindows?: TimeWindow[];

  // Package-based rates
  packages?: Package[];

  // Surge multiplier (for SURGE_MULTIPLIER type)
  surgeMultiplier?: number;

  // Status
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface PricingConfig {
  _id?: ObjectId;
  
  // Priority ranges for each level
  customerPriorityRange: { min: number; max: number };
  locationPriorityRange: { min: number; max: number };
  sublocationPriorityRange: { min: number; max: number };
  surgePriorityRange?: { min: number; max: number }; // 10000-10999 (optional for backward compatibility)

  // Default system timezone
  defaultTimezone: string;
  
  // Other config
  defaultHourlyRate?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface PriorityConfig {
  _id?: ObjectId;
  level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
  minPriority: number;
  maxPriority: number;
  color: string;
  description: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ===== PRICING SCENARIO TYPES =====

export interface PricingScenarioConfig {
  // Layer toggles (which pricing layers are enabled)
  enabledLayers: string[]; // Array of layer IDs (ratesheet IDs or 'sublocation-default', 'location-default', etc.)

  // Filter settings
  selectedDuration: number; // 7, 12, 24, 48 hours
  isEventBooking: boolean;

  // Time window
  viewStart: Date;
  viewEnd: Date;
  rangeStart: Date;
  rangeEnd: Date;
  rangeStartOffset?: number; // Days offset from "now" for Range Start dropdown (e.g., -7 for "7 days ago")
  rangeEndOffset?: number;   // Days offset from "now" for Range End dropdown (e.g., +3 for "3 days ahead")

  // Duration context (optional)
  useDurationContext?: boolean;
  bookingStartTime?: Date;

  // Surge pricing (optional)
  surgeEnabled?: boolean;
  surgeConfigId?: string; // Reference to the surge config used

  // Pricing adjustments (placeholders for future use)
  pricingCoefficientsUp?: number;
  pricingCoefficientsDown?: number;
  bias?: number;
}

export interface PricingScenario {
  _id?: ObjectId;
  name: string;
  description?: string;

  // Hierarchy scope
  appliesTo: {
    level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
    entityId: ObjectId;
  };

  // Saved simulation state
  config: PricingScenarioConfig;

  // Status and metadata
  isActive: boolean;
  createdBy?: string; // Future: user tracking
  tags?: string[]; // Future: categorization

  createdAt: Date;
  updatedAt: Date;
}

// ===== SURGE PRICING TYPES =====

export interface DemandSupplyParams {
  currentDemand: number;        // e.g., 15 (bookings/hour)
  currentSupply: number;        // e.g., 10 (available capacity/slots per hour)
  historicalAvgPressure: number; // e.g., 1.2 (baseline pressure ratio)
}

export interface SurgeParams {
  alpha: number;                // Sensitivity coefficient (0.1 - 1.0, default 0.3)
  minMultiplier: number;        // Floor multiplier (0.5 - 1.0, default 0.75)
  maxMultiplier: number;        // Ceiling multiplier (1.0 - 3.0, default 1.8)
  emaAlpha: number;             // EMA smoothing factor (0.1 - 0.5, default 0.3)
}

export interface SurgeTimeWindow {
  daysOfWeek?: number[];        // 0=Sunday, 6=Saturday (optional, default all days)
  startTime?: string;           // "HH:MM" format (optional, default 00:00)
  endTime?: string;             // "HH:MM" format (optional, default 23:59)
}

export interface SurgeConfig {
  _id?: ObjectId;
  name: string;
  description?: string;

  // Hierarchy scope (surge is location/space-based, not event-based)
  appliesTo: {
    level: 'SUBLOCATION' | 'LOCATION';
    entityId: ObjectId;
  };

  // Priority (higher number = higher priority when multiple configs overlap)
  // Similar to ratesheets: typical ranges SUBLOCATION (500-999), LOCATION (300-499)
  priority: number;

  // Manual demand/supply parameters (for simulation)
  demandSupplyParams: DemandSupplyParams;

  // Surge calculation parameters
  surgeParams: SurgeParams;

  // Time-based applicability (optional)
  effectiveFrom: Date;
  effectiveTo?: Date;
  timeWindows?: SurgeTimeWindow[];

  // Status
  isActive: boolean;
  createdBy?: string;

  // Materialization tracking (for physical surge ratesheets)
  materializedRatesheetId?: ObjectId; // Reference to the physical surge ratesheet created from this config
  lastMaterialized?: Date; // Timestamp when this config was last materialized

  createdAt: Date;
  updatedAt: Date;
}

export interface SurgeCalculationResult {
  surge_factor: number;           // Final multiplier (0.75 - 1.8)
  pressure: number;               // demand / supply
  normalized_pressure: number;    // pressure / historical_avg
  smoothed_pressure: number;      // EMA of normalized
  raw_factor: number;             // Before clamping
  applied: boolean;               // Whether surge was successfully calculated
}

export interface HourlySurgeBreakdown {
  hour: Date;                     // ISO timestamp for this hour
  basePrice: number;              // Original price before surge
  surgeMultiplier: number;        // The surge factor applied
  finalPrice: number;             // basePrice * surgeMultiplier
}

export interface SurgePricingResult {
  basePrice: number;              // Average base price per hour
  surgeMultiplier: number;        // Average surge multiplier across all hours
  finalPrice: number;             // Average final price per hour
  surgeDetails: SurgeCalculationResult;
  hourlyBreakdown: HourlySurgeBreakdown[];
}

// ===== CAPACITY SHEET TYPES =====
// Re-export from CapacitySheet model for convenience

export type {
  CapacitySheet,
  CapacitySheetType,
  TimeCapacityWindow,
  DateCapacityRange,
  EventCapacityRule,
  RecurrenceRule,
  CapacityQuery,
  CapacityResult
} from './CapacitySheet';
