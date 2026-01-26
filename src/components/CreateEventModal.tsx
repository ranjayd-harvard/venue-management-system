'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import TimezoneSelector from './TimezoneSelector';

interface Customer {
  _id: string;
  name: string;
}

interface Location {
  _id: string;
  name: string;
  city: string;
  customerId?: string;
}

interface SubLocation {
  _id: string;
  label: string;
  locationId?: string;
}

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateEventModal({ isOpen, onClose, onSuccess }: CreateEventModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [filteredSublocations, setFilteredSublocations] = useState<SubLocation[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedSubLocation, setSelectedSubLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [attendees, setAttendees] = useState('');
  const [defaultHourlyRate, setDefaultHourlyRate] = useState('');
  const [gracePeriodBefore, setGracePeriodBefore] = useState('');
  const [gracePeriodAfter, setGracePeriodAfter] = useState('');
  const [timezone, setTimezone] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedCustomer) {
      const filtered = locations.filter(l => l.customerId === selectedCustomer);
      setFilteredLocations(filtered);
      // Reset location and sublocation if current selection is invalid
      if (selectedLocation && !filtered.find(l => l._id === selectedLocation)) {
        setSelectedLocation('');
        setSelectedSubLocation('');
      }
    } else {
      setFilteredLocations([]);
      setSelectedLocation('');
      setSelectedSubLocation('');
    }
  }, [selectedCustomer, locations]);

  useEffect(() => {
    if (selectedLocation) {
      const filtered = sublocations.filter(s => s.locationId === selectedLocation);
      setFilteredSublocations(filtered);
      // Reset sublocation if current selection is invalid
      if (selectedSubLocation && !filtered.find(s => s._id === selectedSubLocation)) {
        setSelectedSubLocation('');
      }
    } else {
      setFilteredSublocations([]);
      setSelectedSubLocation('');
    }
  }, [selectedLocation, sublocations]);

  const loadData = async () => {
    try {
      const [customersRes, locationsRes, sublocationsRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/locations'),
        fetch('/api/sublocations'),
      ]);

      if (customersRes.ok) {
        const data = await customersRes.json();
        setCustomers(data);
      }

      if (locationsRes.ok) {
        const data = await locationsRes.json();
        setLocations(data);
      }

      if (sublocationsRes.ok) {
        const data = await sublocationsRes.json();
        setSublocations(data);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const validateForm = () => {
    if (!name.trim()) {
      setError('Event name is required');
      return false;
    }

    if (!startDate) {
      setError('Start date is required');
      return false;
    }

    if (!endDate) {
      setError('End date is required');
      return false;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      setError('End date must be after start date');
      return false;
    }

    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload: any = {
        name,
        description: description || undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        attendees: attendees ? parseInt(attendees) : undefined,
        defaultHourlyRate: defaultHourlyRate ? parseFloat(defaultHourlyRate) : undefined,
        gracePeriodBefore: gracePeriodBefore ? parseInt(gracePeriodBefore) : undefined,
        gracePeriodAfter: gracePeriodAfter ? parseInt(gracePeriodAfter) : undefined,
        timezone: timezone || undefined,
        isActive,
      };

      // Add entity associations
      if (selectedSubLocation) {
        payload.subLocationId = selectedSubLocation;
        payload.locationId = selectedLocation;
        payload.customerId = selectedCustomer;
      } else if (selectedLocation) {
        payload.locationId = selectedLocation;
        payload.customerId = selectedCustomer;
      } else if (selectedCustomer) {
        payload.customerId = selectedCustomer;
      }

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create event');
      }

      onSuccess();
      resetForm();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedCustomer('');
    setSelectedLocation('');
    setSelectedSubLocation('');
    setStartDate('');
    setEndDate('');
    setAttendees('');
    setDefaultHourlyRate('');
    setGracePeriodBefore('');
    setGracePeriodAfter('');
    setTimezone('');
    setIsActive(true);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Create New Event</h2>
            <p className="text-pink-100 text-sm mt-1">Add a new event to your venue management system</p>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Status Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="font-semibold text-gray-900">Active Status</label>
              <p className="text-sm text-gray-600">Enable or disable this event</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                isActive ? 'bg-green-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Event Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Event Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900"
              placeholder="e.g., Annual Conference 2026"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900"
              placeholder="Event details..."
            />
          </div>

          {/* Entity Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Location Association (Optional)</h3>

            {/* Customer Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Customer
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 text-gray-900 bg-white cursor-pointer"
              >
                <option value="">Select customer (optional)...</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Selection */}
            {selectedCustomer && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Location
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 text-gray-900 bg-white cursor-pointer"
                >
                  <option value="">Select location (optional)...</option>
                  {filteredLocations.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.name} ({l.city})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* SubLocation Selection */}
            {selectedLocation && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sub-Location
                </label>
                <select
                  value={selectedSubLocation}
                  onChange={(e) => setSelectedSubLocation(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 text-gray-900 bg-white cursor-pointer"
                >
                  <option value="">Select sub-location (optional)...</option>
                  {filteredSublocations.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                End Date & Time *
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900"
                required
              />
            </div>
          </div>

          {/* Validation hint */}
          {startDate && endDate && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                ✓ Duration: {new Date(startDate).toLocaleString()} to {new Date(endDate).toLocaleString()}
                {new Date(endDate) <= new Date(startDate) && (
                  <span className="block text-red-600 font-semibold mt-1">
                    ⚠️ End time must be after start time!
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Grace Periods */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Grace Periods (Optional)</h3>
            <p className="text-xs text-gray-600">Extend the event time window for pricing and capacity calculations</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Grace Period Before (minutes)
                </label>
                <input
                  type="number"
                  value={gracePeriodBefore}
                  onChange={(e) => setGracePeriodBefore(e.target.value)}
                  min="0"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">Time added before event start</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Grace Period After (minutes)
                </label>
                <input
                  type="number"
                  value={gracePeriodAfter}
                  onChange={(e) => setGracePeriodAfter(e.target.value)}
                  min="0"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">Time added after event end</p>
              </div>
            </div>
          </div>

          {/* Additional Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Expected Attendees
              </label>
              <input
                type="number"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                min="0"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900"
                placeholder="100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Default Hourly Rate ($)
              </label>
              <input
                type="number"
                value={defaultHourlyRate}
                onChange={(e) => setDefaultHourlyRate(e.target.value)}
                min="0"
                step="0.01"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-900"
                placeholder="150.00"
              />
            </div>
          </div>

          {/* Timezone */}
          <TimezoneSelector
            value={timezone}
            onChange={setTimezone}
            label="Event Timezone"
            showInheritedFrom={false}
          />
        </form>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-6 flex justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            disabled={loading}
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg hover:from-pink-700 hover:to-purple-700 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
