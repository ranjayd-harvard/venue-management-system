'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Clock, 
  DollarSign, 
  Zap,
  Award,
  Building2,
  MapPin,
  ChevronDown,
  ChevronRight,
  Filter,
  Layers,
  RefreshCw,
  Calendar
} from 'lucide-react';

interface TimeWindow {
  startTime: string;
  endTime: string;
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
  applyTo: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
  customerId?: string;
  locationId?: string;
  subLocationId?: string;
  customer?: { _id: string; name: string };
  location?: { _id: string; name: string };
  sublocation?: { _id: string; label: string };
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
  pricingEnabled?: boolean;
  isActive?: boolean;
}

interface Customer {
  _id: string;
  name: string;
  defaultHourlyRate?: number;
}

interface TimeSlot {
  hour: number;
  label: string;
  date: Date;
  winningPrice?: number;
  winningRatesheet?: Ratesheet;
  isDefaultRate?: boolean;
  defaultType?: 'SUBLOCATION' | 'LOCATION' | 'CUSTOMER';
}

interface SubLocationWithPricing {
  sublocation: SubLocation;
  location: Location;
  customer: Customer | null;
  ratesheets: Ratesheet[];
  timeSlots: TimeSlot[];
}

// Color palette for locations - vibrant and distinct
const LOCATION_COLORS = [
  { bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', gradient: 'from-blue-500 to-blue-600' },
  { bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', gradient: 'from-emerald-500 to-emerald-600' },
  { bg: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', gradient: 'from-purple-500 to-purple-600' },
  { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', gradient: 'from-amber-500 to-amber-600' },
  { bg: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300', gradient: 'from-rose-500 to-rose-600' },
  { bg: 'bg-cyan-500', light: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300', gradient: 'from-cyan-500 to-cyan-600' },
  { bg: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300', gradient: 'from-indigo-500 to-indigo-600' },
  { bg: 'bg-teal-500', light: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300', gradient: 'from-teal-500 to-teal-600' },
  { bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', gradient: 'from-orange-500 to-orange-600' },
  { bg: 'bg-pink-500', light: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300', gradient: 'from-pink-500 to-pink-600' },
];

export default function TimelineAllSublocationsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPricing, setLoadingPricing] = useState(false);
  
  // Filters
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [showOnlyPricingEnabled, setShowOnlyPricingEnabled] = useState(true);
  
  // Date range
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [hoursToShow, setHoursToShow] = useState<number>(24);
  
  // Pricing data per sublocation
  const [sublocationPricing, setSublocationPricing] = useState<Map<string, SubLocationWithPricing>>(new Map());
  
  // Expanded locations
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  
  // Location color mapping
  const locationColorMap = useRef(new Map<string, typeof LOCATION_COLORS[0]>()).current;

  const getLocationColor = (locationId: string) => {
    if (!locationColorMap.has(locationId)) {
      const index = locationColorMap.size % LOCATION_COLORS.length;
      locationColorMap.set(locationId, LOCATION_COLORS[index]);
    }
    return locationColorMap.get(locationId)!;
  };

  // Fetch initial data
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch pricing when filters or date change
  useEffect(() => {
    if (sublocations.length > 0) {
      fetchAllPricing();
    }
  }, [sublocations, viewDate, hoursToShow, selectedCustomer, selectedLocations, showOnlyPricingEnabled]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch customers
      const customersRes = await fetch('/api/customers');
      const customersData = await customersRes.json();
      setCustomers(customersData);

      // Fetch all locations
      const locationsRes = await fetch('/api/locations');
      const locationsData = await locationsRes.json();
      setLocations(locationsData);

      // Fetch all sublocations
      const sublocationsRes = await fetch('/api/sublocations');
      const sublocationsData = await sublocationsRes.json();
      setSublocations(sublocationsData);

      // Expand all locations by default
      setExpandedLocations(new Set(locationsData.map((l: Location) => l._id)));
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPricing = async () => {
    setLoadingPricing(true);
    const newPricingMap = new Map<string, SubLocationWithPricing>();

    // Filter sublocations based on selections
    let filteredSublocations = sublocations;

    if (showOnlyPricingEnabled) {
      filteredSublocations = filteredSublocations.filter(sl => sl.pricingEnabled && sl.isActive !== false);
    }

    if (selectedCustomer) {
      const customerLocationIds = locations
        .filter(l => l.customerId === selectedCustomer)
        .map(l => l._id);
      filteredSublocations = filteredSublocations.filter(sl => 
        customerLocationIds.includes(sl.locationId)
      );
    }

    if (selectedLocations.size > 0) {
      filteredSublocations = filteredSublocations.filter(sl => 
        selectedLocations.has(sl.locationId)
      );
    }

    // Format dates
    const startStr = viewDate.toISOString().split('T')[0];
    const endDate = new Date(viewDate);
    endDate.setHours(endDate.getHours() + hoursToShow);
    const endStr = endDate.toISOString().split('T')[0];

    // Fetch pricing for each sublocation
    await Promise.all(
      filteredSublocations.map(async (sublocation) => {
        try {
          const location = locations.find(l => l._id === sublocation.locationId);
          if (!location) return;

          const customer = customers.find(c => c._id === location.customerId) || null;

          // Fetch ratesheets for this sublocation
          const url = new URL('/api/ratesheets', window.location.origin);
          url.searchParams.set('subLocationId', sublocation._id);
          url.searchParams.set('startDate', startStr);
          url.searchParams.set('endDate', endStr);
          url.searchParams.set('resolveHierarchy', 'true');

          const response = await fetch(url.toString());
          const ratesheets = await response.json();

          // Calculate time slots
          const timeSlots = calculateTimeSlots(
            sublocation,
            location,
            customer,
            ratesheets.filter((rs: Ratesheet) => rs.isActive !== false)
          );

          newPricingMap.set(sublocation._id, {
            sublocation,
            location,
            customer,
            ratesheets: ratesheets.filter((rs: Ratesheet) => rs.isActive !== false),
            timeSlots
          });
        } catch (error) {
          console.error(`Failed to fetch pricing for ${sublocation.label}:`, error);
        }
      })
    );

    setSublocationPricing(newPricingMap);
    setLoadingPricing(false);
  };

  const calculateTimeSlots = (
    sublocation: SubLocation,
    location: Location,
    customer: Customer | null,
    ratesheets: Ratesheet[]
  ): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const currentTime = new Date(viewDate);
    const endTime = new Date(viewDate);
    endTime.setHours(endTime.getHours() + hoursToShow);

    // Sort ratesheets by priority (highest first)
    const sortedRatesheets = [...ratesheets].sort((a, b) => b.priority - a.priority);

    while (currentTime < endTime) {
      const hour = currentTime.getHours();
      const timeStr = `${hour.toString().padStart(2, '0')}:00`;

      // Filter ratesheets active for this specific datetime
      const activeRatesheets = sortedRatesheets.filter(rs => {
        const effectiveFrom = new Date(rs.effectiveFrom);
        const effectiveTo = rs.effectiveTo ? new Date(rs.effectiveTo) : null;
        return effectiveFrom <= currentTime && (!effectiveTo || effectiveTo >= currentTime);
      });

      // Find winning ratesheet with matching time window
      let winner: { ratesheet: Ratesheet; price: number } | undefined;
      
      for (const rs of activeRatesheets) {
        if (rs.timeWindows && rs.timeWindows.length > 0) {
          const matchingWindow = rs.timeWindows.find(tw => 
            timeStr >= tw.startTime && timeStr < tw.endTime
          );
          if (matchingWindow) {
            winner = { ratesheet: rs, price: matchingWindow.pricePerHour };
            break;
          }
        }
      }

      let winningPrice = winner?.price;
      let isDefaultRate = false;
      let defaultType: 'SUBLOCATION' | 'LOCATION' | 'CUSTOMER' | undefined;

      // Fall back to defaults if no ratesheet matches
      if (!winner) {
        if (sublocation.defaultHourlyRate && sublocation.defaultHourlyRate > 0) {
          winningPrice = sublocation.defaultHourlyRate;
          isDefaultRate = true;
          defaultType = 'SUBLOCATION';
        } else if (location.defaultHourlyRate && location.defaultHourlyRate > 0) {
          winningPrice = location.defaultHourlyRate;
          isDefaultRate = true;
          defaultType = 'LOCATION';
        } else if (customer?.defaultHourlyRate && customer.defaultHourlyRate > 0) {
          winningPrice = customer.defaultHourlyRate;
          isDefaultRate = true;
          defaultType = 'CUSTOMER';
        }
      }

      slots.push({
        hour,
        label: formatHour(hour),
        date: new Date(currentTime),
        winningPrice,
        winningRatesheet: winner?.ratesheet,
        isDefaultRate,
        defaultType
      });

      currentTime.setHours(currentTime.getHours() + 1);
    }

    return slots;
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12A';
    if (hour === 12) return '12P';
    if (hour < 12) return `${hour}A`;
    return `${hour - 12}P`;
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

  const setQuickRange = (hours: number) => {
    setViewDate(new Date());
    setHoursToShow(hours);
  };

  const toggleLocationExpand = (locationId: string) => {
    const newExpanded = new Set(expandedLocations);
    if (newExpanded.has(locationId)) {
      newExpanded.delete(locationId);
    } else {
      newExpanded.add(locationId);
    }
    setExpandedLocations(newExpanded);
  };

  const toggleLocationFilter = (locationId: string) => {
    const newSelected = new Set(selectedLocations);
    if (newSelected.has(locationId)) {
      newSelected.delete(locationId);
    } else {
      newSelected.add(locationId);
    }
    setSelectedLocations(newSelected);
  };

  // Group sublocations by location
  const groupedSublocations = useMemo(() => {
    const groups = new Map<string, SubLocationWithPricing[]>();
    
    sublocationPricing.forEach((pricing) => {
      const locationId = pricing.location._id;
      if (!groups.has(locationId)) {
        groups.set(locationId, []);
      }
      groups.get(locationId)!.push(pricing);
    });

    // Sort sublocations within each group by label
    groups.forEach((sublocations, locationId) => {
      sublocations.sort((a, b) => a.sublocation.label.localeCompare(b.sublocation.label));
    });

    return groups;
  }, [sublocationPricing]);

  // Get filtered locations (only those with sublocations in the pricing map)
  const filteredLocations = useMemo(() => {
    return locations.filter(loc => groupedSublocations.has(loc._id));
  }, [locations, groupedSublocations]);

  // Calculate statistics
  const stats = useMemo(() => {
    let totalSublocations = 0;
    let totalRatesheets = 0;
    let uniqueRatesheetIds = new Set<string>();
    let peakRate = 0;
    let avgRate = 0;
    let rateCount = 0;

    sublocationPricing.forEach((pricing) => {
      totalSublocations++;
      pricing.ratesheets.forEach(rs => {
        uniqueRatesheetIds.add(rs._id);
        rs.timeWindows?.forEach(tw => {
          if (tw.pricePerHour > peakRate) peakRate = tw.pricePerHour;
          avgRate += tw.pricePerHour;
          rateCount++;
        });
      });
    });

    return {
      totalSublocations,
      totalLocations: groupedSublocations.size,
      totalRatesheets: uniqueRatesheetIds.size,
      peakRate,
      avgRate: rateCount > 0 ? Math.round(avgRate / rateCount) : 0
    };
  }, [sublocationPricing, groupedSublocations]);

  // Generate time header labels
  const timeHeaders = useMemo(() => {
    const headers: { label: string; date: Date }[] = [];
    const currentTime = new Date(viewDate);
    
    for (let i = 0; i < hoursToShow; i++) {
      headers.push({
        label: formatHour(currentTime.getHours()),
        date: new Date(currentTime)
      });
      currentTime.setHours(currentTime.getHours() + 1);
    }
    
    return headers;
  }, [viewDate, hoursToShow]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading all sublocations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            All Sublocations Timeline
          </h1>
          <p className="text-gray-600">
            Compare pricing across all sublocations at once • Color-coded by location
          </p>
        </div>

        {/* Filters & Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Customer Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Filter by Customer
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              >
                <option value="">All Customers</option>
                {customers.map((cust) => (
                  <option key={cust._id} value={cust._id}>
                    {cust.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Start Date & Time
              </label>
              <input
                type="datetime-local"
                value={viewDate.toISOString().slice(0, 16)}
                onChange={(e) => setViewDate(new Date(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
            </div>

            {/* Quick Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Time Range
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setQuickRange(12)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                    hoursToShow === 12 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  12h
                </button>
                <button
                  onClick={() => setQuickRange(24)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                    hoursToShow === 24 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  24h
                </button>
                <button
                  onClick={() => setQuickRange(48)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                    hoursToShow === 48 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  48h
                </button>
              </div>
            </div>

            {/* Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Options
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyPricingEnabled}
                    onChange={(e) => setShowOnlyPricingEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Pricing enabled only</span>
                </label>
                <button
                  onClick={fetchAllPricing}
                  disabled={loadingPricing}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingPricing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Location Color Legend */}
          {filteredLocations.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Layers className="w-4 h-4 inline mr-1" />
                Locations ({filteredLocations.length})
                <span className="text-xs font-normal text-gray-500 ml-2">Click to filter</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {filteredLocations.map((loc) => {
                  const color = getLocationColor(loc._id);
                  const isSelected = selectedLocations.size === 0 || selectedLocations.has(loc._id);
                  const sublocationCount = groupedSublocations.get(loc._id)?.length || 0;
                  
                  return (
                    <button
                      key={loc._id}
                      onClick={() => toggleLocationFilter(loc._id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 border-2 ${
                        isSelected 
                          ? `${color.light} ${color.text} ${color.border}` 
                          : 'bg-gray-100 text-gray-400 border-gray-200'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${color.bg}`}></span>
                      {loc.name}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${isSelected ? color.bg + ' text-white' : 'bg-gray-300 text-gray-600'}`}>
                        {sublocationCount}
                      </span>
                    </button>
                  );
                })}
                {selectedLocations.size > 0 && (
                  <button
                    onClick={() => setSelectedLocations(new Set())}
                    className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Locations</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalLocations}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">SubLocations</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalSublocations}</p>
              </div>
              <MapPin className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Ratesheets</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalRatesheets}</p>
              </div>
              <Zap className="w-8 h-8 text-amber-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Peak Rate</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">${stats.peakRate}</p>
              </div>
              <Award className="w-8 h-8 text-rose-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Rate</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">${stats.avgRate}</p>
              </div>
              <DollarSign className="w-8 h-8 text-emerald-500" />
            </div>
          </div>
        </div>

        {/* Loading indicator for pricing */}
        {loadingPricing && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600"></div>
            <span className="text-blue-700 font-medium">Loading pricing data for all sublocations...</span>
          </div>
        )}

        {/* Timeline Grid */}
        {!loadingPricing && sublocationPricing.size > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Time Header */}
            <div className="sticky top-0 z-20 bg-gray-50 border-b-2 border-gray-200">
              <div className="flex">
                {/* Location/SubLocation column header */}
                <div className="w-64 min-w-64 px-4 py-3 font-semibold text-gray-700 border-r border-gray-200 bg-gray-100">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location / SubLocation
                  </div>
                </div>
                {/* Time column headers */}
                <div className="flex-1 overflow-x-auto">
                  <div className="flex">
                    {timeHeaders.map((header, idx) => (
                      <div
                        key={idx}
                        className="w-14 min-w-14 px-1 py-3 text-center text-xs font-medium text-gray-600 border-r border-gray-100"
                        title={header.date.toLocaleString()}
                      >
                        {header.label}
                        {header.date.getHours() === 0 && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {header.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Location Groups */}
            <div className="divide-y divide-gray-100">
              {filteredLocations.map((location) => {
                const color = getLocationColor(location._id);
                const isExpanded = expandedLocations.has(location._id);
                const locationSublocations = groupedSublocations.get(location._id) || [];
                
                // Skip if filtered out
                if (selectedLocations.size > 0 && !selectedLocations.has(location._id)) {
                  return null;
                }

                return (
                  <div key={location._id}>
                    {/* Location Header Row */}
                    <div 
                      className={`flex cursor-pointer hover:bg-gray-50 transition-colors ${color.light}`}
                      onClick={() => toggleLocationExpand(location._id)}
                    >
                      <div className={`w-64 min-w-64 px-4 py-3 border-r ${color.border} flex items-center gap-2`}>
                        <div className={`w-4 h-4 rounded ${color.bg}`}></div>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                        <span className={`font-semibold ${color.text}`}>{location.name}</span>
                        <span className="text-xs text-gray-500 ml-auto">
                          {locationSublocations.length} subloc
                        </span>
                      </div>
                      <div className="flex-1 overflow-x-auto">
                        <div className="flex h-full items-center">
                          {/* Show aggregated view when collapsed */}
                          {!isExpanded && locationSublocations.length > 0 && (
                            <div className="flex items-center px-4 text-sm text-gray-500">
                              <span>Click to expand {locationSublocations.length} sublocations</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SubLocation Rows */}
                    {isExpanded && locationSublocations.map((pricingData) => (
                      <div key={pricingData.sublocation._id} className="flex hover:bg-gray-50 transition-colors">
                        {/* SubLocation Label */}
                        <div className={`w-64 min-w-64 px-4 py-2 border-r border-gray-200 flex items-center gap-2 ${color.light} bg-opacity-30`}>
                          <div className="w-4"></div> {/* Spacer for indent */}
                          <MapPin className={`w-3 h-3 ${color.text}`} />
                          <span className="text-sm font-medium text-gray-700 truncate" title={pricingData.sublocation.label}>
                            {pricingData.sublocation.label}
                          </span>
                          {pricingData.ratesheets.length > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${color.bg} text-white ml-auto`}>
                              {pricingData.ratesheets.length}
                            </span>
                          )}
                        </div>

                        {/* Time Slots */}
                        <div className="flex-1 overflow-x-auto">
                          <div className="flex">
                            {pricingData.timeSlots.map((slot, idx) => (
                              <div
                                key={idx}
                                className="w-14 min-w-14 h-12 border-r border-gray-100 relative group"
                                title={`${slot.date.toLocaleString()}: $${slot.winningPrice || 0}/hr`}
                              >
                                <div
                                  className={`absolute inset-1 rounded flex flex-col items-center justify-center text-white text-xs font-medium transition-transform group-hover:scale-105 ${
                                    slot.winningRatesheet
                                      ? `bg-gradient-to-br ${color.gradient}`
                                      : slot.isDefaultRate
                                      ? slot.defaultType === 'SUBLOCATION'
                                        ? 'bg-gradient-to-br from-purple-400 to-purple-500'
                                        : slot.defaultType === 'LOCATION'
                                        ? 'bg-gradient-to-br from-emerald-400 to-emerald-500'
                                        : 'bg-gradient-to-br from-blue-400 to-blue-500'
                                      : 'bg-gray-200 text-gray-500'
                                  }`}
                                >
                                  {slot.winningPrice ? (
                                    <>
                                      <span className="font-bold">${slot.winningPrice}</span>
                                      {slot.isDefaultRate && (
                                        <span className="text-[8px] opacity-75">
                                          {slot.defaultType?.slice(0, 3)}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-[10px]">-</span>
                                  )}
                                </div>

                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                                  <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-xl">
                                    <div className="text-gray-400 text-[10px] mb-1">
                                      {slot.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} {slot.label}
                                    </div>
                                    {slot.winningRatesheet ? (
                                      <>
                                        <div className="font-semibold">{slot.winningRatesheet.name}</div>
                                        <div className="text-gray-300">Level: {slot.winningRatesheet.applyTo}</div>
                                        <div className="text-green-400">${slot.winningPrice}/hr</div>
                                      </>
                                    ) : slot.isDefaultRate ? (
                                      <>
                                        <div className="font-semibold">{slot.defaultType} Default</div>
                                        <div className="text-green-400">${slot.winningPrice}/hr</div>
                                      </>
                                    ) : (
                                      <div className="text-gray-400">No rate configured</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loadingPricing && sublocationPricing.size === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Sublocations Found</h3>
            <p className="text-gray-500 mb-4">
              {showOnlyPricingEnabled 
                ? 'No pricing-enabled sublocations match your filters.' 
                : 'No sublocations match your current filters.'}
            </p>
            <button
              onClick={() => {
                setSelectedCustomer('');
                setSelectedLocations(new Set());
                setShowOnlyPricingEnabled(false);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Legend</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-6 rounded bg-gradient-to-br from-blue-500 to-blue-600"></div>
              <span className="text-gray-600">Ratesheet (color = location)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-6 rounded bg-gradient-to-br from-purple-400 to-purple-500"></div>
              <span className="text-gray-600">SubLocation Default</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-6 rounded bg-gradient-to-br from-emerald-400 to-emerald-500"></div>
              <span className="text-gray-600">Location Default</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-6 rounded bg-gradient-to-br from-blue-400 to-blue-500"></div>
              <span className="text-gray-600">Customer Default</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-6 rounded bg-gray-200"></div>
              <span className="text-gray-600">No Rate</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
