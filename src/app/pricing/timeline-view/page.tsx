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
  MapPin,
  User
} from 'lucide-react';
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
  customerId?: string;
  locationId?: string;
  subLocationId?: string;
  eventId?: string;
  // Enriched data from API
  customer?: { _id: string; name: string };
  location?: { _id: string; name: string };
  sublocation?: { _id: string; label: string };
  event?: { _id: string; name: string };
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

interface PricingConfig {
  customerPriorityRange: { min: number; max: number };
  locationPriorityRange: { min: number; max: number };
  sublocationPriorityRange: { min: number; max: number };
  eventPriorityRange?: { min: number; max: number };
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
  applyTo?: string;
  icon: React.ReactNode;
  // For ratesheets, show which level it's from
  levelInfo?: string;
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
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [ratesheets, setRatesheets] = useState<Ratesheet[]>([]);
  const [events, setEvents] = useState<Event[]>([]); // Needed for getActiveRatesheetsForInterval filtering
  const [loading, setLoading] = useState(false);

  // Pricing config for priority ranges
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);

  // Entity data
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentSubLocation, setCurrentSubLocation] = useState<SubLocation | null>(null);
  
  // Date-time range for the slider (7 days past to 30 days future)
  const [rangeStart, setRangeStart] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  });
  const [rangeEnd, setRangeEnd] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now (total 37 day window)
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

  const [selectedDuration, setSelectedDuration] = useState<number>(12); // Duration in hours (default 12h)

  // Booking start time for duration-based window calculations
  const [useDurationContext, setUseDurationContext] = useState<boolean>(false);
  const [bookingStartTime, setBookingStartTime] = useState<Date>(viewStart);

  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

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

  const getPriorityBadgeColor = (priority: number, config: PricingConfig | null): string => {
    if (!config) return 'bg-gray-100 text-gray-700 border-gray-200';

    if (config.eventPriorityRange && priority >= config.eventPriorityRange.min && priority <= config.eventPriorityRange.max) {
      return 'bg-pink-100 text-pink-700 border-pink-200';
    }
    if (priority >= config.sublocationPriorityRange.min && priority <= config.sublocationPriorityRange.max) {
      return 'bg-purple-100 text-purple-700 border-purple-200';
    }
    if (priority >= config.locationPriorityRange.min && priority <= config.locationPriorityRange.max) {
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
    if (priority >= config.customerPriorityRange.min && priority <= config.customerPriorityRange.max) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getApplyToColor = (applyTo: string): string => {
    switch (applyTo) {
      case 'EVENT': return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'SUBLOCATION': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'LOCATION': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CUSTOMER': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  useEffect(() => {
    fetchPricingConfig();
  }, []);

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
      // Load all active events for filtering logic
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
      // Fetch ratesheets whenever sublocation, event, or date range changes
      fetchRatesheets(selectedSubLocation);
    } else {
      setRatesheets([]);
      setCurrentSubLocation(null);
      setEvents([]);
      setSelectedEventId('');
    }
  }, [selectedSubLocation, rangeStart, rangeEnd]);

  // Refetch ratesheets when event selection changes
  useEffect(() => {
    if (selectedSubLocation) {
      fetchRatesheets(selectedSubLocation);
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (currentSubLocation || currentLocation || currentCustomer) {
      calculateTimeSlots();
    }
  }, [ratesheets, viewStart, viewEnd, currentSubLocation, currentLocation, currentCustomer, useDurationContext, bookingStartTime]);

  const fetchPricingConfig = async () => {
    try {
      const response = await fetch('/api/pricing/config');
      const data = await response.json();
      setPricingConfig(data.pricingConfig);
    } catch (error) {
      console.error('Failed to fetch pricing config:', error);
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

  /**
   * FIXED: Fetch ratesheets using the updated API that resolves the full hierarchy
   * This now fetches ratesheets at Customer, Location, SubLocation, AND Event levels
   *
   * AUTOMATIC EVENT DETECTION: Now automatically fetches ratesheets for ALL events
   * that overlap with the timeline view date range, without requiring manual event selection
   */
  const fetchRatesheets = async (subLocationId: string) => {
    setLoading(true);
    try {
      // Format dates for the API
      const startStr = rangeStart.toISOString().split('T')[0];
      const endStr = rangeEnd.toISOString().split('T')[0];

      // Step 1: Find all active events that overlap with the timeline date range
      const eventsResponse = await fetch('/api/events');
      const allEvents = await eventsResponse.json();
      const activeEvents = allEvents.filter((e: Event) => e.isActive);

      // Find events that overlap with timeline range
      const overlappingEvents = activeEvents.filter((event: Event) => {
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);
        // Event overlaps if: event ends after range starts AND event starts before range ends
        return eventEnd >= rangeStart && eventStart <= rangeEnd;
      });

      console.log('[Timeline] Found overlapping events:', {
        total: activeEvents.length,
        overlapping: overlappingEvents.length,
        events: overlappingEvents.map((e: Event) => ({
          name: e.name,
          start: e.startDate,
          end: e.endDate
        }))
      });

      // Step 2: Fetch ratesheets for the hierarchy
      // Use resolveHierarchy=true to get Customer → Location → SubLocation ratesheets
      const url = new URL('/api/ratesheets', window.location.origin);
      url.searchParams.set('subLocationId', subLocationId);
      url.searchParams.set('startDate', startStr);
      url.searchParams.set('endDate', endStr);
      url.searchParams.set('resolveHierarchy', 'true');

      // Step 3: If manual event is selected, only include that event
      // Otherwise, fetch ratesheets for ALL overlapping events
      if (selectedEventId) {
        // Manual selection mode - only fetch selected event
        url.searchParams.set('eventId', selectedEventId);
      } else if (overlappingEvents.length > 0) {
        // Automatic mode - fetch ratesheets for all overlapping events
        // Note: The API currently only supports one eventId at a time
        // So we'll fetch ratesheets without eventId and then fetch event ratesheets separately
      }

      const response = await fetch(url.toString());
      let allRatesheets = await response.json();

      // Step 4: If no manual event selected, fetch ratesheets for ALL overlapping events
      if (!selectedEventId && overlappingEvents.length > 0) {
        // Fetch event ratesheets separately for each overlapping event
        const eventRatesheetPromises = overlappingEvents.map((event: Event) => {
          const eventUrl = new URL('/api/ratesheets', window.location.origin);
          eventUrl.searchParams.set('eventId', event._id);
          eventUrl.searchParams.set('startDate', startStr);
          eventUrl.searchParams.set('endDate', endStr);
          return fetch(eventUrl.toString()).then(res => res.json());
        });

        const eventRatesheetsArrays = await Promise.all(eventRatesheetPromises);
        const eventRatesheets = eventRatesheetsArrays.flat();

        // Merge event ratesheets with hierarchy ratesheets (avoid duplicates)
        const existingIds = new Set(allRatesheets.map((rs: any) => rs._id));
        const newEventRatesheets = eventRatesheets.filter((rs: any) => !existingIds.has(rs._id));
        allRatesheets = [...allRatesheets, ...newEventRatesheets];
      }

      // Filter to only active ratesheets and sort by priority (highest first)
      const activeRatesheets = allRatesheets.filter((rs: any) => rs.isActive);
      setRatesheets(activeRatesheets.sort((a: Ratesheet, b: Ratesheet) => b.priority - a.priority));

      console.log('[Timeline] Loaded ratesheets:', {
        total: allRatesheets.length,
        active: activeRatesheets.length,
        byLevel: {
          customer: activeRatesheets.filter((rs: Ratesheet) => rs.applyTo === 'CUSTOMER').length,
          location: activeRatesheets.filter((rs: Ratesheet) => rs.applyTo === 'LOCATION').length,
          sublocation: activeRatesheets.filter((rs: Ratesheet) => rs.applyTo === 'SUBLOCATION').length,
          event: activeRatesheets.filter((rs: Ratesheet) => rs.applyTo === 'EVENT').length,
        }
      });
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
      
      // Find ratesheets with matching time windows for this hour
      const candidateRatesheets = activeRatesheets
        .map(rs => {
          if (rs.timeWindows && rs.timeWindows.length > 0) {
            const matchingWindow = rs.timeWindows.find(tw => {
              const windowType = tw.windowType || 'ABSOLUTE_TIME';

              if (windowType === 'DURATION_BASED') {
                // Duration-based windows: only show if duration context is enabled
                if (!useDurationContext) {
                  return false; // Skip duration-based windows when context is disabled
                }

                // Calculate minutes from booking start
                const minutesFromStart = Math.floor(
                  (currentTime.getTime() - bookingStartTime.getTime()) / (1000 * 60)
                );
                const startMinute = tw.startMinute ?? 0;
                const endMinute = tw.endMinute ?? 0;

                return minutesFromStart >= startMinute && minutesFromStart < endMinute;
              } else {
                // ABSOLUTE_TIME windows: match against hour time
                if (!tw.startTime || !tw.endTime) {
                  return false; // Invalid window
                }
                return timeInWindow(timeStr, tw.startTime, tw.endTime);
              }
            });

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

      // Winner is the highest priority ratesheet with a matching time window
      const winner = candidateRatesheets.length > 0 ? candidateRatesheets[0] : undefined;
      
      let winningPrice = winner?.price;
      let isDefaultRate = false;
      let defaultType: 'SUBLOCATION' | 'LOCATION' | 'CUSTOMER' | undefined;
      
      // If no ratesheet matches, fall back to default rates
      // Priority: SubLocation > Location > Customer
      if (!winner) {
        if (currentSubLocation?.defaultHourlyRate && currentSubLocation.defaultHourlyRate > 0) {
          winningPrice = currentSubLocation.defaultHourlyRate;
          isDefaultRate = true;
          defaultType = 'SUBLOCATION';
        } else if (currentLocation?.defaultHourlyRate && currentLocation.defaultHourlyRate > 0) {
          winningPrice = currentLocation.defaultHourlyRate;
          isDefaultRate = true;
          defaultType = 'LOCATION';
        } else if (currentCustomer?.defaultHourlyRate && currentCustomer.defaultHourlyRate > 0) {
          winningPrice = currentCustomer.defaultHourlyRate;
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

    // Use only ratesheets active during the selected interval
    const activeRatesheets = getActiveRatesheetsForInterval();

    // Add ratesheets (sorted by priority already)
    activeRatesheets.forEach((rs, index) => {
      // Determine level info string
      let levelInfo = '';
      if (rs.applyTo === 'EVENT' && rs.event) {
        levelInfo = `Event: ${rs.event.name}`;
      } else if (rs.applyTo === 'CUSTOMER' && rs.customer) {
        levelInfo = `Customer: ${rs.customer.name}`;
      } else if (rs.applyTo === 'LOCATION' && rs.location) {
        levelInfo = `Location: ${rs.location.name}`;
      } else if (rs.applyTo === 'SUBLOCATION' && rs.sublocation) {
        levelInfo = `SubLocation: ${rs.sublocation.label}`;
      }

      items.push({
        id: rs._id,
        name: rs.name,
        type: 'RATESHEET',
        priority: rs.priority,
        effectiveFrom: rs.effectiveFrom,
        effectiveTo: rs.effectiveTo,
        timeWindows: rs.timeWindows,
        applyTo: rs.applyTo,
        levelInfo,
        icon: <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getRatesheetColor(rs._id)} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
          #{index + 1}
        </div>
      });
    });

    // Calculate priorities from config (use middle of range)
    const sublocPriority = pricingConfig 
      ? Math.floor((pricingConfig.sublocationPriorityRange.min + pricingConfig.sublocationPriorityRange.max) / 2)
      : 300;
    const locPriority = pricingConfig
      ? Math.floor((pricingConfig.locationPriorityRange.min + pricingConfig.locationPriorityRange.max) / 2)
      : 200;
    const custPriority = pricingConfig
      ? Math.floor((pricingConfig.customerPriorityRange.min + pricingConfig.customerPriorityRange.max) / 2)
      : 100;

    // Add sublocation default
    if (currentSubLocation?.defaultHourlyRate && currentSubLocation.defaultHourlyRate > 0) {
      items.push({
        id: 'sublocation-default',
        name: `${currentSubLocation.label} Default Rate`,
        type: 'SUBLOCATION_DEFAULT',
        priority: sublocPriority,
        rate: currentSubLocation.defaultHourlyRate,
        icon: <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center text-white shadow-md">
          <MapPin className="w-5 h-5" />
        </div>
      });
    }

    // Add location default
    if (currentLocation?.defaultHourlyRate && currentLocation.defaultHourlyRate > 0) {
      items.push({
        id: 'location-default',
        name: `${currentLocation.name} Default Rate`,
        type: 'LOCATION_DEFAULT',
        priority: locPriority,
        rate: currentLocation.defaultHourlyRate,
        icon: <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center text-white shadow-md">
          <Building2 className="w-5 h-5" />
        </div>
      });
    }

    // Add customer default
    if (currentCustomer?.defaultHourlyRate && currentCustomer.defaultHourlyRate > 0) {
      items.push({
        id: 'customer-default',
        name: `${currentCustomer.name} Default Rate`,
        type: 'CUSTOMER_DEFAULT',
        priority: custPriority,
        rate: currentCustomer.defaultHourlyRate,
        icon: <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white shadow-md">
          <User className="w-5 h-5" />
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

  const setQuickRange = (hours: number) => {
    setSelectedDuration(hours);
    // Keep current start time, just update the end based on new duration
    const newViewEnd = new Date(viewStart.getTime() + hours * 60 * 60 * 1000);
    setViewEnd(newViewEnd);
  };

  const getTotalHours = (): number => {
    return Math.ceil((viewEnd.getTime() - viewStart.getTime()) / (1000 * 60 * 60));
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

  /**
   * Filter ratesheets to only those active during the selected viewing interval
   */
  const getActiveRatesheetsForInterval = (): typeof ratesheets => {
    return ratesheets.filter(rs => {
      // For EVENT ratesheets, check if the event overlaps with the selected interval
      if (rs.applyTo === 'EVENT' && rs.eventId) {
        const event = events.find(e => e._id === rs.eventId);
        if (event) {
          const eventStart = new Date(event.startDate);
          const eventEnd = new Date(event.endDate);
          // Event overlaps if: event ends after viewStart AND event starts before viewEnd
          return eventEnd >= viewStart && eventStart <= viewEnd;
        }
        return false;
      }

      // For non-event ratesheets, check if the ratesheet's effective date range overlaps with selected interval
      const rsStart = new Date(rs.effectiveFrom);
      const rsEnd = rs.effectiveTo ? new Date(rs.effectiveTo) : new Date('2099-12-31');

      // Ratesheet overlaps if: rs ends after viewStart AND rs starts before viewEnd
      return rsEnd >= viewStart && rsStart <= viewEnd;
    });
  };

  const getPeakRate = (): number => {
    const activeRatesheets = getActiveRatesheetsForInterval();

    // Get all rates from active ratesheets
    const ratesheetRates = activeRatesheets.flatMap(rs =>
      rs.timeWindows?.map(tw => tw.pricePerHour) || []
    );

    const defaultRates = [
      currentSubLocation?.defaultHourlyRate || 0,
      currentLocation?.defaultHourlyRate || 0,
      currentCustomer?.defaultHourlyRate || 0
    ];

    return Math.max(...ratesheetRates, ...defaultRates, 0);
  };

  // Count ratesheets by level (filtered to selected interval)
  const getRatesheetCounts = () => {
    const activeRatesheets = getActiveRatesheetsForInterval();
    return {
      event: activeRatesheets.filter(rs => rs.applyTo === 'EVENT').length,
      customer: activeRatesheets.filter(rs => rs.applyTo === 'CUSTOMER').length,
      location: activeRatesheets.filter(rs => rs.applyTo === 'LOCATION').length,
      sublocation: activeRatesheets.filter(rs => rs.applyTo === 'SUBLOCATION').length,
      total: activeRatesheets.length,
    };
  };

  const counts = getRatesheetCounts();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Pricing Timeline
          </h1>
          <p className="text-gray-600">
            Visual timeline showing which ratesheets and default rates are active
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
          eventCount={counts.event}
        />

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && selectedSubLocation && (
          <>
            {/* Timeline Range Slider */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Selected Interval</h2>
                <div className="text-sm text-gray-600 font-medium">
                   {formatDateTime(viewStart)} - {formatDateTime(viewEnd)} {' '}<span className="text-gray-500 font-light">({selectedDuration}h duration)</span>
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

                      {/* Selected interval - solid red block */}
                      <div
                        className="absolute h-full shadow-lg"
                        style={{
                          left: `${getViewWindowPosition().left}%`,
                          width: `${getViewWindowPosition().width}%`,
                          background: '#e616c6ff',
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
                          ? 'bg-gradient-to-br from-purple-400 to-purple-500 border-white shadow-sm'
                          : slot.isDefaultRate && slot.defaultType === 'LOCATION'
                          ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 border-white shadow-sm'
                          : slot.isDefaultRate && slot.defaultType === 'CUSTOMER'
                          ? 'bg-gradient-to-br from-blue-400 to-blue-500 border-white shadow-sm'
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
                    
                    {/* Enhanced Tooltip */}
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
                              <div className="text-gray-300">Level: {slot.winningRatesheet.applyTo}</div>
                              <div className="text-gray-300">Priority: {slot.winningRatesheet.priority}</div>
                              <div className="text-green-400">${slot.winningPrice}/hr</div>
                            </>
                          ) : (
                            <>
                              <div className="font-semibold">{getDefaultTypeLabel(slot.defaultType)}</div>
                              <div className="text-gray-300">
                                Priority: {
                                  slot.defaultType === 'SUBLOCATION' 
                                    ? pricingConfig?.sublocationPriorityRange.min 
                                    : slot.defaultType === 'LOCATION'
                                    ? pricingConfig?.locationPriorityRange.min
                                    : pricingConfig?.customerPriorityRange.min
                                }+
                              </div>
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

            {/* Stats Overview - UPDATED to show hierarchy breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Ratesheets</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{counts.total}</p>
                    {counts.total > 0 && (
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {counts.event > 0 && (
                          <span className="text-xs px-1.5 py-0.5 bg-pink-100 text-pink-700 rounded">
                            {counts.event} Event
                          </span>
                        )}
                        {counts.customer > 0 && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {counts.customer} Cust
                          </span>
                        )}
                        {counts.location > 0 && (
                          <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                            {counts.location} Loc
                          </span>
                        )}
                        {counts.sublocation > 0 && (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                            {counts.sublocation} Sub
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <Zap className="w-8 h-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Highest Priority</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {getActiveRatesheetsForInterval().length > 0 ? Math.max(...getActiveRatesheetsForInterval().map(rs => rs.priority)) : '-'}
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
                      {getActiveRatesheetsForInterval().reduce((sum, rs) => sum + (rs.timeWindows?.length || 0), 0)}
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
                      ${getPeakRate()}
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
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className={`text-xs px-2 py-1 rounded-full border font-semibold ${getPriorityBadgeColor(item.priority, pricingConfig)}`}>
                                Priority: {item.priority}
                              </span>
                              {item.applyTo && (
                                <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getApplyToColor(item.applyTo)}`}>
                                  {item.applyTo}
                                </span>
                              )}
                              {item.type === 'RATESHEET' && item.levelInfo && (
                                <span className="text-xs text-gray-500">
                                  {item.levelInfo}
                                </span>
                              )}
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
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityBadgeColor(item.priority, pricingConfig)}`}>
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
