'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Clock,
  DollarSign,
  Building2,
  MapPin,
  User,
  Award,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import DecisionAuditPanel from '@/components/DecisionAuditPanel';
import PricingFilters from '@/components/PricingFilters';
import { getTimeInTimezone } from '@/lib/timezone-utils';

interface TimeWindow {
  windowType?: 'ABSOLUTE_TIME' | 'DURATION_BASED';
  startTime?: string;
  endTime?: string;
  startMinute?: number;
  endMinute?: number;
  pricePerHour: number;
  daysOfWeek?: number[]; // 0=Sunday, 6=Saturday
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
  defaultTimezone?: string;
}

interface PricingLayer {
  id: string;
  name: string;
  type: 'RATESHEET' | 'SUBLOCATION_DEFAULT' | 'LOCATION_DEFAULT' | 'CUSTOMER_DEFAULT';
  priority: number;
  rate?: number;
  color: string;
  applyTo?: string;
}

interface TimeSlot {
  hour: number;
  label: string;
  date: Date;
  layers: Array<{
    layer: PricingLayer;
    price: number | null;
    isActive: boolean;
  }>;
  winningLayer?: PricingLayer;
  winningPrice?: number;
  decisionLog?: any;
  pricingData?: any;
}

export default function TimelineTilesPage() {
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [ratesheets, setRatesheets] = useState<Ratesheet[]>([]);
  const [loading, setLoading] = useState(false);

  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentSubLocation, setCurrentSubLocation] = useState<SubLocation | null>(null);
  const [entityTimezone, setEntityTimezone] = useState<string>('America/New_York'); // Timezone for calculations

  // Initialize all dates from the same timestamp
  // Range covers 60 days in past to 60 days in future
  const [rangeStart, setRangeStart] = useState<Date>(() => {
    const now = new Date();
    //return new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  });
  const [rangeEnd, setRangeEnd] = useState<Date>(() => {
    const now = new Date();
    //return new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days from now (total 120 day window)
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now (total 37 day window)
  });

  const [viewStart, setViewStart] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours ago (default view)
  });
  const [viewEnd, setViewEnd] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours from now (12 hour default view)
  });

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<number>(12); // Duration in hours (default 12h)

  // Booking start time for duration-based window calculations (optional)
  const [useDurationContext, setUseDurationContext] = useState<boolean>(false);
  const [bookingStartTime, setBookingStartTime] = useState<Date>(viewStart);

  // Selected slot for showing decision panel (persistent)
  const [selectedSlot, setSelectedSlot] = useState<{ slotIdx: number; layerId: string } | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{ slotIdx: number; layerId: string } | null>(null);
  const [decisionPanelData, setDecisionPanelData] = useState<any>(null);
  const [showWaterfall, setShowWaterfall] = useState(false);

  // Event booking toggle
  const [isEventBooking, setIsEventBooking] = useState<boolean>(false);

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

  // Auto-set isEventBooking=true when event is selected
  useEffect(() => {
    if (selectedEventId) {
      setIsEventBooking(true);
    }
  }, [selectedEventId]);

  // Clear selectedEventId when isEventBooking is toggled OFF
  useEffect(() => {
    if (!isEventBooking && selectedEventId) {
      setSelectedEventId('');
    }
  }, [isEventBooking]);

  useEffect(() => {
    if (selectedSubLocation) {
      fetchSubLocationDetails(selectedSubLocation);
      fetchRatesheets(selectedSubLocation);
      fetchEntityTimezone(selectedSubLocation); // Fetch timezone for accurate time window matching
    } else {
      setRatesheets([]);
      setCurrentSubLocation(null);
      setSelectedEventId('');
      setEntityTimezone('America/New_York'); // Reset to default
    }
  }, [selectedSubLocation]); // Only refetch when sublocation changes, not when range changes

  useEffect(() => {
    if (selectedSubLocation) {
      fetchRatesheets(selectedSubLocation);
    }
  }, [selectedEventId]);

  // Sync view window with booking start time when duration context is enabled
  useEffect(() => {
    if (useDurationContext) {
      setViewStart(new Date(bookingStartTime));
      setViewEnd(new Date(bookingStartTime.getTime() + selectedDuration * 60 * 60 * 1000));
    }
  }, [useDurationContext, bookingStartTime]);

  useEffect(() => {
    if (currentSubLocation || currentLocation || currentCustomer) {
      calculateTimeSlots();
    }
  }, [ratesheets, viewStart, viewEnd, currentSubLocation, currentLocation, currentCustomer, useDurationContext, bookingStartTime, isEventBooking, entityTimezone]);

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

  const fetchEntityTimezone = async (subLocationId: string) => {
    try {
      const response = await fetch(`/api/timezone?entityType=SUBLOCATION&entityId=${subLocationId}`);
      const data = await response.json();
      if (data.timezone) {
        setEntityTimezone(data.timezone);
        console.log(`[Timeline] Using timezone for sublocation: ${data.timezone}`);
      }
    } catch (error) {
      console.error('Failed to fetch entity timezone:', error);
    }
  };

  const fetchRatesheets = async (subLocationId: string) => {
    setLoading(true);
    try {
      const startStr = rangeStart.toISOString().split('T')[0];
      const endStr = rangeEnd.toISOString().split('T')[0];

      const eventsResponse = await fetch('/api/events');
      const allEvents = await eventsResponse.json();
      const activeEvents = allEvents.filter((e: Event) => e.isActive);

      const overlappingEvents = activeEvents.filter((event: Event) => {
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);
        return eventEnd >= rangeStart && eventStart <= rangeEnd;
      });

      const url = new URL('/api/ratesheets', window.location.origin);
      url.searchParams.set('subLocationId', subLocationId);
      url.searchParams.set('startDate', startStr);
      url.searchParams.set('endDate', endStr);
      url.searchParams.set('resolveHierarchy', 'true');

      if (selectedEventId) {
        url.searchParams.set('eventId', selectedEventId);
      }

      const response = await fetch(url.toString());
      let allRatesheets = await response.json();

      if (!selectedEventId && overlappingEvents.length > 0) {
        const eventRatesheetPromises = overlappingEvents.map((event: Event) => {
          const eventUrl = new URL('/api/ratesheets', window.location.origin);
          eventUrl.searchParams.set('eventId', event._id);
          eventUrl.searchParams.set('startDate', startStr);
          eventUrl.searchParams.set('endDate', endStr);
          return fetch(eventUrl.toString()).then(res => res.json());
        });

        const eventRatesheetsArrays = await Promise.all(eventRatesheetPromises);
        const eventRatesheets = eventRatesheetsArrays.flat();

        const existingIds = new Set(allRatesheets.map((rs: any) => rs._id));
        const newEventRatesheets = eventRatesheets.filter((rs: any) => !existingIds.has(rs._id));
        allRatesheets = [...allRatesheets, ...newEventRatesheets];
      }

      const activeRatesheets = allRatesheets.filter((rs: any) => rs.isActive);
      setRatesheets(activeRatesheets.sort((a: Ratesheet, b: Ratesheet) => b.priority - a.priority));
    } catch (error) {
      console.error('Failed to fetch ratesheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPricingLayers = (): PricingLayer[] => {
    const layers: PricingLayer[] = [];

    // Add ratesheets (already sorted by priority)
    ratesheets.forEach((rs) => {
      let name = rs.name;
      if (rs.applyTo === 'EVENT' && rs.event) {
        name = `${rs.name} (${rs.event.name})`;
      } else if (rs.applyTo === 'CUSTOMER' && rs.customer) {
        name = `${rs.name} (${rs.customer.name})`;
      } else if (rs.applyTo === 'LOCATION' && rs.location) {
        name = `${rs.name} (${rs.location.name})`;
      } else if (rs.applyTo === 'SUBLOCATION' && rs.sublocation) {
        name = `${rs.name} (${rs.sublocation.label})`;
      }

      layers.push({
        id: rs._id,
        name,
        type: 'RATESHEET',
        priority: rs.priority,
        color: getLayerColor(rs.applyTo, rs.priority),
        applyTo: rs.applyTo
      });
    });

    // Add defaults
    const sublocPriority = pricingConfig
      ? Math.floor((pricingConfig.sublocationPriorityRange.min + pricingConfig.sublocationPriorityRange.max) / 2)
      : 300;
    const locPriority = pricingConfig
      ? Math.floor((pricingConfig.locationPriorityRange.min + pricingConfig.locationPriorityRange.max) / 2)
      : 200;
    const custPriority = pricingConfig
      ? Math.floor((pricingConfig.customerPriorityRange.min + pricingConfig.customerPriorityRange.max) / 2)
      : 100;

    if (currentSubLocation?.defaultHourlyRate && currentSubLocation.defaultHourlyRate > 0) {
      layers.push({
        id: 'sublocation-default',
        name: `${currentSubLocation.label} Default`,
        type: 'SUBLOCATION_DEFAULT',
        priority: sublocPriority,
        rate: currentSubLocation.defaultHourlyRate,
        color: 'bg-purple-400'
      });
    }

    if (currentLocation?.defaultHourlyRate && currentLocation.defaultHourlyRate > 0) {
      layers.push({
        id: 'location-default',
        name: `${currentLocation.name} Default`,
        type: 'LOCATION_DEFAULT',
        priority: locPriority,
        rate: currentLocation.defaultHourlyRate,
        color: 'bg-emerald-400'
      });
    }

    if (currentCustomer?.defaultHourlyRate && currentCustomer.defaultHourlyRate > 0) {
      layers.push({
        id: 'customer-default',
        name: `${currentCustomer.name} Default`,
        type: 'CUSTOMER_DEFAULT',
        priority: custPriority,
        rate: currentCustomer.defaultHourlyRate,
        color: 'bg-blue-400'
      });
    }

    return layers.sort((a, b) => b.priority - a.priority);
  };

  const getLayerColor = (applyTo: string, priority: number): string => {
    switch (applyTo) {
      case 'EVENT': return 'bg-gradient-to-br from-pink-400 to-pink-500';
      case 'SUBLOCATION': return 'bg-gradient-to-br from-purple-400 to-purple-500';
      case 'LOCATION': return 'bg-gradient-to-br from-emerald-400 to-emerald-500';
      case 'CUSTOMER': return 'bg-gradient-to-br from-blue-400 to-blue-500';
      default: return 'bg-gradient-to-br from-gray-400 to-gray-500';
    }
  };

  const getLayerBorderColor = (applyTo: string, isWinner: boolean): string => {
    if (isWinner) {
      // Winner gets a gold/amber border instead of yellow
      return 'border-amber-500';
    }

    switch (applyTo) {
      case 'EVENT': return 'border-pink-600';
      case 'SUBLOCATION': return 'border-purple-600';
      case 'LOCATION': return 'border-emerald-600';
      case 'CUSTOMER': return 'border-blue-600';
      default: return 'border-gray-600';
    }
  };

  const calculateTimeSlots = () => {
    const slots: TimeSlot[] = [];
    const currentTime = new Date(viewStart);
    const endTime = new Date(viewEnd);
    const allLayers = getPricingLayers();
    // Use entity timezone (fetched from TimezoneSettingsRepository, same as pricing API)
    const timezone = entityTimezone;

    console.log(`[calculateTimeSlots] Using timezone: ${timezone}`);
    console.log(`[calculateTimeSlots] Layers (sorted by priority):`, allLayers.map(l => `${l.name} (${l.priority})`));

    while (currentTime < endTime) {
      // Use timezone-aware time to match ratesheet time windows
      const timeStr = getTimeInTimezone(currentTime, timezone);
      const hour = parseInt(timeStr.split(':')[0], 10);

      // For each layer, check if it applies at this hour
      const layerPrices = allLayers.map(layer => {
        let price: number | null = null;
        let isActive = false;

        if (layer.type === 'RATESHEET') {
          // Find the ratesheet
          const ratesheet = ratesheets.find(rs => rs._id === layer.id);
          if (ratesheet) {
            // Check date range
            const effectiveFrom = new Date(ratesheet.effectiveFrom);
            const effectiveTo = ratesheet.effectiveTo ? new Date(ratesheet.effectiveTo) : null;

            if (effectiveFrom <= currentTime && (!effectiveTo || effectiveTo >= currentTime)) {
              // Check time windows
              if (ratesheet.timeWindows && ratesheet.timeWindows.length > 0) {
                const matchingWindow = ratesheet.timeWindows.find(tw => {
                  // CRITICAL: For walk-ins (isEventBooking = false), skip grace periods ($0/hr time windows)
                  // This allows event rates to apply but excludes free grace periods
                  if (!isEventBooking && tw.pricePerHour === 0 && ratesheet.applyTo === 'EVENT') {
                    return false; // Skip this $0/hr grace period time window
                  }

                  // Check daysOfWeek filter - skip this time window if day doesn't match
                  // 0=Sunday, 1=Monday, ..., 6=Saturday
                  if (tw.daysOfWeek && tw.daysOfWeek.length > 0) {
                    const dayOfWeek = currentTime.getDay();
                    if (!tw.daysOfWeek.includes(dayOfWeek)) {
                      return false; // Day of week doesn't match
                    }
                  }

                  const windowType = tw.windowType || 'ABSOLUTE_TIME';

                  if (windowType === 'DURATION_BASED') {
                    // Duration-based windows: calculate minutes from ratesheet effectiveFrom
                    // For EVENT ratesheets, effectiveFrom is the event start minus grace period
                    const ratesheetStart = new Date(ratesheet.effectiveFrom);
                    const minutesFromRatesheetStart = Math.floor((currentTime.getTime() - ratesheetStart.getTime()) / (1000 * 60));
                    const startMinute = tw.startMinute ?? 0;
                    const endMinute = tw.endMinute ?? 0;

                    return minutesFromRatesheetStart >= startMinute && minutesFromRatesheetStart < endMinute;
                  } else {
                    // ABSOLUTE_TIME windows: match against hour time
                    if (!tw.startTime || !tw.endTime) {
                      return false; // Invalid window
                    }
                    return timeInWindow(timeStr, tw.startTime, tw.endTime);
                  }
                });

                if (matchingWindow) {
                  // Handle SURGE_MULTIPLIER type ratesheets specially
                  if (ratesheet.type === 'SURGE_MULTIPLIER') {
                    // For surge multipliers, pricePerHour contains the multiplier, not the absolute price
                    // We need to find the base price and multiply it
                    const surgeMultiplier = matchingWindow.pricePerHour;

                    // Find the base price from non-surge layers
                    // We need to look at all layers and find the highest priority non-surge active layer
                    let basePrice = 0;

                    // Check all ratesheets for the base price (exclude current surge ratesheet)
                    for (const otherLayer of allLayers) {
                      if (otherLayer.id === layer.id) continue; // Skip current surge layer

                      let otherPrice: number | null = null;
                      let otherIsActive = false;

                      if (otherLayer.type === 'RATESHEET') {
                        const otherRatesheet = ratesheets.find(rs => rs._id === otherLayer.id);
                        if (otherRatesheet && otherRatesheet.type !== 'SURGE_MULTIPLIER') {
                          // Check if this ratesheet applies to this hour
                          const otherEffectiveFrom = new Date(otherRatesheet.effectiveFrom);
                          const otherEffectiveTo = otherRatesheet.effectiveTo ? new Date(otherRatesheet.effectiveTo) : null;

                          if (otherEffectiveFrom <= currentTime && (!otherEffectiveTo || otherEffectiveTo >= currentTime)) {
                            if (otherRatesheet.timeWindows && otherRatesheet.timeWindows.length > 0) {
                              const otherMatchingWindow = otherRatesheet.timeWindows.find(tw => {
                                if (!isEventBooking && tw.pricePerHour === 0 && otherRatesheet.applyTo === 'EVENT') {
                                  return false;
                                }
                                // Check daysOfWeek filter
                                if (tw.daysOfWeek && tw.daysOfWeek.length > 0) {
                                  const dayOfWeek = currentTime.getDay();
                                  if (!tw.daysOfWeek.includes(dayOfWeek)) {
                                    return false;
                                  }
                                }
                                const windowType = tw.windowType || 'ABSOLUTE_TIME';
                                if (windowType === 'DURATION_BASED') {
                                  const ratesheetStart = new Date(otherRatesheet.effectiveFrom);
                                  const minutesFromRatesheetStart = Math.floor((currentTime.getTime() - ratesheetStart.getTime()) / (1000 * 60));
                                  const startMinute = tw.startMinute ?? 0;
                                  const endMinute = tw.endMinute ?? 0;
                                  return minutesFromRatesheetStart >= startMinute && minutesFromRatesheetStart < endMinute;
                                } else {
                                  if (!tw.startTime || !tw.endTime) return false;
                                  return timeInWindow(timeStr, tw.startTime, tw.endTime);
                                }
                              });

                              if (otherMatchingWindow) {
                                otherPrice = otherMatchingWindow.pricePerHour;
                                otherIsActive = true;
                              }
                            }
                          }
                        }
                      } else {
                        // Default rate
                        otherPrice = otherLayer.rate || null;
                        otherIsActive = otherPrice !== null;
                      }

                      // If this layer is active and has higher priority, use it as base
                      if (otherIsActive && otherPrice !== null) {
                        basePrice = otherPrice;
                        break; // Use the first (highest priority) active non-surge layer
                      }
                    }

                    // Fallback to default rates if no base found
                    if (basePrice === 0) {
                      basePrice = currentSubLocation?.defaultHourlyRate
                        || currentLocation?.defaultHourlyRate
                        || currentCustomer?.defaultHourlyRate
                        || 0;
                    }

                    price = Math.round(basePrice * surgeMultiplier * 100) / 100;
                  } else {
                    price = Math.round(matchingWindow.pricePerHour * 100) / 100;
                  }
                  isActive = true;
                }
              }
            }
          }
        } else {
          // Default rates are always active
          price = layer.rate || null;
          isActive = price !== null;
        }

        return { layer, price, isActive };
      });

      // Winner is the first active layer (highest priority)
      const winner = layerPrices.find(lp => lp.isActive);

      // Debug: Log first few hours
      if (slots.length < 5) {
        console.log(`[Hour ${timeStr}] Active layers:`, layerPrices.filter(lp => lp.isActive).map(lp => `${lp.layer.name}: $${lp.price}`));
        console.log(`[Hour ${timeStr}] Winner: ${winner?.layer.name} @ $${winner?.price}`);
      }

      slots.push({
        hour,
        label: formatHour(hour),
        date: new Date(currentTime),
        layers: layerPrices,
        winningLayer: winner?.layer,
        winningPrice: winner?.price || undefined
      });

      currentTime.setHours(currentTime.getHours() + 1);
    }

    setTimeSlots(slots);
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

  const getTotalCost = (): number => {
    const total = timeSlots.reduce((sum, slot) => sum + (slot.winningPrice || 0), 0);
    return Math.round(total * 100) / 100;
  };

  const getTotalDuration = (): string => {
    const hours = timeSlots.length;
    if (hours === 0) return '0 hours';
    if (hours === 1) return '1 hour';
    return `${hours} hours`;
  };

  const handleTileClick = async (slotIdx: number, layerId: string, slot: TimeSlot) => {
    // Set as selected slot
    setSelectedSlot({ slotIdx, layerId });

    // Fetch pricing data for this specific hour
    try {
      const startTime = slot.date;
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 1);

      const requestBody = {
        subLocationId: selectedSubLocation,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };

      if (selectedEventId) {
        requestBody.eventId = selectedEventId;
      }

      const response = await fetch('/api/pricing/calculate-hourly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.error('Pricing API error:', response.status, response.statusText);
        return;
      }

      const data = await response.json();
      console.log('[Click] Fetched pricing data:', data);
      setDecisionPanelData(data);
    } catch (error) {
      console.error('Failed to fetch pricing data:', error);
    }
  };

  const handleTileHover = (slotIdx: number, layerId: string) => {
    setHoveredSlot({ slotIdx, layerId });
  };

  const handleTileLeave = () => {
    setHoveredSlot(null);
  };

  const allLayers = getPricingLayers();
  const counts = {
    event: ratesheets.filter(rs => rs.applyTo === 'EVENT').length,
    total: ratesheets.length
  };

  // Debug logging
  useEffect(() => {
    console.log('[Timeline Tiles] Data:', {
      ratesheets: ratesheets.length,
      allLayers: allLayers.length,
      timeSlots: timeSlots.length,
      currentSubLocation,
      currentLocation,
      currentCustomer
    });
  }, [ratesheets, allLayers.length, timeSlots.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 overflow-x-hidden">
      <div className="max-w-[1800px] mx-auto overflow-x-hidden">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Pricing Timeline - Waterfall View
              </h1>
              <p className="text-gray-600">
                Visual waterfall showing pricing hierarchy and winning rates for each hour
              </p>
            </div>
            <div className="bg-gray-100 rounded-lg p-3 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Local Time:</span>
                <span className="text-gray-900 font-mono">
                  {new Date().toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Server (UTC):</span>
                <span className="text-gray-900 font-mono">
                  {new Date().toUTCString().slice(0, -4)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Timezone:</span>
                <span className="text-gray-900 font-mono">
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </span>
              </div>
            </div>
          </div>
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
          isEventBooking={isEventBooking}
          onIsEventBookingChange={setIsEventBooking}
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

                {/* Selected interval info below slider */}
                {/* <div className="text-center text-sm text-gray-700 mt-2">
                  <span className="font-medium">Selected Interval:</span>{' '}
                  <span className="text-gray-900 font-semibold">
                    {formatDateTime(viewStart)} – {formatDateTime(viewEnd)}
                  </span>
                  {' '}
                  <span className="text-gray-500">({selectedDuration}h duration)</span>
                </div> */}
              </div>

              {/* START, Total Cost, END section */}
              <div className="flex items-stretch justify-between gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg px-3 py-2 shadow-md border border-blue-700 flex-shrink-0 flex flex-col justify-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wide opacity-90">Start</div>
                  <div className="text-xs font-bold">
                    {viewStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-[10px] font-medium">
                    {viewStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </div>
                </div>

                {/* Total cost - full width between START and END */}
                <div className="bg-gradient-to-r from-gray-500 to-gray-900 rounded-lg px-4 py-2 flex-1 flex flex-col justify-center shadow-md">
                  <div className="text-center">
                    <div className="text-xs font-medium text-white uppercase tracking-wide opacity-90">Total Cost</div>
                    <div className="text-3xl font-bold text-white">
                      ${getTotalCost().toFixed(2)}
                    </div>
                    <div className="text-[10px] text-white mt-1 hidden">
                      {timeSlots.map(s => s.winningPrice ? `$${s.winningPrice}` : '$0').join(' + ')} = ${getTotalCost()}
                    </div>
                    <div className="text-xs text-white opacity-90 mt-1">
                      Duration: {getTotalDuration()}
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg px-3 py-2 shadow-md border border-purple-700 flex-shrink-0 flex flex-col justify-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wide opacity-90">End</div>
                  <div className="text-xs font-bold">
                    {viewEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-[10px] font-medium">
                    {viewEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </div>
                </div>
              </div>

              {/* Time markers in grid with winning prices */}
              <div className="mt-4">
                <div className="grid grid-cols-12 gap-1">
                  {timeSlots.map((slot, idx) => {
                    const isSelected = selectedSlot?.slotIdx === idx;
                    const isHovered = hoveredSlot?.slotIdx === idx;
                    return (
                      <div
                        key={idx}
                        className={`bg-gray-50 border rounded-lg p-2 text-center cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-600 border-2 shadow-xl bg-blue-50'
                            : isHovered
                            ? 'border-blue-400 border-2 shadow-lg'
                            : 'border-gray-300'
                        }`}
                        onClick={() => handleTileClick(idx, 'pricing-tile', slot)}
                        onMouseEnter={() => handleTileHover(idx, 'pricing-tile')}
                        onMouseLeave={handleTileLeave}
                      >
                        {/* Winning price - prominent */}
                        {slot.winningPrice ? (
                          <div className="text-xl font-extrabold text-gray-900 text-pink-500 mb-0">
                            ${slot.winningPrice.toFixed(2)}
                          </div>
                        ) : (
                          <div className="text-lg font-extrabold text-gray-400 mb-0">
                            -
                          </div>
                        )}
                        {/* Hour label */}
                        <div className="text-xs font-semibold text-gray-700 mt-1">{slot.label}</div>
                        {/* Date */}
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {slot.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Toggle button for waterfall */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowWaterfall(!showWaterfall)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors font-medium text-sm"
                >
                  {showWaterfall ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Hide Pricing Waterfall Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Show Pricing Waterfall Details
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Waterfall Visualization - Collapsible */}
            {showWaterfall && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                {/* Waterfall layers */}
                <div className="space-y-2 mb-6">
                {allLayers.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-lg font-medium">No pricing rules found</p>
                    <p className="text-sm mt-2">
                      No ratesheets or default rates are configured for this sublocation.
                    </p>
                  </div>
                )}
                {allLayers.map((layer, layerIdx) => {
                  // Check if this layer has any active tiles in the current time window
                  const hasActiveTiles = timeSlots.some(slot => {
                    const layerData = slot.layers.find(l => l.layer.id === layer.id);
                    return layerData?.isActive;
                  });

                  // Skip rendering this layer if it has no active tiles
                  if (!hasActiveTiles) {
                    return null;
                  }

                  return (
                  <div key={layer.id}>
                    {/* Layer label */}
                    <div className="text-xs font-medium text-gray-700 mb-1" title={layer.name}>
                      <span className="font-semibold">{layer.name}</span>
                      <span className="text-[10px] text-gray-500 ml-2">Priority: {layer.priority}</span>
                    </div>

                    {/* Tiles for each time slot in a grid */}
                    <div className="grid grid-cols-12 gap-1">
                      {timeSlots.length === 0 ? (
                        <div className="col-span-12 rounded-lg border-2 border-gray-300 bg-gray-50 h-[60px] flex items-center justify-center">
                          <div className="text-gray-500 font-medium text-xs text-center px-2">
                            No Price Info
                          </div>
                        </div>
                      ) : (
                        timeSlots.map((slot, slotIdx) => {
                          const layerData = slot.layers.find(l => l.layer.id === layer.id);
                          const isWinner = slot.winningLayer?.id === layer.id;

                          // Debug: Check for mismatches
                          if (slotIdx < 3 && layerData?.isActive && isWinner) {
                            console.log(`[Render ${slot.label}] ${layer.name} isWinner=${isWinner}, winningPrice=$${slot.winningPrice}, layerPrice=$${layerData?.price}`);
                          }
                          const isHovered = hoveredSlot?.slotIdx === slotIdx && hoveredSlot?.layerId === layer.id;

                          const isSelected = selectedSlot?.slotIdx === slotIdx && selectedSlot?.layerId === layer.id;

                          return (
                            <div
                              key={slotIdx}
                              onClick={() => layerData?.isActive && handleTileClick(slotIdx, layer.id, slot)}
                              onMouseEnter={() => handleTileHover(slotIdx, layer.id)}
                              onMouseLeave={handleTileLeave}
                              title={layerData?.isActive ? `${layer.name} - $${layerData.price}/hr (Priority: ${layer.priority})` : 'Not active for this time'}
                              className={`rounded-lg transition-all cursor-pointer ${
                                layerData?.isActive
                                  ? isWinner
                                    ? `${layer.color} border-black shadow-xl`
                                    : `${layer.color} border-gray-400 opacity-70 shadow-sm`
                                  : 'bg-gray-100 border-gray-300 opacity-30'
                              }`}
                              style={{
                                height: '60px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: isSelected ? '5px' : isWinner ? '4px' : '2px',
                                borderStyle: isWinner ? 'solid' : 'dotted',
                                borderColor: isSelected ? '#2563eb' : undefined,
                                transform: isHovered || isSelected ? 'scale(1.05)' : 'scale(1)',
                                zIndex: isSelected ? 15 : isHovered ? 10 : 1
                              }}
                            >
                              {layerData?.isActive && layerData.price !== null && (
                                <div className="text-white font-bold text-sm drop-shadow-md">
                                  ${layerData.price}/hr
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  );
                })}
                </div>
              </div>
            )}

            {/* Decision Panel - Shows when tile is selected (persistent) */}
            {selectedSlot && (
              <div className="bg-white rounded-xl shadow-lg border-2 border-blue-500 p-6 mb-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    Pricing Details for {timeSlots[selectedSlot.slotIdx]?.label} on {timeSlots[selectedSlot.slotIdx]?.date.toLocaleDateString()}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedSlot(null);
                      setDecisionPanelData(null);
                    }}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <span className="text-xl">×</span>
                  </button>
                </div>
                {decisionPanelData ? (
                  <DecisionAuditPanel
                    segments={decisionPanelData.segments}
                    decisionLog={decisionPanelData.decisionLog}
                    totalPrice={decisionPanelData.totalPrice}
                    totalHours={decisionPanelData.totalHours}
                    breakdown={decisionPanelData.breakdown}
                    timezone={decisionPanelData.timezone}
                    metadata={decisionPanelData.metadata}
                  />
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Loading pricing details...</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
