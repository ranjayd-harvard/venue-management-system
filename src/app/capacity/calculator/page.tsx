'use client';

import { useState, useEffect } from 'react';
import { Calculator, Users, TrendingUp } from 'lucide-react';

interface SubLocation {
  _id: string;
  locationId: string;
  label: string;
  description?: string;
  isActive: boolean;
}

interface Location {
  _id: string;
  name: string;
  city: string;
}

interface CapacitySegment {
  startTime: string;
  endTime: string;
  durationHours: number;
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity: number;
  availableCapacity: number;
  source: string;
  capacitySheet?: {
    id: string;
    name: string;
  };
}

interface CapacityResult {
  segments: CapacitySegment[];
  summary: {
    totalHours: number;
    avgMinCapacity: number;
    avgMaxCapacity: number;
    avgDefaultCapacity: number;
    avgAllocatedCapacity: number;
    avgAvailableCapacity: number;
  };
  metadata?: any;
}

const getDefaultDates = () => {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(9, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setHours(17, 0, 0, 0);

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

export default function CapacityCalculatorPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [subLocationId, setSubLocationId] = useState('');

  const defaultDates = getDefaultDates();
  const [startDateTime, setStartDateTime] = useState(defaultDates.start);
  const [endDateTime, setEndDateTime] = useState(defaultDates.end);

  const [result, setResult] = useState<CapacityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/locations')
      .then(res => res.json())
      .then(data => setLocations(data))
      .catch(err => console.error('Failed to load locations:', err));
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      fetch(`/api/sublocations?locationId=${selectedLocation}`)
        .then(res => res.json())
        .then(data => {
          const activeSublocations = data.filter((sl: SubLocation) => sl.isActive);
          setSublocations(activeSublocations);
          setSubLocationId('');
        })
        .catch(err => console.error('Failed to load sublocations:', err));
    } else {
      setSublocations([]);
      setSubLocationId('');
    }
  }, [selectedLocation]);

  const calculateCapacity = async () => {
    if (!subLocationId || !startDateTime || !endDateTime) {
      setError('Please select a sublocation and booking period');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/capacity/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subLocationId,
          startTime: new Date(startDateTime).toISOString(),
          endTime: new Date(endDateTime).toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate capacity');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-green-50 to-emerald-50">
      <div className="bg-gradient-to-r from-teal-600 to-green-600 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex items-center gap-3">
            <Calculator className="w-10 h-10" />
            <div>
              <h1 className="text-4xl font-bold mb-2">Capacity Calculator</h1>
              <p className="text-teal-100 text-lg">Calculate available capacity for bookings</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Booking Details</h2>

              <div className="space-y-4 text-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location *
                  </label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">Select Location...</option>
                    {locations.map((loc) => (
                      <option key={loc._id} value={loc._id}>
                        {loc.name} - {loc.city}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sub-Location *
                  </label>
                  <select
                    value={subLocationId}
                    onChange={(e) => setSubLocationId(e.target.value)}
                    disabled={!selectedLocation}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="">Select Sub-Location...</option>
                    {sublocations.map((sub) => (
                      <option key={sub._id} value={sub._id}>
                        {sub.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={startDateTime}
                    onChange={(e) => setStartDateTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={endDateTime}
                    onChange={(e) => setEndDateTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <button
                  onClick={calculateCapacity}
                  disabled={loading || !subLocationId}
                  className="w-full bg-gradient-to-r from-teal-600 to-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-teal-700 hover:to-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator size={20} />
                      Calculate Capacity
                    </>
                  )}
                </button>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            {result ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-teal-500">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Avg Max</span>
                      <Users className="text-teal-600" size={20} />
                    </div>
                    <p className="text-3xl font-bold text-teal-900">{result.summary.avgMaxCapacity}</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Avg Available</span>
                      <TrendingUp className="text-green-600" size={20} />
                    </div>
                    <p className="text-3xl font-bold text-green-900">{result.summary.avgAvailableCapacity}</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Total Hours</span>
                      <Calculator className="text-blue-600" size={20} />
                    </div>
                    <p className="text-3xl font-bold text-blue-900">{result.summary.totalHours}h</p>
                  </div>
                </div>

                {/* Hourly Breakdown */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-teal-600 to-green-600 text-white px-6 py-4">
                    <h3 className="text-xl font-bold">Hourly Capacity Breakdown</h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Min</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Default</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Allocated</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Available</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {result.segments.map((segment, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {new Date(segment.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                              {new Date(segment.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-6 py-4 text-sm text-right text-gray-900">{segment.minCapacity}</td>
                            <td className="px-6 py-4 text-sm text-right font-semibold text-teal-900">{segment.maxCapacity}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-900">{segment.defaultCapacity}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-600">{segment.allocatedCapacity}</td>
                            <td className="px-6 py-4 text-sm text-right font-bold text-green-700">{segment.availableCapacity}</td>
                            <td className="px-6 py-4 text-sm">
                              {segment.source === 'CAPACITYSHEET' ? (
                                <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-medium">
                                  {segment.capacitySheet?.name || 'Sheet'}
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                                  Default
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">TOTAL / AVERAGE</td>
                          <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">{result.summary.avgMinCapacity}</td>
                          <td className="px-6 py-4 text-sm text-right font-bold text-teal-900">{result.summary.avgMaxCapacity}</td>
                          <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">{result.summary.avgDefaultCapacity}</td>
                          <td className="px-6 py-4 text-sm text-right font-bold text-gray-600">{result.summary.avgAllocatedCapacity}</td>
                          <td className="px-6 py-4 text-sm text-right font-bold text-green-700">{result.summary.avgAvailableCapacity}</td>
                          <td className="px-6 py-4"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Results Yet</h3>
                <p className="text-gray-600">
                  Select a location, sublocation, and booking period to calculate capacity
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
