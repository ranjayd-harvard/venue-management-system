'use client';

import { useState, useEffect } from 'react';
import { Calculator, Users, TrendingUp, PieChart } from 'lucide-react';
import CapacityAllocationChart, { AllocationData } from '@/components/CapacityAllocationChart';

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

interface SegmentBreakdown {
  transient: number;
  events: number;
  reserved: number;
  unavailable: number;
  readyToUse: number;
  isOverride: boolean;
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
    level?: string;
  };
  breakdown?: SegmentBreakdown;
}

// Helper to format value with -9 as unknown
const formatValue = (value: number | undefined): string => {
  if (value === undefined || value === -9) return '-';
  return String(value);
};

// Check if value is unknown (-9)
const isUnknown = (value: number | undefined): boolean => {
  return value === undefined || value === -9;
};

interface AllocationBreakdown {
  totalCapacity: number;
  allocated: {
    total: number;
    transient: number;
    events: number;
    reserved: number;
  };
  unallocated: {
    total: number;
    unavailable: number;
    readyToUse: number;
  };
  percentages: {
    transient: number;
    events: number;
    reserved: number;
    unavailable: number;
    readyToUse: number;
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
  allocationBreakdown?: AllocationBreakdown;
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

      <div className="max-w-full mx-auto px-8 py-6">
        {/* Input Panel - Horizontal Layout */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location *
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-700"
              >
                <option value="">Select Location...</option>
                {locations.map((loc) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.name} - {loc.city}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sub-Location *
              </label>
              <select
                value={subLocationId}
                onChange={(e) => setSubLocationId(e.target.value)}
                disabled={!selectedLocation}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 text-gray-700"
              >
                <option value="">Select Sub-Location...</option>
                {sublocations.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-700"
              />
            </div>

            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date & Time *
              </label>
              <input
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-700"
              />
            </div>

            <div className="flex-shrink-0">
              <button
                onClick={calculateCapacity}
                disabled={loading || !subLocationId}
                className="bg-gradient-to-r from-teal-600 to-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:from-teal-700 hover:to-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 h-[42px]"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator size={20} />
                    Calculate
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results Panel - Full Width */}
        <div>
          {result ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-teal-500">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Avg Max</span>
                    <Users className="text-teal-600" size={18} />
                  </div>
                  <p className="text-2xl font-bold text-teal-900">{result.summary.avgMaxCapacity}</p>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Avg Available</span>
                    <TrendingUp className="text-green-600" size={18} />
                  </div>
                  <p className="text-2xl font-bold text-green-900">{result.summary.avgAvailableCapacity}</p>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Total Hours</span>
                    <Calculator className="text-blue-600" size={18} />
                  </div>
                  <p className="text-2xl font-bold text-blue-900">{result.summary.totalHours}h</p>
                </div>

                {result.allocationBreakdown && (
                  <>
                    <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-gray-400">
                      <div className="text-sm font-medium text-gray-600 mb-2">Total Capacity</div>
                      <p className="text-2xl font-bold text-gray-900">{result.allocationBreakdown.totalCapacity}</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-teal-400">
                      <div className="text-sm font-medium text-teal-600 mb-2">Allocated</div>
                      <p className="text-2xl font-bold text-teal-700">{result.allocationBreakdown.allocated.total}</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-amber-400">
                      <div className="text-sm font-medium text-amber-600 mb-2">Unallocated</div>
                      <p className="text-2xl font-bold text-amber-700">{result.allocationBreakdown.unallocated.total}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Capacity Allocation Breakdown */}
              {result.allocationBreakdown && (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-teal-600 to-green-600 text-white px-6 py-4">
                    <div className="flex items-center gap-3">
                      <PieChart className="w-6 h-6" />
                      <h3 className="text-xl font-bold">Capacity Allocation Breakdown</h3>
                    </div>
                    <p className="text-teal-100 text-sm mt-1">
                      Distribution of capacity across allocation categories
                    </p>
                  </div>

                  <div className="p-6">
                    {/* Allocation Chart - Full Width */}
                    <CapacityAllocationChart
                      data={{
                        transient: result.allocationBreakdown.allocated.transient,
                        events: result.allocationBreakdown.allocated.events,
                        reserved: result.allocationBreakdown.allocated.reserved,
                        unavailable: result.allocationBreakdown.unallocated.unavailable,
                        readyToUse: result.allocationBreakdown.unallocated.readyToUse,
                      }}
                      totalCapacity={result.allocationBreakdown.totalCapacity}
                      showTreemap={true}
                      showStackedBar={true}
                      height={320}
                    />
                  </div>
                </div>
              )}

              {/* Hourly Breakdown */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-teal-600 to-green-600 text-white px-6 py-4">
                  <h3 className="text-xl font-bold">Hourly Capacity Breakdown</h3>
                  <p className="text-teal-100 text-sm mt-1">
                    Per-hour allocation across all 5 categories. &quot;-&quot; indicates unknown values.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-teal-600 uppercase">
                          <div className="flex items-center justify-end gap-1">
                            <div className="w-2 h-2 rounded-full bg-teal-500" />
                            Transient
                          </div>
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-pink-600 uppercase">
                          <div className="flex items-center justify-end gap-1">
                            <div className="w-2 h-2 rounded-full bg-pink-500" />
                            Events
                          </div>
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-violet-600 uppercase">
                          <div className="flex items-center justify-end gap-1">
                            <div className="w-2 h-2 rounded-full bg-violet-500" />
                            Reserved
                          </div>
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          <div className="flex items-center justify-end gap-1">
                            <div className="w-2 h-2 rounded-full bg-gray-400" />
                            Unavailable
                          </div>
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-amber-600 uppercase">
                          <div className="flex items-center justify-end gap-1">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            Ready To Use
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {result.segments.map((segment, index) => {
                        const breakdown = segment.breakdown;
                        const isOverride = breakdown?.isOverride ?? false;

                        return (
                          <tr key={index} className={`hover:bg-gray-50 ${isOverride ? 'bg-blue-50/30' : ''}`}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                              {new Date(segment.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                              {new Date(segment.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className={`px-3 py-3 text-sm text-right ${isUnknown(breakdown?.transient) ? 'text-gray-400' : 'font-semibold text-teal-700'}`}>
                              {formatValue(breakdown?.transient)}
                            </td>
                            <td className={`px-3 py-3 text-sm text-right ${isUnknown(breakdown?.events) ? 'text-gray-400' : 'font-semibold text-pink-700'}`}>
                              {formatValue(breakdown?.events)}
                            </td>
                            <td className={`px-3 py-3 text-sm text-right ${isUnknown(breakdown?.reserved) ? 'text-gray-400' : 'font-semibold text-violet-700'}`}>
                              {formatValue(breakdown?.reserved)}
                            </td>
                            <td className={`px-3 py-3 text-sm text-right ${isUnknown(breakdown?.unavailable) ? 'text-gray-400' : 'font-semibold text-gray-600'}`}>
                              {formatValue(breakdown?.unavailable)}
                            </td>
                            <td className={`px-3 py-3 text-sm text-right ${isUnknown(breakdown?.readyToUse) ? 'text-gray-400' : 'font-bold text-amber-600'}`}>
                              {formatValue(breakdown?.readyToUse)}
                            </td>
                            <td className="px-3 py-3 text-sm">
                              {segment.source === 'CAPACITYSHEET' ? (
                                <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-medium">
                                  {segment.capacitySheet?.name || 'Sheet'}
                                </span>
                              ) : segment.source === 'OPERATING_HOURS' ? (
                                <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded-full text-xs font-medium">
                                  Closed
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                                  Default
                                </span>
                              )}
                              {isOverride && (
                                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                  Override
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-100">
                      <tr>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">DEFAULTS</td>
                        <td className="px-3 py-3 text-sm text-right font-bold text-teal-700">
                          {result.allocationBreakdown?.allocated.transient ?? '-'}
                        </td>
                        <td className="px-3 py-3 text-sm text-right font-bold text-pink-700">
                          {result.allocationBreakdown?.allocated.events ?? '-'}
                        </td>
                        <td className="px-3 py-3 text-sm text-right font-bold text-violet-700">
                          {result.allocationBreakdown?.allocated.reserved ?? '-'}
                        </td>
                        <td className="px-3 py-3 text-sm text-right font-bold text-gray-600">
                          {result.allocationBreakdown?.unallocated.unavailable ?? '-'}
                        </td>
                        <td className="px-3 py-3 text-sm text-right font-bold text-amber-600">
                          {result.allocationBreakdown?.unallocated.readyToUse ?? '-'}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-500">
                          Base allocation
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Legend */}
                <div className="px-6 py-3 bg-gray-50 border-t text-xs text-gray-600">
                  <span className="font-medium">Legend:</span>
                  <span className="ml-3 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">Override</span> = Hour has specific capacity settings
                  <span className="ml-3">|</span>
                  <span className="ml-3 text-gray-400">-</span> = Unknown/not tracked for this hour
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
  );
}
