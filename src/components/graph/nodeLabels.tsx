import React from 'react';
import { CapacityMetrics, AllocationBreakdown } from './graphTypes';

// Allocation category colors matching CapacityAllocationChart
const ALLOCATION_COLORS = {
  transient: '#14B8A6',    // teal-500
  events: '#EC4899',       // pink-500
  reserved: '#8B5CF6',     // violet-500
  unavailable: '#9CA3AF',  // gray-400
  readyToUse: '#F59E0B',   // amber-500
};

/**
 * Allocation breakdown table for node labels - shows all categories with counts
 */
function AllocationMiniBar({ allocation, isHighlighted }: { allocation: AllocationBreakdown; isHighlighted: boolean }) {
  const total = allocation.transient + allocation.events + allocation.reserved + allocation.unavailable + allocation.readyToUse;
  if (total === 0) return null;

  const percentages = {
    transient: Math.round((allocation.transient / total) * 100),
    events: Math.round((allocation.events / total) * 100),
    reserved: Math.round((allocation.reserved / total) * 100),
    unavailable: Math.round((allocation.unavailable / total) * 100),
    readyToUse: Math.round((allocation.readyToUse / total) * 100),
  };

  return (
    <div className="mt-2 pt-2 border-t border-current/20">
      {/* Visual bar */}
      <div className="h-2 rounded-full overflow-hidden flex bg-gray-200/50 mb-2">
        {percentages.transient > 0 && (
          <div
            style={{ width: `${percentages.transient}%`, backgroundColor: ALLOCATION_COLORS.transient }}
            title={`Transient: ${allocation.transient}`}
          />
        )}
        {percentages.events > 0 && (
          <div
            style={{ width: `${percentages.events}%`, backgroundColor: ALLOCATION_COLORS.events }}
            title={`Events: ${allocation.events}`}
          />
        )}
        {percentages.reserved > 0 && (
          <div
            style={{ width: `${percentages.reserved}%`, backgroundColor: ALLOCATION_COLORS.reserved }}
            title={`Reserved: ${allocation.reserved}`}
          />
        )}
        {percentages.unavailable > 0 && (
          <div
            style={{ width: `${percentages.unavailable}%`, backgroundColor: ALLOCATION_COLORS.unavailable }}
            title={`Unavailable: ${allocation.unavailable}`}
          />
        )}
        {percentages.readyToUse > 0 && (
          <div
            style={{ width: `${percentages.readyToUse}%`, backgroundColor: ALLOCATION_COLORS.readyToUse }}
            title={`Ready: ${allocation.readyToUse}`}
          />
        )}
      </div>
      {/* Category table */}
      <div className="space-y-0.5">
        <div className="flex justify-between items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: ALLOCATION_COLORS.transient }}></span>
            <span className={`text-[10px] ${isHighlighted ? 'text-white/80' : 'text-gray-600'}`}>Transient:</span>
          </span>
          <span className={`text-[10px] font-semibold ${isHighlighted ? 'text-white' : 'text-gray-800'}`}>{allocation.transient}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: ALLOCATION_COLORS.events }}></span>
            <span className={`text-[10px] ${isHighlighted ? 'text-white/80' : 'text-gray-600'}`}>Events:</span>
          </span>
          <span className={`text-[10px] font-semibold ${isHighlighted ? 'text-white' : 'text-gray-800'}`}>{allocation.events}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: ALLOCATION_COLORS.reserved }}></span>
            <span className={`text-[10px] ${isHighlighted ? 'text-white/80' : 'text-gray-600'}`}>Reserved:</span>
          </span>
          <span className={`text-[10px] font-semibold ${isHighlighted ? 'text-white' : 'text-gray-800'}`}>{allocation.reserved}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: ALLOCATION_COLORS.unavailable }}></span>
            <span className={`text-[10px] ${isHighlighted ? 'text-white/80' : 'text-gray-600'}`}>Unavailable:</span>
          </span>
          <span className={`text-[10px] font-semibold ${isHighlighted ? 'text-white' : 'text-gray-800'}`}>{allocation.unavailable}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: ALLOCATION_COLORS.readyToUse }}></span>
            <span className={`text-[10px] ${isHighlighted ? 'text-white/80' : 'text-gray-600'}`}>Ready:</span>
          </span>
          <span className={`text-[10px] font-semibold ${isHighlighted ? 'text-white' : 'text-gray-800'}`}>{allocation.readyToUse}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Node label rendering functions for the graph visualization
 * Each function renders the JSX for a specific node type
 */

interface CustomerNodeLabelProps {
  customer: any;
  isHighlighted: boolean;
  metrics?: CapacityMetrics;
  entityTypeLabel?: string;
}

export function CustomerNodeLabel({ customer, isHighlighted, metrics, entityTypeLabel }: CustomerNodeLabelProps) {
  return (
    <div className="text-center px-4 py-3">
      <div className={`font-bold text-lg mb-1 ${isHighlighted ? 'text-white' : 'text-blue-900'}`}>
        {customer.name}
      </div>
      {entityTypeLabel && (
        <div className={`text-[10px] font-medium mb-0.5 ${isHighlighted ? 'text-blue-200' : 'text-blue-400'}`}>
          {entityTypeLabel}
        </div>
      )}
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
          {metrics.allocation && (
            <AllocationMiniBar allocation={metrics.allocation} isHighlighted={isHighlighted} />
          )}
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
  entityTypeLabel?: string;
}

export function LocationNodeLabel({
  location,
  isHighlighted,
  metrics,
  totalAllocated = 0,
  remainingCapacity = null,
  entityTypeLabel
}: LocationNodeLabelProps) {
  return (
    <div className="text-center px-4 py-3">
      <div className={`font-bold text-base mb-1 ${isHighlighted ? 'text-white' : 'text-emerald-900'}`}>
        {location.name}
      </div>
      {entityTypeLabel && (
        <div className={`text-[10px] font-medium mb-0.5 ${isHighlighted ? 'text-emerald-200' : 'text-emerald-400'}`}>
          {entityTypeLabel}
        </div>
      )}
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
          {metrics.allocation && (
            <AllocationMiniBar allocation={metrics.allocation} isHighlighted={isHighlighted} />
          )}
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
  entityTypeLabel?: string;
}

export function SubLocationNodeLabel({
  sublocation,
  isHighlighted,
  metrics,
  venueCount = 0,
  totalVenueCapacity = 0,
  entityTypeLabel
}: SubLocationNodeLabelProps) {
  return (
    <div className="text-center px-4 py-3">
      <div className={`font-bold text-sm mb-1 ${isHighlighted ? 'text-white' : 'text-orange-900'}`}>
        {sublocation.label}
      </div>
      {entityTypeLabel && (
        <div className={`text-[10px] font-medium mb-0.5 ${isHighlighted ? 'text-orange-200' : 'text-orange-400'}`}>
          {entityTypeLabel}
        </div>
      )}
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
          {metrics.allocation && (
            <AllocationMiniBar allocation={metrics.allocation} isHighlighted={isHighlighted} />
          )}
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
