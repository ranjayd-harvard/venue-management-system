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
  totalCapacity?: number; // Total capacity of the location
  attributes?: Attribute[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SubLocation {
  _id?: ObjectId;
  locationId: ObjectId;
  label: string;
  description?: string;
  allocatedCapacity?: number; // Capacity allocated to this sub-location
  attributes?: Attribute[];
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

// NEW: Junction table for many-to-many relationship between SubLocation and Venue
export interface SubLocationVenue {
  _id?: ObjectId;
  subLocationId: ObjectId;
  venueId: ObjectId;
  createdAt: Date;
}

// DEPRECATED: Keep for backward compatibility during migration
export interface LocationVenue {
  _id?: ObjectId;
  locationId: ObjectId;
  venueId: ObjectId;
  createdAt: Date;
}
