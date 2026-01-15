import { ObjectId } from 'mongodb';

export interface Attribute {
  key: string;
  value: string;
}

export interface Customer {
  _id?: ObjectId;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  attributes?: Attribute[];
  defaultHourlyRate?: number;
  timezone?: string;
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
  attributes?: Attribute[];
  defaultHourlyRate?: number;
  timezone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubLocation {
  _id?: ObjectId;
  locationId: ObjectId;
  label: string;
  description?: string;
  allocatedCapacity?: number;
  attributes?: Attribute[];
  defaultHourlyRate?: number;
  pricingEnabled: boolean;
  isActive: boolean;
  timezone?: string;
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
  startTime: string; // Format: "HH:MM" (24-hour)
  endTime: string;   // Format: "HH:MM" (24-hour)
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
  applyTo: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
  customerId?: ObjectId;
  locationId?: ObjectId;
  subLocationId?: ObjectId;
  
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
  level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
  minPriority: number;
  maxPriority: number;
  color: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
