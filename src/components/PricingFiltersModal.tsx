'use client';

import { useState, useEffect } from 'react';
import { X, Filter } from 'lucide-react';

interface Location {
  _id: string;
  name: string;
  customerId: string;
  defaultHourlyRate?: number;
}

interface SubLocation {
  _id: string;
  label: string;
  locationId: string;
  defaultHourlyRate?: number;
}

interface Event {
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

interface PricingFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;

  // Location/SubLocation/Event selection
  selectedLocation: string;
  selectedSubLocation: string;
  selectedEventId: string;
  onLocationChange: (locationId: string) => void;
  onSubLocationChange: (subLocationId: string) => void;
  onEventChange: (eventId: string) => void;

  // Duration selection
  selectedDuration: number;
  onDurationChange: (hours: number) => void;

  // Duration-based pricing context (optional)
  useDurationContext?: boolean;
  bookingStartTime?: Date;
  onUseDurationContextChange?: (enabled: boolean) => void;
  onBookingStartTimeChange?: (time: Date) => void;

  // Event booking toggle (optional)
  isEventBooking?: boolean;
  onIsEventBookingChange?: (isEventBooking: boolean) => void;

  // Pricing coefficients (optional - placeholders for future use)
  pricingCoefficientsUp?: number;
  pricingCoefficientsDown?: number;
  bias?: number;
  onPricingCoefficientsUpChange?: (value: number | undefined) => void;
  onPricingCoefficientsDownChange?: (value: number | undefined) => void;
  onBiasChange?: (value: number | undefined) => void;

  // Event counts (for auto-detect message)
  eventCount?: number;
}

export default function PricingFiltersModal({
  isOpen,
  onClose,
  selectedLocation,
  selectedSubLocation,
  selectedEventId,
  onLocationChange,
  onSubLocationChange,
  onEventChange,
  selectedDuration,
  onDurationChange,
  useDurationContext,
  bookingStartTime,
  onUseDurationContextChange,
  onBookingStartTimeChange,
  isEventBooking,
  onIsEventBookingChange,
  pricingCoefficientsUp,
  pricingCoefficientsDown,
  bias,
  onPricingCoefficientsUpChange,
  onPricingCoefficientsDownChange,
  onBiasChange,
  eventCount = 0,
}: PricingFiltersModalProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  // Fetch locations on mount
  useEffect(() => {
    if (isOpen) {
      fetchLocations();
    }
  }, [isOpen]);

  // Fetch sublocations when location changes
  useEffect(() => {
    if (selectedLocation) {
      fetchSubLocations(selectedLocation);
    } else {
      setSublocations([]);
    }
  }, [selectedLocation]);

  // Fetch events when sublocation changes
  useEffect(() => {
    if (selectedSubLocation) {
      fetchEvents();
    } else {
      setEvents([]);
    }
  }, [selectedSubLocation]);

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations');
      const data = await res.json();
      setLocations(data);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const fetchSubLocations = async (locationId: string) => {
    try {
      const res = await fetch(`/api/sublocations?locationId=${locationId}`);
      const data = await res.json();
      setSublocations(data);
    } catch (error) {
      console.error('Failed to fetch sublocations:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      // Get sublocation details to know its location and customer
      const sublocationRes = await fetch(`/api/sublocations/${selectedSubLocation}`);
      const sublocation = await sublocationRes.json();

      // Get location details
      const locationRes = await fetch(`/api/locations/${sublocation.locationId}`);
      const location = await locationRes.json();

      // Fetch all events
      const res = await fetch('/api/events');
      const allEvents = await res.json();

      // Filter events by hierarchy: must be active AND belong to this sublocation/location/customer
      const filteredEvents = allEvents.filter((e: Event) => {
        if (!e.isActive) return false;

        // Event must belong to this sublocation hierarchy
        // Convert IDs to strings for comparison (in case they're ObjectIds)
        const eventSubLocId = typeof e.subLocationId === 'object' ? (e.subLocationId as any)?.$oid || String(e.subLocationId) : e.subLocationId;
        const eventLocId = typeof e.locationId === 'object' ? (e.locationId as any)?.$oid || String(e.locationId) : e.locationId;
        const eventCustId = typeof e.customerId === 'object' ? (e.customerId as any)?.$oid || String(e.customerId) : e.customerId;

        const matchesSubLocation = eventSubLocId === selectedSubLocation;
        const matchesLocation = eventLocId === location._id && !eventSubLocId;
        const matchesCustomer = eventCustId === location.customerId && !eventLocId && !eventSubLocId;

        return matchesSubLocation || matchesLocation || matchesCustomer;
      });

      setEvents(filteredEvents);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <Filter className="w-6 h-6" />
                <h2 className="text-2xl font-bold">Pricing Filters</h2>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => onLocationChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                  >
                    <option value="">Select location...</option>
                    {locations.map((loc) => (
                      <option key={loc._id} value={loc._id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sub-Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sub-Location
                  </label>
                  <select
                    value={selectedSubLocation}
                    onChange={(e) => onSubLocationChange(e.target.value)}
                    disabled={!selectedLocation}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
                  >
                    <option value="">Select sub-location...</option>
                    {sublocations.map((subloc) => (
                      <option key={subloc._id} value={subloc._id}>
                        {subloc.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Event */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event (Optional - Auto-detected)
                  </label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => onEventChange(e.target.value)}
                    disabled={!selectedSubLocation || events.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
                  >
                    <option value="">Auto-detect overlapping events</option>
                    {events.map((event) => (
                      <option key={event._id} value={event._id}>
                        {event.name}
                        {event.description && ` - ${event.description}`}
                      </option>
                    ))}
                  </select>
                  {selectedEventId ? (
                    <p className="text-xs text-pink-600 mt-1 font-medium">
                      📅 Manual: Showing only this event
                    </p>
                  ) : eventCount > 0 ? (
                    <p className="text-xs text-green-600 mt-1 font-medium">
                      ✨ Auto: Detected {eventCount} event ratesheet{eventCount > 1 ? 's' : ''}
                    </p>
                  ) : null}
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onDurationChange(7)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                        selectedDuration === 7
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      7h
                    </button>
                    <button
                      onClick={() => onDurationChange(12)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                        selectedDuration === 12
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      12h
                    </button>
                    <button
                      onClick={() => onDurationChange(24)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                        selectedDuration === 24
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      24h
                    </button>
                    <button
                      onClick={() => onDurationChange(48)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                        selectedDuration === 48
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      48h
                    </button>
                  </div>
                </div>
              </div>

              {/* Duration-Based Pricing Context (Optional - only show if props provided) */}
              {onUseDurationContextChange && useDurationContext !== undefined && bookingStartTime && onBookingStartTimeChange && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">
                        Duration-Based Pricing Context
                      </label>
                      <button
                        type="button"
                        onClick={() => onUseDurationContextChange(!useDurationContext)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          useDurationContext ? 'bg-purple-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            useDurationContext ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {useDurationContext
                        ? '✓ Showing duration-based windows with booking context'
                        : '○ Duration-based windows hidden (no booking context)'}
                    </p>
                  </div>

                  {useDurationContext && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Booking Start Time
                        </label>
                        <input
                          type="datetime-local"
                          value={formatDateTimeLocal(bookingStartTime)}
                          onChange={(e) => {
                            const newStart = new Date(e.target.value);
                            onBookingStartTimeChange(newStart);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                        />
                        <p className="text-xs text-purple-600 mt-1">
                          📍 Reference point for duration-based windows (e.g., 0-120 minutes from this time)
                        </p>
                      </div>
                      <div className="flex items-center">
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 w-full">
                          <p className="text-sm text-purple-800">
                            <strong>How it works:</strong> Duration-based windows like "0-120 min → $8/hr"
                            will be calculated from the booking start time you set. Toggle this off to only see
                            clock-based windows (e.g., "09:00-17:00 → $100/hr").
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Event Booking Toggle (Optional - only show if props provided) */}
              {onIsEventBookingChange && isEventBooking !== undefined && selectedSubLocation && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="bg-gradient-to-r from-pink-50 to-purple-50 border-2 border-pink-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <label htmlFor="isEventBookingFilter" className="text-sm font-semibold text-gray-800 cursor-pointer">
                          Is this an event booking?
                        </label>
                        <p className="text-xs text-gray-600 mt-1">
                          {isEventBooking
                            ? '✅ Event pricing with grace periods will apply (free grace periods)'
                            : '❌ Regular walk-in pricing (no free grace periods)'}
                        </p>
                      </div>
                      <button
                        id="isEventBookingFilter"
                        type="button"
                        onClick={() => onIsEventBookingChange(!isEventBooking)}
                        className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 ${
                          isEventBooking ? 'bg-pink-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isEventBooking ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing Coefficients (Future Use) */}
              {(onPricingCoefficientsUpChange || onPricingCoefficientsDownChange || onBiasChange) && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-600 text-lg">⚠️</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-yellow-800">Experimental Features</p>
                        <p className="text-xs text-yellow-700 mt-1">
                          These coefficients are placeholders for future pricing adjustments. They are saved with scenarios but not yet used in calculations.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {onPricingCoefficientsUpChange && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pricing Coefficient (Up)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={pricingCoefficientsUp ?? ''}
                          onChange={(e) => onPricingCoefficientsUpChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder="e.g., 1.2"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Multiplier for upward adjustment</p>
                      </div>
                    )}

                    {onPricingCoefficientsDownChange && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pricing Coefficient (Down)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={pricingCoefficientsDown ?? ''}
                          onChange={(e) => onPricingCoefficientsDownChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder="e.g., 0.8"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Multiplier for downward adjustment</p>
                      </div>
                    )}

                    {onBiasChange && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bias
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={bias ?? ''}
                          onChange={(e) => onBiasChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder="e.g., 0.5"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Base adjustment bias</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t border-gray-200 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
