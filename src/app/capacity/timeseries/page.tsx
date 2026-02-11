'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
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

interface AllocationBreakdown {
  subLocationId: string;
  subLocationLabel: string;
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
  metadata: {
    totalHours: number;
    availableHours: number;
    unavailableHours: number;
    timezone: string;
    startTime: string;
    endTime: string;
  };
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
  const [selectedMetric, setSelectedMetric] = useState<'min' | 'max' | 'default' | 'allocated' | 'transient' | 'events' | 'reserved' | 'unavailable' | 'readyToUse'>('max');

  // Allocation breakdown
  const [allocationData, setAllocationData] = useState<AllocationBreakdown | null>(null);
  const [allocationLoading, setAllocationLoading] = useState(false);

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
  }, [capacitySheets, viewStart, viewEnd, currentSubLocation, currentLocation, currentCustomer, selectedMetric, allocationData]);

  // Fetch allocation breakdown when sublocation or view window changes
  useEffect(() => {
    if (selectedSubLocation) {
      fetchAllocationData();
    } else {
      setAllocationData(null);
    }
  }, [selectedSubLocation, viewStart, viewEnd]);

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

  // Fetch allocation breakdown data
  const fetchAllocationData = async () => {
    if (!selectedSubLocation) {
      setAllocationData(null);
      return;
    }

    setAllocationLoading(true);
    try {
      const response = await fetch('/api/capacity/allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subLocationId: selectedSubLocation,
          startTime: viewStart.toISOString(),
          endTime: viewEnd.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch allocation data');
      }

      const data = await response.json();
      setAllocationData(data);
    } catch (err: any) {
      console.error('Error fetching allocation data:', err);
      setAllocationData(null);
    } finally {
      setAllocationLoading(false);
    }
  };

  const generateTimeSeriesData = () => {
    const dataPoints: TimeSeriesDataPoint[] = [];
    const capacityKeysSet = new Set<string>();

    // Check if we're showing allocation categories
    const isAllocationMetric = ['transient', 'events', 'reserved', 'unavailable', 'readyToUse'].includes(selectedMetric);

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

      // For allocation metrics, show breakdown from allocation data as constant lines
      if (isAllocationMetric && allocationData) {
        const allocationCategories = [
          { key: 'Transient', value: allocationData.allocated.transient, metric: 'transient' },
          { key: 'Events', value: allocationData.allocated.events, metric: 'events' },
          { key: 'Reserved', value: allocationData.allocated.reserved, metric: 'reserved' },
          { key: 'Unavailable', value: allocationData.unallocated.unavailable, metric: 'unavailable' },
          { key: 'Ready To Use', value: allocationData.unallocated.readyToUse, metric: 'readyToUse' },
        ];

        // Show all categories or just the selected one
        allocationCategories.forEach(cat => {
          point[cat.key] = cat.value;
          capacityKeysSet.add(cat.key);
        });
      } else if (!isAllocationMetric) {
        // Standard capacity metrics (min, max, default, allocated)

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
      }

      dataPoints.push(point);
      currentTime.setHours(currentTime.getHours() + 1);
    }

    const keys = Array.from(capacityKeysSet);
    setTimeSeriesData(dataPoints);
    setAllCapacityKeys(keys);
    setVisibleCapacities(new Set(keys));
  };

  const getCapacityColor = (capacityKey: string, index: number): string => {
    // Fixed colors for allocation categories
    const allocationColors: Record<string, string> = {
      'Transient': '#14B8A6',      // teal
      'Events': '#EC4899',          // pink
      'Reserved': '#8B5CF6',        // violet
      'Unavailable': '#9CA3AF',     // gray
      'Ready To Use': '#F59E0B',    // amber
    };

    // Return fixed color for allocation categories
    if (allocationColors[capacityKey]) {
      return allocationColors[capacityKey];
    }

    // Modern, vibrant color palette for other capacities
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
      // Check if we're viewing allocation categories (they don't compete, so no "winner")
      const allocationCategoryNames = ['Transient', 'Events', 'Reserved', 'Unavailable', 'Ready To Use'];
      const isAllocationView = payload.every((entry: any) => allocationCategoryNames.includes(entry.name));

      // Calculate total from all visible capacity values
      const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);

      // Determine the winner - only for competing capacity sources (not allocation categories)
      let winnerName: string | null = null;
      if (!isAllocationView) {
        // Capacity sheets (with time windows) take priority over defaults
        // Among capacity sheets, lower value (more restrictive) typically wins
        // If no capacity sheet, the default with highest specificity wins
        const sortedPayload = [...payload].sort((a: any, b: any) => {
          // Capacity sheets (entries with time ranges like "09:00-17:00") win over defaults
          const aIsSheet = a.name.includes('(') && a.name.includes(':');
          const bIsSheet = b.name.includes('(') && b.name.includes(':');

          if (aIsSheet && !bIsSheet) return -1;
          if (!aIsSheet && bIsSheet) return 1;

          // Among same type, lower value (more restrictive) wins
          return (a.value || 0) - (b.value || 0);
        });

        winnerName = sortedPayload[0]?.name;
      }

      return (
        <div className="bg-white border-2 border-gray-200 rounded-lg shadow-xl p-4 min-w-[280px]">
          <p className="font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">{label}</p>

          {/* For allocation view, show a header indicating these are breakdown categories */}
          {isAllocationView && (
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Capacity Breakdown</p>
          )}

          {/* Capacity values from chart */}
          <div className="space-y-1 mb-3">
            {payload.map((entry: any, index: number) => {
              const isWinner = !isAllocationView && entry.name === winnerName;
              return (
                <div
                  key={index}
                  className={`flex items-center justify-between text-sm py-1 px-2 rounded ${
                    isWinner ? 'bg-emerald-50 border border-emerald-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className={isWinner ? 'font-semibold text-emerald-700' : 'text-gray-700'}>
                      {entry.name}
                    </span>
                    {isWinner && (
                      <span className="text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded font-medium">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <span className={`font-bold ${isWinner ? 'text-emerald-700' : 'text-gray-900'}`}>
                    {entry.value}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Show total for allocation view */}
          {isAllocationView && (
            <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between text-sm">
              <span className="font-medium text-gray-700">Total Capacity</span>
              <span className="font-bold text-gray-900">{total}</span>
            </div>
          )}

          {/* Allocation Breakdown - only show when NOT viewing allocation categories (to avoid duplication) */}
          {allocationData && !isAllocationView && (
            <>
              <div className="border-t border-gray-200 pt-3 mt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Allocation Breakdown</p>

                {/* Stacked bar visualization */}
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex mb-3">
                  <div
                    className="h-full"
                    style={{
                      width: `${allocationData.percentages.transient}%`,
                      backgroundColor: '#14B8A6'
                    }}
                    title={`Transient: ${allocationData.percentages.transient}%`}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: `${allocationData.percentages.events}%`,
                      backgroundColor: '#EC4899'
                    }}
                    title={`Events: ${allocationData.percentages.events}%`}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: `${allocationData.percentages.reserved}%`,
                      backgroundColor: '#8B5CF6'
                    }}
                    title={`Reserved: ${allocationData.percentages.reserved}%`}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: `${allocationData.percentages.unavailable}%`,
                      backgroundColor: '#9CA3AF'
                    }}
                    title={`Unavailable: ${allocationData.percentages.unavailable}%`}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: `${allocationData.percentages.readyToUse}%`,
                      backgroundColor: '#F59E0B'
                    }}
                    title={`Ready To Use: ${allocationData.percentages.readyToUse}%`}
                  />
                </div>

                {/* Breakdown details */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      <span className="text-gray-600">Transient</span>
                    </div>
                    <span className="font-semibold text-teal-600">
                      {allocationData.allocated.transient} ({allocationData.percentages.transient}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-pink-500" />
                      <span className="text-gray-600">Events</span>
                    </div>
                    <span className="font-semibold text-pink-600">
                      {allocationData.allocated.events} ({allocationData.percentages.events}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-violet-500" />
                      <span className="text-gray-600">Reserved</span>
                    </div>
                    <span className="font-semibold text-violet-600">
                      {allocationData.allocated.reserved} ({allocationData.percentages.reserved}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                      <span className="text-gray-600">Unavailable</span>
                    </div>
                    <span className="font-semibold text-gray-500">
                      {allocationData.unallocated.unavailable} ({allocationData.percentages.unavailable}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between col-span-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-gray-600">Ready To Use</span>
                    </div>
                    <span className="font-semibold text-amber-600">
                      {allocationData.unallocated.readyToUse} ({allocationData.percentages.readyToUse}%)
                    </span>
                  </div>
                </div>

                {/* Total */}
                <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs">
                  <span className="font-medium text-gray-700">Total Capacity</span>
                  <span className="font-bold text-gray-900">{allocationData.totalCapacity}</span>
                </div>
              </div>
            </>
          )}
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
                      onChange={(e) => setSelectedMetric(e.target.value as 'min' | 'max' | 'default' | 'allocated' | 'transient' | 'events' | 'reserved' | 'unavailable' | 'readyToUse')}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm text-gray-900 bg-white"
                    >
                      <optgroup label="Capacity Limits">
                        <option value="min">Min Capacity</option>
                        <option value="max">Max Capacity</option>
                        <option value="default">Default Capacity</option>
                        <option value="allocated">Allocated Capacity</option>
                      </optgroup>
                      <optgroup label="Allocation Categories">
                        <option value="transient">Transient (Walk-ins)</option>
                        <option value="events">Events</option>
                        <option value="reserved">Reserved</option>
                        <option value="unavailable">Unavailable</option>
                        <option value="readyToUse">Ready To Use</option>
                      </optgroup>
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
                      onClick={(e) => e.value && toggleCapacityVisibility(e.value)}
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
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Legend (Click to toggle visibility)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {allCapacityKeys.map((capacityKey, index) => {
                    const isVisible = visibleCapacities.has(capacityKey);
                    return (
                      <button
                        key={capacityKey}
                        onClick={() => toggleCapacityVisibility(capacityKey)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                          isVisible
                            ? 'bg-white border-gray-300 shadow-sm'
                            : 'bg-gray-100 border-gray-200 opacity-50'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full ${!isVisible ? 'opacity-40' : ''}`}
                          style={{ backgroundColor: getCapacityColor(capacityKey, index) }}
                        />
                        <span className={`text-xs font-medium truncate ${isVisible ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                          {capacityKey}
                        </span>
                        {!isVisible && (
                          <span className="text-[10px] text-gray-400 ml-auto">(hidden)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {allCapacityKeys.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No capacities to display. Select a location and sublocation with capacity configured.
                  </div>
                )}
              </div>
            </div>

            {/* Allocation Categories */}
            {allocationData && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Allocation Categories</h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Transient */}
                  <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-4 border border-teal-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-teal-500" />
                      <span className="text-sm font-semibold text-teal-700">Transient</span>
                    </div>
                    <div className="text-2xl font-bold text-teal-600">{allocationData.allocated.transient}</div>
                    <div className="text-xs text-teal-600">{allocationData.percentages.transient}% of total</div>
                    <div className="text-xs text-gray-500 mt-1">Walk-in capacity</div>
                  </div>

                  {/* Events */}
                  <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg p-4 border border-pink-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-pink-500" />
                      <span className="text-sm font-semibold text-pink-700">Events</span>
                    </div>
                    <div className="text-2xl font-bold text-pink-600">{allocationData.allocated.events}</div>
                    <div className="text-xs text-pink-600">{allocationData.percentages.events}% of total</div>
                    <div className="text-xs text-gray-500 mt-1">Event bookings</div>
                  </div>

                  {/* Reserved */}
                  <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-lg p-4 border border-violet-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-violet-500" />
                      <span className="text-sm font-semibold text-violet-700">Reserved</span>
                    </div>
                    <div className="text-2xl font-bold text-violet-600">{allocationData.allocated.reserved}</div>
                    <div className="text-xs text-violet-600">{allocationData.percentages.reserved}% of total</div>
                    <div className="text-xs text-gray-500 mt-1">Pre-reserved slots</div>
                  </div>

                  {/* Unavailable */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">Unavailable</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-500">{allocationData.unallocated.unavailable}</div>
                    <div className="text-xs text-gray-500">{allocationData.percentages.unavailable}% of total</div>
                    <div className="text-xs text-gray-500 mt-1">Closed/Blackout</div>
                  </div>

                  {/* Ready To Use */}
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-sm font-semibold text-amber-700">Ready To Use</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-600">{allocationData.unallocated.readyToUse}</div>
                    <div className="text-xs text-amber-600">{allocationData.percentages.readyToUse}% of total</div>
                    <div className="text-xs text-gray-500 mt-1">Available capacity</div>
                  </div>
                </div>

                {/* Summary row */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                  <div className="flex gap-6">
                    <div>
                      <span className="text-sm text-gray-600">Total Allocated: </span>
                      <span className="font-bold text-teal-600">{allocationData.allocated.total}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Total Unallocated: </span>
                      <span className="font-bold text-amber-600">{allocationData.unallocated.total}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Total Capacity: </span>
                    <span className="font-bold text-gray-900">{allocationData.totalCapacity}</span>
                  </div>
                </div>
              </div>
            )}

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
