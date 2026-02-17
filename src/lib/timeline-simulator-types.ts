export interface TimeWindow {
  windowType?: 'ABSOLUTE_TIME' | 'DURATION_BASED';
  startTime?: string;
  endTime?: string;
  startMinute?: number;
  endMinute?: number;
  pricePerHour: number;
  daysOfWeek?: number[];
}

export interface Ratesheet {
  _id: string;
  name: string;
  type: string;
  priority: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  timeWindows?: TimeWindow[];
  applyTo: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
  customerId?: string;
  locationId?: string;
  subLocationId?: string;
  eventId?: string;
  customer?: { _id: string; name: string };
  location?: { _id: string; name: string };
  sublocation?: { _id: string; label: string };
  event?: { _id: string; name: string };
}

export interface Location {
  _id: string;
  name: string;
  customerId: string;
  defaultHourlyRate?: number;
}

export interface SubLocation {
  _id: string;
  label: string;
  locationId: string;
  defaultHourlyRate?: number;
}

export interface Customer {
  _id: string;
  name: string;
  defaultHourlyRate?: number;
}

export interface Event {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  subLocationId?: string;
  locationId?: string;
  customerId?: string;
}

export interface PricingConfig {
  customerPriorityRange: { min: number; max: number };
  locationPriorityRange: { min: number; max: number };
  sublocationPriorityRange: { min: number; max: number };
  eventPriorityRange?: { min: number; max: number };
}

export interface PricingLayer {
  id: string;
  name: string;
  type: 'RATESHEET' | 'SUBLOCATION_DEFAULT' | 'LOCATION_DEFAULT' | 'CUSTOMER_DEFAULT' | 'SURGE';
  priority: number;
  rate?: number;
  color: string;
  applyTo?: string;
}

export interface TimeSlot {
  hour: number;
  label: string;
  date: Date;
  layers: Array<{
    layer: PricingLayer;
    price: number | null;
    isActive: boolean;
  }>;
  winningLayer?: PricingLayer;
  winningPrice?: number;
  basePrice?: number;
  surgePrice?: number;
  surgeMultiplier?: number;
  decisionLog?: any;
  pricingData?: any;
  capacity?: {
    allocated: number;
    max: number;
    available: number;
  };
  eventNames?: string[];
  events?: Array<{ name: string; priority: number }>;
  isAvailable?: boolean;
  unavailableReason?: 'CLOSED' | 'BLACKOUT';
}

// Shared utility for formatting prices with superscript decimals
export const formatPriceWithSuperscript = (price: number) => {
  const formatted = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parts = formatted.split('.');
  return {
    dollars: parts[0],
    cents: parts[1] || '00'
  };
};
