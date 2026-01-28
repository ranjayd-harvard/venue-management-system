export interface Attribute {
  key: string;
  value: string;
  source?: string;
}

export interface FilterState {
  customer: string;
  location: string;
  sublocation: string;
  venue: string;
  event: string;
}

export interface AllData {
  customers: any[];
  locations: any[];
  sublocations: any[];
  venues: any[];
  slvRelations: any[];
  events: any[];
}

export interface CapacityMetrics {
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity: number;
}

export interface GraphCapacityMetrics {
  date: string;
  customers: Record<string, CapacityMetrics>;
  locations: Record<string, CapacityMetrics>;
  sublocations: Record<string, CapacityMetrics>;
  events: Record<string, CapacityMetrics>;
}

export interface TooltipData {
  name: string;
  type: string;
  entity: any;
  x: number;
  y: number;
}

export interface AttributeBreakdown {
  inherited: Attribute[];
  own: Attribute[];
  overridden: Attribute[];
}

export type EventAssociatedTo = 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'VENUE';
