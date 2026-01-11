'use client';

import { useState, useEffect } from 'react';
import DecisionAuditPanel from '@/components/DecisionAuditPanel';

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

interface PricingBreakdown {
  startDateTime: string;
  endDateTime: string;
  pricePerHour: number;
  hours: number;
  subtotal: number;
  ratesheetId: string;
  ratesheetName: string;
  appliedRule: string;
}

interface PricingResult {
  totalPrice: number;
  breakdown: PricingBreakdown[];
  currency: string;
  decisionLog?: any[];           // ← Add this
  ratesheetsSummary?: any;       // ← Add this  
}

// Helper to get default dates
const getDefaultDates = () => {
  const now = new Date();
  
  // Start: Tomorrow at 9:00 AM
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(9, 0, 0, 0);
  
  // End: Tomorrow at 5:00 PM (8 hours later)
  const endDate = new Date(startDate);
  endDate.setHours(17, 0, 0, 0);
  
  // Format for datetime-local input: YYYY-MM-DDTHH:mm
  const formatDateTime = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  return {
    start: formatDateTime(startDate),
    end: formatDateTime(endDate)
  };
};

export default function PricingViewPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [subLocationId, setSubLocationId] = useState('');
  
  // Initialize with default dates
  const defaultDates = getDefaultDates();
  const [startDateTime, setStartDateTime] = useState(defaultDates.start);
  const [endDateTime, setEndDateTime] = useState(defaultDates.end);
  
  const [result, setResult] = useState<PricingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch locations on mount
  useEffect(() => {
    fetch('/api/locations')
      .then(res => res.json())
      .then(data => {
        setLocations(data);
        setDataLoading(false);
      })
      .catch(err => {
        console.error('Failed to load locations:', err);
        setDataLoading(false);
      });
  }, []);

  // Fetch sublocations when location changes
  useEffect(() => {
    if (selectedLocation) {
      setDataLoading(true);
      fetch(`/api/sublocations?locationId=${selectedLocation}`)
        .then(res => res.json())
        .then(data => {
          // Filter to show only pricing-enabled sublocations
          const pricingEnabledSublocations = data.filter(
            (sl: SubLocation) => sl.pricingEnabled && sl.isActive
          );
          setSublocations(pricingEnabledSublocations);
          setSubLocationId('');
          setDataLoading(false);
        })
        .catch(err => {
          console.error('Failed to load sublocations:', err);
          setDataLoading(false);
        });
    } else {
      setSublocations([]);
      setSubLocationId('');
    }
  }, [selectedLocation]);

  const handleCalculate = async () => {
    if (!subLocationId || !startDateTime || !endDateTime) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {

      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const response = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subLocationId,
          startDateTime: new Date(startDateTime).toISOString(),
          endDateTime: new Date(endDateTime).toISOString(),
          timezone: userTimezone
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate pricing');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate pricing');
    } finally {
      setLoading(false);
    }
  };

  // Calculate duration in hours
  const calculateDuration = () => {
    if (!startDateTime || !endDateTime) return 0;
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Math.max(0, hours);
  };

  const duration = calculateDuration();
  const selectedSubLocation = sublocations.find(sl => sl._id === subLocationId);
  const selectedLocationObj = locations.find(l => l._id === selectedLocation);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold mb-2">Pricing Calculator</h1>
          <p className="text-blue-100">Calculate pricing for your venue booking</p>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="space-y-6">
            {/* Location Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                disabled={dataLoading}
              >
                <option value="">Choose a location...</option>
                {locations.map((location) => (
                  <option key={location._id} value={location._id}>
                    {location.name} - {location.city}
                  </option>
                ))}
              </select>
            </div>

            {/* SubLocation Selection */}
            {selectedLocation && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Sub-Location
                  {selectedLocationObj && (
                    <span className="text-xs font-normal text-gray-500 ml-2">
                      (Pricing-enabled spaces only)
                    </span>
                  )}
                </label>
                {dataLoading ? (
                  <div className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-500">
                    Loading sub-locations...
                  </div>
                ) : sublocations.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
                    No pricing-enabled sub-locations available for this location.
                  </div>
                ) : (
                  <select
                    value={subLocationId}
                    onChange={(e) => setSubLocationId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                  >
                    <option value="">Choose a sub-location...</option>
                    {sublocations.map((sublocation) => (
                      <option key={sublocation._id} value={sublocation._id}>
                        {sublocation.label}
                        {sublocation.description && ` - ${sublocation.description}`}
                        {sublocation.defaultHourlyRate && 
                          ` (Base rate: $${sublocation.defaultHourlyRate}/hr)`
                        }
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Date/Time Inputs */}
            {subLocationId && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-red-700">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Start Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={startDateTime}
                      onChange={(e) => setStartDateTime(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Default: Tomorrow at 9:00 AM
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      End Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={endDateTime}
                      onChange={(e) => setEndDateTime(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Default: Tomorrow at 5:00 PM
                    </p>
                  </div>
                </div>

                {/* Duration Display */}
                {duration > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Booking Duration:</span>
                      <span className="text-lg font-bold text-blue-700">
                        {duration.toFixed(1)} hours
                        {duration >= 24 && ` (${Math.floor(duration / 24)} days)`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Selected SubLocation Info */}
                {selectedSubLocation && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-2">Selected Space</h3>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-700">Location:</span>
                        <span className="font-medium text-gray-900">
                          {selectedLocationObj?.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700">Sub-Location:</span>
                        <span className="font-medium text-gray-900">
                          {selectedSubLocation.label}
                        </span>
                      </div>
                      {selectedSubLocation.allocatedCapacity && (
                        <div className="flex justify-between">
                          <span className="text-gray-700">Capacity:</span>
                          <span className="font-medium text-gray-900">
                            {selectedSubLocation.allocatedCapacity} people
                          </span>
                        </div>
                      )}
                      {selectedSubLocation.defaultHourlyRate && (
                        <div className="flex justify-between">
                          <span className="text-gray-700">Base Hourly Rate:</span>
                          <span className="font-medium text-gray-900">
                            ${selectedSubLocation.defaultHourlyRate}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Calculate Button */}
                <button
                  onClick={handleCalculate}
                  disabled={loading || !subLocationId || !startDateTime || !endDateTime}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Calculating...
                    </span>
                  ) : (
                    'Calculate Pricing'
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-800 px-6 py-4 rounded-lg mb-8">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="space-y-6">
            {/* Total Price Card */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg shadow-lg p-8">
              <p className="text-green-100 text-sm uppercase tracking-wide mb-2">Total Price</p>
              <p className="text-5xl font-bold mb-2">
                ${result.totalPrice.toFixed(2)}
              </p>
              <p className="text-green-100">{result.currency}</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-gray-600 text-sm mb-1">Rate Changes</p>
                <p className="text-2xl font-bold text-gray-900">{result.breakdown.length}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-gray-600 text-sm mb-1">Avg per Hour</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${(result.totalPrice / result.breakdown.reduce((sum, b) => sum + b.hours, 0)).toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-gray-600 text-sm mb-1">Ratesheets Used</p>
                <p className="text-2xl font-bold text-gray-900">
                  {new Set(result.breakdown.map(b => b.ratesheetId)).size}
                </p>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4">
                <h2 className="text-xl font-bold">Pricing Breakdown</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Time Period
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Hours
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Subtotal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Ratesheet
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {result.breakdown.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div>
                            {new Date(item.startDateTime).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-gray-500 text-xs">
                            to {new Date(item.endDateTime).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.hours.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          ${item.pricePerHour}/hr
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-green-600">
                          ${item.subtotal.toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {item.ratesheetName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.appliedRule}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                        Total:
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-green-600">
                        ${result.totalPrice.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

           {/* NEW: Decision Audit Panel */}
          {result.decisionLog && result.ratesheetsSummary && (
            <DecisionAuditPanel
              decisionLog={result.decisionLog}
              ratesheetsSummary={result.ratesheetsSummary}
            />
          )}           


          </div>
        )}

        {/* Help Section */}
        {!result && !error && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-800 mb-3">💡 Quick Tips</h3>
            <ul className="space-y-2 text-gray-700 text-sm">
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span><strong>Default times:</strong> Tomorrow 9 AM - 5 PM (8 hours)</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span><strong>Select time:</strong> Click the clock icon in date inputs</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span><strong>Only pricing-enabled spaces:</strong> Shown in dropdown</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">•</span>
                <span><strong>Pricing rules:</strong> Ratesheets apply automatically based on time/date</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
