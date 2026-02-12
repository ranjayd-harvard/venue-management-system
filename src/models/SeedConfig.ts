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
  createPriorityConfigs: boolean; // Seed priority config ranges
  createCapacitySheets: boolean; // Seed capacity sheets at all hierarchy levels
  createSurgeConfigs: boolean; // Seed surge pricing configs
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
  eventDateRangeStart: 1, // Start 1 day from now (tomorrow)
  eventDateRangeEnd: 5, // End 5 days from now
  percentActiveEvents: 0, // 0% active (all events are future)
  customerPrefix: 'Customer',
  locationPrefix: 'Location',
  subLocationPrefix: 'SubLocation',
  venuePrefix: 'Venue',
  eventPrefix: 'Event',
  useUSPSLocations: true,
  createRatesheets: true,
  createEvents: true,
  createEventRatesheets: true,
  createPriorityConfigs: true,
  createCapacitySheets: true,
  createSurgeConfigs: true,
};
