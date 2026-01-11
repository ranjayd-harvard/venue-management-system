'use client';

import { useState, useEffect } from 'react';

interface SubLocation {
  _id: string;
  locationId: string;
  label: string;
  description?: string;
  allocatedCapacity?: number;
  pricingEnabled: boolean;
  isActive: boolean;
  defaultHourlyRate?: number;
}

interface Location {
  _id: string;
  name: string;
  city: string;
}

export default function SubLocationPricingSettings() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/locations')
      .then(res => res.json())
      .then(data => {
        setLocations(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load locations:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      setLoading(true);
      fetch(`/api/sublocations?locationId=${selectedLocation}`)
        .then(res => res.json())
        .then(data => {
          setSublocations(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to load sublocations:', err);
          setLoading(false);
        });
    } else {
      setSublocations([]);
    }
  }, [selectedLocation]);

  const handleTogglePricing = async (sublocationId: string, currentValue: boolean) => {
    setSaving(sublocationId);
    setMessage(null);

    try {
      const response = await fetch('/api/sublocations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sublocationId,
          pricingEnabled: !currentValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update sublocation');
      }

      // Update local state
      setSublocations(prev =>
        prev.map(sl =>
          sl._id === sublocationId
            ? { ...sl, pricingEnabled: !currentValue }
            : sl
        )
      );

      setMessage({
        type: 'success',
        text: `Pricing ${!currentValue ? 'enabled' : 'disabled'} successfully!`,
      });
    } catch (error) {
      console.error('Error updating sublocation:', error);
      setMessage({
        type: 'error',
        text: 'Failed to update pricing setting. Please try again.',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateRate = async (sublocationId: string, newRate: number) => {
    if (newRate < 0) return;

    setSaving(sublocationId);
    setMessage(null);

    try {
      const response = await fetch('/api/sublocations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sublocationId,
          defaultHourlyRate: newRate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update rate');
      }

      // Update local state
      setSublocations(prev =>
        prev.map(sl =>
          sl._id === sublocationId
            ? { ...sl, defaultHourlyRate: newRate }
            : sl
        )
      );

      setMessage({
        type: 'success',
        text: 'Default rate updated successfully!',
      });
    } catch (error) {
      console.error('Error updating rate:', error);
      setMessage({
        type: 'error',
        text: 'Failed to update rate. Please try again.',
      });
    } finally {
      setSaving(null);
    }
  };

  const selectedLocationObj = locations.find(l => l._id === selectedLocation);
  const enabledCount = sublocations.filter(sl => sl.pricingEnabled).length;
  const totalCount = sublocations.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold mb-2">SubLocation Pricing Settings</h1>
          <p className="text-indigo-100">Enable pricing and set default rates for your spaces</p>
        </div>

        {/* Location Selection */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Select Location
          </label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
            disabled={loading}
          >
            <option value="">Choose a location...</option>
            {locations.map((location) => (
              <option key={location._id} value={location._id}>
                {location.name} - {location.city}
              </option>
            ))}
          </select>
        </div>

        {/* Message Display */}
        {message && (
          <div
            className={`rounded-lg p-4 mb-6 ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Stats Card */}
        {selectedLocation && !loading && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {selectedLocationObj?.name}
                </h3>
                <p className="text-gray-600 text-sm">
                  {enabledCount} of {totalCount} sub-locations have pricing enabled
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-indigo-600">
                  {Math.round((enabledCount / totalCount) * 100)}%
                </div>
                <div className="text-xs text-gray-500 uppercase">Enabled</div>
              </div>
            </div>
            <div className="mt-4 bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all"
                style={{ width: `${(enabledCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* SubLocations List */}
        {selectedLocation && !loading && sublocations.length > 0 && (
          <div className="space-y-4">
            {sublocations.map((sublocation) => (
              <div
                key={sublocation._id}
                className={`bg-white rounded-lg shadow-lg overflow-hidden transition-all ${
                  sublocation.pricingEnabled
                    ? 'border-2 border-green-400'
                    : 'border-2 border-gray-200'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {sublocation.label}
                        </h3>
                        {sublocation.pricingEnabled && (
                          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                            PRICING ENABLED
                          </span>
                        )}
                      </div>
                      {sublocation.description && (
                        <p className="text-gray-600 text-sm mb-2">{sublocation.description}</p>
                      )}
                      <div className="flex gap-4 text-sm text-gray-500">
                        {sublocation.allocatedCapacity && (
                          <span>Capacity: {sublocation.allocatedCapacity}</span>
                        )}
                        <span>Status: {sublocation.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Enable/Disable Pricing */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Pricing Status
                      </label>
                      <button
                        onClick={() => handleTogglePricing(sublocation._id, sublocation.pricingEnabled)}
                        disabled={saving === sublocation._id}
                        className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                          sublocation.pricingEnabled
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {saving === sublocation._id ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Updating...
                          </span>
                        ) : sublocation.pricingEnabled ? (
                          'Disable Pricing'
                        ) : (
                          'Enable Pricing'
                        )}
                      </button>
                    </div>

                    {/* Default Hourly Rate */}
                    <div className="bg-gray-50 rounded-lg p-4 text-gray-700">
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Default Hourly Rate
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                            $
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={sublocation.defaultHourlyRate || 0}
                            onChange={(e) => {
                              const newValue = parseInt(e.target.value) || 0;
                              setSublocations(prev =>
                                prev.map(sl =>
                                  sl._id === sublocation._id
                                    ? { ...sl, defaultHourlyRate: newValue }
                                    : sl
                                )
                              );
                            }}
                            className="w-full pl-8 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={saving === sublocation._id}
                          />
                        </div>
                        <button
                          onClick={() => handleUpdateRate(sublocation._id, sublocation.defaultHourlyRate || 0)}
                          disabled={saving === sublocation._id}
                          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Save
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        This is the base rate used when no ratesheets match
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading State */}
        {loading && selectedLocation && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <svg className="animate-spin h-12 w-12 mx-auto mb-4 text-indigo-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-gray-600">Loading sub-locations...</p>
          </div>
        )}

        {/* Empty State */}
        {!selectedLocation && !loading && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📍</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Select a Location</h3>
            <p className="text-gray-600">Choose a location to manage its sub-location pricing settings</p>
          </div>
        )}

        {/* No SubLocations */}
        {selectedLocation && !loading && sublocations.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Sub-Locations Found</h3>
            <p className="text-gray-600">This location doesn't have any sub-locations yet</p>
          </div>
        )}

        {/* Help Section */}
        <div className="bg-white rounded-lg shadow p-6 mt-8">
          <h3 className="font-semibold text-gray-800 mb-3">💡 How Pricing Works</h3>
          <ul className="space-y-2 text-gray-700 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold">1.</span>
              <span><strong>Enable Pricing:</strong> Turn on pricing for a sub-location to make it available in the pricing calculator</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold">2.</span>
              <span><strong>Set Default Rate:</strong> This base hourly rate is used when no ratesheets match the booking time</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold">3.</span>
              <span><strong>Create Ratesheets:</strong> Go to Admin Pricing to create time-based and special pricing rules</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 font-bold">4.</span>
              <span><strong>Calculate Pricing:</strong> Use the Pricing Calculator to see real-time pricing for bookings</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
