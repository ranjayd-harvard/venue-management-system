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
  ChevronUp,
  Filter
} from 'lucide-react';
import DecisionAuditPanel from '@/components/DecisionAuditPanel';
import PricingFiltersModal from '@/components/PricingFiltersModal';
import { Save, FolderOpen, X, Zap, FileText, Lock } from 'lucide-react';
import { PricingScenario, SurgeConfig } from '@/models/types';

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

interface PricingLayer {
  id: string;
  name: string;
  type: 'RATESHEET' | 'SUBLOCATION_DEFAULT' | 'LOCATION_DEFAULT' | 'CUSTOMER_DEFAULT' | 'SURGE';
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
  winningPrice?: number;        // Final price (surge if enabled, base otherwise)
  basePrice?: number;           // Base price before surge
  surgePrice?: number;          // Surge-adjusted price
  surgeMultiplier?: number;     // The surge factor applied
  decisionLog?: any;
  pricingData?: any;
  capacity?: {
    allocated: number;
    max: number;
    available: number;
  };
  eventNames?: string[]; // Changed from eventName to eventNames array
  events?: Array<{ name: string; priority: number }>; // Store events with priority for sorting
}

export default function TimelineSimulatorPage() {
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [ratesheets, setRatesheets] = useState<Ratesheet[]>([]);
  const [loading, setLoading] = useState(false);

  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentSubLocation, setCurrentSubLocation] = useState<SubLocation | null>(null);
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);

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

  // Layer enable/disable state (tracks which layers are enabled)
  const [enabledLayers, setEnabledLayers] = useState<Set<string>>(new Set());

  // Pricing coefficients (placeholders for future use)
  const [pricingCoefficientsUp, setPricingCoefficientsUp] = useState<number | undefined>(undefined);
  const [pricingCoefficientsDown, setPricingCoefficientsDown] = useState<number | undefined>(undefined);
  const [bias, setBias] = useState<number | undefined>(undefined);

  // Modal state
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [isSaveScenarioModalOpen, setIsSaveScenarioModalOpen] = useState(false);
  const [saveScenarioName, setSaveScenarioName] = useState('');
  const [saveScenarioDescription, setSaveScenarioDescription] = useState('');

  // Scenario state
  const [scenarios, setScenarios] = useState<PricingScenario[]>([]);
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);

  // Mode toggles: independent simulation and planning flags
  const [isSimulationEnabled, setIsSimulationEnabled] = useState(false);
  const [isPlanningEnabled, setIsPlanningEnabled] = useState(false);

  // Surge pricing state
  const [surgeEnabled, setSurgeEnabled] = useState<boolean>(false);
  const [activeSurgeConfig, setActiveSurgeConfig] = useState<SurgeConfig | null>(null);

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
    } else {
      setRatesheets([]);
      setCurrentSubLocation(null);
      setSelectedEventId('');
      setCurrentEvent(null);
    }
  }, [selectedSubLocation]); // Only refetch when sublocation changes, not when range changes

  useEffect(() => {
    console.log('🎯 selectedEventId changed:', selectedEventId);
    if (selectedSubLocation) {
      fetchRatesheets(selectedSubLocation);
    }
    if (selectedEventId) {
      fetchEventDetails(selectedEventId);
    } else {
      setCurrentEvent(null);
      console.log('⚠️  No event selected, cleared currentEvent');
    }
  }, [selectedEventId]);

  // Sync view window with booking start time when duration context is enabled
  useEffect(() => {
    if (useDurationContext) {
      setViewStart(new Date(bookingStartTime));
      setViewEnd(new Date(bookingStartTime.getTime() + selectedDuration * 60 * 60 * 1000));
    }
  }, [useDurationContext, bookingStartTime]);

  // Initialize all layers as enabled when layers change
  useEffect(() => {
    const allLayers = getPricingLayers();
    const allLayerIds = new Set(allLayers.map(l => l.id));
    setEnabledLayers(allLayerIds);
  }, [ratesheets, currentSubLocation, currentLocation, currentCustomer]);

  useEffect(() => {
    if (currentSubLocation || currentLocation || currentCustomer) {
      calculateTimeSlots().catch(error => {
        console.error('Error calculating time slots:', error);
      });
    }
  }, [ratesheets, viewStart, viewEnd, currentSubLocation, currentLocation, currentCustomer, useDurationContext, bookingStartTime, isEventBooking, enabledLayers, currentEvent, surgeEnabled, activeSurgeConfig]);

  // Load scenarios when sublocation changes
  useEffect(() => {
    if (selectedSubLocation) {
      loadScenarios();
      loadSurgeConfig();
    }
  }, [selectedSubLocation]);

  // Apply surge pricing when surge is toggled or context changes
  // NOTE: Surge pricing is now handled automatically in /api/pricing/calculate-hourly
  // No separate surge calculation needed - it's integrated into the pricing waterfall

  // Automatically enable SURGE layer when surge is toggled on
  useEffect(() => {
    if (surgeEnabled && activeSurgeConfig) {
      // Add surge layer to enabled layers
      setEnabledLayers(prev => {
        const newSet = new Set(prev);
        newSet.add('surge-layer');
        return newSet;
      });
    } else {
      // Remove surge layer from enabled layers when disabled
      setEnabledLayers(prev => {
        const newSet = new Set(prev);
        newSet.delete('surge-layer');
        return newSet;
      });
    }
  }, [surgeEnabled, activeSurgeConfig])

  const fetchPricingConfig = async () => {
    try {
      const response = await fetch('/api/pricing/config');
      const data = await response.json();
      setPricingConfig(data.pricingConfig);
    } catch (error) {
      console.error('Failed to fetch pricing config:', error);
    }
  };

  // Load scenarios for current sublocation
  const loadScenarios = async () => {
    if (!selectedSubLocation) return;

    try {
      const url = new URL('/api/pricing-scenarios', window.location.origin);
      url.searchParams.set('subLocationId', selectedSubLocation);
      url.searchParams.set('resolveHierarchy', 'true');

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        setScenarios(data.filter((s: PricingScenario) => s.isActive));
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error);
    }
  };

  // Load surge config for current sublocation
  const loadSurgeConfig = async () => {
    if (!selectedSubLocation) {
      setActiveSurgeConfig(null);
      return;
    }

    try {
      const url = new URL('/api/surge-pricing/configs', window.location.origin);
      url.searchParams.set('subLocationId', selectedSubLocation);

      const response = await fetch(url.toString());
      if (response.ok) {
        const configs = await response.json();
        const activeConfig = configs.find((c: SurgeConfig) => c.isActive);
        setActiveSurgeConfig(activeConfig || null);
      }
    } catch (error) {
      console.error('Failed to load surge config:', error);
      setActiveSurgeConfig(null);
    }
  };

  // NOTE: Surge pricing is now integrated into the main pricing calculation
  // The /api/pricing/calculate-hourly endpoint automatically includes surge when enabled

  // Save current state as a scenario
  const saveScenario = async () => {
    if (!selectedSubLocation) {
      alert('Please select a sublocation first');
      return;
    }

    // Open the modal instead of using prompt
    setIsSaveScenarioModalOpen(true);
  };

  // Handle actual scenario save from modal
  const handleSaveScenarioSubmit = async () => {
    if (!saveScenarioName.trim()) {
      alert('Please enter a scenario name');
      return;
    }

    try {
      const config: any = {
        enabledLayers: Array.from(enabledLayers),
        selectedDuration,
        isEventBooking,
        viewStart: viewStart.toISOString(),
        viewEnd: viewEnd.toISOString(),
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
        useDurationContext,
        bookingStartTime: bookingStartTime.toISOString(),
      };

      // Add pricing coefficients if they're set
      if (pricingCoefficientsUp !== undefined) {
        config.pricingCoefficientsUp = pricingCoefficientsUp;
      }
      if (pricingCoefficientsDown !== undefined) {
        config.pricingCoefficientsDown = pricingCoefficientsDown;
      }
      if (bias !== undefined) {
        config.bias = bias;
      }

      const response = await fetch('/api/pricing-scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveScenarioName,
          description: saveScenarioDescription || undefined,
          appliesTo: {
            level: 'SUBLOCATION',
            entityId: selectedSubLocation,
          },
          config,
          isActive: true,
        }),
      });

      if (response.ok) {
        const scenario = await response.json();
        setCurrentScenarioId(scenario._id);
        alert(`Scenario "${saveScenarioName}" saved successfully!`);
        loadScenarios(); // Reload scenarios list

        // Close modal and reset form
        setIsSaveScenarioModalOpen(false);
        setSaveScenarioName('');
        setSaveScenarioDescription('');
      } else {
        const error = await response.json();
        alert(`Failed to save scenario: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to save scenario:', error);
      alert('Failed to save scenario');
    }
  };

  // Load a scenario
  const loadScenario = (scenario: PricingScenario) => {
    const { config } = scenario;

    setEnabledLayers(new Set(config.enabledLayers));
    setSelectedDuration(config.selectedDuration);
    setIsEventBooking(config.isEventBooking);
    setViewStart(new Date(config.viewStart));
    setViewEnd(new Date(config.viewEnd));
    setRangeStart(new Date(config.rangeStart));
    setRangeEnd(new Date(config.rangeEnd));
    setUseDurationContext(config.useDurationContext || false);
    setBookingStartTime(config.bookingStartTime ? new Date(config.bookingStartTime) : new Date(config.viewStart));

    // Restore pricing coefficients if they exist
    setPricingCoefficientsUp(config.pricingCoefficientsUp);
    setPricingCoefficientsDown(config.pricingCoefficientsDown);
    setBias(config.bias);

    setCurrentScenarioId(scenario._id?.toString() || null);
    alert(`Loaded scenario: ${scenario.name}`);
  };

  // Clear/reset current scenario
  const clearScenario = () => {
    setCurrentScenarioId(null);

    // Reset to default state - enable ALL layers (default simulation state)
    const allLayerIds = getPricingLayers().map(layer => layer.id);
    setEnabledLayers(new Set(allLayerIds));

    // Clear pricing coefficients
    setPricingCoefficientsUp(undefined);
    setPricingCoefficientsDown(undefined);
    setBias(undefined);
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

  const fetchEventDetails = async (eventId: string) => {
    try {
      console.log('🔍 Fetching event details for eventId:', eventId);
      const response = await fetch(`/api/events/${eventId}`);
      const event = await response.json();
      console.log('✅ Event fetched:', event);
      setCurrentEvent(event);
    } catch (error) {
      console.error('Failed to fetch event details:', error);
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

    // Add SURGE layer if surge is enabled and active
    if (surgeEnabled && activeSurgeConfig) {
      layers.push({
        id: 'surge-layer',
        name: `🔥 SURGE: ${activeSurgeConfig.name}`,
        type: 'SURGE',
        priority: 10000,
        color: 'bg-gradient-to-br from-orange-400 to-orange-600',
        applyTo: 'SURGE'
      });
    }

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

  const calculateTimeSlots = async () => {
    const slots: TimeSlot[] = [];

    // Round viewStart down to the start of the hour
    const roundedViewStart = new Date(viewStart);
    roundedViewStart.setMinutes(0, 0, 0);

    const currentTime = new Date(roundedViewStart);

    // Calculate end time based on selectedDuration to ensure we get exactly 12, 24, or 48 hours
    const roundedViewEnd = new Date(roundedViewStart);
    roundedViewEnd.setHours(roundedViewEnd.getHours() + selectedDuration);

    const endTime = new Date(roundedViewEnd);

    const allLayers = getPricingLayers();

    // Fetch all active events to determine which event is active for each hour
    let allEvents: Event[] = [];
    try {
      const eventsResponse = await fetch('/api/events');
      if (eventsResponse.ok) {
        allEvents = await eventsResponse.json();
        console.log('📅 Fetched all events:', allEvents.length);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }

    // Fetch capacity data for the entire time range
    let capacityData: any = null;
    if (selectedSubLocation) {
      try {
        const response = await fetch('/api/capacity/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subLocationId: selectedSubLocation,
            startTime: roundedViewStart.toISOString(),
            endTime: roundedViewEnd.toISOString(),
            eventId: selectedEventId || undefined,
          }),
        });
        if (response.ok) {
          capacityData = await response.json();
        }
      } catch (error) {
        console.error('Failed to fetch capacity data:', error);
      }
    }

    // Fetch pricing data from API
    // When surge is enabled, we need BOTH base and surge prices
    let basePricingData: any = null;
    let surgePricingData: any = null;

    console.log('🔍 API Fetch Check:', {
      selectedSubLocation,
      surgeEnabled,
      roundedViewStart: roundedViewStart.toISOString(),
      roundedViewEnd: roundedViewEnd.toISOString()
    });

    if (selectedSubLocation) {
      try {
        if (surgeEnabled) {
          // Fetch base prices (without surge)
          console.log('💰 Fetching base pricing data (surge OFF)');
          const baseResponse = await fetch('/api/pricing/calculate-hourly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subLocationId: selectedSubLocation,
              startTime: roundedViewStart.toISOString(),
              endTime: roundedViewEnd.toISOString(),
              eventId: selectedEventId || undefined,
              includeSurge: false,
            }),
          });
          if (baseResponse.ok) {
            basePricingData = await baseResponse.json();
          }

          // Fetch surge prices (with surge)
          console.log('💰 Fetching surge pricing data (surge ON)');
          const surgeResponse = await fetch('/api/pricing/calculate-hourly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subLocationId: selectedSubLocation,
              startTime: roundedViewStart.toISOString(),
              endTime: roundedViewEnd.toISOString(),
              eventId: selectedEventId || undefined,
              includeSurge: true,
            }),
          });
          if (surgeResponse.ok) {
            surgePricingData = await surgeResponse.json();
            console.log('💰 Surge pricing data received:', {
              totalPrice: surgePricingData.totalPrice,
              segments: surgePricingData.segments?.length,
              hasSurgeRatesheets: surgePricingData.segments?.some((s: any) => s.ratesheet?.level === 'SURGE')
            });
          }
        } else {
          // Just fetch base prices
          console.log('💰 Fetching pricing data (surge OFF)');
          const response = await fetch('/api/pricing/calculate-hourly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subLocationId: selectedSubLocation,
              startTime: roundedViewStart.toISOString(),
              endTime: roundedViewEnd.toISOString(),
              eventId: selectedEventId || undefined,
              includeSurge: false,
            }),
          });
          if (response.ok) {
            basePricingData = await response.json();
            console.log('📊 Base pricing data received:', {
              totalPrice: basePricingData.totalPrice,
              totalHours: basePricingData.totalHours,
              segments: basePricingData.segments?.length,
              firstSegment: basePricingData.segments?.[0],
              lastSegment: basePricingData.segments?.[basePricingData.segments.length - 1]
            });
            console.log('📊 First 3 segments:', basePricingData.segments?.slice(0, 3).map((seg: any) => ({
              startTime: seg.startTime,
              pricePerHour: seg.pricePerHour
            })));
          } else {
            console.error('❌ Base pricing API failed:', response.status, response.statusText);
          }
        }
      } catch (error) {
        console.error('Failed to fetch pricing data:', error);
      }
    }

    let iterationCount = 0;
    while (currentTime < endTime) {
      // Use UTC hours for consistent timezone handling
      const hour = currentTime.getUTCHours();
      const timeStr = `${hour.toString().padStart(2, '0')}:00`;
      iterationCount++;

      // For each layer, check if it applies at this hour
      const layerPrices = allLayers.map(layer => {
        let price: number | null = null;
        let isActive = false;

        if (layer.type === 'SURGE') {
          // SURGE layer - store the multiplier, not absolute price
          // We'll apply it dynamically to the current base price
          if (surgePricingData?.segments) {
            const segment = surgePricingData.segments.find((seg: any) => {
              const segStart = new Date(seg.startTime);
              return segStart.getTime() === currentTime.getTime();
            });

            if (hour === 4) {
              console.log('🐛 [4 AM SURGE LAYER] Checking surge segment:');
              console.log('   segment found:', !!segment);
              console.log('   segment.ratesheet?.level:', segment?.ratesheet?.level);
              console.log('   segment.pricePerHour:', segment?.pricePerHour);
            }

            // Must have both a segment AND that segment's winning ratesheet must be SURGE level
            // If surge was skipped for this hour, segment.ratesheet.level won't be 'SURGE'
            if (segment && segment.ratesheet?.level === 'SURGE') {
              // Store the MULTIPLIER (the backend now returns the final price after applying surge)
              // We need to calculate the multiplier from base vs surge price
              const baseSegment = basePricingData?.segments.find((seg: any) => {
                const segStart = new Date(seg.startTime);
                return segStart.getTime() === currentTime.getTime();
              });

              if (baseSegment && baseSegment.pricePerHour > 0) {
                // Calculate multiplier: surge_price / base_price
                const surgeMultiplier = segment.pricePerHour / baseSegment.pricePerHour;
                price = surgeMultiplier; // Store multiplier for later application
                isActive = true;

                if (hour === 4) {
                  console.log('🐛 [4 AM SURGE LAYER] Calculating multiplier:');
                  console.log('   baseSegment.pricePerHour:', baseSegment.pricePerHour);
                  console.log('   segment.pricePerHour:', segment.pricePerHour);
                  console.log('   calculated multiplier:', surgeMultiplier);
                }
              }
            }
            // If no SURGE ratesheet for this hour, leave isActive = false (grayed out tile)
          }
        } else if (layer.type === 'RATESHEET') {
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
                  price = matchingWindow.pricePerHour;
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

      // Winner is the first active layer (highest priority) that is also enabled
      let winner = layerPrices.find(lp => lp.isActive && enabledLayers.has(lp.layer.id));

      // If SURGE layer won, apply multiplier to base price dynamically
      if (winner && winner.layer.type === 'SURGE' && winner.price !== null) {
        const surgeMultiplier = winner.price; // This is the multiplier

        // Find the next non-SURGE winner
        const baseWinner = layerPrices.find(lp =>
          lp.isActive &&
          enabledLayers.has(lp.layer.id) &&
          lp.layer.type !== 'SURGE'
        );

        if (baseWinner && baseWinner.price !== null) {
          // Apply multiplier to base price
          const surgePrice = baseWinner.price * surgeMultiplier;
          winner = {
            ...winner,
            price: surgePrice // Override with calculated surge price
          };
        }
      }

      // Find capacity for this hour
      let capacityForHour = undefined;
      if (capacityData?.segments) {
        const segment = capacityData.segments.find((seg: any) => {
          const segStart = new Date(seg.startTime);
          const segEnd = new Date(seg.endTime);
          return currentTime >= segStart && currentTime < segEnd;
        });
        if (segment) {
          capacityForHour = {
            allocated: segment.allocatedCapacity,
            max: segment.maxCapacity,
            available: segment.availableCapacity,
          };
        }
      }

      // Find all events that are active during this hour
      const slotStart = new Date(currentTime);
      const slotEnd = new Date(currentTime.getTime() + 60 * 60 * 1000); // +1 hour
      const activeEvents = allEvents.filter(event => {
        if (!event.isActive) return false;
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);
        // Check if the event overlaps with this hour slot
        return eventStart < slotEnd && eventEnd > slotStart;
      });

      // Get event priorities from ratesheets and filter by enabled layers and sublocation
      const eventsWithPriority = activeEvents
        .map(event => {
          // Find the ratesheet for this event to get its priority
          // Try multiple matching strategies: eventId, event._id, or event.name
          const eventRatesheet = ratesheets.find(rs => {
            if (rs.applyTo !== 'EVENT') return false;

            // Strategy 1: Match by eventId field
            if (rs.eventId && rs.eventId === event._id.toString()) {
              return true;
            }

            // Strategy 2: Match by nested event._id
            if (rs.event?._id && rs.event._id.toString() === event._id.toString()) {
              return true;
            }

            // Strategy 3: Match by event name (fallback for auto-generated ratesheets like "Auto-event7")
            if (rs.event?.name === event.name) {
              return true;
            }

            return false;
          });

          if (eventRatesheet) {
            console.log(`✅ Found ratesheet for ${event.name}: ${eventRatesheet.name} (priority: ${eventRatesheet.priority}), sublocation: ${eventRatesheet.subLocationId}`);
          } else {
            console.log(`⚠️  No ratesheet found for event: ${event.name} (_id: ${event._id})`);
          }

          return {
            name: event.name,
            priority: eventRatesheet?.priority || 0,
            ratesheetId: eventRatesheet?._id?.toString(),
            subLocationId: eventRatesheet?.subLocationId?.toString() || event.subLocationId?.toString()
          };
        })
        // Filter by sublocation, enabled layers, and ratesheet availability
        .filter(event => {
          if (!event.ratesheetId) return false;
          if (!enabledLayers.has(event.ratesheetId)) return false;

          // Only include events that belong to the selected sublocation
          if (event.subLocationId && selectedSubLocation) {
            return event.subLocationId === selectedSubLocation;
          }

          return true;
        });

      // Sort events by priority (descending - highest priority first)
      eventsWithPriority.sort((a, b) => b.priority - a.priority);

      const eventNames = eventsWithPriority.map(e => e.name);

      // Find pricing data from API for this hour
      let apiBasePrice = undefined;
      let apiSurgePrice = undefined;
      let apiWinningPrice = undefined;
      let apiSurgeMultiplier = undefined;

      // Get base price
      if (basePricingData?.segments) {
        const segment = basePricingData.segments.find((seg: any) => {
          const segStart = new Date(seg.startTime);
          return segStart.getTime() === currentTime.getTime();
        });
        if (segment) {
          apiBasePrice = segment.pricePerHour;
        }

        // Debug: Log segment matching for first few iterations
        if (iterationCount <= 5) {
          console.log(`🐛 [Iteration ${iterationCount}, Hour ${hour}] Base price segment matching:`, {
            currentTime: currentTime.toISOString(),
            currentTimeMs: currentTime.getTime(),
            totalSegments: basePricingData.segments.length,
            segmentFound: !!segment,
            apiBasePrice,
            firstSegmentStart: basePricingData.segments[0]?.startTime,
            firstSegmentStartMs: new Date(basePricingData.segments[0]?.startTime).getTime()
          });
        }
      }

      // Get surge price if enabled
      if (surgeEnabled && surgePricingData?.segments) {
        const segment = surgePricingData.segments.find((seg: any) => {
          const segStart = new Date(seg.startTime);
          return segStart.getTime() === currentTime.getTime();
        });
        if (segment) {
          apiSurgePrice = segment.pricePerHour;
          // Calculate surge multiplier from base and surge prices
          if (apiBasePrice && apiBasePrice > 0) {
            apiSurgeMultiplier = apiSurgePrice / apiBasePrice;
          }
        }
      }

      // Winning price logic:
      // - In simulation mode: Use layer-based winner (respects layer toggles)
      // - Otherwise: Use surge price if surge enabled, otherwise base price
      let finalWinningPrice: number | undefined;
      let finalBasePrice: number | undefined;

      if (isSimulationEnabled) {
        // Simulation mode: respect layer toggles
        // Winner is already calculated at line 880-901 and respects enabledLayers
        // If SURGE won, winner.price has already been recalculated dynamically
        finalWinningPrice = winner?.price !== undefined && winner?.price !== null ? winner.price : undefined;

        // Debug logging
        if (hour === 4) {
          console.log('🐛 [4 AM DEBUG] Simulation Mode:');
          console.log('   Winner:', winner?.layer.name, winner?.layer.type);
          console.log('   Winner Price:', winner?.price);
          console.log('   Final Winning Price:', finalWinningPrice);
          console.log('   Enabled Layers:', Array.from(enabledLayers));
        }

        // For base price in simulation mode:
        // - If SURGE layer is winning AND enabled, find the non-surge layer winner for base price
        // - Otherwise, base price = winning price (no strikethrough needed)
        if (winner?.layer.type === 'SURGE' && enabledLayers.has('surge-layer')) {
          // Find the winning non-SURGE layer for the base price
          const nonSurgeWinner = layerPrices.find(lp =>
            lp.isActive &&
            enabledLayers.has(lp.layer.id) &&
            lp.layer.type !== 'SURGE'
          );
          finalBasePrice = nonSurgeWinner?.price ?? apiBasePrice;
        } else {
          finalBasePrice = finalWinningPrice; // Same as winning price when not showing surge
        }
      } else {
        // Normal mode: use API pricing
        apiWinningPrice = surgeEnabled ? apiSurgePrice : apiBasePrice;
        finalWinningPrice = apiWinningPrice;
        finalBasePrice = apiBasePrice;

        // Debug: Log normal mode pricing for first few iterations
        if (iterationCount <= 5) {
          console.log(`🐛 [Iteration ${iterationCount}, Hour ${hour}] Normal mode pricing:`, {
            surgeEnabled,
            apiBasePrice,
            apiSurgePrice,
            apiWinningPrice,
            finalWinningPrice,
            finalBasePrice
          });
        }
      }

      // Calculate dynamic surge price in simulation mode
      let finalSurgePrice = apiSurgePrice;
      if (isSimulationEnabled && winner?.layer.type === 'SURGE' && enabledLayers.has('surge-layer')) {
        // In simulation mode, if SURGE is winning, calculate surge price from current base
        const nonSurgeWinner = layerPrices.find(lp =>
          lp.isActive &&
          enabledLayers.has(lp.layer.id) &&
          lp.layer.type !== 'SURGE'
        );
        if (nonSurgeWinner && nonSurgeWinner.price !== null && apiSurgeMultiplier !== undefined) {
          finalSurgePrice = nonSurgeWinner.price * apiSurgeMultiplier;
        }
      }

      if (hour === 4 && currentTime.getDate() === 29) {
        console.log('🐛 [4 AM JAN 29] Setting slot values:');
        console.log('   finalWinningPrice:', finalWinningPrice);
        console.log('   finalBasePrice:', finalBasePrice);
        console.log('   apiSurgePrice:', apiSurgePrice);
        console.log('   finalSurgePrice:', finalSurgePrice);
        console.log('   apiSurgeMultiplier:', apiSurgeMultiplier);
        console.log('   isSimulationEnabled:', isSimulationEnabled);
        console.log('   surgeEnabled:', surgeEnabled);
        console.log('   enabledLayers.has("surge-layer"):', enabledLayers.has('surge-layer'));
        console.log('   Winner layer:', winner?.layer.name, winner?.layer.type);
        console.log('   Winner price:', winner?.price);
        console.log('   apiWinningPrice:', apiWinningPrice);
        console.log('   apiBasePrice:', apiBasePrice);
        console.log('   Date:', currentTime.toISOString());
      }

      slots.push({
        hour,
        label: formatHour(hour),
        date: new Date(currentTime),
        layers: layerPrices,
        winningLayer: winner?.layer,
        // Use final winning price (respects simulation mode and layer toggles)
        winningPrice: finalWinningPrice !== undefined ? finalWinningPrice : (apiWinningPrice !== undefined ? apiWinningPrice : undefined),
        basePrice: finalBasePrice !== undefined ? finalBasePrice : (apiWinningPrice !== undefined ? apiWinningPrice : undefined),
        surgePrice: finalSurgePrice,
        surgeMultiplier: apiSurgeMultiplier,
        capacity: capacityForHour,
        eventNames: eventNames.length > 0 ? eventNames : undefined,
        events: eventsWithPriority.length > 0 ? eventsWithPriority : undefined,
      });

      // Debug log for event names with priority
      if (eventsWithPriority.length > 0) {
        const eventInfo = eventsWithPriority.map(e => `${e.name}(${e.priority})`).join(', ');
        console.log(`📌 Slot ${slots.length - 1} (${formatHour(hour)}): events = [${eventInfo}]`);
      }

      currentTime.setHours(currentTime.getHours() + 1);
    }

    // NOTE: Surge pricing now happens automatically in the pricing engine (SURGE ratesheets)
    // No post-processing needed - surge ratesheets are generated and applied in the pricing waterfall
    console.log('🔍 Surge enabled:', surgeEnabled, '| Active config:', !!activeSurgeConfig);

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
    return surgeEnabled ? getTotalSurgeCost() : getTotalBaseCost();
  };

  const getTotalBaseCost = (): number => {
    return timeSlots.reduce((sum, slot) => sum + (slot.winningPrice || 0), 0);
  };

  const getTotalSurgeCost = (): number => {
    return timeSlots.reduce((sum, slot) => {
      return sum + (slot.surgePrice || slot.winningPrice || 0);
    }, 0);
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

      const requestBody: {
        subLocationId: string;
        startTime: string;
        endTime: string;
        eventId?: string;
      } = {
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

  const toggleLayer = (layerId: string) => {
    console.log('🔄 [toggleLayer] Attempting to toggle:', layerId);

    setEnabledLayers(prev => {
      const newSet = new Set(prev);
      const allLayers = getPricingLayers();

      console.log('🔄 [toggleLayer] Current state:', {
        layerId,
        currentlyEnabled: Array.from(prev),
        allLayers: allLayers.map(l => ({ id: l.id, name: l.name, type: l.type }))
      });

      // Check if trying to disable a layer
      if (newSet.has(layerId)) {
        const layerToDisable = allLayers.find(l => l.id === layerId);

        // Count enabled DEFAULT layers AFTER removing this layer
        // DEFAULT layers are always active (no time windows), so we need at least one
        const enabledDefaultLayersAfterDisable = Array.from(newSet)
          .filter(id => id !== layerId) // Exclude the layer being disabled
          .filter(id => {
            const layer = allLayers.find(l => l.id === id);
            return layer && (
              layer.type === 'SUBLOCATION_DEFAULT' ||
              layer.type === 'LOCATION_DEFAULT' ||
              layer.type === 'CUSTOMER_DEFAULT'
            );
          });

        console.log('🔄 [toggleLayer] Disabling check:', {
          layerToDisable: layerToDisable?.name,
          layerType: layerToDisable?.type,
          enabledDefaultLayersAfterDisable: enabledDefaultLayersAfterDisable.length,
          willBlock: enabledDefaultLayersAfterDisable.length === 0
        });

        // Prevent disabling if it would leave zero DEFAULT layers
        // This ensures there's always at least one always-active pricing layer
        if (enabledDefaultLayersAfterDisable.length === 0) {
          console.log('⚠️ BLOCKED: Cannot disable layer - at least one DEFAULT layer must remain enabled:', layerId);
          return prev; // Return unchanged
        }

        // Allow disabling this layer
        console.log('✅ Allowing disable of:', layerId);
        newSet.delete(layerId);
      } else {
        // Enabling a layer is always allowed
        console.log('✅ Enabling layer:', layerId);
        newSet.add(layerId);
      }

      console.log('🔄 [toggleLayer] New enabled layers:', Array.from(newSet));
      return newSet;
    });
  };

  const allLayers = getPricingLayers();
  const counts = {
    event: ratesheets.filter(rs => rs.applyTo === 'EVENT').length,
    total: ratesheets.length
  };

  // Debug logging
  useEffect(() => {
    console.log('[Timeline Simulator] Data:', {
      ratesheets: ratesheets.length,
      allLayers: allLayers.length,
      timeSlots: timeSlots.length,
      currentSubLocation,
      currentLocation,
      currentCustomer
    });
  }, [ratesheets, allLayers.length, timeSlots.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 overflow-x-hidden">
      {/* Header - Event Admin Style */}
      <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-2xl">
        <div className="max-w-[1800px] mx-auto px-8 py-8">
          <div className="flex justify-between items-center">
            <div>
              {/* Dynamic Title: Show SubLocation name or default */}
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold">
                  {currentSubLocation ? currentSubLocation.label : 'Pricing Simulator'}
                </h1>
                <button
                  onClick={() => setIsFiltersModalOpen(true)}
                  className="bg-white/10 backdrop-blur-sm border border-white/30 text-white p-2 rounded-lg hover:bg-white/20 transition-all shadow-lg"
                  title="Change SubLocation"
                >
                  <Filter className="w-5 h-5" />
                </button>
              </div>

              {/* Location context and description */}
              {currentLocation && currentSubLocation ? (
                <p className="text-pink-100 font-thin">
                  📍 {currentLocation.name} • Visual waterfall showing pricing hierarchy
                </p>
              ) : (
                <p className="text-pink-100 font-thin">Visual waterfall showing pricing hierarchy and winning rates for each hour</p>
              )}

              {/* Selected Values Display - More compact, without duplicating sublocation/location */}
              {selectedSubLocation && (
                <div className="flex flex-wrap items-center gap-2 text-sm mt-4">
                  {currentEvent && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white font-medium border border-white/30">
                      🗓️ {currentEvent.name}
                    </span>
                  )}
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white font-medium border border-white/30">
                    ⏱️ {selectedDuration}h
                  </span>
                  {isEventBooking && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white font-medium border border-white/30">
                      🎫 Event Booking
                    </span>
                  )}
                  {/* Timezone Info */}
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white font-medium border border-white/30">
                    <Clock className="w-3 h-3 mr-1.5" />
                    {new Date().toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium border border-white/30">
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 items-end">
              {/* Mode Toggles - Checkboxes */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex gap-4 border border-white/20">
                {/* Simulation Toggle */}
                <button
                  onClick={() => setIsSimulationEnabled(!isSimulationEnabled)}
                  className="flex items-center gap-2 group"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    isSimulationEnabled
                      ? 'bg-white border-white'
                      : 'border-white/50 group-hover:border-white/70'
                  }`}>
                    {isSimulationEnabled && (
                      <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <Zap className="w-4 h-4 text-white" />
                  <span className="text-white font-semibold text-sm">Simulation</span>
                </button>

                {/* Planning Toggle - Only enabled when Simulation is ON */}
                <button
                  onClick={() => {
                    if (isSimulationEnabled) {
                      setIsPlanningEnabled(!isPlanningEnabled);
                    }
                  }}
                  disabled={!isSimulationEnabled}
                  className={`flex items-center gap-2 group ${
                    !isSimulationEnabled ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    isPlanningEnabled && isSimulationEnabled
                      ? 'bg-white border-white'
                      : 'border-white/50 group-hover:border-white/70'
                  }`}>
                    {isPlanningEnabled && isSimulationEnabled && (
                      <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <FileText className="w-4 h-4 text-white" />
                  <span className="text-white font-semibold text-sm">Planning</span>
                </button>

                {/* Surge Pricing Toggle - Shows surge multiplier when active */}
                <button
                  onClick={() => setSurgeEnabled(!surgeEnabled)}
                  disabled={!activeSurgeConfig}
                  className={`flex items-center gap-2 group ${
                    !activeSurgeConfig ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                  title={!activeSurgeConfig ? 'No surge config available for this sublocation' : 'Toggle surge pricing'}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    surgeEnabled && activeSurgeConfig
                      ? 'bg-white border-white'
                      : 'border-white/50 group-hover:border-white/70'
                  }`}>
                    {surgeEnabled && activeSurgeConfig && (
                      <svg className="w-3 h-3 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <Zap className="w-4 h-4 text-white" />
                  <span className="text-white font-semibold text-sm">Surge Pricing</span>
                  {surgeEnabled && activeSurgeConfig && (
                    <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                      {(() => {
                        const { demandSupplyParams, surgeParams } = activeSurgeConfig;
                        const pressure = demandSupplyParams.currentDemand / demandSupplyParams.currentSupply;
                        const normalized = pressure / demandSupplyParams.historicalAvgPressure;
                        const rawFactor = 1 + surgeParams.alpha * Math.log(normalized);
                        const surgeFactor = Math.max(
                          surgeParams.minMultiplier,
                          Math.min(surgeParams.maxMultiplier, rawFactor)
                        );
                        return `${surgeFactor.toFixed(2)}x`;
                      })()}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex gap-3">
                {/* Planning Mode: Show scenario controls */}
                {isPlanningEnabled && isSimulationEnabled && selectedSubLocation && (
                  <>
                    {/* Save Scenario Button */}
                    <button
                      onClick={saveScenario}
                      className="bg-white/20 backdrop-blur-sm border border-white/30 text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/30 transition-all shadow-lg flex items-center gap-2"
                    >
                      <Save className="w-5 h-5" />
                      Save Scenario
                    </button>

                    {/* Load Scenario Dropdown */}
                    {scenarios.length > 0 && (
                      <div className="relative group">
                        <select
                          onChange={(e) => {
                            const scenario = scenarios.find(s => s._id?.toString() === e.target.value);
                            if (scenario) loadScenario(scenario);
                          }}
                          value={currentScenarioId || ''}
                          className="bg-white/20 backdrop-blur-sm border border-white/30 text-white px-6 py-3 pl-12 pr-4 rounded-xl font-semibold hover:bg-white/30 transition-all shadow-lg appearance-none cursor-pointer"
                          style={{
                            backgroundImage: 'none',
                          }}
                        >
                          <option value="" className="bg-purple-600 text-white">📁 Load Scenario...</option>
                          {scenarios.map((scenario) => (
                            <option
                              key={scenario._id?.toString()}
                              value={scenario._id?.toString()}
                              className="bg-purple-600 text-white"
                            >
                              {scenario.name}
                            </option>
                          ))}
                        </select>
                        <FolderOpen className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-white" />
                        {currentScenarioId && (
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-purple-600"></div>
                        )}
                      </div>
                    )}

                    {/* Clear Scenario Button - Only show when a scenario is loaded */}
                    {currentScenarioId && (
                      <button
                        onClick={clearScenario}
                        className="bg-red-500/20 backdrop-blur-sm border border-red-400/30 text-white px-4 py-3 rounded-xl font-semibold hover:bg-red-500/30 transition-all shadow-lg flex items-center gap-2"
                        title="Clear loaded scenario"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-8 py-8">

        {/* Filters Modal */}
        <PricingFiltersModal
          isOpen={isFiltersModalOpen}
          onClose={() => setIsFiltersModalOpen(false)}
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
          pricingCoefficientsUp={pricingCoefficientsUp}
          pricingCoefficientsDown={pricingCoefficientsDown}
          bias={bias}
          onPricingCoefficientsUpChange={setPricingCoefficientsUp}
          onPricingCoefficientsDownChange={setPricingCoefficientsDown}
          onBiasChange={setBias}
          eventCount={counts.event}
        />

        {/* Save Scenario Modal */}
        {isSaveScenarioModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-pink-600 to-purple-600 px-6 py-4">
                <h2 className="text-2xl font-bold text-white">Save Scenario</h2>
                <p className="text-pink-100 text-sm mt-1">Save current simulation configuration</p>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Scenario Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={saveScenarioName}
                    onChange={(e) => setSaveScenarioName(e.target.value)}
                    placeholder="e.g., Peak Season Pricing"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={saveScenarioDescription}
                    onChange={(e) => setSaveScenarioDescription(e.target.value)}
                    placeholder="Brief description of this scenario..."
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                  />
                </div>

                {/* Summary of what will be saved */}
                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-purple-800 mb-2">What will be saved:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-purple-700">
                    <div>✓ {enabledLayers.size} enabled layers</div>
                    <div>✓ {selectedDuration}h duration</div>
                    <div>✓ Time window settings</div>
                    <div>✓ {isEventBooking ? 'Event' : 'Standard'} booking</div>
                    {(pricingCoefficientsUp !== undefined || pricingCoefficientsDown !== undefined || bias !== undefined) && (
                      <div className="col-span-2">✓ Pricing coefficients</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                <button
                  onClick={() => {
                    setIsSaveScenarioModalOpen(false);
                    setSaveScenarioName('');
                    setSaveScenarioDescription('');
                  }}
                  className="px-6 py-2 rounded-xl font-semibold text-gray-700 hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveScenarioSubmit}
                  disabled={!saveScenarioName.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl font-semibold hover:from-pink-700 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Scenario
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && selectedSubLocation && (
          <>
            {/* Apple-Inspired Timeline Section */}
            <div className="relative overflow-hidden rounded-3xl mb-6 mb-2" style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.95) 100%)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
              border: '1px solid rgba(255,255,255,0.8)'
            }}>
              {/* Premium Header with Glassmorphism */}
              <div className="relative px-8 pt-8 pb-6">
                {/* Total Cost - Hero Section */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-baseline gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Cost</span>
                    {surgeEnabled && activeSurgeConfig && (
                      <span className="px-2 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        SURGE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    {surgeEnabled && activeSurgeConfig ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-baseline gap-4">
                          <span className="text-4xl font-medium text-gray-400 line-through">
                            ${getTotalBaseCost().toLocaleString()}
                          </span>
                          <span className="text-8xl font-semibold tracking-tight bg-gradient-to-br from-orange-600 to-red-600 bg-clip-text text-transparent">
                            ${getTotalSurgeCost().toLocaleString()}
                          </span>
                        </div>
                        <span className={`text-sm font-bold ${getTotalSurgeCost() > getTotalBaseCost() ? 'text-red-600' : 'text-green-600'}`}>
                          {getTotalSurgeCost() > getTotalBaseCost() ? '+' : ''}
                          ${(getTotalSurgeCost() - getTotalBaseCost()).toLocaleString()}
                          {' '}
                          ({((getTotalSurgeCost() / getTotalBaseCost() - 1) * 100).toFixed(1)}%)
                        </span>
                      </div>
                    ) : (
                      <div className="text-8xl font-semibold tracking-tight bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent">
                        ${getTotalCost().toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-sm text-gray-500 font-medium">
                    {getTotalDuration()}
                  </div>
                </div>

                {/* Start and End Times - Minimal Pills */}
                <div className="flex items-center justify-center gap-3 mb-8">
                  <div className="px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-gray-200/50 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Start</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {viewStart.toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="h-px w-12 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>

                  <div className="px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-gray-200/50 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">End</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {viewEnd.toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Minimalist Timeline Slider */}
                <div className="relative px-6">
                  {/* Date markers - Above track */}
                  <div className="flex justify-between mb-3 px-1">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const tickMs = rangeStart.getTime() + (i / 4) * (rangeEnd.getTime() - rangeStart.getTime());
                      const tickDate = new Date(tickMs);
                      return (
                        <div key={i} className="text-center">
                          <div className="text-[10px] font-semibold text-gray-900">
                            {tickDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-[9px] text-gray-400 mt-0.5">
                            {tickDate.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Clean track */}
                  <div className="relative h-2 group">
                    {/* Base track with subtle gradient */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-gray-200/80 via-gray-100/80 to-gray-200/80 shadow-inner"></div>

                    {/* Active selection with premium gradient */}
                    <div
                      className="absolute h-full rounded-full transition-all duration-300 group-hover:h-3 group-hover:-mt-0.5"
                      style={{
                        left: `${getViewWindowPosition().left}%`,
                        width: `${getViewWindowPosition().width}%`,
                        background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
                        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3), 0 0 0 4px rgba(139, 92, 246, 0.1)'
                      }}
                    >
                      {/* Subtle shine effect */}
                      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/40 to-transparent"></div>
                    </div>

                    {/* Invisible drag handle */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={getViewWindowPosition().left}
                      onChange={(e) => handleStartTimeChange(parseFloat(e.target.value))}
                      className="absolute inset-0 w-full h-8 -mt-3 opacity-0 cursor-grab active:cursor-grabbing"
                      style={{ zIndex: 10 }}
                    />
                  </div>

                  {/* Subtle tick marks below */}
                  <div className="flex justify-between mt-2 px-1">
                    {Array.from({ length: 11 }).map((_, i) => (
                      <div key={i} className="w-px h-1.5 bg-gray-300/60 rounded-full"></div>
                    ))}
                  </div>
                </div>
              </div>



              {/* Hourly Rate Breakdown Chart */}
              {timeSlots.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 mt-6">
                  {/* Header with Stats */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        Hourly Rate Breakdown
                      </h3>
                      <p className="text-sm text-gray-600">
                        Next {timeSlots.length} hours starting from {formatDateTime(viewStart)}
                      </p>
                    </div>

                    {/* Min/Avg/Max Stats */}
                    <div className="flex items-center gap-6">
                      {(() => {
                        const prices = timeSlots.filter(s => s.winningPrice).map(s => s.winningPrice!);
                        if (prices.length === 0) return null;

                        const min = Math.min(...prices);
                        const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
                        const max = Math.max(...prices);

                        return (
                          <>
                            <div className="text-center">
                              <div className="text-blue-600 text-xl font-bold">${min.toFixed(2)}</div>
                              <div className="text-xs text-gray-500">Min</div>
                            </div>
                            <div className="text-center">
                              <div className="text-blue-600 text-2xl font-bold">${avg.toFixed(2)}</div>
                              <div className="text-xs text-gray-500">Avg</div>
                            </div>
                            <div className="text-center">
                              <div className="text-red-600 text-xl font-bold">${max.toFixed(2)}</div>
                              <div className="text-xs text-gray-500">Max</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Duration Toggle */}
                    <div className="flex gap-2 ml-6">
                      <button
                        onClick={() => setQuickRange(12)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          selectedDuration === 12
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        12h
                      </button>
                      <button
                        onClick={() => setQuickRange(24)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          selectedDuration === 24
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        24h
                      </button>
                      <button
                        onClick={() => setQuickRange(48)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          selectedDuration === 48
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        48h
                      </button>
                    </div>
                  </div>

                  {/* SVG Chart */}
                  <div className="relative w-full" style={{ height: '320px' }}>
                    <svg className="w-full h-full" viewBox="0 0 1000 320" preserveAspectRatio="xMidYMid meet">
                      {/* Gradients */}
                      <defs>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="50%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
                        </linearGradient>
                        <linearGradient id="eventIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ec4899" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>

                      {/* Chart calculation and rendering */}
                      {(() => {
                        const prices = timeSlots.map(s => s.winningPrice || 0);
                        const maxPrice = Math.max(...prices);
                        const minPrice = Math.min(...prices.filter(p => p > 0));
                        const range = maxPrice - minPrice || 1;
                        const padding = range * 0.15;

                        const chartHeight = 180;
                        const chartBaseline = 240;
                        const leftMargin = 40;
                        const rightMargin = 20;
                        const chartWidth = 1000 - leftMargin - rightMargin;

                        // Calculate Y-axis values for grid lines with intelligent scaling
                        let yAxisMax, yAxisMin, yAxisRange;

                        if (range < 1) {
                          // Very small range - show a fixed $1 range centered on the price
                          const avgPrice = (maxPrice + minPrice) / 2;
                          yAxisMin = Math.floor(avgPrice) - 0.5;
                          yAxisMax = Math.ceil(avgPrice) + 0.5;
                          yAxisRange = yAxisMax - yAxisMin;
                        } else if (range < 5) {
                          // Small range - add moderate padding
                          yAxisMax = maxPrice + padding;
                          yAxisMin = minPrice - padding;
                          yAxisRange = yAxisMax - yAxisMin;
                        } else {
                          // Larger range - use standard padding
                          yAxisMax = Math.ceil(maxPrice + padding);
                          yAxisMin = Math.floor(minPrice - padding);
                          yAxisRange = yAxisMax - yAxisMin;
                        }

                        const points = timeSlots.map((slot, i) => {
                          // Handle single slot case (avoid division by zero)
                          const x = timeSlots.length === 1
                            ? leftMargin + chartWidth / 2  // Center single point
                            : leftMargin + (i / (timeSlots.length - 1)) * chartWidth;

                          // Use Y-axis range for normalization to ensure consistency
                          const normalizedPrice = ((slot.winningPrice || 0) - yAxisMin) / yAxisRange;
                          const y = chartBaseline - (normalizedPrice * chartHeight);

                          return { x, y, slot };
                        });

                        const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');

                        return (
                          <>
                            {/* Grid lines - positioned to match Y-axis labels and chart scale */}
                            {[0, 1, 2, 3, 4].map(i => {
                              // Calculate price for this grid line
                              const price = yAxisMax - (i * yAxisRange / 4);
                              // Convert price to Y coordinate using same formula as chart points
                              const normalizedPrice = (price - yAxisMin) / yAxisRange;
                              const y = chartBaseline - (normalizedPrice * chartHeight);

                              return (
                                <line
                                  key={`grid-${i}`}
                                  x1={leftMargin}
                                  y1={y}
                                  x2={leftMargin + chartWidth}
                                  y2={y}
                                  stroke="#e5e7eb"
                                  strokeWidth="0.5"
                                  opacity="0.5"
                                />
                              );
                            })}

                            {/* Area fill */}
                            <polygon
                              points={`${leftMargin},${chartBaseline} ${pointsStr} ${leftMargin + chartWidth},${chartBaseline}`}
                              fill="url(#areaGradient)"
                            />

                            {/* Glow effect under the line */}
                            <polyline
                              points={pointsStr}
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
                              points={pointsStr}
                              fill="none"
                              stroke="url(#lineGradient)"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {/* Data points */}
                            {points.map(({ x, y, slot }, i) => {
                              const hasEvents = slot.events && slot.events.length > 0;
                              const eventCount = slot.events?.length || 0;

                              return (
                                <g key={i}>
                                  {/* Concentric circles for each event - rendered from outside to inside */}
                                  {hasEvents && slot.events!.map((event, eventIdx) => {
                                    // Each event gets a larger concentric circle
                                    // Start from outer ring and work inward
                                    const ringRadius = 10 + ((eventCount - eventIdx - 1) * 4);

                                    return (
                                      <g key={`event-circle-${i}-${eventIdx}`}>
                                        {/* Subtle glow effect for each event ring */}
                                        <circle
                                          cx={x}
                                          cy={y}
                                          r={ringRadius + 2}
                                          fill="none"
                                          stroke="url(#lineGradient)"
                                          strokeWidth="4"
                                          opacity="0.15"
                                        />

                                        {/* Event circle ring - styled to match chart */}
                                        <circle
                                          cx={x}
                                          cy={y}
                                          r={ringRadius}
                                          fill="rgba(255, 255, 255, 0.95)"
                                          stroke="url(#lineGradient)"
                                          strokeWidth="2"
                                          opacity="0.9"
                                        />
                                        {/* Tooltip for this event */}
                                        <title>{event.name} (Priority: {event.priority})</title>
                                      </g>
                                    );
                                  })}

                                  {/* Main dot */}
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r="5"
                                    fill="#ffffff"
                                    stroke="url(#lineGradient)"
                                    strokeWidth="3"
                                  />

                                  {/* Tooltip for main dot */}
                                  <title>
                                    {slot.label} - ${slot.winningPrice?.toFixed(2) || '0.00'}/hr
                                    {hasEvents && `\n\n🗓️ ${eventCount} Event${eventCount > 1 ? 's' : ''}:\n${slot.events!.map(e => `• ${e.name} (Priority: ${e.priority})`).join('\n')}`}
                                  </title>
                                </g>
                              );
                            })}

                            {/* X-axis labels */}
                            {points.map(({ x, slot }, i) => {
                              const labelInterval = timeSlots.length <= 12 ? 2 : timeSlots.length <= 24 ? 4 : 8;
                              if (i % labelInterval !== 0 && i !== points.length - 1) return null;

                              const showDayLabel = i === 0 || slot.date.getDate() !== points[i - 1]?.slot.date.getDate();

                              return (
                                <g key={`label-${i}`}>
                                  <line
                                    x1={x}
                                    y1={chartBaseline}
                                    x2={x}
                                    y2={chartBaseline + 6}
                                    stroke="#cbd5e1"
                                    strokeWidth="1.5"
                                  />
                                  <text
                                    x={x}
                                    y={chartBaseline + 20}
                                    textAnchor="middle"
                                    fill="#64748b"
                                    fontSize="11"
                                    fontWeight="600"
                                  >
                                    {slot.label}
                                  </text>
                                  {showDayLabel && (
                                    <text
                                      x={x}
                                      y={chartBaseline + 34}
                                      textAnchor="middle"
                                      fill="#94a3b8"
                                      fontSize="9"
                                      fontWeight="500"
                                    >
                                      {slot.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </text>
                                  )}
                                </g>
                              );
                            })}

                            {/* Y-axis labels - positioned to match grid lines */}
                            {[0, 1, 2, 3, 4].map(i => {
                              // Calculate price for this label (same as grid line)
                              const price = yAxisMax - (i * yAxisRange / 4);
                              // Convert price to Y coordinate using same formula as chart points
                              const normalizedPrice = (price - yAxisMin) / yAxisRange;
                              const y = chartBaseline - (normalizedPrice * chartHeight);

                              // Dynamic decimal precision based on range
                              let decimals;
                              if (yAxisRange < 2) {
                                decimals = 2; // Very small range - show cents
                              } else if (yAxisRange < 10) {
                                decimals = 1; // Small range - show one decimal
                              } else {
                                decimals = 0; // Large range - whole dollars
                              }

                              return (
                                <text
                                  key={`y-${i}`}
                                  x="30"
                                  y={y + 5}
                                  textAnchor="end"
                                  fill="#64748b"
                                  fontSize="11"
                                  fontWeight="600"
                                >
                                  ${price.toFixed(decimals)}
                                </text>
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>
              )}

              {/* Time markers in grid with winning prices */}
              <div className="mt-4">
                <div className="grid grid-cols-12 gap-1">
                  {timeSlots.map((slot, idx) => {
                    const isSelected = selectedSlot?.slotIdx === idx;
                    const isHovered = hoveredSlot?.slotIdx === idx;

                    // Debug log for rendering
                    if (slot.eventNames && slot.eventNames.length > 0) {
                      console.log(`🎨 Rendering slot ${idx} with eventNames: [${slot.eventNames.join(', ')}]`);
                    }

                    return (
                      <div
                        key={idx}
                        className={`relative bg-gradient-to-br from-silver-500 via-silver-50 to-silver-100 border rounded-xl overflow-hidden cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-600 border-2 shadow-xl ring-2 ring-blue-300'
                            : isHovered
                            ? 'border-blue-400 border-2 shadow-lg'
                            : 'border-gray-200 shadow-sm'
                        }`}
                        onClick={() => handleTileClick(idx, 'pricing-tile', slot)}
                        onMouseEnter={() => handleTileHover(idx, 'pricing-tile')}
                        onMouseLeave={handleTileLeave}
                      >
                        {/* Header with time */}
                        <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-2 py-1.5 text-center">
                          <div className="text-[11px] font-bold text-white tracking-tight">{slot.label}</div>
                          <div className="text-[9px] text-slate-300 font-medium">
                            {slot.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>

                        {/* Pricing Section */}
                        <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 px-2 py-3 border-b border-gray-100">
                          <div className="text-[8px] uppercase font-semibold text-gray-500 mb-1 tracking-wider flex items-center justify-center gap-1">
                            Price
                            {/* Show surge icon if surge is ON and SURGE layer is winning */}
                            {surgeEnabled && slot.surgePrice !== undefined && slot.winningLayer?.type === 'SURGE' && (!isSimulationEnabled || enabledLayers.has('surge-layer')) && (
                              <Zap className="w-2 h-2 text-orange-600" />
                            )}
                          </div>
                          {slot.winningPrice !== undefined && slot.winningPrice !== null ? (
                            /* Show surge price only if: surge enabled AND SURGE layer is winning */
                            surgeEnabled && slot.surgePrice !== undefined && slot.winningLayer?.type === 'SURGE' && (!isSimulationEnabled || enabledLayers.has('surge-layer')) ? (
                              <div className="space-y-1">
                                {slot.basePrice !== undefined && (
                                  <div className="text-sm font-bold text-gray-400 line-through">
                                    ${slot.basePrice.toFixed(2)}
                                  </div>
                                )}
                                <div className={`text-2xl font-black ${
                                  slot.basePrice && slot.surgePrice > slot.basePrice
                                    ? 'bg-gradient-to-r from-orange-600 to-red-600'
                                    : slot.basePrice && slot.surgePrice < slot.basePrice
                                    ? 'bg-gradient-to-r from-green-600 to-emerald-600'
                                    : 'bg-gradient-to-r from-gray-600 to-gray-700'
                                } bg-clip-text text-transparent`}>
                                  ${slot.surgePrice.toFixed(2)}
                                </div>
                                {slot.surgeMultiplier && (
                                  <div className={`text-[9px] font-bold ${
                                    slot.surgeMultiplier > 1
                                      ? 'text-red-600'
                                      : slot.surgeMultiplier < 1
                                      ? 'text-green-600'
                                      : 'text-gray-600'
                                  }`}>
                                    {slot.surgeMultiplier.toFixed(2)}x
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-2xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                                ${slot.winningPrice.toFixed(2)}
                              </div>
                            )
                          ) : (
                            <div className="text-base font-extrabold text-gray-300">
                              -
                            </div>
                          )}
                        </div>

                        {/* Capacity Section */}
                        {slot.capacity && (
                          <div className="bg-white px-2 py-2.5 border-b border-gray-100">
                            <div className="text-[8px] uppercase font-semibold text-gray-500 mb-1 tracking-wider">Capacity</div>
                            <div className="flex items-baseline justify-center gap-1">
                              <span className="text-base font-black text-slate-700">{slot.capacity.allocated}</span>
                              <span className="text-[10px] text-gray-400 font-bold">/</span>
                              <span className="text-sm font-bold text-slate-600">{slot.capacity.max}</span>
                            </div>
                            {/* Capacity bar */}
                            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all"
                                style={{
                                  width: `${Math.min((slot.capacity.allocated / slot.capacity.max) * 100, 100)}%`
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Revenue Section */}
                        {slot.capacity && (slot.winningPrice !== undefined && slot.winningPrice !== null) && (
                          <div className="bg-gradient-to-br from-red-50 to-orange-50 px-2 py-2.5 border-b-2 border-silver-900 border-dashed">
                            <div className="text-[8px] uppercase font-semibold text-gray-500 mb-1 tracking-wider">Revenue Max</div>
                            <div className="flex items-baseline justify-center gap-0.5">
                              <span className="text-lg font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                                ${(slot.capacity.max * (surgeEnabled && slot.surgePrice && (!isSimulationEnabled || enabledLayers.has('surge-layer')) ? slot.surgePrice : slot.winningPrice)).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Event Section */}
                        {slot.eventNames && slot.eventNames.length > 0 && (
                          <div className="bg-gradient-to-br from-zinc-50 via-silver-50 to-silver-100 px-2 py-2.5">
                            <div className="text-[8px] uppercase font-thin text-black mb-1 tracking-wider">
                              {slot.eventNames.length > 1 ? 'Events' : 'Event'}
                            </div>
                            <div className="text-[10px] font-light text-gray-700 text-left space-y-1">
                              {slot.eventNames.map((eventName, eventIdx) => (
                                <div key={eventIdx} className="line-clamp-1 bg-white/40 rounded px-1 py-0.5">
                                  {eventName}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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

                  const isLayerEnabled = enabledLayers.has(layer.id);

                  // Check if this layer can be disabled
                  // Count enabled DEFAULT layers AFTER removing this layer
                  // DEFAULT layers are always active, so we need at least one
                  const enabledDefaultLayersAfterDisable = Array.from(enabledLayers)
                    .filter(id => id !== layer.id) // Exclude current layer
                    .filter(id => {
                      const l = allLayers.find(layer => layer.id === id);
                      return l && (
                        l.type === 'SUBLOCATION_DEFAULT' ||
                        l.type === 'LOCATION_DEFAULT' ||
                        l.type === 'CUSTOMER_DEFAULT'
                      );
                    });

                  // Cannot disable if it would leave zero DEFAULT layers
                  const wouldLeaveNoDefaultLayers = enabledDefaultLayersAfterDisable.length === 0;
                  const canToggleOff = !wouldLeaveNoDefaultLayers;

                  // Debug logging for layer toggle state
                  if (layerIdx === 0 || layer.type === 'SURGE') {
                    console.log(`🔒 [Layer Toggle Debug] ${layer.name}:`, {
                      layerId: layer.id,
                      layerType: layer.type,
                      isEnabled: isLayerEnabled,
                      enabledDefaultLayersAfterDisable: enabledDefaultLayersAfterDisable.length,
                      wouldLeaveNoDefaultLayers,
                      canToggleOff,
                      shouldShowLock: isLayerEnabled && !canToggleOff,
                      allEnabledLayers: Array.from(enabledLayers),
                      allLayers: allLayers.map(l => ({ id: l.id, name: l.name, type: l.type }))
                    });
                  }

                  return (
                  <div key={layer.id}>
                    {/* Layer label with toggle */}
                    <div className="flex items-center gap-2 mb-1">
                      {/* Toggle switch */}
                      <button
                        onClick={() => isSimulationEnabled && canToggleOff && toggleLayer(layer.id)}
                        disabled={!isSimulationEnabled || (isLayerEnabled && !canToggleOff)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          !isSimulationEnabled || (isLayerEnabled && !canToggleOff) ? 'bg-gray-400 opacity-60 cursor-not-allowed' :
                          isLayerEnabled ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                        title={
                          !isSimulationEnabled ? 'Enable Simulation mode to toggle layers' :
                          (isLayerEnabled && !canToggleOff) ? 'Cannot disable - at least one DEFAULT layer must remain enabled (always-active pricing)' :
                          isLayerEnabled ? 'Click to disable this layer' : 'Click to enable this layer'
                        }
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isLayerEnabled ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                      <div className="text-xs font-medium text-gray-700 flex items-center gap-1" title={layer.name}>
                        <span className="font-semibold">{layer.name}</span>
                        {(isLayerEnabled && !canToggleOff) && (
                          <span title="Cannot disable - at least one DEFAULT layer required (always-active pricing)">
                            <Lock className="w-3 h-3 text-gray-500" />
                          </span>
                        )}
                        <span className="text-[10px] text-gray-500 ml-2">Priority: {layer.priority}</span>
                      </div>
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
                          const isHovered = hoveredSlot?.slotIdx === slotIdx && hoveredSlot?.layerId === layer.id;
                          const isSelected = selectedSlot?.slotIdx === slotIdx && selectedSlot?.layerId === layer.id;

                          // Determine if this tile should be grayed out (active but layer is disabled)
                          const isDisabled = !isLayerEnabled && layerData?.isActive;

                          return (
                            <div
                              key={slotIdx}
                              onClick={() => layerData?.isActive && isLayerEnabled && handleTileClick(slotIdx, layer.id, slot)}
                              onMouseEnter={() => handleTileHover(slotIdx, layer.id)}
                              onMouseLeave={handleTileLeave}
                              title={
                                isDisabled
                                  ? `${layer.name} - $${layerData.price}/hr (Priority: ${layer.priority}) - DISABLED`
                                  : layerData?.isActive
                                    ? `${layer.name} - $${layerData.price}/hr (Priority: ${layer.priority})`
                                    : 'Not active for this time'
                              }
                              className={`rounded-lg transition-all cursor-pointer ${
                                isDisabled
                                  ? 'bg-gray-400 border-gray-500 opacity-40'
                                  : layerData?.isActive
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
                                <div className="flex flex-col items-center justify-center gap-0.5 px-1">
                                  {/* Price */}
                                  <div className={`font-bold text-sm drop-shadow-md ${
                                    isDisabled ? 'text-gray-600 line-through' : 'text-white'
                                  }`}>
                                    ${typeof layerData.price === 'number' ? layerData.price.toFixed(2) : layerData.price}
                                  </div>
                                  {/* Capacity */}
                                  {slot.capacity && (
                                    <div className="flex flex-col items-center gap-0.5 w-full">
                                      <div className={`text-[8px] font-semibold flex items-baseline gap-0.5 ${
                                        isDisabled ? 'text-gray-500' : 'text-white'
                                      }`}>
                                        <span className="opacity-90">{slot.capacity.allocated}</span>
                                        <span className="opacity-60 text-[7px]">/</span>
                                        <span className="opacity-70 text-[7px]">{slot.capacity.max}</span>
                                      </div>
                                      {/* Mini capacity bar */}
                                      {!isDisabled && (
                                        <div className="w-full h-0.5 bg-white bg-opacity-30 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-white"
                                            style={{
                                              width: `${Math.min((slot.capacity.allocated / slot.capacity.max) * 100, 100)}%`
                                            }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )}
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
