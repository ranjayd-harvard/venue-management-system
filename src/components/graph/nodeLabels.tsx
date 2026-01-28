import React from 'react';
import { CapacityMetrics } from './graphTypes';

/**
 * Node label rendering functions for the graph visualization
 * Each function renders the JSX for a specific node type
 */

interface CustomerNodeLabelProps {
  customer: any;
  isHighlighted: boolean;
  metrics?: CapacityMetrics;
}

export function CustomerNodeLabel({ customer, isHighlighted, metrics }: CustomerNodeLabelProps) {
  return (
    <div className="text-center px-4 py-3">
      <div className={`font-bold text-lg mb-1 ${isHighlighted ? 'text-white' : 'text-blue-900'}`}>
        {customer.name}
      </div>
      <div className={`text-xs ${isHighlighted ? 'text-blue-100' : 'text-blue-600'}`}>
        {customer.email}
      </div>
      {metrics && (
        <div className={`text-xs mt-2 space-y-1 ${isHighlighted ? 'text-white' : 'text-blue-700'}`}>
          <div className="flex justify-between gap-3">
            <span className="text-left">Min:</span>
            <span className="font-semibold">{metrics.minCapacity}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-left">Max:</span>
            <span className="font-semibold">{metrics.maxCapacity}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-left">Default:</span>
            <span className="font-semibold">{metrics.defaultCapacity}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-left">Allocated:</span>
            <span className="font-semibold">{metrics.allocatedCapacity}</span>
          </div>
        </div>
      )}
      {customer.attributes && customer.attributes.length > 0 && (
        <div className="mt-2 flex justify-center">
          <span className={`text-xs px-2 py-1 rounded-full ${
            isHighlighted ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
          }`}>
            {customer.attributes.length} attributes
          </span>
        </div>
      )}
    </div>
  );
}

interface LocationNodeLabelProps {
  location: any;
  isHighlighted: boolean;
  metrics?: CapacityMetrics;
  totalAllocated?: number;
  remainingCapacity?: number | null;
}

export function LocationNodeLabel({
  location,
  isHighlighted,
  metrics,
  totalAllocated = 0,
  remainingCapacity = null
}: LocationNodeLabelProps) {
  return (
    <div className="text-center px-4 py-3">
      <div className={`font-bold text-base mb-1 ${isHighlighted ? 'text-white' : 'text-emerald-900'}`}>
        {location.name}
      </div>
      <div className={`text-xs mb-2 ${isHighlighted ? 'text-emerald-100' : 'text-emerald-600'}`}>
        {location.city}, {location.state}
      </div>
      {metrics && (
        <div className={`text-xs space-y-1 ${isHighlighted ? 'text-white' : 'text-emerald-700'}`}>
          <div className="flex justify-between gap-2">
            <span>Min:</span>
            <span className="font-semibold">{metrics.minCapacity}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Max:</span>
            <span className="font-semibold">{metrics.maxCapacity}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Default:</span>
            <span className="font-semibold">{metrics.defaultCapacity}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Allocated:</span>
            <span className="font-semibold">{metrics.allocatedCapacity}</span>
          </div>
        </div>
      )}
      {!metrics && location.totalCapacity && (
        <div className={`text-xs space-y-1 ${isHighlighted ? 'text-white' : 'text-emerald-700'}`}>
          <div className="flex justify-between">
            <span>Total:</span>
            <span className="font-semibold">{location.totalCapacity}</span>
          </div>
          <div className="flex justify-between">
            <span>Allocated:</span>
            <span className="font-semibold">{totalAllocated}</span>
          </div>
          <div className="flex justify-between">
            <span>Available:</span>
            <span className={`font-semibold ${
              remainingCapacity && remainingCapacity < 0
                ? 'text-red-500'
                : isHighlighted ? 'text-emerald-100' : 'text-emerald-600'
            }`}>
              {remainingCapacity}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface SubLocationNodeLabelProps {
  sublocation: any;
  isHighlighted: boolean;
  metrics?: CapacityMetrics;
  venueCount?: number;
  totalVenueCapacity?: number;
}

export function SubLocationNodeLabel({
  sublocation,
  isHighlighted,
  metrics,
  venueCount = 0,
  totalVenueCapacity = 0
}: SubLocationNodeLabelProps) {
  return (
    <div className="text-center px-4 py-3">
      <div className={`font-bold text-sm mb-1 ${isHighlighted ? 'text-white' : 'text-orange-900'}`}>
        {sublocation.label}
      </div>
      {metrics && (
        <div className={`text-xs space-y-1 ${isHighlighted ? 'text-orange-100' : 'text-orange-700'}`}>
          <div className="flex justify-between gap-2">
            <span>Min:</span>
            <span className="font-semibold">{metrics.minCapacity}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Max:</span>
            <span className="font-semibold">{metrics.maxCapacity}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Default:</span>
            <span className="font-semibold">{metrics.defaultCapacity}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Allocated:</span>
            <span className="font-semibold">{metrics.allocatedCapacity}</span>
          </div>
        </div>
      )}
      {!metrics && (
        <div className={`text-xs space-y-1 ${isHighlighted ? 'text-orange-100' : 'text-orange-700'}`}>
          {sublocation.allocatedCapacity && (
            <div className="flex justify-between">
              <span>Allocated:</span>
              <span className="font-semibold">{sublocation.allocatedCapacity}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Venues:</span>
            <span className="font-semibold">{venueCount}</span>
          </div>
          {totalVenueCapacity > 0 && (
            <div className="flex justify-between">
              <span>Total Cap:</span>
              <span className="font-semibold">{totalVenueCapacity}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface VenueNodeLabelProps {
  venue: any;
  isHighlighted: boolean;
}

export function VenueNodeLabel({ venue, isHighlighted }: VenueNodeLabelProps) {
  return (
    <div className="text-center px-4 py-3">
      <div className={`font-bold text-sm mb-1 ${isHighlighted ? 'text-white' : 'text-purple-900'}`}>
        {venue.name}
      </div>
      <div className={`text-xs space-y-1 ${isHighlighted ? 'text-purple-100' : 'text-purple-700'}`}>
        <div>{venue.venueType}</div>
        {venue.capacity && (
          <div className="flex justify-between">
            <span>Capacity:</span>
            <span className="font-semibold">{venue.capacity}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface EventNodeLabelProps {
  event: any;
  isHighlighted: boolean;
  eventAssociatedTo: string;
  metrics?: CapacityMetrics;
}

export function EventNodeLabel({
  event,
  isHighlighted,
  eventAssociatedTo,
  metrics
}: EventNodeLabelProps) {
  return (
    <div className="text-center px-4 py-3">
      <div className={`font-bold text-sm mb-1 ${isHighlighted ? 'text-white' : 'text-rose-900'}`}>
        {event.name}
      </div>
      <div className={`text-xs ${isHighlighted ? 'text-rose-100' : 'text-rose-700'}`}>
        {eventAssociatedTo || 'N/A'}
      </div>
      {metrics && (
        <div className={`text-xs mt-2 space-y-1 ${isHighlighted ? 'text-rose-100' : 'text-rose-700'}`}>
          <div className="flex justify-between gap-2">
            <span>Min:</span>
            <span className="font-semibold">{metrics.minCapacity}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Max:</span>
            <span className="font-semibold">{metrics.maxCapacity}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Default:</span>
            <span className="font-semibold">{metrics.defaultCapacity}</span>
          </div>
        </div>
      )}
    </div>
  );
}
