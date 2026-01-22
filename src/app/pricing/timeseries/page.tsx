'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Building2,
  MapPin,
  User,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import PricingFilters from '@/components/PricingFilters';

interface TimeWindow {
  windowType?: 'ABSOLUTE_TIME' | 'DURATION_BASED';
  startTime?: string;
  endTime?: string;
  startMinute?: number;
  endMinute?: number;
  pricePerHour: number;
}

interface Ratesheet {
  _id: string;
  name: string;
  type: string;
  priority: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  timeWindows?: TimeWindow[];
  applyTo: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
  isActive: boolean;
}

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

interface Customer {
  _id: string;
  name: string;
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

interface TimeSeriesDataPoint {
  timestamp: Date;
  timeLabel: string;
  [key: string]: any; // Dynamic rate keys
}

export default function PricingTimeSeriesPage() {
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Entity data
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentSubLocation, setCurrentSubLocation] = useState<SubLocation | null>(null);

  // Ratesheets
  const [ratesheets, setRatesheets] = useState<Ratesheet[]>([]);

  // Duration selection
  const [selectedDuration, setSelectedDuration] = useState<number>(12); // Duration in hours (default 12h)

  // Duration-based pricing context
  const [useDurationContext, setUseDurationContext] = useState<boolean>(false);
  const [bookingStartTime, setBookingStartTime] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours ago (matches viewStart default)
  });

  // Date-time range for the slider (30 days past to 60 days future)
  const [rangeStart, setRangeStart] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  });
  const [rangeEnd, setRangeEnd] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days from now (total 90 day window)
  });

  // Currently viewing window within the range (default 12 hours)
  const [viewStart, setViewStart] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours ago
  });
  const [viewEnd, setViewEnd] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours from now (12 hour default view)
  });

  // TimeSeries data
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);
  const [allRateKeys, setAllRateKeys] = useState<string[]>([]);
  const [visibleRates, setVisibleRates] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedLocation) {
      fetchLocationDetails(selectedLocation);
    } else {
      setSelectedSubLocation('');
      setCurrentLocation(null);
      setCurrentCustomer(null);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (selectedSubLocation) {
      fetchSubLocationDetails(selectedSubLocation);
      // Fetch ratesheets
      fetchRatesheets(selectedSubLocation);
    } else {
      setCurrentSubLocation(null);
      setSelectedEventId('');
      setRatesheets([]);
    }
  }, [selectedSubLocation, selectedEventId]);

  // Sync view window with booking start time when duration context is enabled
  useEffect(() => {
    if (useDurationContext) {
      setViewStart(new Date(bookingStartTime));
      setViewEnd(new Date(bookingStartTime.getTime() + selectedDuration * 60 * 60 * 1000));
    }
  }, [useDurationContext, bookingStartTime]);

  // Recalculate timeseries when duration changes
  useEffect(() => {
    const newViewEnd = new Date(viewStart.getTime() + selectedDuration * 60 * 60 * 1000);
    setViewEnd(newViewEnd);
  }, [selectedDuration, viewStart]);

  // Generate timeseries data when dependencies change
  useEffect(() => {
    if (currentSubLocation || currentLocation || currentCustomer) {
      generateTimeSeriesData();
    }
  }, [ratesheets, viewStart, viewEnd, currentSubLocation, currentLocation, currentCustomer, useDurationContext, bookingStartTime]);

  const fetchLocationDetails = async (locationId: string) => {
    try {
      const response = await fetch(`/api/locations/${locationId}`);
      const location = await response.json();
      setCurrentLocation(location);

      // Fetch customer details
      if (location.customerId) {
        const customerResponse = await fetch(`/api/customers/${location.customerId}`);
        const customer = await customerResponse.json();
        setCurrentCustomer(customer);
      }
    } catch (error) {
      console.error('Failed to fetch location details:', error);
    }
  };

  const fetchSubLocationDetails = async (subLocationId: string) => {
    try {
      const response = await fetch(`/api/sublocations/${subLocationId}`);
      const subloc = await response.json();
      setCurrentSubLocation(subloc);
    } catch (error) {
      console.error('Failed to fetch sublocation details:', error);
    }
  };

  const fetchRatesheets = async (subLocationId: string) => {
    setLoading(true);
    try {
      // Use the full range (30 days past to 60 days future) to fetch all relevant ratesheets
      const startStr = rangeStart.toISOString().split('T')[0];
      const endStr = rangeEnd.toISOString().split('T')[0];

      const url = new URL('/api/ratesheets', window.location.origin);
      url.searchParams.set('subLocationId', subLocationId);
      url.searchParams.set('startDate', startStr);
      url.searchParams.set('endDate', endStr);
      url.searchParams.set('resolveHierarchy', 'true');

      if (selectedEventId) {
        url.searchParams.set('eventId', selectedEventId);
      }

      const response = await fetch(url.toString());
      const allRatesheets = await response.json();

      const activeRatesheets = allRatesheets.filter((rs: Ratesheet) => rs.isActive);
      setRatesheets(activeRatesheets.sort((a: Ratesheet, b: Ratesheet) => b.priority - a.priority));
    } catch (error) {
      console.error('Failed to fetch ratesheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSeriesData = () => {
    const dataPoints: TimeSeriesDataPoint[] = [];
    const rateKeysSet = new Set<string>();

    // Generate hourly timestamps
    const currentTime = new Date(viewStart);
    const endTime = new Date(viewEnd);

    while (currentTime < endTime) {
      const point: TimeSeriesDataPoint = {
        timestamp: new Date(currentTime),
        timeLabel: currentTime.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          hour12: true
        })
      };

      // Add default rates
      if (currentCustomer?.defaultHourlyRate) {
        const key = `Customer Default`;
        point[key] = currentCustomer.defaultHourlyRate;
        rateKeysSet.add(key);
      }

      if (currentLocation?.defaultHourlyRate) {
        const key = `Location Default`;
        point[key] = currentLocation.defaultHourlyRate;
        rateKeysSet.add(key);
      }

      if (currentSubLocation?.defaultHourlyRate) {
        const key = `SubLocation Default`;
        point[key] = currentSubLocation.defaultHourlyRate;
        rateKeysSet.add(key);
      }

      // Check ratesheets
      const timeStr = currentTime.toTimeString().substring(0, 5); // HH:mm

      ratesheets.forEach(rs => {
        // Check if ratesheet is effective at this time
        const effectiveFrom = new Date(rs.effectiveFrom);
        const effectiveTo = rs.effectiveTo ? new Date(rs.effectiveTo) : null;

        if (currentTime >= effectiveFrom && (!effectiveTo || currentTime <= effectiveTo)) {
          // Check time windows
          if (rs.timeWindows) {
            rs.timeWindows.forEach((tw) => {
              const windowType = tw.windowType || 'ABSOLUTE_TIME';
              let matches = false;
              let windowLabel = '';

              if (windowType === 'ABSOLUTE_TIME') {
                // Absolute time matching
                if (tw.startTime && tw.endTime && timeStr >= tw.startTime && timeStr < tw.endTime) {
                  matches = true;
                  windowLabel = `${tw.startTime}-${tw.endTime}`;
                }
              } else if (windowType === 'DURATION_BASED') {
                // Duration-based matching (only if context is enabled)
                if (useDurationContext) {
                  const minutesFromStart = Math.floor((currentTime.getTime() - bookingStartTime.getTime()) / (1000 * 60));
                  const startMinute = tw.startMinute ?? 0;
                  const endMinute = tw.endMinute ?? 0;

                  if (minutesFromStart >= startMinute && minutesFromStart < endMinute) {
                    matches = true;
                    windowLabel = `${startMinute}-${endMinute}min`;
                  }
                }
              }

              if (matches) {
                const key = `${rs.name} (${windowLabel})`;
                point[key] = tw.pricePerHour;
                rateKeysSet.add(key);
              }
            });
          }
        }
      });

      dataPoints.push(point);
      currentTime.setHours(currentTime.getHours() + 1);
    }

    const keys = Array.from(rateKeysSet);
    setTimeSeriesData(dataPoints);
    setAllRateKeys(keys);
    setVisibleRates(new Set(keys));
  };

  const getRateColor = (rateKey: string, index: number): string => {
    // Modern, vibrant color palette
    const colors = [
      '#6366F1', // indigo
      '#EC4899', // pink
      '#10B981', // emerald
      '#F59E0B', // amber
      '#8B5CF6', // purple
      '#14B8A6', // teal
      '#F97316', // orange
      '#3B82F6', // blue
      '#EF4444', // red
      '#06B6D4', // cyan
      '#84CC16', // lime
      '#A855F7', // violet
    ];

    // Hash the key to get a consistent color
    let hash = 0;
    for (let i = 0; i < rateKey.length; i++) {
      hash = rateKey.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border-2 border-gray-200 rounded-lg shadow-lg p-4">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-700">{entry.name}:</span>
              <span className="font-bold text-gray-900">${entry.value?.toFixed(2)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const toggleRateVisibility = (rateKey: string) => {
    const newVisible = new Set(visibleRates);
    if (newVisible.has(rateKey)) {
      newVisible.delete(rateKey);
    } else {
      newVisible.add(rateKey);
    }
    setVisibleRates(newVisible);
  };

  const setQuickRange = (hours: number) => {
    setSelectedDuration(hours);
    // If duration context is enabled, calculate from booking start time
    if (useDurationContext) {
      const newViewStart = new Date(bookingStartTime);
      const newViewEnd = new Date(bookingStartTime.getTime() + hours * 60 * 60 * 1000);
      setViewStart(newViewStart);
      setViewEnd(newViewEnd);
    } else {
      // Keep current start time, just update the end based on new duration
      const newViewEnd = new Date(viewStart.getTime() + hours * 60 * 60 * 1000);
      setViewEnd(newViewEnd);
    }
  };

  const getViewWindowPosition = (): { left: number; width: number } => {
    const totalMs = rangeEnd.getTime() - rangeStart.getTime();
    const viewStartMs = viewStart.getTime() - rangeStart.getTime();
    const durationMs = selectedDuration * 60 * 60 * 1000;

    return {
      left: (viewStartMs / totalMs) * 100,
      width: (durationMs / totalMs) * 100
    };
  };

  const handleStartTimeChange = (position: number) => {
    const totalMs = rangeEnd.getTime() - rangeStart.getTime();
    const newMs = rangeStart.getTime() + (position / 100) * totalMs;
    const newViewStart = new Date(newMs);
    const newViewEnd = new Date(newViewStart.getTime() + selectedDuration * 60 * 60 * 1000);

    setViewStart(newViewStart);
    setViewEnd(newViewEnd);
  };

  const formatDateTime = (date: Date): string => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Pricing TimeSeries
          </h1>
          <p className="text-gray-600">
            Analyze pricing patterns and trends over time
          </p>
        </div>

        {/* Filters */}
        <PricingFilters
          selectedLocation={selectedLocation}
          selectedSubLocation={selectedSubLocation}
          selectedEventId={selectedEventId}
          onLocationChange={setSelectedLocation}
          onSubLocationChange={setSelectedSubLocation}
          onEventChange={setSelectedEventId}
          selectedDuration={selectedDuration}
          onDurationChange={setQuickRange}
          useDurationContext={useDurationContext}
          bookingStartTime={bookingStartTime}
          onUseDurationContextChange={setUseDurationContext}
          onBookingStartTimeChange={setBookingStartTime}
        />

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && selectedSubLocation && (
          <>
            {/* Current Selection Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Current Selection</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {currentCustomer && (
                  <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white shadow-md">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-600">Customer</div>
                      <div className="text-lg font-bold text-gray-900">{currentCustomer.name}</div>
                      {currentCustomer.defaultHourlyRate && (
                        <div className="text-sm text-gray-600 mt-1">
                          Default: ${currentCustomer.defaultHourlyRate}/hr
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {currentLocation && (
                  <div className="flex items-start space-x-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center text-white shadow-md">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-600">Location</div>
                      <div className="text-lg font-bold text-gray-900">{currentLocation.name}</div>
                      {currentLocation.defaultHourlyRate && (
                        <div className="text-sm text-gray-600 mt-1">
                          Default: ${currentLocation.defaultHourlyRate}/hr
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {currentSubLocation && (
                  <div className="flex items-start space-x-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center text-white shadow-md">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-600">Sub-Location</div>
                      <div className="text-lg font-bold text-gray-900">{currentSubLocation.label}</div>
                      {currentSubLocation.defaultHourlyRate && (
                        <div className="text-sm text-gray-600 mt-1">
                          Default: ${currentSubLocation.defaultHourlyRate}/hr
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline Range Slider */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Time Navigator</h2>
                <div className="text-sm text-gray-600 font-medium">
                  {formatDateTime(viewStart)} - {formatDateTime(viewEnd)} {' '}
                  <span className="text-gray-500 font-light">({selectedDuration}h duration)</span>
                </div>
              </div>

              <div className="relative bg-white rounded-lg px-4 py-6 border border-gray-200">
                {/* Timeline track container */}
                <div className="relative h-16 mb-8">
                  {/* Time tick marks */}
                  <div className="absolute inset-x-0 top-0 flex justify-between">
                    {Array.from({ length: 11 }).map((_, i) => {
                      const tickMs = rangeStart.getTime() + (i / 10) * (rangeEnd.getTime() - rangeStart.getTime());
                      const tickDate = new Date(tickMs);
                      return (
                        <div key={i} className="flex flex-col items-center">
                          <div className="w-px h-2 bg-gray-400" />
                          <div className="text-[9px] text-gray-500 mt-1 font-medium">
                            {tickDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Main slider track */}
                  <div className="absolute inset-x-0 top-8 h-10">
                    <div className="relative w-full h-full bg-gray-100 rounded-sm border-t-2 border-b-2 border-gray-300">
                      {/* Unselected area - hatched pattern */}
                      <div
                        className="absolute h-full bg-gray-200"
                        style={{
                          left: 0,
                          width: '100%',
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,0.04) 6px, rgba(0,0,0,0.04) 12px)'
                        }}
                      />

                      {/* Selected interval - solid colored block */}
                      <div
                        className="absolute h-full shadow-lg"
                        style={{
                          left: `${getViewWindowPosition().left}%`,
                          width: `${getViewWindowPosition().width}%`,
                          background: '#3B82F6',
                          border: '2px solid white',
                          boxSizing: 'border-box'
                        }}
                      >
                        {/* Single combined label below the interval */}
                        <div
                          className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-gray-800 bg-white px-3 py-1 rounded border border-gray-400 shadow-md"
                          style={{ zIndex: 20 }}
                        >
                          {viewStart.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                          {' – '}
                          {viewEnd.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Invisible range input for dragging */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={getViewWindowPosition().left}
                      onChange={(e) => handleStartTimeChange(parseFloat(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
                      style={{ zIndex: 11 }}
                    />
                  </div>
                </div>
              </div>

              {/* Quick info */}
              <div className="mt-4 flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  <span>Drag the slider to adjust the time window</span>
                </div>
                <div>
                  Total range: 30 days past to 60 days future
                </div>
              </div>
            </div>

            {/* TimeSeries Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Pricing TimeSeries Chart</h2>
                <div className="text-sm text-gray-600">
                  {timeSeriesData.length} data points over {selectedDuration} hours
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg p-6 mb-4">
                <ResponsiveContainer width="100%" height={500}>
                  <LineChart
                    data={timeSeriesData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="timeLabel"
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                      stroke="#9CA3AF"
                    />
                    <YAxis
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                      stroke="#9CA3AF"
                      tickFormatter={(value) => `$${value}`}
                      label={{ value: 'Price per Hour ($)', angle: -90, position: 'insideLeft', style: { fill: '#6B7280' } }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="line"
                      onClick={(e) => toggleRateVisibility(e.value)}
                      formatter={(value) => (
                        <span className="text-sm font-medium text-gray-700">{value}</span>
                      )}
                    />
                    {allRateKeys.map((rateKey, index) => (
                      visibleRates.has(rateKey) && (
                        <Line
                          key={rateKey}
                          type="monotone"
                          dataKey={rateKey}
                          stroke={getRateColor(rateKey, index)}
                          strokeWidth={3}
                          dot={{ r: 5, strokeWidth: 2, fill: '#fff' }}
                          activeDot={{ r: 7, strokeWidth: 2 }}
                          name={rateKey}
                          connectNulls
                        />
                      )
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Legend (Click to toggle)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Array.from(visibleRates).map(rateKey => (
                    <button
                      key={rateKey}
                      onClick={() => toggleRateVisibility(rateKey)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                        visibleRates.has(rateKey)
                          ? 'bg-white border-gray-300 shadow-sm'
                          : 'bg-gray-100 border-gray-200 opacity-50'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: getRateColor(rateKey) }}
                      />
                      <span className="text-xs font-medium text-gray-700 truncate">
                        {rateKey}
                      </span>
                    </button>
                  ))}
                </div>
                {visibleRates.size === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No rates to display. Select a location and sublocation with pricing configured.
                  </div>
                )}
              </div>
            </div>

            {/* Rate Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Rate Statistics</h2>
              <div className="space-y-3">
                {allRateKeys.map((rateKey, index) => {
                  // Calculate stats for this rate
                  const values = timeSeriesData
                    .map(point => point[rateKey])
                    .filter(v => v !== null && v !== undefined) as number[];

                  const min = values.length > 0 ? Math.min(...values) : 0;
                  const max = values.length > 0 ? Math.max(...values) : 0;
                  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

                  return (
                    <div
                      key={rateKey}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full shadow-sm"
                          style={{ backgroundColor: getRateColor(rateKey, index) }}
                        />
                        <span className="text-sm font-semibold text-gray-900">{rateKey}</span>
                      </div>
                      <div className="flex gap-6 text-xs text-gray-700">
                        <div className="flex flex-col items-center">
                          <span className="font-medium text-gray-500">Min</span>
                          <span className="font-bold text-emerald-600">${min.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="font-medium text-gray-500">Max</span>
                          <span className="font-bold text-pink-600">${max.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="font-medium text-gray-500">Avg</span>
                          <span className="font-bold text-blue-600">${avg.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="font-medium text-gray-500">Points</span>
                          <span className="font-bold text-gray-700">{values.length}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {!selectedSubLocation && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <div className="text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Select Location and Sub-Location
              </h3>
              <p className="text-gray-600">
                Choose a location and sub-location to view pricing timeseries
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
