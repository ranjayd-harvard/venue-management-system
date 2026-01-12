'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp,
  Zap,
  Award,
  Info,
  Building2,
  MapPin
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
  layer: string;
  entityId: string;
}

interface Location {
  _id: string;
  name: string;
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

interface PricingItem {
  id: string;
  name: string;
  type: 'RATESHEET' | 'SUBLOCATION_DEFAULT' | 'LOCATION_DEFAULT' | 'CUSTOMER_DEFAULT';
  priority: number;
  rate?: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  timeWindows?: TimeWindow[];
  layer?: string;
  icon: React.ReactNode;
}

interface TimeSlot {
  hour: number;
  label: string;
  date: Date;
  ratesheets: Array<{
    ratesheet: Ratesheet;
    price: number;
    isActive: boolean;
  }>;
  winningRatesheet?: Ratesheet;
  winningPrice?: number;
  isDefaultRate?: boolean;
  defaultType?: 'SUBLOCATION' | 'LOCATION' | 'CUSTOMER';
}

export default function TimelineViewPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [ratesheets, setRatesheets] = useState<Ratesheet[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Date-time range for the slider
  const [rangeStart, setRangeStart] = useState<Date>(new Date());
  const [rangeEnd, setRangeEnd] = useState<Date>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  
  // Currently viewing window within the range
  const [viewStart, setViewStart] = useState<Date>(new Date());
  const [viewEnd, setViewEnd] = useState<Date>(new Date(Date.now() + 24 * 60 * 60 * 1000));
  
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [subLocationRate, setSubLocationRate] = useState<number>(0);
  const [locationRate, setLocationRate] = useState<number>(0);
  const [customerRate, setCustomerRate] = useState<number>(0);

  // Drag state for better handle control
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);

  // Unique colors per ratesheet
  const ratesheetColors = useRef(new Map<string, string>()).current;
  const colorPalette = [
    'from-purple-500 to-purple-600',
    'from-blue-500 to-blue-600',
    'from-pink-500 to-pink-600',
    'from-emerald-500 to-emerald-600',
    'from-amber-500 to-amber-600',
    'from-teal-500 to-teal-600',
    'from-rose-500 to-rose-600',
    'from-indigo-500 to-indigo-600',
    'from-cyan-500 to-cyan-600',
    'from-orange-500 to-orange-600',
  ];

  const getRatesheetColor = (ratesheetId: string): string => {
    if (!ratesheetColors.has(ratesheetId)) {
      const index = ratesheetColors.size % colorPalette.length;
      ratesheetColors.set(ratesheetId, colorPalette[index]);
    }
    return ratesheetColors.get(ratesheetId)!;
  };

  const getPriorityBadgeColor = (priority: number): string => {
    if (priority >= 50) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (priority >= 30) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (priority >= 20) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      fetchSubLocations(selectedLocation);
      const loc = locations.find(l => l._id === selectedLocation);
      setLocationRate(loc?.defaultHourlyRate || 0);
    } else {
      setSublocations([]);
      setSelectedSubLocation('');
      setLocationRate(0);
    }
  }, [selectedLocation, locations]);

  useEffect(() => {
    if (selectedSubLocation) {
      const startStr = rangeStart.toISOString().split('T')[0];
      const endStr = rangeEnd.toISOString().split('T')[0];
      fetchRatesheets(selectedSubLocation, startStr, endStr);
      fetchSubLocationDetails(selectedSubLocation);
    } else {
      setRatesheets([]);
      setSubLocationRate(0);
    }
  }, [selectedSubLocation, rangeStart, rangeEnd]);

  useEffect(() => {
    if (ratesheets.length > 0 || subLocationRate > 0 || locationRate > 0 || customerRate > 0) {
      calculateTimeSlots();
    }
  }, [ratesheets, viewStart, viewEnd, subLocationRate, locationRate, customerRate]);

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

  const fetchSubLocationDetails = async (subLocationId: string) => {
    try {
      const subloc = sublocations.find(s => s._id === subLocationId);
      if (subloc?.defaultHourlyRate) {
        setSubLocationRate(subloc.defaultHourlyRate);
      } else {
        const response = await fetch(`/api/sublocations/${subLocationId}`);
        const data = await response.json();
        setSubLocationRate(data.defaultHourlyRate || 0);
      }
    } catch (error) {
      console.error('Failed to fetch sublocation details:', error);
    }
  };

  const fetchRatesheets = async (subLocationId: string, start: string, end: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ratesheets?subLocationId=${subLocationId}&startDate=${start}&endDate=${end}`);
      const data = await response.json();
      
      const activeRatesheets = data.filter((rs: any) => 
        rs.isActive && (rs.approvalStatus === 'APPROVED' || rs.status === 'APPROVED')
      );
      
      setRatesheets(activeRatesheets.sort((a: Ratesheet, b: Ratesheet) => b.priority - a.priority));
    } catch (error) {
      console.error('Failed to fetch ratesheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeSlots = () => {
    const slots: TimeSlot[] = [];
    const currentTime = new Date(viewStart);
    const endTime = new Date(viewEnd);

    while (currentTime < endTime) {
      const nextHour = new Date(currentTime);
      nextHour.setHours(currentTime.getHours() + 1);

      const hour = currentTime.getHours();
      const timeStr = `${hour.toString().padStart(2, '0')}:00`;
      
      // Filter ratesheets active for this specific datetime
      const activeRatesheets = ratesheets.filter(rs => {
        const effectiveFrom = new Date(rs.effectiveFrom);
        const effectiveTo = rs.effectiveTo ? new Date(rs.effectiveTo) : null;
        
        return effectiveFrom <= currentTime && (!effectiveTo || effectiveTo >= currentTime);
      });
      
      const candidateRatesheets = activeRatesheets
        .map(rs => {
          if (rs.timeWindows) {
            const matchingWindow = rs.timeWindows.find(tw => 
              timeInWindow(timeStr, tw.startTime, tw.endTime)
            );
            if (matchingWindow) {
              return {
                ratesheet: rs,
                price: matchingWindow.pricePerHour,
                isActive: true
              };
            }
          }
          return null;
        })
        .filter(Boolean) as Array<{ ratesheet: Ratesheet; price: number; isActive: boolean }>;

      const winner = candidateRatesheets.length > 0 ? candidateRatesheets[0] : undefined;
      
      let winningPrice = winner?.price;
      let isDefaultRate = false;
      let defaultType: 'SUBLOCATION' | 'LOCATION' | 'CUSTOMER' | undefined;
      
      // Priority order: Ratesheet > SubLocation Default > Location Default > Customer Default
      if (!winner) {
        if (subLocationRate > 0) {
          winningPrice = subLocationRate;
          isDefaultRate = true;
          defaultType = 'SUBLOCATION';
        } else if (locationRate > 0) {
          winningPrice = locationRate;
          isDefaultRate = true;
          defaultType = 'LOCATION';
        } else if (customerRate > 0) {
          winningPrice = customerRate;
          isDefaultRate = true;
          defaultType = 'CUSTOMER';
        }
      }

      slots.push({
        hour,
        label: formatHour(hour),
        date: new Date(currentTime),
        ratesheets: candidateRatesheets,
        winningRatesheet: winner?.ratesheet,
        winningPrice,
        isDefaultRate,
        defaultType
      });

      currentTime.setHours(currentTime.getHours() + 1);
    }

    setTimeSlots(slots);
  };

  const getPricingItems = (): PricingItem[] => {
    const items: PricingItem[] = [];

    // Add ratesheets
    ratesheets.forEach((rs, index) => {
      items.push({
        id: rs._id,
        name: rs.name,
        type: 'RATESHEET',
        priority: rs.priority,
        effectiveFrom: rs.effectiveFrom,
        effectiveTo: rs.effectiveTo,
        timeWindows: rs.timeWindows,
        layer: rs.layer,
        icon: <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getRatesheetColor(rs._id)} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
          #{index + 1}
        </div>
      });
    });

    // Add sublocation default (priority 5)
    if (subLocationRate > 0) {
      const subloc = sublocations.find(s => s._id === selectedSubLocation);
      items.push({
        id: 'sublocation-default',
        name: `${subloc?.label || 'SubLocation'} Default Rate`,
        type: 'SUBLOCATION_DEFAULT',
        priority: 5,
        rate: subLocationRate,
        icon: <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white shadow-md">
          <MapPin className="w-5 h-5" />
        </div>
      });
    }

    // Add location default (priority 3)
    if (locationRate > 0) {
      const loc = locations.find(l => l._id === selectedLocation);
      items.push({
        id: 'location-default',
        name: `${loc?.name || 'Location'} Default Rate`,
        type: 'LOCATION_DEFAULT',
        priority: 3,
        rate: locationRate,
        icon: <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center text-white shadow-md">
          <Building2 className="w-5 h-5" />
        </div>
      });
    }

    // Add customer default (priority 1)
    if (customerRate > 0) {
      items.push({
        id: 'customer-default',
        name: 'Customer Default Rate',
        type: 'CUSTOMER_DEFAULT',
        priority: 1,
        rate: customerRate,
        icon: <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white shadow-md">
          <DollarSign className="w-5 h-5" />
        </div>
      });
    }

    // Sort by priority (highest first)
    return items.sort((a, b) => b.priority - a.priority);
  };

  const timeInWindow = (time: string, start: string, end: string): boolean => {
    return time >= start && time < end;
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
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

  const formatDateShort = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const setQuickRange = (days: number) => {
    const start = new Date();
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    setRangeStart(start);
    setRangeEnd(end);
    setViewStart(start);
    setViewEnd(new Date(start.getTime() + 24 * 60 * 60 * 1000));
  };

  const getTotalHours = (): number => {
    return Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60));
  };

  const getViewWindowPosition = (): { left: number; width: number } => {
    const totalMs = rangeEnd.getTime() - rangeStart.getTime();
    const viewStartMs = viewStart.getTime() - rangeStart.getTime();
    const viewWidthMs = viewEnd.getTime() - viewStart.getTime();
    
    return {
      left: (viewStartMs / totalMs) * 100,
      width: (viewWidthMs / totalMs) * 100
    };
  };

  const handleStartDrag = (position: number) => {
    const totalMs = rangeEnd.getTime() - rangeStart.getTime();
    const newMs = rangeStart.getTime() + (position / 100) * totalMs;
    const newDate = new Date(newMs);
    
    if (newDate < viewEnd) {
      setViewStart(newDate);
    }
  };

  const handleEndDrag = (position: number) => {
    const totalMs = rangeEnd.getTime() - rangeStart.getTime();
    const newMs = rangeStart.getTime() + (position / 100) * totalMs;
    const newDate = new Date(newMs);
    
    if (newDate > viewStart) {
      setViewEnd(newDate);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const getDefaultTypeLabel = (type?: 'SUBLOCATION' | 'LOCATION' | 'CUSTOMER'): string => {
    switch (type) {
      case 'SUBLOCATION': return 'SubLocation Default';
      case 'LOCATION': return 'Location Default';
      case 'CUSTOMER': return 'Customer Default';
      default: return 'Default';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Pricing Timeline
          </h1>
          <p className="text-gray-600">
            Visual timeline showing which ratesheets are active throughout the day
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sub-Location
              </label>
              <select
                value={selectedSubLocation}
                onChange={(e) => setSelectedSubLocation(e.target.value)}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Range
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setQuickRange(1)}
                  className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium"
                >
                  Today
                </button>
                <button
                  onClick={() => setQuickRange(7)}
                  className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium"
                >
                  Week
                </button>
                <button
                  onClick={() => setQuickRange(30)}
                  className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium"
                >
                  Month
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && selectedSubLocation && (
          <>
            {/* Interactive Date-Time Range Slider */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Timeline Range</h2>
                <div className="text-sm text-gray-600">
                  Total: {getTotalHours()} hours ({formatDateShort(rangeStart)} - {formatDateShort(rangeEnd)})
                </div>
              </div>

              <div className="mb-6">
                <div className="text-xs text-gray-500 mb-3 flex justify-between">
                  <span>Viewing: {formatDateTime(viewStart)}</span>
                  <span>to {formatDateTime(viewEnd)}</span>
                </div>
                
                <div className="relative h-20 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-lg px-4 py-6">
                  {/* Background track */}
                  <div className="absolute inset-x-4 top-1/2 transform -translate-y-1/2">
                    <div className="relative w-full h-3 bg-gray-200 rounded-full">
                      {/* Selected view window */}
                      <div
                        className="absolute h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                        style={{
                          left: `${getViewWindowPosition().left}%`,
                          width: `${getViewWindowPosition().width}%`
                        }}
                      />
                    </div>

                    {/* Start handle - separate track for better control */}
                    <div 
                      className="absolute top-0 w-full h-3"
                      style={{ pointerEvents: isDraggingEnd ? 'none' : 'auto' }}
                    >
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={getViewWindowPosition().left}
                        onChange={(e) => handleStartDrag(parseFloat(e.target.value))}
                        onMouseDown={() => setIsDraggingStart(true)}
                        onMouseUp={() => setIsDraggingStart(false)}
                        onTouchStart={() => setIsDraggingStart(true)}
                        onTouchEnd={() => setIsDraggingStart(false)}
                        className="absolute w-full h-3 bg-transparent appearance-none cursor-pointer start-handle"
                        style={{ zIndex: isDraggingStart ? 10 : 4 }}
                        title={`Start: ${formatDateTime(viewStart)}`}
                      />
                    </div>
                    
                    {/* End handle - separate track */}
                    <div 
                      className="absolute top-0 w-full h-3"
                      style={{ pointerEvents: isDraggingStart ? 'none' : 'auto' }}
                    >
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={getViewWindowPosition().left + getViewWindowPosition().width}
                        onChange={(e) => handleEndDrag(parseFloat(e.target.value))}
                        onMouseDown={() => setIsDraggingEnd(true)}
                        onMouseUp={() => setIsDraggingEnd(false)}
                        onTouchStart={() => setIsDraggingEnd(true)}
                        onTouchEnd={() => setIsDraggingEnd(false)}
                        className="absolute w-full h-3 bg-transparent appearance-none cursor-pointer end-handle"
                        style={{ zIndex: isDraggingEnd ? 10 : 4 }}
                        title={`End: ${formatDateTime(viewEnd)}`}
                      />
                    </div>
                  </div>

                  {/* Time markers */}
                  <div className="absolute inset-x-4 bottom-1 flex justify-between text-[10px] text-gray-500">
                    <span>{formatDateShort(rangeStart)}</span>
                    <span>{formatDateShort(new Date((rangeStart.getTime() + rangeEnd.getTime()) / 2))}</span>
                    <span>{formatDateShort(rangeEnd)}</span>
                  </div>
                </div>

                <div className="text-xs text-gray-500 mt-2 text-center">
                  💡 Tip: Drag the blue handles to adjust viewing window
                </div>
              </div>

              {/* Hourly Rate Display */}
              <div className="grid grid-cols-12 gap-1">
                {timeSlots.map((slot, idx) => (
                  <div
                    key={`${slot.date.getTime()}-${idx}`}
                    className="relative group"
                  >
                    <div
                      className={`h-24 rounded-lg border-2 transition-all ${
                        slot.winningRatesheet
                          ? `bg-gradient-to-br ${getRatesheetColor(slot.winningRatesheet._id)} border-white shadow-md`
                          : slot.isDefaultRate && slot.defaultType === 'SUBLOCATION'
                          ? 'bg-gradient-to-br from-blue-400 to-blue-500 border-white shadow-sm'
                          : slot.isDefaultRate && slot.defaultType === 'LOCATION'
                          ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 border-white shadow-sm'
                          : slot.isDefaultRate && slot.defaultType === 'CUSTOMER'
                          ? 'bg-gradient-to-br from-gray-400 to-gray-500 border-white shadow-sm'
                          : 'bg-gray-100 border-gray-200'
                      }`}
                    >
                      {slot.winningPrice && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                          <span className="text-xs font-bold">${slot.winningPrice}</span>
                          <span className="text-[10px] opacity-90">/ hr</span>
                          {slot.isDefaultRate && (
                            <span className="text-[8px] opacity-75 mt-0.5">
                              {slot.defaultType === 'SUBLOCATION' ? 'Sub' : slot.defaultType === 'LOCATION' ? 'Loc' : 'Cust'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-center mt-1">
                      <span className="text-[10px] text-gray-600 font-medium">{slot.label}</span>
                    </div>
                    
                    {/* Enhanced Tooltip with date/time */}
                    {(slot.winningRatesheet || slot.isDefaultRate) && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-xl">
                          <div className="text-gray-400 text-[10px] mb-1">
                            {slot.date.toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric' 
                            })} {slot.label}
                          </div>
                          {slot.winningRatesheet ? (
                            <>
                              <div className="font-semibold">{slot.winningRatesheet.name}</div>
                              <div className="text-gray-300">Priority: {slot.winningRatesheet.priority}</div>
                              <div className="text-green-400">${slot.winningPrice}/hr</div>
                            </>
                          ) : (
                            <>
                              <div className="font-semibold">{getDefaultTypeLabel(slot.defaultType)}</div>
                              <div className="text-gray-300">Priority: {slot.defaultType === 'SUBLOCATION' ? 5 : slot.defaultType === 'LOCATION' ? 3 : 1}</div>
                              <div className="text-green-400">${slot.winningPrice}/hr</div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Overview */}
            {(ratesheets.length > 0 || subLocationRate > 0 || locationRate > 0 || customerRate > 0) && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Active Ratesheets</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{ratesheets.length}</p>
                      </div>
                      <Zap className="w-8 h-8 text-blue-500" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Highest Priority</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {ratesheets.length > 0 ? Math.max(...ratesheets.map(rs => rs.priority)) : '-'}
                        </p>
                      </div>
                      <Award className="w-8 h-8 text-purple-500" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Time Windows</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {ratesheets.reduce((sum, rs) => sum + (rs.timeWindows?.length || 0), 0)}
                        </p>
                      </div>
                      <Clock className="w-8 h-8 text-emerald-500" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Peak Rate</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          ${ratesheets.length > 0 ? Math.max(...ratesheets.flatMap(rs => 
                            rs.timeWindows?.map(tw => tw.pricePerHour) || [0]
                          )) : Math.max(subLocationRate, locationRate, customerRate)}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-pink-500" />
                    </div>
                  </div>
                </div>

                {/* Pricing Items (Ratesheets + Default Rates) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">Pricing Rules (Priority Order)</h2>
                    {selectedItems.size > 0 && (
                      <span className="text-sm text-gray-600">
                        {selectedItems.size} selected
                      </span>
                    )}
                  </div>
                  
                  {getPricingItems().map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="p-6">
                        <div className="flex items-center gap-4">
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => toggleItemSelection(item.id)}
                            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          />

                          {/* Icon */}
                          {item.icon}
                          
                          {/* Content */}
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className={`text-xs px-2 py-1 rounded-full border font-semibold ${getPriorityBadgeColor(item.priority)}`}>
                                    Priority: {item.priority}
                                  </span>
                                  {item.type === 'RATESHEET' && (
                                    <span className="text-xs text-gray-500">
                                      {new Date(item.effectiveFrom!).toLocaleDateString()} - {' '}
                                      {item.effectiveTo ? new Date(item.effectiveTo).toLocaleDateString() : 'Ongoing'}
                                    </span>
                                  )}
                                  {item.type !== 'RATESHEET' && (
                                    <span className="text-xs text-gray-500">
                                      Always Active
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  {item.type === 'RATESHEET' ? (
                                    <>
                                      <div className="text-sm text-gray-500">Time Windows</div>
                                      <div className="text-lg font-bold text-gray-900">
                                        {item.timeWindows?.length || 0}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="text-sm text-gray-500">Default Rate</div>
                                      <div className="text-lg font-bold text-green-600">
                                        ${item.rate}/hr
                                      </div>
                                    </>
                                  )}
                                </div>
                                
                                {item.type === 'RATESHEET' && (
                                  expandedItem === item.id ? (
                                    <ChevronUp className="w-5 h-5 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {expandedItem === item.id && item.type === 'RATESHEET' && item.timeWindows && (
                        <div className="border-t border-gray-200 bg-gray-50 p-6">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Time Windows & Rates</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {item.timeWindows.map((tw, idx) => (
                              <div
                                key={idx}
                                className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <Clock className="w-4 h-4 text-gray-400" />
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityBadgeColor(item.priority)}`}>
                                    Window {idx + 1}
                                  </span>
                                </div>
                                <div className="text-sm font-semibold text-gray-900 mb-1">
                                  {tw.startTime} - {tw.endTime}
                                </div>
                                <div className="text-2xl font-bold text-green-600">
                                  ${tw.pricePerHour}
                                  <span className="text-sm text-gray-500 font-normal">/hr</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        input[type="range"].start-handle::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
          cursor: grab;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          position: relative;
          z-index: 10;
        }

        input[type="range"].start-handle:active::-webkit-slider-thumb {
          cursor: grabbing;
          transform: scale(1.1);
        }

        input[type="range"].end-handle::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
          cursor: grab;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          position: relative;
          z-index: 10;
        }

        input[type="range"].end-handle:active::-webkit-slider-thumb {
          cursor: grabbing;
          transform: scale(1.1);
        }
        
        input[type="range"].start-handle::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
          cursor: grab;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        input[type="range"].end-handle::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
          cursor: grab;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        input[type="range"] {
          background: transparent;
        }

        input[type="range"]::-webkit-slider-runnable-track {
          background: transparent;
        }

        input[type="range"]::-moz-range-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}
