// src/models/SeedConfig.ts
export interface SeedConfig {
  _id?: any;
  customers: number;
  locationsPerCustomer: number;
  subLocationsPerLocation: number;
  venues: number;
  venuesPerLocation: number;
  venuesPerSubLocation: number;
  eventsPerSubLocation: number;
  eventDateRangeStart: number; // Days from now (can be negative for past)
  eventDateRangeEnd: number; // Days from now
  percentActiveEvents: number; // Percentage of events that should be active (0-100)
  customerPrefix: string;
  locationPrefix: string;
  subLocationPrefix: string;
  venuePrefix: string;
  eventPrefix: string;
  useUSPSLocations: boolean;
  createRatesheets: boolean;
  createEvents: boolean;
  createEventRatesheets: boolean; // Create event-specific ratesheets
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_SEED_CONFIG: Omit<SeedConfig, '_id' | 'createdAt' | 'updatedAt'> = {
  customers: 3,
  locationsPerCustomer: 2,
  subLocationsPerLocation: 2,
  venues: 6,
  venuesPerLocation: 3,
  venuesPerSubLocation: 2,
  eventsPerSubLocation: 3,
  eventDateRangeStart: -7, // Start 7 days ago
  eventDateRangeEnd: 7, // End 7 days from now
  percentActiveEvents: 40, // 40% of events are currently active
  customerPrefix: 'Customer',
  locationPrefix: 'Location',
  subLocationPrefix: 'SubLocation',
  venuePrefix: 'Venue',
  eventPrefix: 'Event',
  useUSPSLocations: true,
  createRatesheets: true,
  createEvents: true,
  createEventRatesheets: true,
};
