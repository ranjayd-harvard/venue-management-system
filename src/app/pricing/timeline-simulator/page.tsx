'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import DecisionAuditPanel from '@/components/DecisionAuditPanel';
import PricingFiltersModal from '@/components/PricingFiltersModal';
import SaveScenarioModal from '@/components/SaveScenarioModal';
import SimulatorHeader from '@/components/SimulatorHeader';
import TotalCostDisplay from '@/components/TotalCostDisplay';
import HourlyRateChart from '@/components/HourlyRateChart';
import WinningPriceGrid from '@/components/WinningPriceGrid';
import PricingWaterfallGrid from '@/components/PricingWaterfallGrid';
import { getTimeInTimezone } from '@/lib/timezone-utils';
import { PricingScenario, SurgeConfig } from '@/models/types';
import type { Ratesheet, Location, SubLocation, Customer, Event, PricingConfig, PricingLayer, TimeSlot } from '@/lib/timeline-simulator-types';
import { formatPriceWithSuperscript } from '@/lib/timeline-simulator-types';

export default function TimelineSimulatorPage() {
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [ratesheets, setRatesheets] = useState<Ratesheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [pricingDataLoading, setPricingDataLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentSubLocation, setCurrentSubLocation] = useState<SubLocation | null>(null);
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [entityTimezone, setEntityTimezone] = useState<string>('America/New_York'); // Timezone for calculations

  // Initialize all dates from the same timestamp to prevent timing drift on initial render
  // Range covers 1 day in past to 3 days in future (default)
  // All times snapped to hour boundaries
  const [initialDates] = useState(() => {
    const now = new Date();
    // Snap to start of current hour
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    return {
      rangeStart: new Date(hourStart.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      rangeEnd: new Date(hourStart.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now (total 4 day window)
      viewStart: new Date(hourStart.getTime()), // Start of current hour
      viewEnd: new Date(hourStart.getTime() + 12 * 60 * 60 * 1000) // 12 hours from current hour
    };
  });

  const [rangeStart, setRangeStart] = useState<Date>(initialDates.rangeStart);
  const [rangeEnd, setRangeEnd] = useState<Date>(initialDates.rangeEnd);
  const [viewStart, setViewStart] = useState<Date>(initialDates.viewStart);
  const [viewEnd, setViewEnd] = useState<Date>(initialDates.viewEnd);

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<number>(12); // Duration in hours (default 12h)

  // Booking start time for duration-based window calculations (uses same synchronized timestamp)
  const [useDurationContext, setUseDurationContext] = useState<boolean>(true);
  const [bookingStartTime, setBookingStartTime] = useState<Date>(initialDates.viewStart);

  // Selected slot for showing decision panel (persistent)
  const [selectedSlot, setSelectedSlot] = useState<{ slotIdx: number; layerId: string } | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{ slotIdx: number; layerId: string } | null>(null);
  const [decisionPanelData, setDecisionPanelData] = useState<any>(null);
  const [showWaterfall, setShowWaterfall] = useState(true);

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [savedScenarioState, setSavedScenarioState] = useState<any>(null);

  // Mode toggles: independent simulation and planning flags
  const [isSimulationEnabled, setIsSimulationEnabled] = useState(false);
  const [isPlanningEnabled, setIsPlanningEnabled] = useState(false);

  // Surge pricing state
  const [surgeEnabled, setSurgeEnabled] = useState<boolean>(false);
  const [activeSurgeConfig, setActiveSurgeConfig] = useState<SurgeConfig | null>(null);
  const [appliedSurgeRatesheets, setAppliedSurgeRatesheets] = useState<Array<{ id: string; name: string; priority: number }>>([]);

  // Track saved enabled layers when loading a scenario (to restore after surge layers are created)
  const [pendingEnabledLayers, setPendingEnabledLayers] = useState<Set<string> | null>(null);

  // Pre-simulation baseline price (captured when simulation mode is first enabled)
  const [preSimulationBaselinePrice, setPreSimulationBaselinePrice] = useState<number>(0);

  // Track URL-loaded scenario to apply after location is set
  const pendingUrlScenario = useRef<PricingScenario | null>(null);

  useEffect(() => {
    fetchPricingConfig();
    loadInitialDefaults();
    checkAndLoadScenarioFromUrl();
  }, []);

  // Check URL for scenarioId parameter and auto-load if present
  const checkAndLoadScenarioFromUrl = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const scenarioId = urlParams.get('scenarioId');

      if (scenarioId) {
        console.log('🔍 [URL LOAD] Found scenarioId in URL:', scenarioId);

        // Fetch the scenario from API
        const response = await fetch(`/api/pricing-scenarios/${scenarioId}`);
        if (response.ok) {
          const scenario = await response.json();
          console.log('✅ [URL LOAD] Successfully fetched scenario:', scenario.name);

          // Store scenario to load after location is set
          pendingUrlScenario.current = scenario;

          // Set the location/sublocation/event based on the scenario's appliesTo
          await loadScenarioFromUrl(scenario);
        } else {
          console.error('❌ [URL LOAD] Failed to fetch scenario:', response.statusText);
          alert('Failed to load scenario from URL');
        }
      }
    } catch (error) {
      console.error('❌ [URL LOAD] Error loading scenario from URL:', error);
    }
  };

  // Load scenario from URL (sets location context, actual scenario load happens in useEffect)
  const loadScenarioFromUrl = async (scenario: PricingScenario) => {
    console.log('📂 [URL LOAD] Setting location context for scenario:', scenario.name);

    // First, set the location/sublocation/event based on the scenario's appliesTo
    const { level, entityId } = scenario.appliesTo;

    try {
      if (level === 'SUBLOCATION') {
        // Fetch sublocation to get its location
        const sublocRes = await fetch(`/api/sublocations/${entityId}`);
        const subloc = await sublocRes.json();
        console.log('📍 [URL LOAD] Setting location:', subloc.locationId, 'sublocation:', entityId);
        setSelectedLocation(subloc.locationId);
        setSelectedSubLocation(entityId.toString());
      } else if (level === 'LOCATION') {
        console.log('📍 [URL LOAD] Setting location:', entityId);
        setSelectedLocation(entityId.toString());
        // Sublocation will be handled by the useEffect that watches selectedLocation
      } else if (level === 'CUSTOMER') {
        // Fetch first location for this customer
        const locationsRes = await fetch(`/api/locations?customerId=${entityId}`);
        const locations = await locationsRes.json();
        if (locations.length > 0) {
          console.log('📍 [URL LOAD] Setting location (from customer):', locations[0]._id);
          setSelectedLocation(locations[0]._id);
        }
      } else if (level === 'EVENT') {
        // Fetch event to get its sublocation/location
        const eventRes = await fetch(`/api/events/${entityId}`);
        const event = await eventRes.json();
        if (event.subLocationId) {
          const sublocRes = await fetch(`/api/sublocations/${event.subLocationId}`);
          const subloc = await sublocRes.json();
          console.log('📍 [URL LOAD] Setting location (from event):', subloc.locationId, 'sublocation:', event.subLocationId);
          setSelectedLocation(subloc.locationId);
          setSelectedSubLocation(event.subLocationId);
        } else if (event.locationId) {
          console.log('📍 [URL LOAD] Setting location (from event):', event.locationId);
          setSelectedLocation(event.locationId);
        }
        setSelectedEventId(entityId.toString());
      }
    } catch (error) {
      console.error('❌ [URL LOAD] Error setting location context:', error);
      alert('Failed to set location context for scenario');
    }
  };

  // Load initial defaults: auto-select first location and sublocation on page load
  const loadInitialDefaults = async () => {
    try {
      // Check if we're loading from URL - if so, skip default loading
      const urlParams = new URLSearchParams(window.location.search);
      const scenarioId = urlParams.get('scenarioId');
      if (scenarioId) {
        console.log('⏭️ [INIT] Skipping default location load - loading from URL instead');
        return;
      }

      // Fetch locations
      const locationsRes = await fetch('/api/locations');
      const locations = await locationsRes.json();

      if (locations.length > 0) {
        const firstLocation = locations[0]._id;
        setSelectedLocation(firstLocation);

        // Fetch sublocations for first location
        const sublocationsRes = await fetch(`/api/sublocations?locationId=${firstLocation}`);
        const sublocations = await sublocationsRes.json();

        if (sublocations.length > 0) {
          setSelectedSubLocation(sublocations[0]._id);
        }
      }
    } catch (error) {
      console.error('Failed to load initial defaults:', error);
    }
  };

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
      fetchEntityTimezone(selectedSubLocation);
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

  // Apply pending URL scenario after ratesheets are loaded
  useEffect(() => {
    if (pendingUrlScenario.current && ratesheets.length > 0 && selectedSubLocation) {
      console.log('🎬 [URL LOAD] Ratesheets loaded, applying pending scenario:', pendingUrlScenario.current.name);
      const scenarioToLoad = pendingUrlScenario.current;
      pendingUrlScenario.current = null; // Clear the pending scenario

      // Give the UI a moment to settle after ratesheets load
      setTimeout(() => {
        loadScenario(scenarioToLoad);
      }, 500);
    }
  }, [ratesheets, selectedSubLocation]);

  // Sync view window with booking start time when duration context is enabled
  useEffect(() => {
    if (useDurationContext) {
      setViewStart(new Date(bookingStartTime));
      setViewEnd(new Date(bookingStartTime.getTime() + selectedDuration * 60 * 60 * 1000));
    }
  }, [useDurationContext, bookingStartTime]);

  // Initialize all layers as enabled when layers change
  useEffect(() => {
    // Skip auto-enable if we're loading a scenario with pending layers to restore
    if (pendingEnabledLayers !== null || pendingUrlScenario.current !== null) {
      console.log('⏭️ [AUTO-ENABLE] Skipping auto-enable (loading scenario)', {
        hasPendingLayers: pendingEnabledLayers !== null,
        hasPendingScenario: pendingUrlScenario.current !== null,
        isLoadingScenario: isLoadingScenarioRef.current
      });
      return;
    }

    const allLayers = getPricingLayers();
    const allLayerIds = new Set(allLayers.map(l => l.id));
    console.log('🔄 [AUTO-ENABLE] Auto-enabling all layers:', {
      layerCount: allLayerIds.size,
      layersSample: Array.from(allLayerIds).slice(0, 5)
    });
    setEnabledLayers(allLayerIds);
  }, [ratesheets, currentSubLocation, currentLocation, currentCustomer]);
  // NOTE: pendingEnabledLayers is NOT in deps - we only check it to skip execution, not react to changes

  useEffect(() => {
    if (currentSubLocation || currentLocation || currentCustomer) {
      calculateTimeSlots().catch(error => {
        console.error('Error calculating time slots:', error);
      });
    }
  }, [ratesheets, viewStart, viewEnd, currentSubLocation, currentLocation, currentCustomer, useDurationContext, bookingStartTime, isEventBooking, enabledLayers, currentEvent, surgeEnabled, activeSurgeConfig, isSimulationEnabled, entityTimezone]);

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

  // Reset baseline when simulation mode is turned off
  useEffect(() => {
    if (!isSimulationEnabled && preSimulationBaselinePrice > 0) {
      setPreSimulationBaselinePrice(0);
    }
  }, [isSimulationEnabled]);

  // Auto-disable surge when switching from Simulation to Live mode
  // Live mode doesn't support surge toggle - it only shows materialized surge ratesheets
  useEffect(() => {
    if (!isSimulationEnabled && surgeEnabled) {
      // Disable surge and clear virtual surge ratesheets
      setSurgeEnabled(false);
      setAppliedSurgeRatesheets([]);
    }
  }, [isSimulationEnabled]);

  // Clear applied surge ratesheets when surge is disabled
  useEffect(() => {
    if (!surgeEnabled) {
      setAppliedSurgeRatesheets([]);
    }
  }, [surgeEnabled]);

  // Track if surge layers have been auto-enabled initially
  const [surgeLayersAutoEnabled, setSurgeLayersAutoEnabled] = useState(false);
  // Track if we're currently loading a scenario (to skip auto-enable)
  const isLoadingScenarioRef = useRef(false);

  // Automatically enable ALL SURGE layers when surge is first toggled on
  // But don't re-enable them if user has manually disabled them
  // SKIP auto-enable when loading a scenario (respect saved layer selection)
  useEffect(() => {
    console.log('🔄 [SURGE AUTO-ENABLE] Effect triggered:', {
      surgeEnabled,
      appliedSurgeRatesheetsCount: appliedSurgeRatesheets.length,
      surgeLayersAutoEnabled,
      isLoadingScenario: isLoadingScenarioRef.current,
      currentEnabledLayers: Array.from(enabledLayers)
    });

    // Skip auto-enable if we're loading a scenario
    if (isLoadingScenarioRef.current) {
      console.log('⏭️ [SURGE AUTO-ENABLE] Skipping auto-enable (loading scenario)');
      isLoadingScenarioRef.current = false;
      setSurgeLayersAutoEnabled(true); // Mark as "already handled"
      return;
    }

    if (surgeEnabled && appliedSurgeRatesheets.length > 0 && !surgeLayersAutoEnabled) {
      // Add all surge layers to enabled layers (only on first load)
      console.log('✅ [SURGE AUTO-ENABLE] Auto-enabling surge layers for the first time');
      setEnabledLayers(prev => {
        const newSet = new Set(prev);
        appliedSurgeRatesheets.forEach(surge => {
          console.log(`   Adding surge layer: ${surge.name} (${surge.id})`);
          newSet.add(surge.id);
        });
        return newSet;
      });
      setSurgeLayersAutoEnabled(true);
    } else if (!surgeEnabled) {
      // Remove only VIRTUAL surge layers from enabled layers when surge is disabled
      // Materialized surge ratesheets (real DB records) should remain enabled AND be added
      console.log('❌ [SURGE AUTO-ENABLE] Removing virtual surge layers, keeping materialized (surge disabled)');
      setEnabledLayers(prev => {
        const newSet = new Set(prev);

        // Remove virtual surge layers
        appliedSurgeRatesheets.forEach(surge => {
          // Only remove if it's a virtual surge (ID is a name string, not a MongoDB _id)
          const isMaterialized = ratesheets.some((rs: any) => rs._id === surge.id && rs.surgeConfigId);
          if (!isMaterialized) {
            newSet.delete(surge.id);
          }
        });

        // Also remove old 'surge-layer' if it exists
        newSet.delete('surge-layer');

        // ADD all materialized surge ratesheets to enabled layers
        // They are real DB records and should be active when surge toggle is off
        ratesheets.forEach((rs: any) => {
          if (rs.surgeConfigId) {
            newSet.add(rs._id);
          }
        });

        return newSet;
      });
      setSurgeLayersAutoEnabled(false);
    }
  }, [surgeEnabled, appliedSurgeRatesheets, surgeLayersAutoEnabled])

  // Restore saved enabled layers after surge layers are created (when loading a scenario)
  useEffect(() => {
    if (!pendingEnabledLayers) return;

    console.log('🔄 [RESTORE LAYERS] Effect triggered:', {
      pendingLayersCount: pendingEnabledLayers.size,
      appliedSurgeCount: appliedSurgeRatesheets.length,
      pendingLayersSample: Array.from(pendingEnabledLayers).slice(0, 5)
    });

    // Wait for surge layers if surge is enabled in the scenario
    const hasSurgeLayers = Array.from(pendingEnabledLayers).some(id =>
      typeof id === 'string' && id.startsWith('SURGE:')
    );

    if (hasSurgeLayers && appliedSurgeRatesheets.length === 0) {
      console.log('⏳ [LOAD SCENARIO] Waiting for surge layers to be created...', {
        hasSurgeLayers,
        appliedSurgeCount: appliedSurgeRatesheets.length
      });
      return; // Wait for surge layers to be generated
    }

    console.log('✅ [LOAD SCENARIO] Restoring enabled layers NOW:', {
      pendingLayers: Array.from(pendingEnabledLayers),
      hasSurgeLayers,
      surgeLayers: appliedSurgeRatesheets.map(s => s.id),
      currentEnabledCount: enabledLayers.size
    });

    setEnabledLayers(pendingEnabledLayers);
    setPendingEnabledLayers(null); // Clear pending state

    // Clear the loading flag and reset unsaved changes after a delay to ensure all effects have run
    setTimeout(() => {
      isLoadingScenarioRef.current = false;
      setHasUnsavedChanges(false);
      console.log('✅ [LOAD SCENARIO] Cleared loading flag and reset unsaved changes');
    }, 200);
  }, [pendingEnabledLayers, appliedSurgeRatesheets]);

  // Detect changes from saved scenario state
  useEffect(() => {
    if (!currentScenarioId || !savedScenarioState) {
      setHasUnsavedChanges(false);
      return;
    }

    // Skip change detection if we're currently loading a scenario or restoring pending layers
    if (isLoadingScenarioRef.current || pendingEnabledLayers !== null) {
      console.log('⏭️ [SCENARIO CHANGES] Skipping change detection (loading scenario)');
      return;
    }

    // Compare current state with saved state
    const currentEnabledLayersSet = enabledLayers;
    const savedEnabledLayersSet = savedScenarioState.enabledLayers;

    // Check if enabled layers have changed
    const layersChanged =
      currentEnabledLayersSet.size !== savedEnabledLayersSet.size ||
      !Array.from(currentEnabledLayersSet).every(id => savedEnabledLayersSet.has(id));

    // Find differences in layers
    const currentLayersArray = Array.from(currentEnabledLayersSet);
    const savedLayersArray = Array.from(savedEnabledLayersSet);
    const addedLayers = currentLayersArray.filter(id => !savedEnabledLayersSet.has(id as string));
    const removedLayers = savedLayersArray.filter(id => !currentEnabledLayersSet.has(id as string));

    // Calculate current range offsets for comparison
    const now = new Date();
    const currentRangeStartOffset = Math.round((rangeStart.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const currentRangeEndOffset = Math.round((rangeEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    // Check if other settings have changed
    const surgeChanged = surgeEnabled !== savedScenarioState.surgeEnabled;
    const durationChanged = selectedDuration !== savedScenarioState.selectedDuration;
    const coefficientsChanged =
      pricingCoefficientsUp !== savedScenarioState.pricingCoefficientsUp ||
      pricingCoefficientsDown !== savedScenarioState.pricingCoefficientsDown ||
      bias !== savedScenarioState.bias;

    // Check if range offsets have changed (dropdown values)
    const rangeOffsetsChanged =
      (savedScenarioState.rangeStartOffset !== undefined &&
       currentRangeStartOffset !== savedScenarioState.rangeStartOffset) ||
      (savedScenarioState.rangeEndOffset !== undefined &&
       currentRangeEndOffset !== savedScenarioState.rangeEndOffset);

    const hasChanges = layersChanged || surgeChanged || durationChanged || coefficientsChanged || rangeOffsetsChanged;

    if (hasChanges !== hasUnsavedChanges) {
      console.log('📝 [SCENARIO CHANGES] Change detection triggered:', {
        hasChanges,
        layersChanged,
        surgeChanged,
        durationChanged,
        coefficientsChanged,
        rangeOffsetsChanged,
        currentLayersCount: currentEnabledLayersSet.size,
        savedLayersCount: savedEnabledLayersSet.size,
        addedLayers,
        removedLayers,
        currentSurge: surgeEnabled,
        savedSurge: savedScenarioState.surgeEnabled,
        currentDuration: selectedDuration,
        savedDuration: savedScenarioState.selectedDuration,
        currentRangeStartOffset,
        savedRangeStartOffset: savedScenarioState.rangeStartOffset,
        currentRangeEndOffset,
        savedRangeEndOffset: savedScenarioState.rangeEndOffset,
        isLoadingRef: isLoadingScenarioRef.current,
        hasPendingLayers: pendingEnabledLayers !== null
      });
      setHasUnsavedChanges(hasChanges);
    }
  }, [
    currentScenarioId,
    savedScenarioState,
    enabledLayers,
    surgeEnabled,
    selectedDuration,
    pricingCoefficientsUp,
    pricingCoefficientsDown,
    bias,
    rangeStart,
    rangeEnd,
    hasUnsavedChanges,
    pendingEnabledLayers
  ]);

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
        // Find the highest priority active config (not just the first one)
        const activeConfigs = configs.filter((c: SurgeConfig) => c.isActive);
        const activeConfig = activeConfigs.length > 0
          ? activeConfigs.reduce((highest: SurgeConfig, current: SurgeConfig) =>
              (current.priority || 0) > (highest.priority || 0) ? current : highest
            )
          : null;
        setActiveSurgeConfig(activeConfig);
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
      // Calculate range offsets in days (for dropdown values)
      const now = new Date();
      const rangeStartOffset = Math.round((rangeStart.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const rangeEndOffset = Math.round((rangeEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      const config: any = {
        enabledLayers: Array.from(enabledLayers),
        selectedDuration,
        isEventBooking,
        viewStart: viewStart.toISOString(),
        viewEnd: viewEnd.toISOString(),
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
        rangeStartOffset, // Save dropdown value (e.g., -7 for "7 days ago")
        rangeEndOffset,   // Save dropdown value (e.g., +3 for "3 days ahead")
        useDurationContext,
        bookingStartTime: bookingStartTime.toISOString(),
        // Save surge pricing state
        surgeEnabled,
        surgeConfigId: activeSurgeConfig?._id?.toString(),
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

    // Set flag to skip auto-enable of surge layers (we'll use saved enabledLayers instead)
    isLoadingScenarioRef.current = true;

    console.log('📂 [LOAD SCENARIO] Loading scenario:', scenario.name, {
      surgeEnabled: config.surgeEnabled,
      enabledLayersCount: config.enabledLayers.length,
      hasSurgeLayers: config.enabledLayers.some(id => typeof id === 'string' && id.startsWith('SURGE:'))
    });

    // Store the saved enabled layers to restore later (after surge layers are created)
    setPendingEnabledLayers(new Set(config.enabledLayers));

    // Calculate range dates from offsets if available (for dropdown restoration)
    let newRangeStart: Date;
    let newRangeEnd: Date;
    if (config.rangeStartOffset !== undefined && config.rangeEndOffset !== undefined) {
      // Use saved offsets to recalculate dates relative to current "now"
      const now = new Date();
      newRangeStart = new Date(now.getTime() + config.rangeStartOffset * 24 * 60 * 60 * 1000);
      newRangeEnd = new Date(now.getTime() + config.rangeEndOffset * 24 * 60 * 60 * 1000);
    } else {
      // Backward compatibility: use absolute dates if offsets not available
      newRangeStart = new Date(config.rangeStart);
      newRangeEnd = new Date(config.rangeEnd);
    }

    // Save the initial scenario state for change detection
    setSavedScenarioState({
      enabledLayers: new Set(config.enabledLayers),
      selectedDuration: config.selectedDuration,
      isEventBooking: config.isEventBooking,
      viewStart: new Date(config.viewStart),
      viewEnd: new Date(config.viewEnd),
      rangeStartOffset: config.rangeStartOffset,
      rangeEndOffset: config.rangeEndOffset,
      surgeEnabled: config.surgeEnabled,
      pricingCoefficientsUp: config.pricingCoefficientsUp,
      pricingCoefficientsDown: config.pricingCoefficientsDown,
      bias: config.bias
    });
    setHasUnsavedChanges(false);

    // First, restore all state EXCEPT enabledLayers (we'll do that after surge layers are created)
    setSelectedDuration(config.selectedDuration);
    setIsEventBooking(config.isEventBooking);
    setViewStart(new Date(config.viewStart));
    setViewEnd(new Date(config.viewEnd));
    setRangeStart(newRangeStart);
    setRangeEnd(newRangeEnd);
    setUseDurationContext(config.useDurationContext || false);
    setBookingStartTime(config.bookingStartTime ? new Date(config.bookingStartTime) : new Date(config.viewStart));

    // Restore pricing coefficients if they exist
    setPricingCoefficientsUp(config.pricingCoefficientsUp);
    setPricingCoefficientsDown(config.pricingCoefficientsDown);
    setBias(config.bias);

    // Restore surge pricing state if it exists (do this BEFORE enabledLayers)
    // This will trigger pricing calculation and populate appliedSurgeRatesheets
    if (config.surgeEnabled !== undefined) {
      setSurgeEnabled(config.surgeEnabled);
    }

    // Enable Simulation Mode when loading a scenario
    setIsSimulationEnabled(true);
    setIsPlanningEnabled(true);

    setCurrentScenarioId(scenario._id?.toString() || null);
    alert(`Loaded scenario: ${scenario.name}`);
  };

  // Clear/reset current scenario
  const clearScenario = () => {
    setCurrentScenarioId(null);
    setSavedScenarioState(null);
    setHasUnsavedChanges(false);

    // Reset to default state - enable ALL layers (default simulation state)
    const allLayerIds = getPricingLayers().map(layer => layer.id);
    setEnabledLayers(new Set(allLayerIds));

    // Clear pricing coefficients
    setPricingCoefficientsUp(undefined);
    setPricingCoefficientsDown(undefined);
    setBias(undefined);
  };

  // Promote scenario to production (materialize surge configs)
  const promoteToProduction = async () => {
    if (!currentScenarioId) {
      alert('No scenario selected to promote');
      return;
    }

    if (!surgeEnabled || appliedSurgeRatesheets.length === 0) {
      alert('⚠️ No surge pricing is active in this scenario.\n\nPromotion is only available for scenarios with surge pricing enabled.');
      return;
    }

    const confirmMessage = `🚀 Promote to Production\n\nThis will materialize ${appliedSurgeRatesheets.length} surge config(s) into physical ratesheets:\n\n${appliedSurgeRatesheets.map(s => `• ${s.name}`).join('\n')}\n\nEach will be created as DRAFT and require approval before going live.\n\nContinue?`;

    if (!confirm(confirmMessage)) return;

    try {
      let successCount = 0;
      let failCount = 0;
      const results = [];

      for (const surgeRatesheet of appliedSurgeRatesheets) {
        // Extract config ID from surge ratesheet
        // Surge ratesheets have names like "SURGE: Test Surge - High Priority"
        // We need to find the corresponding config
        const surgeName = surgeRatesheet.name.replace('SURGE: ', '');

        // Find the config by searching for active surge configs
        try {
          const response = await fetch('/api/surge-pricing/configs');
          if (!response.ok) throw new Error('Failed to fetch surge configs');

          const configs = await response.json();
          const matchingConfig = configs.find((c: any) => c.name === surgeName && c.isActive);

          if (!matchingConfig) {
            failCount++;
            results.push(`❌ ${surgeName}: Config not found`);
            continue;
          }

          // Materialize the config
          const materializeResponse = await fetch(`/api/surge-pricing/configs/${matchingConfig._id}/materialize`, {
            method: 'POST',
          });

          if (materializeResponse.ok) {
            const data = await materializeResponse.json();
            successCount++;
            results.push(`✅ ${surgeName}: ${data.multiplier.toFixed(3)}x`);
          } else {
            failCount++;
            results.push(`❌ ${surgeName}: Materialization failed`);
          }
        } catch (error) {
          failCount++;
          results.push(`❌ ${surgeName}: ${error}`);
        }
      }

      const resultMessage = `🎉 Promotion Complete!\n\n${results.join('\n')}\n\n✅ Success: ${successCount}\n❌ Failed: ${failCount}\n\nNavigate to Admin > Surge Pricing to review and submit for approval.`;
      alert(resultMessage);

      if (successCount > 0) {
        // Optionally navigate to admin page
        if (confirm('Navigate to Surge Pricing admin page?')) {
          window.open('/admin/surge-pricing', '_blank');
        }
      }
    } catch (error) {
      console.error('Error promoting to production:', error);
      alert('Failed to promote scenario to production');
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
        console.log('[Timeline Simulator] Set entity timezone:', data.timezone);
      }
    } catch (error) {
      console.error('Failed to fetch entity timezone:', error);
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

    // Add SURGE layers from the applied surge ratesheets (extracted from API response)
    // These can be either:
    // 1. VIRTUAL surge configs (not materialized) - add "(Virtual)" label
    // 2. MATERIALIZED surge ratesheets (approved, in DB) - add time window and multiplier
    if (surgeEnabled && appliedSurgeRatesheets.length > 0) {
      appliedSurgeRatesheets.forEach(surge => {
        // Find the matching materialized ratesheet by ID to get time window and multiplier
        const matchingRatesheet = ratesheets.find(rs => rs._id === surge.id && !!(rs as any).surgeConfigId);
        const isMaterialized = !!matchingRatesheet;

        let displayName = surge.name;
        if (isMaterialized && matchingRatesheet) {
          // Add time window and multiplier to name for materialized surge ratesheets
          const effectiveFrom = new Date(matchingRatesheet.effectiveFrom);
          const effectiveTo = matchingRatesheet.effectiveTo ? new Date(matchingRatesheet.effectiveTo) : null;
          const multiplier = (matchingRatesheet as any).surgeMultiplierSnapshot || 1;
          const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          if (effectiveTo) {
            displayName = `${surge.name} (${formatTime(effectiveFrom)} - ${formatTime(effectiveTo)}, ${multiplier.toFixed(1)}x)`;
          } else {
            displayName = `${surge.name} (from ${formatTime(effectiveFrom)}, ${multiplier.toFixed(1)}x)`;
          }
        } else if (!isMaterialized) {
          displayName = `${surge.name} (Virtual)`;
        }

        layers.push({
          id: surge.id,
          name: displayName,
          type: 'SURGE',
          priority: surge.priority,
          color: 'bg-gradient-to-br from-orange-400 to-orange-600',
          applyTo: 'SURGE'
        });
      });
    }

    // Add ratesheets (already sorted by priority)
    ratesheets.forEach((rs) => {
      // Check if this is a materialized surge ratesheet (has surgeConfigId)
      // Materialized surge ratesheets are PHYSICAL ratesheets that have been approved
      // They DON'T get "(Virtual)" label since they're real, approved ratesheets
      const isSurgeRatesheet = !!(rs as any).surgeConfigId;

      // Skip materialized surge ratesheets in Simulation Mode:
      // - When surge IS enabled: they come from appliedSurgeRatesheets (avoid duplicates)
      // - When surge is NOT enabled: they should not compete as SURGE layers
      //   (prevents inflated prices since client-side SURGE evaluation ignores time windows,
      //    while the API engine correctly checks time windows — causing price discrepancy)
      if (isSurgeRatesheet && isSimulationEnabled) {
        console.log('⏭️  Skipping materialized surge ratesheet in Simulation Mode:', rs.name, surgeEnabled ? '(already in appliedSurgeRatesheets)' : '(surge disabled)');
        return;
      }

      // Debug: Log surge ratesheets
      if (rs.name.includes('SURGE:')) {
        console.log('🔍 Processing ratesheet:', {
          name: rs.name,
          hasSurgeConfigId: !!(rs as any).surgeConfigId,
          surgeConfigId: (rs as any).surgeConfigId,
          isSurgeRatesheet,
          isMaterialized: isSurgeRatesheet,
          priority: rs.priority,
          surgeEnabled,
          mode: surgeEnabled ? 'Simulation (can show both)' : 'Live (Materialized only)'
        });
      }

      let name = rs.name;
      // For materialized surge ratesheets, append the effective time window AND multiplier to distinguish them
      if (isSurgeRatesheet) {
        const effectiveFrom = new Date(rs.effectiveFrom);
        const effectiveTo = rs.effectiveTo ? new Date(rs.effectiveTo) : null;
        const multiplier = (rs as any).surgeMultiplierSnapshot || 1;
        const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        if (effectiveTo) {
          name = `${rs.name} (${formatTime(effectiveFrom)} - ${formatTime(effectiveTo)}, ${multiplier.toFixed(1)}x)`;
        } else {
          name = `${rs.name} (from ${formatTime(effectiveFrom)}, ${multiplier.toFixed(1)}x)`;
        }
      } else {
        // Append entity labels to non-surge ratesheets
        if (rs.applyTo === 'EVENT' && rs.event) {
          name = `${rs.name} (${rs.event.name})`;
        } else if (rs.applyTo === 'CUSTOMER' && rs.customer) {
          name = `${rs.name} (${rs.customer.name})`;
        } else if (rs.applyTo === 'LOCATION' && rs.location) {
          name = `${rs.name} (${rs.location.name})`;
        } else if (rs.applyTo === 'SUBLOCATION' && rs.sublocation) {
          name = `${rs.name} (${rs.sublocation.label})`;
        }
      }

      // CRITICAL: Materialized surge ratesheets should ALWAYS be SURGE type (in both Live and Simulation modes)
      // This ensures they use API segment prices (calculated surge prices) instead of time window multipliers
      const shouldBeSurgeType = isSurgeRatesheet;

      layers.push({
        id: rs._id,
        name,
        type: shouldBeSurgeType ? 'SURGE' : 'RATESHEET',
        priority: rs.priority,
        // Always use orange color for surge ratesheets (even in Live Mode as RATESHEET type)
        color: isSurgeRatesheet ? 'bg-gradient-to-br from-orange-400 to-orange-600' : getLayerColor(rs.applyTo, rs.priority),
        applyTo: isSurgeRatesheet ? 'SURGE' : rs.applyTo
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
        name: `SubLocation-1 Default`,
        type: 'SUBLOCATION_DEFAULT',
        priority: sublocPriority,
        rate: currentSubLocation.defaultHourlyRate,
        color: 'bg-purple-400'
      });
    }

    if (currentLocation?.defaultHourlyRate && currentLocation.defaultHourlyRate > 0) {
      layers.push({
        id: 'location-default',
        name: `Location-1 (${currentLocation.name}) Default`,
        type: 'LOCATION_DEFAULT',
        priority: locPriority,
        rate: currentLocation.defaultHourlyRate,
        color: 'bg-emerald-400'
      });
    }

    if (currentCustomer?.defaultHourlyRate && currentCustomer.defaultHourlyRate > 0) {
      layers.push({
        id: 'customer-default',
        name: `Customer-1 Default`,
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
    setPricingDataLoading(true);
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

    // RACE CONDITION FIX: Compute effective enabled layers inline
    // When ratesheets change, the enabledLayers state may be stale (from previous ratesheets)
    // because setEnabledLayers() is async and may not have completed yet.
    // We detect staleness by checking:
    // 1. enabledLayers is empty when layers exist
    // 2. enabledLayers contains IDs that don't exist in allLayers (old IDs removed)
    // 3. In non-simulation mode: enabledLayers is missing current layer IDs (new layers added)
    //    Note: In simulation mode, users can intentionally disable layers, so we skip this check
    const allLayerIds = new Set(allLayers.map(l => l.id));
    const hasStaleIds = Array.from(enabledLayers).some(id => !allLayerIds.has(id));
    const hasMissingIds = allLayers.some(l => !enabledLayers.has(l.id));

    const isEnabledLayersStale =
      (allLayers.length > 0 && enabledLayers.size === 0) || // Empty when there should be layers
      hasStaleIds || // Contains old IDs that no longer exist
      (!isSimulationEnabled && hasMissingIds); // In live mode, missing layers means stale (new ratesheets added)

    const effectiveEnabledLayers = isEnabledLayersStale ? allLayerIds : enabledLayers;

    if (isEnabledLayersStale) {
      console.log('⚠️ [RACE FIX] Detected stale enabledLayers, using all layers:', {
        enabledLayersSize: enabledLayers.size,
        allLayersSize: allLayers.length,
        hasStaleIds,
        hasMissingIds,
        isSimulationEnabled,
        usingFreshSet: true
      });
    }

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

    console.log('🔍 [SURGE] API Fetch:', {
      surgeEnabled,
      dateRange: `${roundedViewStart.toISOString()} → ${roundedViewEnd.toISOString()}`
    });

    if (selectedSubLocation) {
      try {
        if (surgeEnabled || !isSimulationEnabled) {
          // Fetch base prices (without virtual surge, but includes materialized surge in Live mode)
          const baseResponse = await fetch('/api/pricing/calculate-hourly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subLocationId: selectedSubLocation,
              startTime: roundedViewStart.toISOString(),
              endTime: roundedViewEnd.toISOString(),
              eventId: selectedEventId || undefined,
              includeSurge: false, // Don't include virtual surge, but backend will still include materialized surge ratesheets
            }),
          });
          if (baseResponse.ok) {
            basePricingData = await baseResponse.json();
          }

          // Fetch surge prices (with virtual surge) - only in Simulation mode with surge enabled
          if (surgeEnabled && isSimulationEnabled) {
            const surgeResponse = await fetch('/api/pricing/calculate-hourly', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subLocationId: selectedSubLocation,
                startTime: roundedViewStart.toISOString(),
                endTime: roundedViewEnd.toISOString(),
                eventId: selectedEventId || undefined,
                includeSurge: true, // Include virtual surge
              }),
            });
            if (surgeResponse.ok) {
              surgePricingData = await surgeResponse.json();

              console.log('🔍 [SURGE] API Response:', {
                hasSegments: !!surgePricingData?.segments,
                segmentCount: surgePricingData?.segments?.length || 0,
                firstSegmentLevel: surgePricingData?.segments?.[0]?.ratesheet?.level,
                firstSegmentName: surgePricingData?.segments?.[0]?.ratesheet?.name
              });

              // Extract surge ratesheets - use ALL materialized surge ratesheets from DB
              // IMPORTANT: Use rs._id as the ID (not name) so tile activation can match correctly
              const surgeLayers = new Map<string, { id: string; name: string; priority: number }>();

              // STEP 1: Always add ALL materialized surge ratesheets from the database
              // This ensures we don't miss any due to imperfect segment matching
              ratesheets.forEach((rs: any) => {
                if (rs.surgeConfigId) {
                  surgeLayers.set(rs._id, {
                    id: rs._id, // Use _id for proper matching in tile activation
                    name: rs.name,
                    priority: rs.priority
                  });
                }
              });

              // STEP 2: Also check API segments for any VIRTUAL surge configs (not yet materialized)
              surgePricingData.segments?.forEach((segment: any) => {
                if (segment.ratesheet?.level === 'SURGE') {
                  const ratesheetName = segment.ratesheet.name;
                  // Check if this is a virtual surge (not in our materialized ratesheets)
                  const isMaterialized = ratesheets.some((rs: any) =>
                    rs.surgeConfigId && rs.name === ratesheetName
                  );

                  if (!isMaterialized && !surgeLayers.has(ratesheetName)) {
                    // This is a virtual surge config - add it with name as ID
                    surgeLayers.set(ratesheetName, {
                      id: ratesheetName,
                      name: ratesheetName,
                      priority: segment.ratesheet.priority || 10000
                    });
                  }
                }
              });

              setAppliedSurgeRatesheets(Array.from(surgeLayers.values()));

              console.log(`🔍 [SURGE] Found ${surgeLayers.size} surge ratesheet(s):`,
                Array.from(surgeLayers.values()).map(s => `${s.name} (${s.priority})`).join(', ') || 'none'
              );
            }
          }
        } else {
          // Just fetch base prices
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
          }
        }
      } catch (error) {
        console.error('Failed to fetch pricing data:', error);
      }
    }

    let iterationCount = 0;

    while (currentTime < endTime) {
      // Use timezone-aware time conversion to match API calculations
      const timeStr = getTimeInTimezone(currentTime, entityTimezone);
      const hour = parseInt(timeStr.split(':')[0], 10);
      iterationCount++;

      // For each layer, check if it applies at this hour
      // Process in two passes: first non-SURGE layers, then SURGE layers with base price calculation
      const layerPrices = allLayers.map(layer => {
        let price: number | null = null;
        let isActive = false;

        if (layer.type === 'SURGE') {
          // SURGE layer - check materialized first, then virtual
          // For materialized surge ratesheets, match by ID (layer.id === rs._id)
          const surgeRatesheet = ratesheets.find(rs => rs._id === layer.id && !!(rs as any).surgeConfigId);

          if (surgeRatesheet) {
            const effectiveFrom = new Date(surgeRatesheet.effectiveFrom);
            const effectiveTo = surgeRatesheet.effectiveTo ? new Date(surgeRatesheet.effectiveTo) : null;

            // For materialized surge ratesheets, effectiveFrom/effectiveTo IS the time window
            // Don't check the stale timeWindows array - it contains the original config times
            // Use exclusive end time: effectiveTo > currentTime (not >=) to avoid double-counting the boundary hour
            if (effectiveFrom <= currentTime && (!effectiveTo || effectiveTo > currentTime)) {
              // Mark as active, price will be calculated in second pass
              isActive = true;
              price = 0; // Placeholder, will be updated
            }
          } else if (surgePricingData?.segments) {
            // Virtual surge — not in ratesheets DB, use API surge response to check activation
            // Virtual surge layers have id = ratesheet name (not a DB _id)
            const segment = surgePricingData.segments.find((seg: any) => {
              const segStart = new Date(seg.startTime);
              return segStart.getTime() === currentTime.getTime() &&
                     seg.ratesheet?.level === 'SURGE' &&
                     seg.ratesheet?.name === layer.id;
            });
            if (segment) {
              // Use the API's calculated surge price directly (already includes base × multiplier)
              isActive = true;
              price = segment.pricePerHour;
            }
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

                  // Check daysOfWeek filter — skip this window if day doesn't match
                  // Matches the API engine's daysOfWeek check in price-engine-hourly.ts
                  if (tw.daysOfWeek && tw.daysOfWeek.length > 0) {
                    const dayOfWeek = currentTime.getDay();
                    if (!tw.daysOfWeek.includes(dayOfWeek)) {
                      return false;
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

      // Second pass: Calculate SURGE layer prices using base price from non-SURGE layers
      layerPrices.forEach(layerPrice => {
        if (layerPrice.layer.type === 'SURGE' && layerPrice.isActive) {
          // Match by ID instead of name (name now includes time window suffix)
          const surgeRatesheet = ratesheets.find(rs => rs._id === layerPrice.layer.id && !!(rs as any).surgeConfigId);

          if (surgeRatesheet) {
            // Get the surge multiplier
            const surgeMultiplier = (surgeRatesheet as any).surgeMultiplierSnapshot || 1;

            // Find the base price from the highest priority non-SURGE layer
            let basePrice: number | undefined;

            // Look for active non-SURGE layers
            const nonSurgeLayer = layerPrices.find(lp => lp.isActive && lp.layer.type !== 'SURGE' && lp.price !== null && lp.price > 0);
            if (nonSurgeLayer && nonSurgeLayer.price !== null) {
              basePrice = nonSurgeLayer.price;
            }

            // Fallback: try basePricingData
            if (!basePrice && basePricingData?.segments) {
              const baseSegment = basePricingData.segments.find((seg: any) => {
                const segStart = new Date(seg.startTime);
                return segStart.getTime() === currentTime.getTime();
              });

              if (baseSegment?.pricePerHour) {
                // Check if this segment is from a SURGE ratesheet
                if (baseSegment.ratesheet?.level === 'SURGE') {
                  // Divide out the surge multiplier to get base
                  const winningMultiplier = baseSegment.ratesheet.surgeMultiplierSnapshot || 1;
                  basePrice = baseSegment.pricePerHour / winningMultiplier;
                } else {
                  basePrice = baseSegment.pricePerHour;
                }
              }
            }

            if (basePrice) {
              // Calculate this surge's hypothetical price
              layerPrice.price = basePrice * surgeMultiplier;
              console.log(`✅ [SURGE CALCULATED] Hour ${hour}, Layer: ${layerPrice.layer.name}`, {
                basePrice,
                surgeMultiplier,
                calculatedPrice: layerPrice.price
              });
            } else {
              console.log(`⚠️ [NO BASE PRICE] Hour ${hour}, Layer: ${layerPrice.layer.name} - Setting isActive to false`);
              layerPrice.isActive = false;
              layerPrice.price = null;
            }
          }
        }
      });

      // Winner is the active layer with highest priority (and highest price if tied) that is enabled
      // Filter active enabled layers, then sort by priority DESC, then by price DESC for tie-breaking
      // Use effectiveEnabledLayers to handle race condition when state is stale
      const activeEnabledLayers = layerPrices
        .filter(lp => lp.isActive && effectiveEnabledLayers.has(lp.layer.id))
        .sort((a, b) => {
          // First sort by priority (higher priority wins)
          if (b.layer.priority !== a.layer.priority) {
            return b.layer.priority - a.layer.priority;
          }
          // If priorities are equal, higher price wins (e.g., 2.0x surge beats 1.0x surge)
          return (b.price || 0) - (a.price || 0);
        });
      let winner = activeEnabledLayers[0];

      // SURGE layer prices are already calculated (base × multiplier) from the backend
      // No need to recalculate here

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
          if (!effectiveEnabledLayers.has(event.ratesheetId)) return false;

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
      // Operating hours status from API
      let slotIsAvailable: boolean | undefined = undefined;
      let slotUnavailableReason: 'CLOSED' | 'BLACKOUT' | undefined = undefined;

      // Get base price and operating hours status
      if (basePricingData?.segments) {
        const segment = basePricingData.segments.find((seg: any) => {
          const segStart = new Date(seg.startTime);
          return segStart.getTime() === currentTime.getTime();
        });
        if (segment) {
          apiBasePrice = segment.pricePerHour;
          // Extract operating hours status
          slotIsAvailable = segment.isAvailable;
          slotUnavailableReason = segment.unavailableReason;
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

      if (isSimulationEnabled && surgeEnabled) {
        // Simulation mode WITH surge: use layer-based winner (respects surge layer toggles)
        // Winner is already calculated and respects enabledLayers
        // If SURGE won, winner.price has already been recalculated dynamically
        finalWinningPrice = winner?.price !== undefined && winner?.price !== null ? winner.price : undefined;

        // Debug: Log simulation mode pricing for first iteration
        if (iterationCount === 1) {
          console.log(`💡 [SIMULATION+SURGE] Hour ${hour} Pricing:`, {
            winnerPrice: winner?.price,
            finalWinningPrice,
            winnerType: winner?.layer.type,
            isSurgeWinner: winner?.layer.type === 'SURGE'
          });
        }

        // For base price in simulation mode:
        // - If SURGE layer is winning AND enabled, find the non-surge layer winner for base price
        // - Otherwise, base price = winning price (no strikethrough needed)
        if (winner?.layer.type === 'SURGE' && winner.layer.id && effectiveEnabledLayers.has(winner.layer.id)) {
          // Find the winning non-SURGE layer for the base price
          const nonSurgeWinner = layerPrices.find(lp =>
            lp.isActive &&
            effectiveEnabledLayers.has(lp.layer.id) &&
            lp.layer.type !== 'SURGE'
          );
          finalBasePrice = nonSurgeWinner?.price ?? apiBasePrice;
        } else {
          finalBasePrice = finalWinningPrice; // Same as winning price when not showing surge
        }
      } else {
        // Live mode OR Simulation without surge: use API pricing
        // This ensures Simulation mode (surge off) matches Live mode exactly,
        // since the API pricing engine includes materialized surge ratesheets
        // that the client-side layer calculation cannot fully replicate.
        apiWinningPrice = surgeEnabled ? apiSurgePrice : apiBasePrice;
        finalWinningPrice = apiWinningPrice;
        finalBasePrice = apiBasePrice;

        // Debug: Log API-based pricing for first few iterations
        if (iterationCount <= 5) {
          console.log(`🐛 [Iteration ${iterationCount}, Hour ${hour}] ${isSimulationEnabled ? 'Simulation (no surge)' : 'Live'} mode pricing:`, {
            surgeEnabled,
            apiBasePrice,
            apiSurgePrice,
            apiWinningPrice,
            finalWinningPrice,
            finalBasePrice
          });
        }
      }

      // Surge price for display purposes
      let finalSurgePrice = apiSurgePrice;

      // IMPORTANT: When SURGE layer wins in simulation mode, winner.price already contains
      // the correct surge-adjusted price calculated by the backend pricing engine.
      // We should NOT recalculate it here. The finalWinningPrice set at line 1497
      // already has the correct value from winner.price.
      //
      // The previous code was incorrectly recalculating: nonSurgeWinner.price × apiSurgeMultiplier
      // This caused the winning price to be overwritten with an incorrect value.
      //
      // REMOVED the surge recalculation logic that was causing the bug.

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
        // Operating hours status
        isAvailable: slotIsAvailable,
        unavailableReason: slotUnavailableReason,
      });


      currentTime.setHours(currentTime.getHours() + 1);
    }

    // NOTE: Surge pricing now happens automatically in the pricing engine (SURGE ratesheets)
    // No post-processing needed - surge ratesheets are generated and applied in the pricing waterfall

    // Update baseline price from API base pricing for the CURRENT time range.
    // This ensures the baseline always reflects the non-surge total for the
    // exact hours being displayed, so the delta accurately shows surge effect
    // (not drift from a stale time range captured when simulation was first enabled).
    if (isSimulationEnabled && basePricingData?.segments) {
      const baselineTotal = basePricingData.segments.reduce(
        (sum: number, seg: any) => sum + (seg.pricePerHour || 0), 0
      );
      setPreSimulationBaselinePrice(baselineTotal);
    }

    setTimeSlots(slots);
    setPricingDataLoading(false);
  };

  // Refresh function to reload all pricing data
  const handleRefresh = async () => {
    if (!selectedSubLocation) return;

    setIsRefreshing(true);
    try {
      // Refetch ratesheets
      await fetchRatesheets(selectedSubLocation);
      // Recalculate time slots (will be triggered by ratesheets change, but we also call it directly)
      await calculateTimeSlots();
    } catch (error) {
      console.error('Error refreshing pricing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const timeInWindow = (time: string, start: string, end: string): boolean => {
    // Handle overnight time windows (e.g., 22:00 to 02:00)
    if (end < start) {
      // Overnight window: matches if time >= start OR time < end
      return time >= start || time < end;
    }
    // Same-day window: matches if time >= start AND time < end
    return time >= start && time < end;
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
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
    // Snap to nearest hour
    const hourMs = 60 * 60 * 1000;
    const snappedMs = Math.round(newMs / hourMs) * hourMs;
    const newViewStart = new Date(snappedMs);
    const newViewEnd = new Date(newViewStart.getTime() + selectedDuration * hourMs);

    setViewStart(newViewStart);
    setViewEnd(newViewEnd);
  };

  // Range bound handlers - allow users to expand/shrink the timeline range
  const handleRangeStartChange = (daysOffset: number) => {
    const now = new Date();
    const newRangeStart = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);

    // Ensure rangeStart is before rangeEnd (at least 1 day gap)
    if (newRangeStart.getTime() < rangeEnd.getTime() - 24 * 60 * 60 * 1000) {
      setRangeStart(newRangeStart);

      // Adjust viewStart if it's now outside the new range
      if (viewStart.getTime() < newRangeStart.getTime()) {
        setViewStart(newRangeStart);
        setViewEnd(new Date(newRangeStart.getTime() + selectedDuration * 60 * 60 * 1000));
      }
    }
  };

  const handleRangeEndChange = (daysOffset: number) => {
    const now = new Date();
    const newRangeEnd = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);

    // Ensure rangeEnd is after rangeStart (at least 1 day gap)
    if (newRangeEnd.getTime() > rangeStart.getTime() + 24 * 60 * 60 * 1000) {
      setRangeEnd(newRangeEnd);

      // Adjust viewEnd if it's now outside the new range
      if (viewEnd.getTime() > newRangeEnd.getTime()) {
        setViewEnd(newRangeEnd);
        setViewStart(new Date(newRangeEnd.getTime() - selectedDuration * 60 * 60 * 1000));
      }
    }
  };

  // Get current total based on active layers
  const getTotalCost = (): number => {
    return timeSlots.reduce((sum, slot) => sum + (slot.winningPrice || 0), 0);
  };

  // Component to render price with superscript cents
  const PriceWithSuperscript = ({ price, className = '', dollarClass = '', centsClass = '' }: {
    price: number;
    className?: string;
    dollarClass?: string;
    centsClass?: string;
  }) => {
    const { dollars, cents } = formatPriceWithSuperscript(price);
    return (
      <span className={className}>
        <span className={dollarClass}>${dollars}</span>
        <span className={`${centsClass} align-super`}>.{cents}</span>
      </span>
    );
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
          willBlock: enabledDefaultLayersAfterDisable.length === 0 && layerToDisable?.type !== 'SURGE' && layerToDisable?.type !== 'RATESHEET'
        });

        // Prevent disabling if it would leave zero DEFAULT layers
        // BUT SURGE and RATESHEET layers can always be disabled
        // This ensures there's always at least one always-active pricing layer
        if (enabledDefaultLayersAfterDisable.length === 0 &&
            layerToDisable?.type !== 'SURGE' &&
            layerToDisable?.type !== 'RATESHEET') {
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
      <SimulatorHeader
        currentSubLocationLabel={currentSubLocation?.label}
        currentLocationName={currentLocation?.name}
        currentEventName={currentEvent?.name}
        selectedSubLocation={selectedSubLocation}
        selectedDuration={selectedDuration}
        isEventBooking={isEventBooking}
        isSimulationEnabled={isSimulationEnabled}
        onSimulationToggle={setIsSimulationEnabled}
        isPlanningEnabled={isPlanningEnabled}
        onPlanningToggle={setIsPlanningEnabled}
        surgeEnabled={surgeEnabled}
        onSurgeToggle={setSurgeEnabled}
        activeSurgeConfig={activeSurgeConfig}
        appliedSurgeRatesheets={appliedSurgeRatesheets}
        scenarios={scenarios}
        currentScenarioId={currentScenarioId}
        hasUnsavedChanges={hasUnsavedChanges}
        onSaveScenario={saveScenario}
        onLoadScenario={loadScenario}
        onClearScenario={clearScenario}
        onPromoteToProduction={promoteToProduction}
        onOpenFilters={() => setIsFiltersModalOpen(true)}
      />

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
        <SaveScenarioModal
          isOpen={isSaveScenarioModalOpen}
          onClose={() => { setIsSaveScenarioModalOpen(false); setSaveScenarioName(''); setSaveScenarioDescription(''); }}
          onSubmit={handleSaveScenarioSubmit}
          scenarioName={saveScenarioName}
          onScenarioNameChange={setSaveScenarioName}
          scenarioDescription={saveScenarioDescription}
          onScenarioDescriptionChange={setSaveScenarioDescription}
          enabledLayersCount={enabledLayers.size}
          selectedDuration={selectedDuration}
          isEventBooking={isEventBooking}
          surgeEnabled={surgeEnabled}
          activeSurgeConfigName={activeSurgeConfig?.name}
          hasPricingCoefficients={pricingCoefficientsUp !== undefined || pricingCoefficientsDown !== undefined || bias !== undefined}
        />

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
                <TotalCostDisplay
                  totalCost={getTotalCost()}
                  totalDuration={getTotalDuration()}
                  isSimulationEnabled={isSimulationEnabled}
                  preSimulationBaselinePrice={preSimulationBaselinePrice}
                  surgeEnabled={surgeEnabled}
                  hasSurgeConfig={!!activeSurgeConfig}
                />

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
                  {/* Range adjustment controls */}
                  <div className="flex justify-between items-center mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-gray-500">Range Start:</span>
                      <select
                        value={Math.round((rangeStart.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000))}
                        onChange={(e) => handleRangeStartChange(parseInt(e.target.value))}
                        className="text-[10px] px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:border-purple-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                      >
                        <option value={-60}>60 days ago</option>
                        <option value={-30}>30 days ago</option>
                        <option value={-14}>14 days ago</option>
                        <option value={-7}>7 days ago</option>
                        <option value={-3}>3 days ago</option>
                        <option value={-1}>1 day ago</option>
                        <option value={0}>Today</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-gray-500">Range End:</span>
                      <select
                        value={Math.round((rangeEnd.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000))}
                        onChange={(e) => handleRangeEndChange(parseInt(e.target.value))}
                        className="text-[10px] px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:border-purple-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                      >
                        <option value={1}>1 day ahead</option>
                        <option value={3}>3 days ahead</option>
                        <option value={7}>7 days ahead</option>
                        <option value={14}>14 days ahead</option>
                        <option value={30}>30 days ahead</option>
                        <option value={60}>60 days ahead</option>
                        <option value={90}>90 days ahead</option>
                      </select>
                    </div>
                  </div>

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
              <HourlyRateChart
                timeSlots={timeSlots}
                viewStart={viewStart}
                selectedDuration={selectedDuration}
                onDurationChange={setQuickRange}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
                pricingDataLoading={pricingDataLoading}
              />

              {/* Winning Price Grid */}
              <WinningPriceGrid
                timeSlots={timeSlots}
                selectedSlot={selectedSlot}
                hoveredSlot={hoveredSlot}
                onTileClick={handleTileClick}
                onTileHover={handleTileHover}
                onTileLeave={handleTileLeave}
                surgeEnabled={surgeEnabled}
                isSimulationEnabled={isSimulationEnabled}
                enabledLayers={enabledLayers}
                pricingDataLoading={pricingDataLoading}
                isRefreshing={isRefreshing}
              />

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
              <PricingWaterfallGrid
                timeSlots={timeSlots}
                allLayers={allLayers}
                enabledLayers={enabledLayers}
                isSimulationEnabled={isSimulationEnabled}
                ratesheets={ratesheets}
                onToggleLayer={toggleLayer}
                onTileClick={handleTileClick}
                onTileHover={handleTileHover}
                onTileLeave={handleTileLeave}
                selectedSlot={selectedSlot}
                hoveredSlot={hoveredSlot}
                pricingDataLoading={pricingDataLoading}
                isRefreshing={isRefreshing}
              />
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
