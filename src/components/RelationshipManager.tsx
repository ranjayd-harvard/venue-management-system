'use client';

import { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Location {
  _id: string;
  name: string;
  city: string;
  totalCapacity?: number;
}

interface SubLocation {
  _id: string;
  locationId: string;
  label: string;
  allocatedCapacity?: number;
  pricingEnabled?: boolean;
  isActive?: boolean;
}

interface Venue {
  _id: string;
  name: string;
  venueType: string;
  capacity?: number;
}

interface DraggableVenueProps {
  venue: Venue;
  isAssigned: boolean;
}

function DraggableVenue({ venue, isAssigned }: DraggableVenueProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: venue._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-4 mb-2 rounded-lg cursor-move ${
        isAssigned
          ? 'bg-purple-100 border-2 border-purple-300'
          : 'bg-gray-100 border-2 border-gray-300'
      } hover:shadow-md transition-shadow`}
    >
      <div className="font-semibold text-gray-800">{venue.name}</div>
      <div className="text-sm text-gray-600">{venue.venueType}</div>
      {venue.capacity !== undefined && (
        <div className="text-sm text-purple-600 font-medium">Capacity: {venue.capacity}</div>
      )}
    </div>
  );
}

export default function RelationshipManager() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [assignedVenues, setAssignedVenues] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    Promise.all([
      fetch('/api/locations').then(res => res.json()),
      fetch('/api/venues').then(res => res.json()),
    ])
      .then(([locationsData, venuesData]) => {
        setLocations(locationsData);
        setVenues(venuesData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load data:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      fetch(`/api/sublocations?locationId=${selectedLocation}`)
        .then(res => res.json())
        .then(data => {
          console.log('Fetched sublocations:', data); // Debug log
          
          // FIX: Filter to show all active sublocations, regardless of pricingEnabled status
          const activeSublocations = data.filter((sl: SubLocation) => 
            sl.isActive !== false // Show all unless explicitly inactive
          );
          
          console.log('Filtered sublocations:', activeSublocations); // Debug log
          
          setSublocations(activeSublocations);
          setSelectedSubLocation('');
          setAssignedVenues(new Set());
        })
        .catch(err => console.error('Failed to load sublocations:', err));
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (selectedSubLocation) {
      fetch('/api/sublocation-venues')
        .then(res => res.json())
        .then(allRelationships => {
          const sublocationRelationships = allRelationships.filter(
            (rel: any) => rel.subLocationId === selectedSubLocation
          );
          const venueIds = new Set(sublocationRelationships.map((rel: any) => rel.venueId));
          setAssignedVenues(venueIds);
        })
        .catch(err => console.error('Failed to load sublocation venues:', err));
    }
  }, [selectedSubLocation]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active } = event;
    
    if (!selectedSubLocation) {
      alert('Please select a sub-location first');
      return;
    }

    const venueId = active.id as string;
    const isCurrentlyAssigned = assignedVenues.has(venueId);

    setSaving(true);

    try {
      if (isCurrentlyAssigned) {
        // Remove relationship
        await fetch('/api/sublocation-venues', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subLocationId: selectedSubLocation, venueId }),
        });
        
        setAssignedVenues(prev => {
          const newSet = new Set(prev);
          newSet.delete(venueId);
          return newSet;
        });
      } else {
        // Add relationship
        await fetch('/api/sublocation-venues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subLocationId: selectedSubLocation, venueId }),
        });
        
        setAssignedVenues(prev => new Set(prev).add(venueId));
      }
    } catch (error) {
      console.error('Failed to update relationship:', error);
      alert('Failed to update relationship');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  const assignedVenuesList = venues.filter(v => assignedVenues.has(v._id));
  const availableVenuesList = venues.filter(v => !assignedVenues.has(v._id));

  const selectedLocationObj = locations.find(l => l._id === selectedLocation);
  const selectedSubLocationObj = sublocations.find(sl => sl._id === selectedSubLocation);

  // Calculate capacity for assigned venues
  const assignedVenuesCapacity = assignedVenuesList.reduce((sum, v) => sum + (v.capacity || 0), 0);
  const sublocationCapacity = selectedSubLocationObj?.allocatedCapacity || 0;

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
          Select Location
        </label>
        <select
          id="location"
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
        >
          <option value="">Choose a location...</option>
          {locations.map((location) => (
            <option key={location._id} value={location._id}>
              {location.name} - {location.city}
              {location.totalCapacity && ` (Capacity: ${location.totalCapacity})`}
            </option>
          ))}
        </select>
      </div>

      {selectedLocation && sublocations.length > 0 && (
        <div>
          <label htmlFor="sublocation" className="block text-sm font-medium text-gray-700 mb-2">
            Select Sub-Location
          </label>
          <select
            id="sublocation"
            value={selectedSubLocation}
            onChange={(e) => setSelectedSubLocation(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
          >
            <option value="">Choose a sub-location...</option>
            {sublocations.map((sublocation) => (
              <option key={sublocation._id} value={sublocation._id}>
                {sublocation.label}
                {sublocation.allocatedCapacity && ` (Allocated: ${sublocation.allocatedCapacity})`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Capacity Summary */}
      {selectedSubLocation && sublocationCapacity > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Capacity Summary</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-700">Sub-Location Allocated:</span>
              <span className="font-semibold text-gray-900">{sublocationCapacity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Assigned Venues Total:</span>
              <span className={`font-semibold ${assignedVenuesCapacity > sublocationCapacity ? 'text-red-600' : 'text-gray-900'}`}>
                {assignedVenuesCapacity}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-blue-300">
              <span className="text-gray-700">Remaining Capacity:</span>
              <span className={`font-semibold ${sublocationCapacity - assignedVenuesCapacity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {sublocationCapacity - assignedVenuesCapacity}
              </span>
            </div>
          </div>
          {assignedVenuesCapacity > sublocationCapacity && (
            <div className="mt-2 text-sm text-red-600 font-medium">
              ⚠️ Warning: Assigned venues exceed sub-location capacity!
            </div>
          )}
        </div>
      )}

      {saving && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
          Saving changes...
        </div>
      )}

      {selectedSubLocation && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-800">
                Assigned Venues ({assignedVenuesList.length})
              </h3>
              <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 min-h-[400px]">
                <p className="text-sm text-gray-600 mb-4">
                  Click and drag to unassign
                </p>
                <SortableContext
                  items={assignedVenuesList.map(v => v._id)}
                  strategy={verticalListSortingStrategy}
                >
                  {assignedVenuesList.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      No venues assigned yet
                    </div>
                  ) : (
                    assignedVenuesList.map((venue) => (
                      <DraggableVenue
                        key={venue._id}
                        venue={venue}
                        isAssigned={true}
                      />
                    ))
                  )}
                </SortableContext>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-800">
                Available Venues ({availableVenuesList.length})
              </h3>
              <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 min-h-[400px]">
                <p className="text-sm text-gray-600 mb-4">
                  Click and drag to assign
                </p>
                <SortableContext
                  items={availableVenuesList.map(v => v._id)}
                  strategy={verticalListSortingStrategy}
                >
                  {availableVenuesList.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      All venues assigned
                    </div>
                  ) : (
                    availableVenuesList.map((venue) => (
                      <DraggableVenue
                        key={venue._id}
                        venue={venue}
                        isAssigned={false}
                      />
                    ))
                  )}
                </SortableContext>
              </div>
            </div>
          </div>
        </DndContext>
      )}

      {!selectedLocation && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          Please select a location to begin
        </div>
      )}

      {selectedLocation && sublocations.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          This location has no sub-locations. Please create sub-locations first.
        </div>
      )}

      {selectedLocation && !selectedSubLocation && sublocations.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          Please select a sub-location to manage venue assignments
        </div>
      )}
    </div>
  );
}
