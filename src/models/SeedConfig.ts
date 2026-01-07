// src/models/SeedConfig.ts
export interface SeedConfig {
  _id?: any;
  customers: number;
  locationsPerCustomer: number;
  subLocationsPerLocation: number;
  venues: number;
  venuesPerLocation: number;
  venuesPerSubLocation: number;
  customerPrefix: string;
  locationPrefix: string;
  subLocationPrefix: string;
  venuePrefix: string;
  useUSPSLocations: boolean;
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
  customerPrefix: 'Customer',
  locationPrefix: 'Location',
  subLocationPrefix: 'SubLocation',
  venuePrefix: 'Venue',
  useUSPSLocations: true,
};
