'use client';

import { useState, useEffect } from 'react';
import {
  DollarSign,
  Clock,
  Calendar,
  RefreshCw,
  MapPin,
  Zap,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Timer,
  ChevronDown,
  ChevronUp,
  Grid3x3,
  List,
  Gift,
  AlertCircle,
  Copy
} from 'lucide-react';
import PricingFilters from '@/components/PricingFilters';

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
  gracePeriodBefore?: number;
  gracePeriodAfter?: number;
}

interface PricingResult {
  totalPrice: number;
  totalHours: number;
  averageRate?: number;
  hourlyBreakdown?: any[];
}

interface RateCard {
  duration: number;
  price: number | null;
  loading: boolean;
  isPopular?: boolean;
  badge?: string;
}

export default function DigitalRatecardPage() {
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentSubLocation, setCurrentSubLocation] = useState<SubLocation | null>(null);
  const [activeEvents, setActiveEvents] = useState<Event[]>([]);
  const [eventPrices, setEventPrices] = useState<Map<string, number>>(new Map());

  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Duration-based pricing context
  const [useDurationContext, setUseDurationContext] = useState<boolean>(false);
  const [bookingStartTime, setBookingStartTime] = useState<Date>(new Date());

  // Event booking toggle
  const [isEventBooking, setIsEventBooking] = useState<boolean>(false);

  // Event cards collapsed state
  const [eventsCollapsed, setEventsCollapsed] = useState<boolean>(true);

  // Hourly breakdown for selected duration
  const [selectedDuration, setSelectedDuration] = useState<number>(24);
  const [hourlyBreakdown, setHourlyBreakdown] = useState<Array<{ hour: Date; hourEnd: Date; rate: number; isPartial: boolean }>>([]);

  // View mode toggle (grid/list)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Grid columns control
  const [tilesPerRow, setTilesPerRow] = useState<number>(8);

  // Time period toggle (hourly/daily)
  const [timePeriod, setTimePeriod] = useState<'hourly' | 'daily'>('hourly');

  // Copy settings from Timeline View
  const copySettingsFromTimeline = () => {
    try {
      const savedSettings = localStorage.getItem('timelineViewSettings');
      console.log('\n📋 [COPY] Copying settings from Timeline View...');
      console.log('[COPY] Raw localStorage data:', savedSettings);

      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        console.log('[COPY] Parsed settings:', settings);

        // Copy the settings
        if (settings.bookingStartTime) {
          const newTime = new Date(settings.bookingStartTime);
          console.log('[COPY] Setting bookingStartTime:', newTime.toISOString());
          setBookingStartTime(newTime);
        }
        if (settings.useDurationContext !== undefined) {
          console.log('[COPY] Setting useDurationContext:', settings.useDurationContext);
          setUseDurationContext(settings.useDurationContext);
        }
        if (settings.isEventBooking !== undefined) {
          console.log('[COPY] Setting isEventBooking:', settings.isEventBooking);
          setIsEventBooking(settings.isEventBooking);
        }
        if (settings.selectedLocation) {
          console.log('[COPY] Setting selectedLocation:', settings.selectedLocation);
          setSelectedLocation(settings.selectedLocation);
        }
        if (settings.selectedSubLocation) {
          console.log('[COPY] Setting selectedSubLocation:', settings.selectedSubLocation);
          setSelectedSubLocation(settings.selectedSubLocation);
        }
        if (settings.selectedEventId) {
          console.log('[COPY] Setting selectedEventId:', settings.selectedEventId);
          setSelectedEventId(settings.selectedEventId);
        }

        console.log('[COPY] ✅ All settings copied successfully!');
        // Show success notification
        alert('✅ Settings copied from Timeline View successfully! Check console for details.');
      } else {
        console.warn('[COPY] ⚠️ No settings found in localStorage');
        alert('⚠️ No Timeline View settings found. Please open Timeline View first.');
      }
    } catch (error) {
      console.error('[COPY] ❌ Failed to copy settings:', error);
      alert('❌ Failed to copy settings from Timeline View.');
    }
  };

  // Hourly tiles for 24 hours
  const [hourlyTiles, setHourlyTiles] = useState<Array<{ hour: Date; hourEnd: Date; price: number | null; loading: boolean; isPartial: boolean }>>([]);

  // Daily tiles for 7 days
  const [dailyTiles, setDailyTiles] = useState<Array<{ day: Date; dayEnd: Date; price: number | null; loading: boolean }>>([]);

  // Popular durations with badges
  const popularDurations = [
    { hours: 1, badge: 'Quick Stop', isPopular: false },
    { hours: 2, badge: 'Short Stay', isPopular: true },
    { hours: 3, badge: 'Extended', isPopular: false },
    { hours: 4, badge: 'Half Day', isPopular: true },
    { hours: 6, badge: 'Business', isPopular: false },
    { hours: 8, badge: 'Work Day', isPopular: true },
    { hours: 12, badge: 'Half Day+', isPopular: false },
    { hours: 24, badge: 'Full Day', isPopular: true },
  ];

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
    } else {
      setCurrentSubLocation(null);
      setRateCards([]);
      setActiveEvents([]);
    }
  }, [selectedSubLocation]);

  // Fetch events after we have all the hierarchy data
  useEffect(() => {
    if (currentSubLocation && currentLocation && currentCustomer) {
      fetchActiveEvents();
    }
  }, [currentSubLocation, currentLocation, currentCustomer]);

  useEffect(() => {
    if (currentSubLocation) {
      calculateAllRates();
    }
  }, [currentSubLocation, isEventBooking, selectedEventId, bookingStartTime, timePeriod]);

  // Recalculate hourly breakdown when selectedDuration changes
  useEffect(() => {
    if (currentSubLocation && hourlyBreakdown.length > 0) {
      calculateHourlyBreakdown();
    }
  }, [selectedDuration]);

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

  const fetchActiveEvents = async () => {
    if (!currentSubLocation || !currentLocation || !currentCustomer) return;

    try {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Next 7 days

      const response = await fetch('/api/events');
      const allEvents = await response.json();

      const overlapping = allEvents.filter((event: Event) => {
        if (!event.isActive) return false;

        // Check date overlap
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);
        const dateOverlap = eventEnd >= now && eventStart <= futureDate;
        if (!dateOverlap) return false;

        // Filter by hierarchy: event must belong to this sublocation/location/customer
        // Convert IDs to strings for comparison (in case they're ObjectIds)
        const eventSubLocId = typeof event.subLocationId === 'object'
          ? (event.subLocationId as any)?.$oid || String(event.subLocationId)
          : event.subLocationId;
        const eventLocId = typeof event.locationId === 'object'
          ? (event.locationId as any)?.$oid || String(event.locationId)
          : event.locationId;
        const eventCustId = typeof event.customerId === 'object'
          ? (event.customerId as any)?.$oid || String(event.customerId)
          : event.customerId;

        const matchesSubLocation = eventSubLocId === currentSubLocation._id;
        const matchesLocation = eventLocId === currentLocation._id && !eventSubLocId;
        const matchesCustomer = eventCustId === currentCustomer._id && !eventLocId && !eventSubLocId;

        return matchesSubLocation || matchesLocation || matchesCustomer;
      });

      setActiveEvents(overlapping);

      // Calculate pricing for each event including grace periods
      if (overlapping.length > 0 && currentSubLocation) {
        calculateEventPricing(overlapping);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  const calculateEventPricing = async (events: Event[]) => {
    const prices = new Map<string, number>();

    for (const event of events) {
      const graceBefore = event.gracePeriodBefore || 0;
      const graceAfter = event.gracePeriodAfter || 0;

      // Calculate start time with grace period before
      const eventStart = new Date(event.startDate);
      const adjustedStart = new Date(eventStart.getTime() - graceBefore * 60 * 1000);

      // Calculate end time with grace period after
      const eventEnd = new Date(event.endDate);
      const adjustedEnd = new Date(eventEnd.getTime() + graceAfter * 60 * 1000);

      // Calculate total duration in hours
      const totalHours = Math.ceil((adjustedEnd.getTime() - adjustedStart.getTime()) / (1000 * 60 * 60));

      // Get price for this duration
      const price = await calculatePricing(totalHours);
      if (price !== null) {
        prices.set(event._id, price);
      }
    }

    setEventPrices(prices);
  };

  const calculatePricing = async (durationHours: number): Promise<number | null> => {
    if (!currentSubLocation) return null;

    // Use bookingStartTime instead of current time
    const startTime = new Date(bookingStartTime);
    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

    console.log(`\n🟢 [DIGITAL-RATECARD] calculatePricing(${durationHours}h)`);
    console.log('[DIGITAL-RATECARD] bookingStartTime:', bookingStartTime.toISOString());
    console.log('[DIGITAL-RATECARD] startTime:', startTime.toISOString());
    console.log('[DIGITAL-RATECARD] endTime:', endTime.toISOString());
    console.log('[DIGITAL-RATECARD] selectedEventId:', selectedEventId || 'none');
    console.log('[DIGITAL-RATECARD] isEventBooking:', isEventBooking);

    try {
      const requestBody = {
        subLocationId: currentSubLocation._id,
        eventId: selectedEventId || undefined,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        isEventBooking: isEventBooking,
      };

      console.log('[DIGITAL-RATECARD] API Request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch('/api/pricing/calculate-hourly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.error('[DIGITAL-RATECARD] API Error:', response.status, response.statusText);
        return null;
      }

      const result: PricingResult = await response.json();
      console.log('[DIGITAL-RATECARD] API Response:', result);
      console.log('[DIGITAL-RATECARD] Total Price:', result.totalPrice);

      return result.totalPrice;
    } catch (error) {
      console.error(`[DIGITAL-RATECARD] Failed to calculate pricing for ${durationHours}h:`, error);
      return null;
    }
  };

  const calculateHourlyBreakdown = async () => {
    if (!currentSubLocation) return;

    // Use same logic as calculateHourlyTiles to ensure consistency
    const firstHourMinutes = bookingStartTime.getMinutes();
    const firstHourSeconds = bookingStartTime.getSeconds();
    const isFirstHourPartial = firstHourMinutes > 0 || firstHourSeconds > 0;

    // Calculate tiles - if first hour is partial, we need 25 tiles to cover 24 full hours
    const tileCount = isFirstHourPartial ? 25 : 24;

    const breakdown: Array<{ hour: Date; hourEnd: Date; rate: number; isPartial: boolean }> = [];

    for (let i = 0; i < tileCount; i++) {
      let hourStart: Date;
      let hourEnd: Date;
      let isPartial: boolean;

      const tileStart = new Date(bookingStartTime.getTime() + i * 60 * 60 * 1000);

      if (i === 0 && isFirstHourPartial) {
        // First partial hour: from booking start to next hour mark
        hourStart = new Date(bookingStartTime);
        hourEnd = new Date(tileStart.getFullYear(), tileStart.getMonth(), tileStart.getDate(), tileStart.getHours() + 1, 0, 0, 0);
        isPartial = true;
      } else if (i === tileCount - 1 && isFirstHourPartial) {
        // Last partial hour: from last hour mark to complete 24 hours
        const lastFullHourStart = new Date(bookingStartTime.getTime() + (tileCount - 1) * 60 * 60 * 1000);
        const actualEnd = new Date(bookingStartTime.getTime() + 24 * 60 * 60 * 1000);
        hourStart = new Date(lastFullHourStart.getFullYear(), lastFullHourStart.getMonth(), lastFullHourStart.getDate(), lastFullHourStart.getHours(), 0, 0, 0);
        hourEnd = actualEnd;
        isPartial = actualEnd.getMinutes() > 0 || actualEnd.getSeconds() > 0;
      } else {
        // Full hour
        hourStart = i === 0
          ? new Date(tileStart)
          : new Date(tileStart.getFullYear(), tileStart.getMonth(), tileStart.getDate(), tileStart.getHours(), 0, 0, 0);
        hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
        isPartial = false;
      }

      try {
        const response = await fetch('/api/pricing/calculate-hourly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subLocationId: currentSubLocation._id,
            eventId: selectedEventId || undefined,
            startTime: hourStart.toISOString(),
            endTime: hourEnd.toISOString(),
            isEventBooking: isEventBooking,
          }),
        });

        if (response.ok) {
          const result: PricingResult = await response.json();
          breakdown.push({ hour: hourStart, hourEnd, rate: result.totalPrice, isPartial });
        }
      } catch (error) {
        console.error(`Failed to calculate hourly rate for hour ${i}:`, error);
      }
    }

    setHourlyBreakdown(breakdown);
  };

  const calculateAllRates = async () => {
    setLoading(true);

    // Initialize rate cards
    const initialCards = popularDurations.map(d => ({
      duration: d.hours,
      price: null,
      loading: true,
      isPopular: d.isPopular,
      badge: d.badge
    }));
    setRateCards(initialCards);

    // Calculate all rates in parallel
    const results = await Promise.all(
      popularDurations.map(async (d) => {
        const price = await calculatePricing(d.hours);
        return {
          duration: d.hours,
          price,
          loading: false,
          isPopular: d.isPopular,
          badge: d.badge
        };
      })
    );

    setRateCards(results);

    // Calculate hourly breakdown for selected duration
    await calculateHourlyBreakdown();

    // Calculate tiles based on time period
    if (timePeriod === 'hourly') {
      await calculateHourlyTiles();
    } else {
      await calculateDailyTiles();
    }

    setLastUpdated(new Date());
    setLoading(false);
  };

  const calculateHourlyTiles = async () => {
    if (!currentSubLocation) return;

    // Determine if first hour is partial (doesn't start on the hour)
    const firstHourMinutes = bookingStartTime.getMinutes();
    const firstHourSeconds = bookingStartTime.getSeconds();
    const isFirstHourPartial = firstHourMinutes > 0 || firstHourSeconds > 0;

    // Calculate tiles - if first hour is partial, we need 25 tiles to cover 24 full hours
    const tileCount = isFirstHourPartial ? 25 : 24;

    const initialTiles = Array.from({ length: tileCount }, (_, i) => {
      const tileStart = new Date(bookingStartTime.getTime() + i * 60 * 60 * 1000);
      // Round to the nearest hour mark
      if (i === 0 && isFirstHourPartial) {
        // First partial hour: from booking start to next hour mark
        return {
          hour: new Date(bookingStartTime),
          hourEnd: new Date(tileStart.getFullYear(), tileStart.getMonth(), tileStart.getDate(), tileStart.getHours() + 1, 0, 0, 0),
          price: null,
          loading: true,
          isPartial: true
        };
      } else if (i === tileCount - 1 && isFirstHourPartial) {
        // Last partial hour: from last hour mark to complete 24 hours
        const lastFullHourStart = new Date(bookingStartTime.getTime() + (tileCount - 1) * 60 * 60 * 1000);
        const actualEnd = new Date(bookingStartTime.getTime() + 24 * 60 * 60 * 1000);
        return {
          hour: new Date(lastFullHourStart.getFullYear(), lastFullHourStart.getMonth(), lastFullHourStart.getDate(), lastFullHourStart.getHours(), 0, 0, 0),
          hourEnd: actualEnd,
          price: null,
          loading: true,
          isPartial: actualEnd.getMinutes() > 0 || actualEnd.getSeconds() > 0
        };
      } else {
        // Full hour
        const hourStart = i === 0
          ? new Date(tileStart)
          : new Date(tileStart.getFullYear(), tileStart.getMonth(), tileStart.getDate(), tileStart.getHours(), 0, 0, 0);
        return {
          hour: hourStart,
          hourEnd: new Date(hourStart.getTime() + 60 * 60 * 1000),
          price: null,
          loading: true,
          isPartial: false
        };
      }
    });

    setHourlyTiles(initialTiles as any);

    // Calculate prices for each tile
    const tiles = await Promise.all(
      initialTiles.map(async (tile) => {
        try {
          const response = await fetch('/api/pricing/calculate-hourly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subLocationId: currentSubLocation._id,
              eventId: selectedEventId || undefined,
              startTime: tile.hour.toISOString(),
              endTime: tile.hourEnd.toISOString(),
              isEventBooking: isEventBooking,
            }),
          });

          if (response.ok) {
            const result: PricingResult = await response.json();
            return {
              hour: tile.hour,
              hourEnd: tile.hourEnd,
              price: result.totalPrice,
              loading: false,
              isPartial: tile.isPartial
            };
          }
        } catch (error) {
          console.error(`Failed to calculate price for ${tile.hour}:`, error);
        }

        return {
          hour: tile.hour,
          hourEnd: tile.hourEnd,
          price: null,
          loading: false,
          isPartial: tile.isPartial
        };
      })
    );

    setHourlyTiles(tiles);
  };

  const calculateDailyTiles = async () => {
    if (!currentSubLocation) return;

    const dayCount = 7; // Show 7 days
    const initialTiles = Array.from({ length: dayCount }, (_, i) => {
      const dayStart = new Date(bookingStartTime);
      dayStart.setHours(0, 0, 0, 0); // Start of day
      dayStart.setDate(dayStart.getDate() + i);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999); // End of day

      return {
        day: dayStart,
        dayEnd: dayEnd,
        price: null,
        loading: true,
      };
    });

    setDailyTiles(initialTiles);

    // Calculate prices for each day
    const tiles = await Promise.all(
      initialTiles.map(async (tile) => {
        try {
          const response = await fetch('/api/pricing/calculate-hourly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subLocationId: currentSubLocation._id,
              eventId: selectedEventId || undefined,
              startTime: tile.day.toISOString(),
              endTime: tile.dayEnd.toISOString(),
              isEventBooking: isEventBooking,
            }),
          });

          if (response.ok) {
            const result: PricingResult = await response.json();
            return {
              day: tile.day,
              dayEnd: tile.dayEnd,
              price: result.totalPrice,
              loading: false,
            };
          }
        } catch (error) {
          console.error(`Failed to calculate price for ${tile.day}:`, error);
        }

        return {
          day: tile.day,
          dayEnd: tile.dayEnd,
          price: null,
          loading: false,
        };
      })
    );

    setDailyTiles(tiles);
  };

  const getCardGradient = (isPopular: boolean) => {
    if (isPopular) {
      return 'bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500';
    }
    return 'bg-gradient-to-br from-slate-100 to-slate-200';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto p-6">
        {/* Modern Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-semibold mb-4 shadow-lg">
            <Sparkles className="w-4 h-4" />
            Live Pricing
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-3">
            Smart Parking Rates
          </h1>
          <p className="text-gray-600 text-lg">
            Dynamic pricing updated in real-time • Pay only for what you need
          </p>
        </div>

        {/* Filters - Modern card style */}
        <div className="mb-8">
          <PricingFilters
            selectedLocation={selectedLocation}
            selectedSubLocation={selectedSubLocation}
            selectedEventId={selectedEventId}
            onLocationChange={setSelectedLocation}
            onSubLocationChange={setSelectedSubLocation}
            onEventChange={setSelectedEventId}
            selectedDuration={12}
            onDurationChange={() => {}}
            useDurationContext={useDurationContext}
            bookingStartTime={bookingStartTime}
            onUseDurationContextChange={setUseDurationContext}
            onBookingStartTimeChange={setBookingStartTime}
            isEventBooking={isEventBooking}
            onIsEventBookingChange={setIsEventBooking}
            eventCount={activeEvents.length}
          />

          {/* Debug Panel */}
          {false && selectedSubLocation && (
            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 mt-6">
              <h3 className="text-sm font-bold text-green-900 mb-3 flex items-center gap-2">
                🟢 Digital Ratecard - Debug Info
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-green-600 font-medium">Booking Start Time:</div>
                  <div className="text-green-900 font-mono">{bookingStartTime.toISOString()}</div>
                </div>
                <div>
                  <div className="text-green-600 font-medium">Local Display:</div>
                  <div className="text-green-900 font-mono">{bookingStartTime.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-green-600 font-medium">Duration Context:</div>
                  <div className="text-green-900 font-mono">{useDurationContext ? '✅ ON' : '❌ OFF'}</div>
                </div>
                <div>
                  <div className="text-green-600 font-medium">Event Booking:</div>
                  <div className="text-green-900 font-mono">{isEventBooking ? '✅ YES' : '❌ NO'}</div>
                </div>
                <div>
                  <div className="text-green-600 font-medium">Selected Event:</div>
                  <div className="text-green-900 font-mono">{selectedEventId || 'Auto-detect'}</div>
                </div>
                <div>
                  <div className="text-green-600 font-medium">Active Events:</div>
                  <div className="text-green-900 font-mono">{activeEvents.length} detected</div>
                </div>
                <div>
                  <div className="text-green-600 font-medium">Time Period:</div>
                  <div className="text-green-900 font-mono">{timePeriod}</div>
                </div>
                <div>
                  <div className="text-green-600 font-medium">View Mode:</div>
                  <div className="text-green-900 font-mono">{viewMode}</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-green-200">
                <div className="text-green-600 font-medium mb-1">Check browser console for detailed API logs</div>
                <div className="text-green-700 text-xs">Look for 🟢 [DIGITAL-RATECARD] and 🔍 [API] prefixed messages</div>
              </div>
            </div>
          )}
        </div>

        {loading && !lastUpdated && (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="mt-4 text-gray-600 font-medium">Calculating live rates...</p>
          </div>
        )}

        {!loading && selectedSubLocation && currentLocation && currentSubLocation && (
          <>
            {/* Location Info Card - Modern glassmorphism style */}
            <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-xl border border-white/20 p-8 mb-8">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <MapPin className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{currentLocation.name}</h2>
                    <p className="text-gray-600">{currentSubLocation.label}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-sm text-blue-600">
                        <Clock className="w-4 h-4" />
                        <span>Booking from: {bookingStartTime.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })} at {formatTime(bookingStartTime)}</span>
                      </div>
                      {lastUpdated && (
                        <span className="text-xs text-gray-500">
                          • Updated: {formatTime(lastUpdated)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={copySettingsFromTimeline}
                    className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 flex items-center gap-2 font-semibold"
                    title="Copy date/time and toggles from Timeline View"
                  >
                    <Copy className="w-5 h-5" />
                    Copy from Timeline
                  </button>
                  <button
                    onClick={calculateAllRates}
                    disabled={loading}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
                  >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Rates
                  </button>
                </div>
              </div>

              {/* Active Events - Collapsible Section */}
              {activeEvents.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setEventsCollapsed(!eventsCollapsed)}
                    className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-pink-50 to-purple-50 border-2 border-pink-200 rounded-xl hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-pink-600" />
                      <h3 className="font-bold text-gray-900">
                        Upcoming Events ({activeEvents.length})
                      </h3>
                    </div>
                    {eventsCollapsed ? (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-gray-600" />
                    )}
                  </button>

                  {!eventsCollapsed && (
                    <div className="mt-4 space-y-4">
                      {activeEvents.map((event) => (
                    <div key={event._id} className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl border-2 border-pink-200 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-xl font-bold text-gray-900 mb-1">{event.name}</h4>
                          {event.description && (
                            <p className="text-sm text-gray-600">{event.description}</p>
                          )}
                        </div>
                        <div className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-full">
                          Upcoming
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Start Date */}
                        <div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <Calendar className="w-4 h-4" />
                            Start Date:
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {new Date(event.startDate).toLocaleDateString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric'
                            })}{' '}
                            {new Date(event.startDate).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </div>
                        </div>

                        {/* End Date */}
                        <div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <Calendar className="w-4 h-4" />
                            End Date:
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            {new Date(event.endDate).toLocaleDateString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: 'numeric'
                            })}{' '}
                            {new Date(event.endDate).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Grace Periods */}
                      <div className="mt-4 pt-4 border-t border-pink-200">
                        <h5 className="text-sm font-bold text-gray-700 mb-3">Grace Periods:</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-purple-50 rounded-lg p-3">
                            <div className="text-xs text-purple-600 mb-1">Before Event</div>
                            <div className="text-lg font-bold text-purple-700">
                              {event.gracePeriodBefore || 0} min
                            </div>
                            {event.gracePeriodBefore && event.gracePeriodBefore > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                When you come: {new Date(new Date(event.startDate).getTime() - event.gracePeriodBefore * 60 * 1000).toLocaleTimeString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </div>
                            )}
                          </div>

                          <div className="bg-purple-50 rounded-lg p-3">
                            <div className="text-xs text-purple-600 mb-1">After Event</div>
                            <div className="text-lg font-bold text-purple-700">
                              {event.gracePeriodAfter || 0} min
                            </div>
                            {event.gracePeriodAfter && event.gracePeriodAfter > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                When you go: {new Date(new Date(event.endDate).getTime() + event.gracePeriodAfter * 60 * 1000).toLocaleTimeString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Event Duration and Total Price */}
                      <div className="mt-4 pt-4 border-t border-pink-200">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Event Duration:</span>
                            <span className="font-bold text-pink-600">
                              {Math.ceil((new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / (1000 * 60 * 60))} hours
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Total with Grace:</span>
                            <span className="font-bold text-pink-600">
                              {(() => {
                                const graceBefore = event.gracePeriodBefore || 0;
                                const graceAfter = event.gracePeriodAfter || 0;
                                const eventStart = new Date(event.startDate);
                                const eventEnd = new Date(event.endDate);
                                const adjustedStart = new Date(eventStart.getTime() - graceBefore * 60 * 1000);
                                const adjustedEnd = new Date(eventEnd.getTime() + graceAfter * 60 * 1000);
                                return Math.ceil((adjustedEnd.getTime() - adjustedStart.getTime()) / (1000 * 60 * 60));
                              })()} hours
                            </span>
                          </div>
                        </div>

                        {/* Total Price */}
                        {eventPrices.has(event._id) && (
                          <div className="mt-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 text-white">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm opacity-90">Total Price (with grace periods)</div>
                                <div className="text-3xl font-bold mt-1">
                                  ${eventPrices.get(event._id)?.toFixed(2)}
                                </div>
                              </div>
                              <DollarSign className="w-10 h-10 opacity-50" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hourly Rate Chart */}
            {hourlyBreakdown.length > 0 && (
              <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-xl border border-white/20 p-8 mb-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">Hourly Rate Breakdown</h3>
                    <p className="text-sm text-gray-600">
                      Next {selectedDuration} hours starting from {formatTime(bookingStartTime)}
                    </p>
                  </div>

                  {/* Stats - Inline with title */}
                  <div className="flex gap-6 items-center mr-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">
                        ${Math.min(...hourlyBreakdown.map(h => h.rate)).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-600">Min</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">
                        ${(hourlyBreakdown.reduce((sum, h) => sum + h.rate, 0) / hourlyBreakdown.length).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-600">Avg</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-pink-600">
                        ${Math.max(...hourlyBreakdown.map(h => h.rate)).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-600">Max</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {[12, 24, 48].map(duration => (
                      <button
                        key={duration}
                        onClick={() => {
                          setSelectedDuration(duration);
                          if (currentSubLocation) {
                            calculateHourlyBreakdown();
                          }
                        }}
                        className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                          selectedDuration === duration
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                      >
                        {duration}h
                      </button>
                    ))}
                  </div>
                </div>

                {/* Simple Line Chart */}
                <div className="relative h-80 overflow-hidden">
                  <svg className="w-full h-full" viewBox="0 0 1000 320" preserveAspectRatio="xMidYMid meet">
                    {/* Background gradient */}
                    <defs>
                      <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
                      </linearGradient>
                      <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="50%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>

                    {/* Subtle grid lines - only horizontal */}
                    {[0, 1, 2, 3, 4].map(i => (
                      <line
                        key={`grid-${i}`}
                        x1="40"
                        y1={i * 60}
                        x2="1000"
                        y2={i * 60}
                        stroke="#e5e7eb"
                        strokeWidth="0.5"
                        opacity="0.5"
                      />
                    ))}

                    {/* Line chart */}
                    {hourlyBreakdown.length > 1 && (() => {
                      const maxRate = Math.max(...hourlyBreakdown.map(h => h.rate));
                      const minRate = Math.min(...hourlyBreakdown.map(h => h.rate));
                      const range = maxRate - minRate || 1;
                      const padding = range * 0.15;

                      const chartHeight = 240;
                      const chartBaseline = 240;
                      const leftMargin = 40;
                      const rightMargin = 20;
                      const chartWidth = 1000 - leftMargin - rightMargin;

                      const points = hourlyBreakdown.map((h, i) => {
                        const x = leftMargin + (i / (hourlyBreakdown.length - 1)) * chartWidth;
                        const normalizedRate = ((h.rate - minRate + padding) / (range + 2 * padding));
                        const y = chartBaseline - (normalizedRate * chartHeight);
                        return `${x},${y}`;
                      }).join(' ');

                      return (
                        <>
                          {/* Area fill with gradient */}
                          <polygon
                            points={`${leftMargin},${chartBaseline} ${points} ${leftMargin + chartWidth},${chartBaseline}`}
                            fill="url(#gradient)"
                          />

                          {/* Glow effect under the line */}
                          <polyline
                            points={points}
                            fill="none"
                            stroke="url(#lineGradient)"
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.2"
                            filter="blur(4px)"
                          />

                          {/* Main line */}
                          <polyline
                            points={points}
                            fill="none"
                            stroke="url(#lineGradient)"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          {/* Interactive points with improved tooltips */}
                          {hourlyBreakdown.map((h, i) => {
                            const x = leftMargin + (i / (hourlyBreakdown.length - 1)) * chartWidth;
                            const normalizedRate = ((h.rate - minRate + padding) / (range + 2 * padding));
                            const y = chartBaseline - (normalizedRate * chartHeight);

                            // Smart tooltip positioning to prevent cutoff
                            const isNearStart = i < hourlyBreakdown.length * 0.15;
                            const isNearEnd = i > hourlyBreakdown.length * 0.85;
                            const isNearTop = normalizedRate > 0.7;

                            let tooltipX = x;
                            let tooltipY = y - 55;

                            // Adjust for edges
                            if (isNearStart) tooltipX = Math.max(x, 80);
                            if (isNearEnd) tooltipX = Math.min(x, 920);
                            if (isNearTop) tooltipY = y + 60;

                            return (
                              <g key={i}>
                                {/* Glow effect on hover */}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="12"
                                  fill="url(#lineGradient)"
                                  opacity="0"
                                  className="transition-opacity duration-200"
                                  id={`glow-${i}`}
                                />

                                {/* Main point */}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="5"
                                  fill="#ffffff"
                                  stroke="url(#lineGradient)"
                                  strokeWidth="3"
                                  className="cursor-pointer transition-all duration-200"
                                  onMouseEnter={(e) => {
                                    const tooltip = document.getElementById(`tooltip-${i}`);
                                    const glow = document.getElementById(`glow-${i}`);
                                    if (tooltip) tooltip.style.display = 'block';
                                    if (glow) glow.style.opacity = '0.3';
                                    e.currentTarget.setAttribute('r', '7');
                                  }}
                                  onMouseLeave={(e) => {
                                    const tooltip = document.getElementById(`tooltip-${i}`);
                                    const glow = document.getElementById(`glow-${i}`);
                                    if (tooltip) tooltip.style.display = 'none';
                                    if (glow) glow.style.opacity = '0';
                                    e.currentTarget.setAttribute('r', '5');
                                  }}
                                />

                                {/* Enhanced tooltip */}
                                <g id={`tooltip-${i}`} style={{ display: 'none' }} pointerEvents="none">
                                  {/* Tooltip shadow */}
                                  <rect
                                    x={tooltipX - 62}
                                    y={tooltipY - 2}
                                    width="124"
                                    height="46"
                                    fill="rgba(0, 0, 0, 0.1)"
                                    rx="8"
                                    filter="blur(3px)"
                                  />
                                  {/* Tooltip background */}
                                  <rect
                                    x={tooltipX - 60}
                                    y={tooltipY}
                                    width="120"
                                    height="44"
                                    fill="rgba(15, 23, 42, 0.95)"
                                    rx="8"
                                    stroke="rgba(255, 255, 255, 0.1)"
                                    strokeWidth="1"
                                  />
                                  {/* Price */}
                                  <text
                                    x={tooltipX}
                                    y={tooltipY + 18}
                                    textAnchor="middle"
                                    fill="white"
                                    fontSize="14"
                                    fontWeight="bold"
                                  >
                                    ${h.rate.toFixed(2)}/hr
                                  </text>
                                  {/* Time */}
                                  <text
                                    x={tooltipX}
                                    y={tooltipY + 34}
                                    textAnchor="middle"
                                    fill="#94a3b8"
                                    fontSize="11"
                                  >
                                    {h.isPartial ? `${formatTime(h.hour)} → ${formatTime(h.hourEnd)}` : formatTime(h.hour)}
                                  </text>
                                  {/* Pointer arrow */}
                                  {!isNearTop ? (
                                    <polygon
                                      points={`${x},${y - 8} ${x - 6},${tooltipY + 44} ${x + 6},${tooltipY + 44}`}
                                      fill="rgba(15, 23, 42, 0.95)"
                                    />
                                  ) : (
                                    <polygon
                                      points={`${x},${y + 8} ${x - 6},${tooltipY} ${x + 6},${tooltipY}`}
                                      fill="rgba(15, 23, 42, 0.95)"
                                    />
                                  )}
                                </g>
                              </g>
                            );
                          })}

                          {/* X-axis time labels */}
                          {hourlyBreakdown.map((h, i) => {
                            // Show label every N hours depending on duration
                            const labelInterval = selectedDuration <= 12 ? 2 : selectedDuration <= 24 ? 4 : 8;
                            if (i % labelInterval !== 0 && i !== hourlyBreakdown.length - 1) return null;

                            const x = leftMargin + (i / (hourlyBreakdown.length - 1)) * chartWidth;
                            const showDayLabel = i === 0 || h.hour.getDate() !== hourlyBreakdown[i - 1]?.hour.getDate();

                            // For partial hours, show time range (e.g., "11:46 PM → 12:00 AM")
                            const timeLabel = h.isPartial
                              ? `${formatTime(h.hour)} → ${formatTime(h.hourEnd)}`
                              : formatTime(h.hour);

                            return (
                              <g key={`label-${i}`}>
                                {/* Vertical guide line */}
                                <line
                                  x1={x}
                                  y1={chartBaseline}
                                  x2={x}
                                  y2={chartBaseline + 8}
                                  stroke="#cbd5e1"
                                  strokeWidth="1.5"
                                />
                                {/* Time label */}
                                <text
                                  x={x}
                                  y={chartBaseline + 26}
                                  textAnchor="middle"
                                  fill="#64748b"
                                  fontSize="11"
                                  fontWeight="600"
                                >
                                  {timeLabel}
                                </text>
                                {/* Date label (if day changes) */}
                                {showDayLabel && (
                                  <text
                                    x={x}
                                    y={chartBaseline + 42}
                                    textAnchor="middle"
                                    fill="#94a3b8"
                                    fontSize="10"
                                    fontWeight="500"
                                  >
                                    {h.hour.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                          {/* Y-axis labels with lines */}
                          {[0, 1, 2, 3, 4].map(i => {
                            const maxRate = Math.max(...hourlyBreakdown.map(h => h.rate));
                            const rate = maxRate - (i * maxRate / 4);
                            const y = i * 60;

                            return (
                              <g key={`y-label-${i}`}>
                                <text
                                  x="30"
                                  y={y + 5}
                                  textAnchor="end"
                                  fill="#64748b"
                                  fontSize="11"
                                  fontWeight="600"
                                >
                                  ${rate.toFixed(0)}
                                </text>
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>
            )}

            {/* Hourly/Daily Tiles Section */}
            {(hourlyTiles.length > 0 || dailyTiles.length > 0) && (
              <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-xl border border-white/20 p-8 mb-12">
                {/* Header with Controls */}
                <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {timePeriod === 'hourly' ? 'Hourly Rates' : 'Daily Rates'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {timePeriod === 'hourly'
                        ? `24-hour breakdown starting from ${formatTime(bookingStartTime)}`
                        : `7-day breakdown starting from ${bookingStartTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      }
                    </p>
                  </div>

                  <div className="flex gap-3 items-center flex-wrap">
                    {/* Time Period Toggle */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTimePeriod('hourly')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${
                          timePeriod === 'hourly'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        Hourly
                      </button>
                      <button
                        onClick={() => setTimePeriod('daily')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${
                          timePeriod === 'daily'
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Calendar className="w-4 h-4" />
                        Daily
                      </button>
                    </div>

                    {/* Tiles per Row Selector (only in grid view) */}
                    {viewMode === 'grid' && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-700">Tiles/Row:</label>
                        <select
                          value={tilesPerRow}
                          onChange={(e) => setTilesPerRow(Number(e.target.value))}
                          className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-slate-900 bg-white"
                        >
                          <option value={4}>4</option>
                          <option value={6}>6</option>
                          <option value={8}>8</option>
                          <option value={12}>12</option>
                        </select>
                      </div>
                    )}

                    {/* View Mode Toggle */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${
                          viewMode === 'grid'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Grid3x3 className="w-4 h-4" />
                        Grid
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${
                          viewMode === 'list'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <List className="w-4 h-4" />
                        List
                      </button>
                    </div>
                  </div>
                </div>

                {/* Grid View */}
                {viewMode === 'grid' && timePeriod === 'hourly' && (
                  <div className={`grid gap-4 ${
                    tilesPerRow === 4 ? 'grid-cols-2 sm:grid-cols-4' :
                    tilesPerRow === 6 ? 'grid-cols-3 sm:grid-cols-6' :
                    tilesPerRow === 8 ? 'grid-cols-4 sm:grid-cols-8' :
                    'grid-cols-4 sm:grid-cols-12'
                  }`}>
                    {hourlyTiles.map((tile, index) => {
                      // Calculate surge
                      const allPrices = hourlyTiles.filter(t => t.price !== null).map(t => t.price || 0);
                      const avgPrice = allPrices.length > 0
                        ? allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length
                        : 0;
                      const isSurge = tile.price ? tile.price > avgPrice * 1.5 : false;

                      // Check for overlapping event
                      const overlappingEvent = activeEvents.find(event => {
                        const eventStart = new Date(event.startDate);
                        const eventEnd = new Date(event.endDate);
                        return eventEnd >= tile.hour && eventStart <= tile.hourEnd;
                      });

                      const isGracePeriod = tile.price === 0;

                      return (
                        <div
                          key={index}
                          className="relative group transition-all duration-300 hover:shadow-lg"
                        >
                          {/* Grace period badge (highest priority) */}
                          {isGracePeriod && !tile.loading && (
                            <div className="absolute -top-2 -right-2 z-10">
                              <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-1 rounded-full shadow-lg">
                                <Gift className="w-3 h-3" />
                              </div>
                            </div>
                          )}

                          {/* Event badge */}
                          {!isGracePeriod && overlappingEvent && (
                            <div className="absolute -top-2 -right-2 z-10">
                              <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-1 rounded-full shadow-lg">
                                <Calendar className="w-3 h-3" />
                              </div>
                            </div>
                          )}

                          {/* Surge indicator */}
                          {!isGracePeriod && !overlappingEvent && isSurge && tile.price && tile.price > 0 && (
                            <div className="absolute -top-2 -right-2 z-10">
                              <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-1 rounded-full shadow-lg animate-pulse">
                                <TrendingUp className="w-3 h-3" />
                              </div>
                            </div>
                          )}

                          {/* Partial hour indicator */}
                          {tile.isPartial && !tile.loading && (
                            <div className="absolute -top-2 -left-2 z-10">
                              <div className="bg-gradient-to-r from-amber-500 to-yellow-600 text-white p-1 rounded-full shadow-lg">
                                <AlertCircle className="w-3 h-3" />
                              </div>
                            </div>
                          )}

                          <div className="relative overflow-hidden rounded-xl p-3 h-full bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-slate-200 hover:border-blue-300 transition-colors">
                            {/* Hour range label */}
                            <div className="flex items-center gap-1 mb-2">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <div className="text-xs font-bold text-slate-700">
                                {formatTime(tile.hour)} → {formatTime(tile.hourEnd)}
                              </div>
                            </div>

                            {/* Date - ALWAYS show */}
                            <div className="text-xs text-slate-500 mb-2">
                              {tile.hour.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>

                            {/* Price */}
                            <div className="mb-2">
                              {tile.loading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                                </div>
                              ) : tile.price !== null ? (
                                <div className={`text-xl font-bold ${
                                  isGracePeriod ? 'text-green-600' : isSurge ? 'text-orange-600' : overlappingEvent ? 'text-purple-600' : 'text-slate-900'
                                }`}>
                                  ${tile.price.toFixed(2)}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-400">N/A</div>
                              )}
                            </div>

                            {/* Rate this Hr indicator */}
                            {tile.price !== null && !tile.loading && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                {isGracePeriod ? 'Grace Period' : 'Rate this Hr'}
                              </div>
                            )}

                            {/* Visual indicators */}
                            {isGracePeriod && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-600 rounded-b-xl"></div>
                            )}
                            {!isGracePeriod && isSurge && !overlappingEvent && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-600 rounded-b-xl"></div>
                            )}
                            {!isGracePeriod && overlappingEvent && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 to-purple-600 rounded-b-xl"></div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Daily Tiles - Grid View */}
                {viewMode === 'grid' && timePeriod === 'daily' && (
                  <div className={`grid gap-4 ${
                    tilesPerRow === 4 ? 'grid-cols-2 sm:grid-cols-4' :
                    tilesPerRow === 6 ? 'grid-cols-3 sm:grid-cols-6' :
                    tilesPerRow === 8 ? 'grid-cols-4 sm:grid-cols-7' :
                    'grid-cols-4 sm:grid-cols-7'
                  }`}>
                    {dailyTiles.map((tile, index) => {
                      // Calculate average hourly rate for this day
                      const avgHourlyRate = tile.price ? tile.price / 24 : 0;

                      // Check for overlapping events
                      const dayEvents = activeEvents.filter(event => {
                        const eventStart = new Date(event.startDate);
                        const eventEnd = new Date(event.endDate);
                        return eventEnd >= tile.day && eventStart <= tile.dayEnd;
                      });

                      const hasEvent = dayEvents.length > 0;

                      return (
                        <div
                          key={index}
                          className="relative group transition-all duration-300 hover:shadow-lg"
                        >
                          {/* Event badge */}
                          {hasEvent && (
                            <div className="absolute -top-2 -right-2 z-10">
                              <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-2 py-1 rounded-full shadow-lg text-xs font-bold">
                                {dayEvents.length} Event{dayEvents.length > 1 ? 's' : ''}
                              </div>
                            </div>
                          )}

                          <div className="relative overflow-hidden rounded-xl p-4 h-full bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-slate-200 hover:border-blue-300 transition-colors">
                            {/* Day of week */}
                            <div className="flex items-center gap-1 mb-2">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <div className="text-xs font-bold text-slate-700">
                                {tile.day.toLocaleDateString('en-US', { weekday: 'short' })}
                              </div>
                            </div>

                            {/* Full Date */}
                            <div className="text-sm font-semibold text-slate-700 mb-3">
                              {tile.day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>

                            {/* Daily Total Price */}
                            <div className="mb-2">
                              {tile.loading ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                                </div>
                              ) : tile.price !== null ? (
                                <>
                                  <div className={`text-2xl font-bold ${
                                    hasEvent ? 'text-purple-600' : 'text-slate-900'
                                  }`}>
                                    ${tile.price.toFixed(2)}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    Avg: ${avgHourlyRate.toFixed(2)}/hr
                                  </div>
                                </>
                              ) : (
                                <div className="text-xs text-slate-400">N/A</div>
                              )}
                            </div>

                            {/* Full Day label */}
                            {tile.price !== null && !tile.loading && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                Full Day Rate
                              </div>
                            )}

                            {/* Visual indicators */}
                            {hasEvent && (
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 to-purple-600 rounded-b-xl"></div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* List View - Hourly */}
                {viewMode === 'list' && timePeriod === 'hourly' && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-bold text-slate-700">Hour Range</th>
                          <th className="text-left py-3 px-4 text-sm font-bold text-slate-700">Date</th>
                          <th className="text-right py-3 px-4 text-sm font-bold text-slate-700">Rate</th>
                          <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">Status</th>
                          <th className="text-left py-3 px-4 text-sm font-bold text-slate-700">Event</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hourlyTiles.map((tile, index) => {
                          // Calculate surge
                          const allPrices = hourlyTiles.filter(t => t.price !== null).map(t => t.price || 0);
                          const avgPrice = allPrices.length > 0
                            ? allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length
                            : 0;
                          const isSurge = tile.price ? tile.price > avgPrice * 1.5 : false;

                          // Check for overlapping event
                          const overlappingEvent = activeEvents.find(event => {
                            const eventStart = new Date(event.startDate);
                            const eventEnd = new Date(event.endDate);
                            return eventEnd >= tile.hour && eventStart <= tile.hourEnd;
                          });

                          const isGracePeriod = tile.price === 0;

                          return (
                            <tr
                              key={index}
                              className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                                isGracePeriod ? 'bg-green-50/50' : overlappingEvent ? 'bg-purple-50/50' : isSurge ? 'bg-orange-50/50' : ''
                              }`}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-slate-400" />
                                  <span className="font-semibold text-slate-700">
                                    {formatTime(tile.hour)} → {formatTime(tile.hourEnd)}
                                  </span>
                                  {tile.isPartial && (
                                    <div className="inline-flex items-center">
                                      <AlertCircle className="w-3 h-3 text-amber-600" />
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-600">
                                {tile.hour.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {tile.loading ? (
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                                    <span className="text-xs text-slate-500">Loading...</span>
                                  </div>
                                ) : tile.price !== null ? (
                                  <div>
                                    <div className={`text-lg font-bold ${
                                      isGracePeriod ? 'text-green-600' : isSurge ? 'text-orange-600' : overlappingEvent ? 'text-purple-600' : 'text-slate-900'
                                    }`}>
                                      ${tile.price.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      {isGracePeriod ? 'Grace Period' : tile.isPartial ? 'Rate this Hr (partial)' : 'Rate this Hr'}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-400">N/A</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {isGracePeriod ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold rounded-full">
                                    <Gift className="w-3 h-3" />
                                    Grace
                                  </span>
                                ) : overlappingEvent ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold rounded-full">
                                    <Calendar className="w-3 h-3" />
                                    Event
                                  </span>
                                ) : isSurge && tile.price && tile.price > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-bold rounded-full">
                                    <TrendingUp className="w-3 h-3" />
                                    Surge
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 bg-slate-200 text-slate-600 text-xs font-medium rounded-full">
                                    Regular
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-600">
                                {overlappingEvent ? (
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-purple-700">
                                      {overlappingEvent.name}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* List View - Daily */}
                {viewMode === 'list' && timePeriod === 'daily' && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-bold text-slate-700">Day</th>
                          <th className="text-left py-3 px-4 text-sm font-bold text-slate-700">Date</th>
                          <th className="text-right py-3 px-4 text-sm font-bold text-slate-700">Daily Total</th>
                          <th className="text-right py-3 px-4 text-sm font-bold text-slate-700">Avg/Hour</th>
                          <th className="text-center py-3 px-4 text-sm font-bold text-slate-700">Events</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyTiles.map((tile, index) => {
                          // Calculate average hourly rate for this day
                          const avgHourlyRate = tile.price ? tile.price / 24 : 0;

                          // Check for overlapping events
                          const dayEvents = activeEvents.filter(event => {
                            const eventStart = new Date(event.startDate);
                            const eventEnd = new Date(event.endDate);
                            return eventEnd >= tile.day && eventStart <= tile.dayEnd;
                          });

                          const hasEvent = dayEvents.length > 0;

                          return (
                            <tr
                              key={index}
                              className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                                hasEvent ? 'bg-purple-50/50' : ''
                              }`}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-slate-400" />
                                  <span className="font-semibold text-slate-700">
                                    {tile.day.toLocaleDateString('en-US', { weekday: 'long' })}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-600">
                                {tile.day.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {tile.loading ? (
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                                    <span className="text-xs text-slate-500">Loading...</span>
                                  </div>
                                ) : tile.price !== null ? (
                                  <div>
                                    <div className={`text-lg font-bold ${
                                      hasEvent ? 'text-purple-600' : 'text-slate-900'
                                    }`}>
                                      ${tile.price.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-slate-400">Full Day</div>
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-400">N/A</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {tile.price !== null && !tile.loading ? (
                                  <div>
                                    <div className="text-lg font-bold text-slate-700">
                                      ${avgHourlyRate.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-slate-400">per hour</div>
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {hasEvent ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold rounded-full">
                                      <Calendar className="w-3 h-3" />
                                      {dayEvents.length} Event{dayEvents.length > 1 ? 's' : ''}
                                    </span>
                                    {dayEvents.map(event => (
                                      <div key={event._id} className="text-xs text-purple-700 font-medium">
                                        {event.name}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 bg-slate-200 text-slate-600 text-xs font-medium rounded-full">
                                    No Events
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Info Footer */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2">Real-Time Pricing</h3>
                    <p className="text-sm text-gray-300">
                      Rates update automatically based on demand, events, and time of day
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2">Instant Booking</h3>
                    <p className="text-sm text-gray-300">
                      Reserve your spot instantly through our mobile app or kiosk
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-pink-400" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-2">Flexible Options</h3>
                    <p className="text-sm text-gray-300">
                      Choose the duration that fits your needs - pay only for what you use
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-white/10 text-center">
                <p className="text-gray-300 mb-2">Need help? Contact us</p>
                <p className="text-2xl font-bold">(215) 247-6696</p>
              </div>
            </div>
          </>
        )}

        {!selectedSubLocation && !loading && (
          <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-xl border border-white/20 p-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Select a Location
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Choose a parking location from the filters above to view live pricing and available options
            </p>
          </div>
        )}
      </div>

      {/* Custom animations */}
      <style jsx global>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
