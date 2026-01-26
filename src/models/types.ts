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
  type: 'TIMING_BASED' | 'PACKAGE_BASED';

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
