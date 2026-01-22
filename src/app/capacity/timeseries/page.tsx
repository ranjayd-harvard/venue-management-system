'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Users,
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

interface TimeWindow {
  startTime: string;
  endTime: string;
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity?: number;
}

interface CapacitySheet {
  _id: string;
  name: string;
  type: string;
  priority: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  timeWindows?: TimeWindow[];
  appliesTo: {
    level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
    entityId: string;
  };
  isActive: boolean;
}

interface Location {
  _id: string;
  name: string;
  customerId: string;
  minCapacity?: number;
  maxCapacity?: number;
  defaultCapacity?: number;
  allocatedCapacity?: number;
}

interface SubLocation {
  _id: string;
  label: string;
  locationId: string;
  minCapacity?: number;
  maxCapacity?: number;
  defaultCapacity?: number;
  allocatedCapacity?: number;
}

interface Customer {
  _id: string;
  name: string;
  minCapacity?: number;
  maxCapacity?: number;
  defaultCapacity?: number;
  allocatedCapacity?: number;
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
  [key: string]: any; // Dynamic capacity keys
}

export default function CapacityTimeSeriesPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Entity data
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentSubLocation, setCurrentSubLocation] = useState<SubLocation | null>(null);

  // CapacitySheets
  const [capacitySheets, setCapacitySheets] = useState<CapacitySheet[]>([]);

  // Duration selection
  const [selectedDuration, setSelectedDuration] = useState<number>(12); // Duration in hours (default 12h)

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
  const [allCapacityKeys, setAllCapacityKeys] = useState<string[]>([]);
  const [visibleCapacities, setVisibleCapacities] = useState<Set<string>>(new Set());

  // Capacity metric selection
  const [selectedMetric, setSelectedMetric] = useState<'min' | 'max' | 'default' | 'allocated'>('max');

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      fetchSubLocations(selectedLocation);
      fetchLocationDetails(selectedLocation);
    } else {
      setSublocations([]);
      setSelectedSubLocation('');
      setCurrentLocation(null);
      setCurrentCustomer(null);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (selectedSubLocation) {
      fetchSubLocationDetails(selectedSubLocation);
      // Load all active events
      fetch('/api/events')
        .then(res => res.json())
        .then(data => {
          const activeEvents = data.filter((e: Event) => e.isActive);
          setEvents(activeEvents);
        })
        .catch(err => {
          console.error('Failed to load events:', err);
          setEvents([]);
        });
      // Fetch capacity sheets
      fetchCapacitySheets(selectedSubLocation);
    } else {
      setCurrentSubLocation(null);
      setEvents([]);
      setSelectedEventId('');
      setCapacitySheets([]);
    }
  }, [selectedSubLocation, selectedEventId]);

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
  }, [capacitySheets, viewStart, viewEnd, currentSubLocation, currentLocation, currentCustomer, selectedMetric]);

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations');
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const fetchSubLocations = async (locationId: string) => {
    try {
      const response = await fetch(`/api/sublocations?locationId=${locationId}`);
      const data = await response.json();
      setSublocations(data);
    } catch (error) {
      console.error('Failed to fetch sublocations:', error);
    }
  };

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

  const fetchCapacitySheets = async (subLocationId: string) => {
    setLoading(true);
    try {
      // Use the full range (30 days past to 60 days future) to fetch all relevant capacity sheets
      const startStr = rangeStart.toISOString().split('T')[0];
      const endStr = rangeEnd.toISOString().split('T')[0];

      const url = new URL('/api/capacitysheets', window.location.origin);
      url.searchParams.set('subLocationId', subLocationId);
      url.searchParams.set('startDate', startStr);
      url.searchParams.set('endDate', endStr);
      url.searchParams.set('resolveHierarchy', 'true');

      if (selectedEventId) {
        url.searchParams.set('eventId', selectedEventId);
      }

      const response = await fetch(url.toString());
      const allSheets = await response.json();

      const activeSheets = allSheets.filter((cs: CapacitySheet) => cs.isActive);
      setCapacitySheets(activeSheets.sort((a: CapacitySheet, b: CapacitySheet) => b.priority - a.priority));
    } catch (error) {
      console.error('Failed to fetch capacity sheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSeriesData = () => {
    const dataPoints: TimeSeriesDataPoint[] = [];
    const capacityKeysSet = new Set<string>();

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

      // Add default capacities based on selected metric
      if (currentCustomer) {
        const key = `Customer Default`;
        let value: number | undefined;

        switch (selectedMetric) {
          case 'min':
            value = currentCustomer.minCapacity;
            break;
          case 'max':
            value = currentCustomer.maxCapacity;
            break;
          case 'default':
            value = currentCustomer.defaultCapacity;
            break;
          case 'allocated':
            value = currentCustomer.allocatedCapacity;
            break;
        }

        if (value !== undefined) {
          point[key] = value;
          capacityKeysSet.add(key);
        }
      }

      if (currentLocation) {
        const key = `Location Default`;
        let value: number | undefined;

        switch (selectedMetric) {
          case 'min':
            value = currentLocation.minCapacity;
            break;
          case 'max':
            value = currentLocation.maxCapacity;
            break;
          case 'default':
            value = currentLocation.defaultCapacity;
            break;
          case 'allocated':
            value = currentLocation.allocatedCapacity;
            break;
        }

        if (value !== undefined) {
          point[key] = value;
          capacityKeysSet.add(key);
        }
      }

      if (currentSubLocation) {
        const key = `SubLocation Default`;
        let value: number | undefined;

        switch (selectedMetric) {
          case 'min':
            value = currentSubLocation.minCapacity;
            break;
          case 'max':
            value = currentSubLocation.maxCapacity;
            break;
          case 'default':
            value = currentSubLocation.defaultCapacity;
            break;
          case 'allocated':
            value = currentSubLocation.allocatedCapacity;
            break;
        }

        if (value !== undefined) {
          point[key] = value;
          capacityKeysSet.add(key);
        }
      }

      // Check capacity sheets
      const timeStr = currentTime.toTimeString().substring(0, 5); // HH:mm

      capacitySheets.forEach(cs => {
        // Check if capacity sheet is effective at this time
        const effectiveFrom = new Date(cs.effectiveFrom);
        const effectiveTo = cs.effectiveTo ? new Date(cs.effectiveTo) : null;

        if (currentTime >= effectiveFrom && (!effectiveTo || currentTime <= effectiveTo)) {
          // Check time windows
          if (cs.timeWindows) {
            cs.timeWindows.forEach((tw) => {
              if (timeStr >= tw.startTime && timeStr < tw.endTime) {
                const key = `${cs.name} (${tw.startTime}-${tw.endTime})`;

                // Store the value based on selected metric
                let value: number | undefined;
                switch (selectedMetric) {
                  case 'min':
                    value = tw.minCapacity;
                    break;
                  case 'max':
                    value = tw.maxCapacity;
                    break;
                  case 'default':
                    value = tw.defaultCapacity;
                    break;
                  case 'allocated':
                    value = tw.allocatedCapacity || 0;
                    break;
                  default:
                    value = tw.maxCapacity;
                }

                if (value !== undefined) {
                  point[key] = value;
                  capacityKeysSet.add(key);
                }
              }
            });
          }
        }
      });

      dataPoints.push(point);
      currentTime.setHours(currentTime.getHours() + 1);
    }

    const keys = Array.from(capacityKeysSet);
    setTimeSeriesData(dataPoints);
    setAllCapacityKeys(keys);
    setVisibleCapacities(new Set(keys));
  };

  const getCapacityColor = (capacityKey: string, index: number): string => {
    // Modern, vibrant color palette for capacity
    const colors = [
      '#14B8A6', // teal
      '#10B981', // emerald
      '#06B6D4', // cyan
      '#8B5CF6', // purple
      '#6366F1', // indigo
      '#EC4899', // pink
      '#F59E0B', // amber
      '#F97316', // orange
      '#3B82F6', // blue
      '#EF4444', // red
      '#84CC16', // lime
      '#A855F7', // violet
    ];

    // Hash the key to get a consistent color
    let hash = 0;
    for (let i = 0; i < capacityKey.length; i++) {
      hash = capacityKey.charCodeAt(i) + ((hash << 5) - hash);
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
              <span className="font-bold text-gray-900">{entry.value} people</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const toggleCapacityVisibility = (capacityKey: string) => {
    const newVisible = new Set(visibleCapacities);
    if (newVisible.has(capacityKey)) {
      newVisible.delete(capacityKey);
    } else {
      newVisible.add(capacityKey);
    }
    setVisibleCapacities(newVisible);
  };

  const setQuickRange = (hours: number) => {
    setSelectedDuration(hours);
    // Keep current start time, just update the end based on new duration
    const newViewEnd = new Date(viewStart.getTime() + hours * 60 * 60 * 1000);
    setViewEnd(newViewEnd);
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
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-green-50 to-emerald-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Capacity TimeSeries
          </h1>
          <p className="text-gray-600">
            Analyze capacity patterns and trends over time
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-gray-900 bg-white"
              >
                <option value="">Select location...</option>
                {locations.map((loc) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sub-Location
              </label>
              <select
                value={selectedSubLocation}
                onChange={(e) => setSelectedSubLocation(e.target.value)}
                disabled={!selectedLocation}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
              >
                <option value="">Select sub-location...</option>
                {sublocations.map((subloc) => (
                  <option key={subloc._id} value={subloc._id}>
                    {subloc.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event (Optional)
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                disabled={!selectedSubLocation || events.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 bg-white"
              >
                <option value="">No event selected</option>
                {events.map((event) => (
                  <option key={event._id} value={event._id}>
                    {event.name}
                    {event.description && ` - ${event.description}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedDuration(7)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                    selectedDuration === 7
                      ? 'bg-teal-600 text-white'
                      : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
                  }`}
                >
                  7h
                </button>
                <button
                  onClick={() => setSelectedDuration(12)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                    selectedDuration === 12
                      ? 'bg-teal-600 text-white'
                      : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
                  }`}
                >
                  12h
                </button>
                <button
                  onClick={() => setSelectedDuration(24)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                    selectedDuration === 24
                      ? 'bg-teal-600 text-white'
                      : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
                  }`}
                >
                  24h
                </button>
                <button
                  onClick={() => setSelectedDuration(48)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                    selectedDuration === 48
                      ? 'bg-teal-600 text-white'
                      : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
                  }`}
                >
                  48h
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-600"></div>
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
                      {currentCustomer.maxCapacity && (
                        <div className="text-sm text-gray-600 mt-1">
                          Default: {currentCustomer.maxCapacity} people
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
                      {currentLocation.maxCapacity && (
                        <div className="text-sm text-gray-600 mt-1">
                          Default: {currentLocation.maxCapacity} people
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
                      {currentSubLocation.maxCapacity && (
                        <div className="text-sm text-gray-600 mt-1">
                          Default: {currentSubLocation.maxCapacity} people
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
                          background: '#14B8A6',
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
                <h2 className="text-lg font-bold text-gray-900">Capacity TimeSeries Chart</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Metric:</label>
                    <select
                      value={selectedMetric}
                      onChange={(e) => setSelectedMetric(e.target.value as 'min' | 'max' | 'default' | 'allocated')}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-gray-900 bg-white"
                    >
                      <option value="min">Min Capacity</option>
                      <option value="max">Max Capacity</option>
                      <option value="default">Default Capacity</option>
                      <option value="allocated">Allocated Capacity</option>
                    </select>
                  </div>
                  <div className="text-sm text-gray-600">
                    {timeSeriesData.length} data points over {selectedDuration} hours
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-teal-50 to-green-50 rounded-lg p-6 mb-4">
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
                      label={{ value: 'Capacity (People)', angle: -90, position: 'insideLeft', style: { fill: '#6B7280' } }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="line"
                      onClick={(e) => toggleCapacityVisibility(e.value)}
                      formatter={(value) => (
                        <span className="text-sm font-medium text-gray-700">{value}</span>
                      )}
                    />
                    {allCapacityKeys.map((capacityKey, index) => (
                      visibleCapacities.has(capacityKey) && (
                        <Line
                          key={capacityKey}
                          type="monotone"
                          dataKey={capacityKey}
                          stroke={getCapacityColor(capacityKey, index)}
                          strokeWidth={3}
                          dot={{ r: 5, strokeWidth: 2, fill: '#fff' }}
                          activeDot={{ r: 7, strokeWidth: 2 }}
                          name={capacityKey}
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
                  {Array.from(visibleCapacities).map(capacityKey => (
                    <button
                      key={capacityKey}
                      onClick={() => toggleCapacityVisibility(capacityKey)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                        visibleCapacities.has(capacityKey)
                          ? 'bg-white border-gray-300 shadow-sm'
                          : 'bg-gray-100 border-gray-200 opacity-50'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: getCapacityColor(capacityKey) }}
                      />
                      <span className="text-xs font-medium text-gray-700 truncate">
                        {capacityKey}
                      </span>
                    </button>
                  ))}
                </div>
                {visibleCapacities.size === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No capacities to display. Select a location and sublocation with capacity configured.
                  </div>
                )}
              </div>
            </div>

            {/* Capacity Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Capacity Statistics</h2>
              <div className="space-y-3">
                {allCapacityKeys.map((capacityKey, index) => {
                  // Calculate stats for this capacity
                  const values = timeSeriesData
                    .map(point => point[capacityKey])
                    .filter(v => v !== null && v !== undefined) as number[];

                  const min = values.length > 0 ? Math.min(...values) : 0;
                  const max = values.length > 0 ? Math.max(...values) : 0;
                  const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;

                  return (
                    <div
                      key={capacityKey}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-teal-50 to-green-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full shadow-sm"
                          style={{ backgroundColor: getCapacityColor(capacityKey, index) }}
                        />
                        <span className="text-sm font-semibold text-gray-900">{capacityKey}</span>
                      </div>
                      <div className="flex gap-6 text-xs text-gray-700">
                        <div className="flex flex-col items-center">
                          <span className="font-medium text-gray-500">Min</span>
                          <span className="font-bold text-emerald-600">{min}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="font-medium text-gray-500">Max</span>
                          <span className="font-bold text-pink-600">{max}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="font-medium text-gray-500">Avg</span>
                          <span className="font-bold text-teal-600">{avg}</span>
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
                Choose a location and sub-location to view capacity timeseries
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
