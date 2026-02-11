'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Users,
  Building2,
  TrendingUp,
  DollarSign,
  Edit,
  Target,
  Percent,
  X,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { getMonthlyGoalTotal, getMonthlyOccupancyPercentage, getCurrentWeekProgress, getPlanningCoverage } from '@/lib/capacity-utils';
import HourlyBreakdownTable from '@/components/HourlyBreakdownTable';
import DayCapacityMiniBar from '@/components/DayCapacityMiniBar';

interface Customer {
  _id: string;
  name: string;
  capacityConfig?: CapacityConfig;
}

interface Location {
  _id: string;
  name: string;
  customerId: string;
  capacityConfig?: CapacityConfig;
}

interface SubLocation {
  _id: string;
  label: string;
  locationId: string;
  capacityConfig?: CapacityConfig;
}

interface Event {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  subLocationId?: string;
  locationId?: string;
  customerId?: string;
  capacityConfig?: CapacityConfig;
}

interface CapacityConfig {
  minCapacity: number;
  maxCapacity: number;
  dailyCapacities: DailyCapacity[];
  revenueGoals: RevenueGoal[];
}

interface DailyCapacity {
  date: string;
  capacity: number;
}

interface RevenueGoal {
  startDate: string;
  endDate: string;
  dailyGoal?: number;
  weeklyGoal?: number;
  monthlyGoal?: number;
  revenueGoalType?: 'max' | 'allocated' | 'custom';
  customCategoryGoals?: {
    transient: number;
    events: number;
    reserved: number;
    unavailable: number;
    readyToUse: number;
  };
}

interface HourlySegment {
  hour: number;
  startTime: string;
  endTime: string;
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity: number;
  source: string;
  capacitySheetName?: string;
  capacitySheetLevel?: string;
  isAvailable?: boolean;
  // Per-hour allocation breakdown
  breakdown?: {
    transient: number;
    events: number;
    reserved: number;
    unavailable: number;
    readyToUse: number;
    isOverride?: boolean;
  };
}

interface CapacityBreakdown {
  transient: number;
  events: number;
  reserved: number;
  unavailable: number;
  readyToUse: number;
}

interface DayCell {
  date: Date;
  dateStr: string;
  capacity: number;
  isOverride: boolean;
  revenueGoal?: RevenueGoal;
  calculatedCapacity?: number;
  calculatedGoal?: number;
  hourlyBreakdown?: HourlySegment[];
  capacityBreakdown?: CapacityBreakdown;
}

export default function CapacityManagementPage() {
  // Entity Selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<string>('');

  // Current Entity Data
  const [currentEntity, setCurrentEntity] = useState<any>(null);
  const [entityType, setEntityType] = useState<string>('');

  // Calendar View
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [dayCells, setDayCells] = useState<DayCell[]>([]);

  // UI State
  const [loading, setLoading] = useState(false);
  const [showBoundsModal, setShowBoundsModal] = useState(false);
  const [showCapacityModal, setShowCapacityModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCell, setSelectedCell] = useState<DayCell | null>(null);

  // Form State
  const [minCapacity, setMinCapacity] = useState<number>(0);
  const [maxCapacity, setMaxCapacity] = useState<number>(100);
  const [dailyGoal, setDailyGoal] = useState<number | undefined>();
  const [revenueGoalType, setRevenueGoalType] = useState<'max' | 'allocated' | 'custom'>('max');
  // Custom category goals (for custom revenue goal type)
  const [customCategoryGoals, setCustomCategoryGoals] = useState<{
    transient: number;
    events: number;
    reserved: number;
    unavailable: number;
    readyToUse: number;
  }>({ transient: 0, events: 0, reserved: 0, unavailable: 0, readyToUse: 0 });

  // Aggregation View
  const [showAggregation, setShowAggregation] = useState(false);
  const [aggregationData, setAggregationData] = useState<any>(null);

  // Computed dashboard tile values - recalculate when dayCells, currentEntity, or viewDate changes
  const selectedDateStr = useMemo(() => viewDate.toISOString().split('T')[0], [viewDate]);

  const hourlyRate = useMemo(() =>
    entityType === 'sublocation' ? currentEntity?.defaultHourlyRate : undefined,
    [entityType, currentEntity]
  );

  const currentWeekProgress = useMemo(() => {
    if (!currentEntity) {
      return { weekStart: '', weekEnd: '', totalGoal: 0, actualRevenue: 0, progressPercentage: 0, daysComplete: 0, totalDays: 7 };
    }
    return getCurrentWeekProgress(
      currentEntity.capacityConfig,
      selectedDateStr,
      { includeCalculated: true, hourlyRate, dayCells }
    );
  }, [currentEntity, selectedDateStr, hourlyRate, dayCells]);

  const monthlyGoal = useMemo(() => {
    if (!currentEntity) {
      console.log('[MonthlyGoal] No currentEntity, returning zeros');
      return { setGoals: 0, calculatedGoals: 0, total: 0, daysWithSetGoals: 0, daysCalculated: 0 };
    }

    console.log('[MonthlyGoal] Calculating for:', {
      month: selectedDateStr.substring(0, 7),
      entityId: currentEntity._id,
      revenueGoalsInConfig: currentEntity.capacityConfig?.revenueGoals?.length || 0,
      revenueGoals: currentEntity.capacityConfig?.revenueGoals,
      dayCellsCount: dayCells.length,
      hourlyRate
    });

    const result = getMonthlyGoalTotal(
      currentEntity.capacityConfig,
      selectedDateStr,
      { includeCalculated: true, hourlyRate, dayCells }
    );

    console.log('[MonthlyGoal] Result:', result);
    return result;
  }, [currentEntity, selectedDateStr, hourlyRate, dayCells]);

  const monthlyOccupancy = useMemo(() => {
    if (!currentEntity) {
      return 0;
    }
    return getMonthlyOccupancyPercentage(currentEntity, selectedDateStr, dayCells);
  }, [currentEntity, selectedDateStr, dayCells]);

  const planningCoverage = useMemo(() => {
    if (!currentEntity) {
      return { daysWithGoals: 0, totalDays: 0, percentage: 0, datesWithoutGoals: [] };
    }
    return getPlanningCoverage(currentEntity.capacityConfig, selectedDateStr, dayCells);
  }, [currentEntity, selectedDateStr, dayCells]);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchLocations(selectedCustomer);
      loadEntity('customer', selectedCustomer);
    } else {
      setLocations([]);
      setSelectedLocation('');
    }
  }, [selectedCustomer]);

  useEffect(() => {
    if (selectedLocation) {
      fetchSubLocations(selectedLocation);
      loadEntity('location', selectedLocation);
    } else {
      setSublocations([]);
      setSelectedSubLocation('');
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (selectedSubLocation) {
      fetchEvents(selectedSubLocation);
      loadEntity('sublocation', selectedSubLocation);
    } else {
      setEvents([]);
      setSelectedEvent('');
    }
  }, [selectedSubLocation]);

  useEffect(() => {
    if (selectedEvent) {
      loadEntity('event', selectedEvent);
    }
  }, [selectedEvent]);

  // When currentEntity or viewDate changes, regenerate the calendar
  useEffect(() => {
    if (currentEntity) {
      console.log('[Calendar] Regenerating calendar for:', {
        entityType,
        entityId: currentEntity._id,
        month: viewDate.toISOString().split('T')[0].substring(0, 7),
        revenueGoalsCount: currentEntity.capacityConfig?.revenueGoals?.length || 0
      });
      generateCalendar();
    }
  }, [currentEntity, viewDate]);

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const fetchLocations = async (customerId: string) => {
    try {
      const response = await fetch(`/api/locations?customerId=${customerId}`);
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

  const fetchEvents = async (subLocationId: string) => {
    try {
      const response = await fetch(`/api/events?subLocationId=${subLocationId}`);
      const data = await response.json();
      setEvents(data.filter((e: Event) => e.isActive));
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  const loadEntity = async (type: string, id: string) => {
    setLoading(true);
    try {
      let endpoint = '';
      switch (type) {
        case 'customer':
          endpoint = `/api/customers/${id}`;
          break;
        case 'location':
          endpoint = `/api/locations/${id}`;
          break;
        case 'sublocation':
          endpoint = `/api/sublocations/${id}`;
          break;
        case 'event':
          endpoint = `/api/events/${id}`;
          break;
      }

      console.log('[LoadEntity] Fetching:', { type, id, endpoint });
      const response = await fetch(endpoint);
      const data = await response.json();

      console.log('[LoadEntity] Received data:', {
        entityId: data._id,
        hasCapacityConfig: !!data.capacityConfig,
        revenueGoalsCount: data.capacityConfig?.revenueGoals?.length || 0,
        revenueGoals: data.capacityConfig?.revenueGoals
      });

      setCurrentEntity(data);
      setEntityType(type);

      // Set form defaults
      const config = data.capacityConfig;
      if (config) {
        setMinCapacity(config.minCapacity);
        setMaxCapacity(config.maxCapacity);
      } else {
        setMinCapacity(0);
        setMaxCapacity(100);
      }
    } catch (error) {
      console.error('Failed to load entity:', error);
    } finally {
      setLoading(false);
    }
  };

  const reloadCurrentEntity = async () => {
    if (!entityType) return;

    let id = '';
    switch (entityType) {
      case 'customer':
        id = selectedCustomer;
        break;
      case 'location':
        id = selectedLocation;
        break;
      case 'sublocation':
        id = selectedSubLocation;
        break;
      case 'event':
        id = selectedEvent;
        break;
    }

    console.log('[ReloadEntity] Reloading:', { entityType, id });

    if (id) {
      await loadEntity(entityType, id);
      console.log('[ReloadEntity] Completed. New revenue goals count:',
        currentEntity?.capacityConfig?.revenueGoals?.length || 0
      );
    }
  };

  const generateCalendar = async () => {
    console.log('[GenerateCalendar] Starting for:', {
      month: viewDate.toISOString().split('T')[0].substring(0, 7),
      entityId: currentEntity?._id,
      entityType,
      configExists: !!currentEntity?.capacityConfig,
      revenueGoalsCount: currentEntity?.capacityConfig?.revenueGoals?.length || 0,
      revenueGoals: currentEntity?.capacityConfig?.revenueGoals
    });

    setDayCells([]); // Clear stale data immediately when month changes
    setLoading(true); // Set loading state at the start
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const cells: DayCell[] = [];
    const config = currentEntity?.capacityConfig;

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      // Find daily capacity override
      const override = config?.dailyCapacities?.find((dc: DailyCapacity) => dc.date === dateStr);
      const capacity = override ? override.capacity : (config?.maxCapacity || 100);

      // Find revenue goal
      const goal = config?.revenueGoals?.find((rg: RevenueGoal) =>
        rg.startDate <= dateStr && rg.endDate >= dateStr
      );

      // Calculate capacity using hourly engine for sublocations
      let calculatedCapacity: number | undefined;
      let calculatedGoal: number | undefined;
      let hourlyBreakdown: HourlySegment[] | undefined;
      let capacityBreakdown: CapacityBreakdown | undefined;

      if (entityType === 'sublocation' && currentEntity?._id) {
        try {
          const startTime = new Date(d);
          startTime.setHours(0, 0, 0, 0);
          const endTime = new Date(d);
          endTime.setHours(23, 59, 59, 999);

          const response = await fetch('/api/capacity/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subLocationId: currentEntity._id,
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
            }),
          });

          if (response.ok) {
            const result = await response.json();
            // Calculate sum of all hourly max capacities
            if (result.segments && result.segments.length > 0) {
              // Build hourly breakdown first (include per-hour allocation breakdown from API)
              const breakdown = result.segments.map((seg: any) => ({
                hour: new Date(seg.startTime).getHours(),
                startTime: new Date(seg.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                endTime: new Date(seg.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                minCapacity: seg.minCapacity,
                maxCapacity: seg.maxCapacity,
                defaultCapacity: seg.defaultCapacity,
                allocatedCapacity: seg.allocatedCapacity,
                source: seg.source,
                capacitySheetName: seg.capacitySheet?.name,
                capacitySheetLevel: seg.capacitySheet?.level,
                isAvailable: seg.isAvailable,
                // Per-hour allocation breakdown (from capacity calculate API)
                breakdown: seg.breakdown ? {
                  transient: seg.breakdown.transient,
                  events: seg.breakdown.events,
                  reserved: seg.breakdown.reserved,
                  unavailable: seg.breakdown.unavailable,
                  readyToUse: seg.breakdown.readyToUse,
                  isOverride: seg.breakdown.isOverride,
                } : undefined,
              }));

              hourlyBreakdown = breakdown;

              // Calculate daily capacity as SUM of all hourly max capacities
              calculatedCapacity = breakdown.reduce((sum: number, seg: HourlySegment) => sum + seg.maxCapacity, 0);

              // Calculate revenue goal if we have hourly rate
              // Revenue = hourlyRate * SUM(hourly capacities)
              if (currentEntity.defaultHourlyRate && calculatedCapacity) {
                calculatedGoal = Math.round(currentEntity.defaultHourlyRate * calculatedCapacity);
              }

              // Use API's allocationBreakdown if available (includes stored defaultCapacities)
              // This ensures consistency with other capacity pages
              if (result.allocationBreakdown) {
                capacityBreakdown = {
                  transient: result.allocationBreakdown.allocated.transient,
                  events: result.allocationBreakdown.allocated.events,
                  reserved: result.allocationBreakdown.allocated.reserved,
                  unavailable: result.allocationBreakdown.unallocated.unavailable,
                  readyToUse: result.allocationBreakdown.unallocated.readyToUse,
                };
              } else {
                // Fallback: Calculate capacity breakdown from segments
                // - Transient: allocated capacity from non-EVENT sources
                // - Events: allocated capacity from EVENT sources
                // - Reserved: pre-reserved capacity (not dynamically calculated here)
                // - Unavailable: hours where source is OPERATING_HOURS and isAvailable is false
                // - ReadyToUse: buffer capacity available for future allocation (max - allocated)
                let transientCapacity = 0;
                let eventsCapacity = 0;
                let unavailableCapacity = 0;
                let readyToUseCapacity = 0;

                for (const seg of result.segments) {
                  // Check if this hour is unavailable (closed/blackout)
                  if (seg.source === 'OPERATING_HOURS' && seg.isAvailable === false) {
                    unavailableCapacity += seg.maxCapacity || 0;
                  } else {
                    // Categorize allocated capacity
                    if (seg.capacitySheet?.level === 'EVENT') {
                      eventsCapacity += seg.allocatedCapacity || 0;
                    } else {
                      transientCapacity += seg.allocatedCapacity || 0;
                    }
                    // ReadyToUse = buffer capacity available for future allocation
                    readyToUseCapacity += Math.max(0, (seg.maxCapacity || 0) - (seg.allocatedCapacity || 0));
                  }
                }

                capacityBreakdown = {
                  transient: transientCapacity,
                  events: eventsCapacity,
                  reserved: 0, // Reserved is set explicitly, not computed from segments
                  unavailable: unavailableCapacity,
                  readyToUse: readyToUseCapacity,
                };
              }
            }
          }
        } catch (error) {
          console.error(`Failed to calculate capacity for ${dateStr}:`, error);
        }
      }

      cells.push({
        date: new Date(d),
        dateStr,
        capacity,
        isOverride: !!override,
        revenueGoal: goal,
        calculatedCapacity,
        calculatedGoal,
        hourlyBreakdown,
        capacityBreakdown,
      });
    }

    setDayCells(cells);
    setLoading(false); // Clear loading state when done

    console.log('[GenerateCalendar] Completed. Created cells:', {
      cellCount: cells.length,
      cellsWithRevenueGoals: cells.filter(c => c.revenueGoal).length,
      cellsWithCalculatedGoals: cells.filter(c => c.calculatedGoal).length
    });
  };

  const handleUpdateBounds = async () => {
    if (!currentEntity || !entityType) return;

    setLoading(true);
    try {
      const response = await fetch('/api/capacity/bounds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId: currentEntity._id,
          minCapacity,
          maxCapacity,
        }),
      });

      if (response.ok) {
        // Reload the entity to get fresh data
        await reloadCurrentEntity();
        setShowBoundsModal(false);
        alert('Capacity bounds updated successfully');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to update bounds:', error);
      alert('Failed to update capacity bounds');
    } finally {
      setLoading(false);
    }
  };

  const handleSetCapacity = async () => {
    if (!currentEntity || !entityType || !selectedDate) return;

    setLoading(true);
    try {
      // Calculate revenue goal based on selected type and current hourly breakdown
      let goalToSave: number | undefined = undefined;

      if (entityType === 'sublocation' && currentEntity.defaultHourlyRate && selectedCell?.hourlyBreakdown) {
        if (revenueGoalType === 'max') {
          // Calculate from max capacity
          const totalMax = selectedCell.hourlyBreakdown.reduce((sum, seg) => sum + seg.maxCapacity, 0);
          goalToSave = Math.round(currentEntity.defaultHourlyRate * totalMax);
        } else if (revenueGoalType === 'allocated') {
          // Calculate from allocated capacity
          const totalAllocated = selectedCell.hourlyBreakdown.reduce((sum, seg) => sum + seg.allocatedCapacity, 0);
          goalToSave = Math.round(currentEntity.defaultHourlyRate * totalAllocated);
        } else if (revenueGoalType === 'custom') {
          // Calculate from custom category goals (sum of all categories × hourly rate)
          const customTotal = customCategoryGoals.transient + customCategoryGoals.events +
            customCategoryGoals.reserved + customCategoryGoals.unavailable + customCategoryGoals.readyToUse;
          goalToSave = Math.round(currentEntity.defaultHourlyRate * customTotal);
        }
      }

      if (goalToSave !== undefined && goalToSave !== null && goalToSave > 0) {
        const goalResponse = await fetch('/api/revenue-goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType,
            entityId: currentEntity._id,
            startDate: selectedDate,
            endDate: selectedDate,
            dailyGoal: goalToSave,
            revenueGoalType: revenueGoalType,
            // Include custom category goals when type is 'custom'
            ...(revenueGoalType === 'custom' && { customCategoryGoals }),
          }),
        });

        if (!goalResponse.ok) {
          const error = await goalResponse.json();
          alert(`Error updating goal: ${error.error}`);
        }
      }

      // Reload the entity to get fresh data
      await reloadCurrentEntity();
      setShowCapacityModal(false);
      setSelectedDate('');
      setDailyGoal(undefined);
      alert('Changes saved successfully');
    } catch (error) {
      console.error('Failed to save changes:', error);
      alert('Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCapacity = async (date: string) => {
    if (!currentEntity || !entityType) return;
    if (!confirm('Remove capacity override for this date?')) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/capacity?entityType=${entityType}&entityId=${currentEntity._id}&date=${date}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        // Reload the entity to get fresh data
        await reloadCurrentEntity();
        alert('Capacity override removed');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to delete capacity:', error);
      alert('Failed to delete capacity override');
    } finally {
      setLoading(false);
    }
  };

  const loadAggregation = async () => {
    if (!currentEntity || !entityType) return;

    const today = new Date().toISOString().split('T')[0];
    let queryParam = '';
    let entityId = '';

    // Use the appropriate selected ID based on entity type
    switch (entityType) {
      case 'customer':
        entityId = selectedCustomer;
        queryParam = `customerId=${entityId}`;
        break;
      case 'location':
        entityId = selectedLocation;
        queryParam = `locationId=${entityId}`;
        break;
      case 'sublocation':
        entityId = selectedSubLocation;
        queryParam = `sublocationId=${entityId}`;
        break;
      default:
        return;
    }

    // Validate that we have an ID
    if (!entityId) {
      console.error('No entity ID available for aggregation');
      alert('Please select an entity first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/capacity/aggregate?${queryParam}&date=${today}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load aggregation');
      }

      setAggregationData(data);
      setShowAggregation(true);
    } catch (error) {
      console.error('Failed to load aggregation:', error);
      alert(`Failed to load aggregation data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const previousMonth = () => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    console.log('[Navigation] Previous month clicked. New month:', newDate.toISOString().split('T')[0].substring(0, 7));
    setViewDate(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    console.log('[Navigation] Next month clicked. New month:', newDate.toISOString().split('T')[0].substring(0, 7));
    setViewDate(newDate);
  };

  const getCapacityColor = (cell: DayCell) => {
    // Use occupancy percentage (allocated / max) from hourly breakdown if available
    if (cell.hourlyBreakdown && cell.hourlyBreakdown.length > 0) {
      const totalMax = cell.hourlyBreakdown.reduce((sum, seg) => sum + seg.maxCapacity, 0);
      const totalAllocated = cell.hourlyBreakdown.reduce((sum, seg) => sum + seg.allocatedCapacity, 0);

      if (totalMax === 0) return 'bg-gray-100 text-gray-800';

      const occupancyRatio = totalAllocated / totalMax;
      if (occupancyRatio >= 0.8) return 'bg-green-100 text-green-800';
      if (occupancyRatio >= 0.5) return 'bg-yellow-100 text-yellow-800';
      return 'bg-red-100 text-red-800';
    }

    // Fallback: no color for cells without hourly breakdown
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Capacity & Revenue Management</h1>
        <p className="text-gray-600">
          Manage capacity and revenue goals across your organization
        </p>
      </div>

      {/* Entity Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
          <Building2 className="w-5 h-5" />
          Select Entity
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-gray-900">
          {/* Customer Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer
            </label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Select Customer</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Location Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={!selectedCustomer}
            >
              <option value="">Select Location</option>
              {locations.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* SubLocation Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SubLocation
            </label>
            <select
              value={selectedSubLocation}
              onChange={(e) => setSelectedSubLocation(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={!selectedLocation}
            >
              <option value="">Select SubLocation</option>
              {sublocations.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Event Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event (Optional)
            </label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={!selectedSubLocation}
            >
              <option value="">Select Event</option>
              {events.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Entity Details & Controls */}
      {currentEntity && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {currentEntity.name || currentEntity.label}
              </h2>
              <p className="text-sm text-gray-600 capitalize">
                {entityType} Capacity Configuration
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBoundsModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Edit className="w-4 h-4" />
                Edit Bounds
              </button>
              {entityType === 'sublocation' && currentEntity.defaultHourlyRate && (
                <>
                  <button
                    onClick={async () => {
                      if (!confirm('Auto-populate daily goals for this month based on hourly rate and capacity?')) return;

                      setLoading(true);
                      try {
                        const startDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).toISOString().split('T')[0];
                        const endDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).toISOString().split('T')[0];

                        const response = await fetch('/api/capacity/auto-populate-goals', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            sublocationId: currentEntity._id,
                            startDate,
                            endDate,
                            hoursPerDay: currentEntity.capacityConfig?.hoursPerDay || 24,
                          }),
                        });

                        const data = await response.json();
                        if (response.ok) {
                          await reloadCurrentEntity();
                          alert(`Successfully auto-populated ${data.goalsCreated.length} daily goals!`);
                        } else {
                          alert(`Error: ${data.error}`);
                        }
                      } catch (error) {
                        console.error('Failed to auto-populate goals:', error);
                        alert('Failed to auto-populate goals');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                    disabled={loading}
                  >
                    <DollarSign className="w-4 h-4" />
                    Auto-Populate Goals
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('Recalculate revenue goals for this month using hourly capacity engine?')) return;

                      setLoading(true);
                      try {
                        alert('Recalculate feature coming soon!');
                        // TODO: Implement recalculation logic
                      } catch (error) {
                        console.error('Failed to recalculate goals:', error);
                        alert('Failed to recalculate goals');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700"
                    disabled={loading}
                  >
                    <TrendingUp className="w-4 h-4" />
                    Recalculate Goals
                  </button>
                </>
              )}
              {entityType !== 'event' && (
                <button
                  onClick={loadAggregation}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <TrendingUp className="w-4 h-4" />
                  View Aggregation
                </button>
              )}
            </div>
          </div>

          {/* Capacity Bounds */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="text-sm text-gray-600 mb-1">Min Capacity</div>
              <div className="text-2xl font-bold text-gray-900">
                {currentEntity.capacityConfig?.minCapacity ?? 0}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="text-sm text-gray-600 mb-1">Max Capacity</div>
              <div className="text-2xl font-bold text-gray-900">
                {currentEntity.capacityConfig?.maxCapacity ?? 100}
              </div>
            </div>
          </div>

          {/* Default Capacity Allocation Breakdown - Only for sublocations with defaultCapacities */}
          {entityType === 'sublocation' && currentEntity.capacityConfig?.defaultCapacities && (
            <div className="mb-6 p-4 bg-gradient-to-r from-teal-50 to-green-50 rounded-lg border border-teal-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" />
                Default Capacity Allocation
              </h3>
              <div className="grid grid-cols-5 gap-3">
                {/* Transient */}
                <div className="bg-white rounded-lg p-3 border border-teal-200 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-teal-500" />
                    <span className="text-xs font-medium text-gray-600">Transient</span>
                  </div>
                  <div className="text-lg font-bold text-teal-600">
                    {currentEntity.capacityConfig.defaultCapacities.allocated.transient}
                  </div>
                </div>
                {/* Events */}
                <div className="bg-white rounded-lg p-3 border border-pink-200 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-pink-500" />
                    <span className="text-xs font-medium text-gray-600">Events</span>
                  </div>
                  <div className="text-lg font-bold text-pink-600">
                    {currentEntity.capacityConfig.defaultCapacities.allocated.events}
                  </div>
                </div>
                {/* Reserved */}
                <div className="bg-white rounded-lg p-3 border border-violet-200 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-violet-500" />
                    <span className="text-xs font-medium text-gray-600">Reserved</span>
                  </div>
                  <div className="text-lg font-bold text-violet-600">
                    {currentEntity.capacityConfig.defaultCapacities.allocated.reserved}
                  </div>
                </div>
                {/* Unavailable */}
                <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    <span className="text-xs font-medium text-gray-600">Unavailable</span>
                  </div>
                  <div className="text-lg font-bold text-gray-500">
                    {currentEntity.capacityConfig.defaultCapacities.unallocated.unavailable}
                  </div>
                </div>
                {/* Ready To Use */}
                <div className="bg-white rounded-lg p-3 border border-amber-200 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-medium text-gray-600">Ready To Use</span>
                  </div>
                  <div className="text-lg font-bold text-amber-600">
                    {currentEntity.capacityConfig.defaultCapacities.unallocated.readyToUse}
                  </div>
                </div>
              </div>
              {/* Stacked bar visualization */}
              <div className="mt-3">
                {(() => {
                  const dc = currentEntity.capacityConfig.defaultCapacities;
                  const total = dc.allocated.transient + dc.allocated.events + dc.allocated.reserved + dc.unallocated.unavailable + dc.unallocated.readyToUse;
                  if (total === 0) return null;
                  const pct = (val: number) => Math.round((val / total) * 100);
                  return (
                    <div className="h-4 rounded-full overflow-hidden bg-gray-200 flex">
                      {pct(dc.allocated.transient) > 0 && (
                        <div className="h-full" style={{ width: `${pct(dc.allocated.transient)}%`, backgroundColor: '#14B8A6' }} title={`Transient: ${pct(dc.allocated.transient)}%`} />
                      )}
                      {pct(dc.allocated.events) > 0 && (
                        <div className="h-full" style={{ width: `${pct(dc.allocated.events)}%`, backgroundColor: '#EC4899' }} title={`Events: ${pct(dc.allocated.events)}%`} />
                      )}
                      {pct(dc.allocated.reserved) > 0 && (
                        <div className="h-full" style={{ width: `${pct(dc.allocated.reserved)}%`, backgroundColor: '#8B5CF6' }} title={`Reserved: ${pct(dc.allocated.reserved)}%`} />
                      )}
                      {pct(dc.unallocated.unavailable) > 0 && (
                        <div className="h-full" style={{ width: `${pct(dc.unallocated.unavailable)}%`, backgroundColor: '#9CA3AF' }} title={`Unavailable: ${pct(dc.unallocated.unavailable)}%`} />
                      )}
                      {pct(dc.unallocated.readyToUse) > 0 && (
                        <div className="h-full" style={{ width: `${pct(dc.unallocated.readyToUse)}%`, backgroundColor: '#F59E0B' }} title={`Ready To Use: ${pct(dc.unallocated.readyToUse)}%`} />
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Calendar View */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                <Calendar className="w-5 h-5" />
                Daily Capacity Calendar
              </h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={previousMonth}
                  className="px-3 py-1 border rounded hover:bg-gray-50 text-gray-700"
                >
                  ← Previous
                </button>
                <span className="font-medium text-gray-900">
                  {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={nextMonth}
                  className="px-3 py-1 border rounded hover:bg-gray-50 text-gray-700"
                >
                  Next →
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 ">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center font-semibold text-sm p-2 bg-gray-100 text-gray-700">
                  {day}
                </div>
              ))}

              {/* Padding for first week */}
              {!loading && Array.from({ length: dayCells[0]?.date.getDay() || 0 }).map((_, i) => (
                <div key={`padding-${i}`} className="p-2"></div>
              ))}

              {/* Calendar Days */}
              {loading || dayCells.length === 0 ? (
                // Show loading skeleton for calendar
                <div className="col-span-7 flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading calendar data...</p>
                  </div>
                </div>
              ) : dayCells.map((cell) => {
                // Determine if there's a revenue goal override
                const hasRevenueGoalOverride = cell.revenueGoal && cell.revenueGoal.dailyGoal !== undefined;

                // Determine border style: solid green if override, dotted green if default
                const borderStyle = hasRevenueGoalOverride
                  ? 'border-green-500 border-[4px] border-solid'
                  : 'border-gray-400 border-[2px] border-dotted';

                return (
                  <div
                    key={cell.dateStr}
                    className={`p-3 rounded-md cursor-pointer hover:shadow-md transition-shadow relative ${borderStyle} ${getCapacityColor(cell)}`}
                    onClick={() => {
                      setSelectedDate(cell.dateStr);
                      setSelectedCell(cell);
                      setDailyGoal(cell.revenueGoal?.dailyGoal);
                      // Initialize from revenue goal's type, default to 'max' if not set
                      setRevenueGoalType(cell.revenueGoal?.revenueGoalType || 'max');
                      // Initialize customCategoryGoals: prioritize saved values, fallback to hourly breakdown totals
                      if (cell.revenueGoal?.customCategoryGoals) {
                        // Restore saved custom category goals
                        setCustomCategoryGoals(cell.revenueGoal.customCategoryGoals);
                      } else if (cell.hourlyBreakdown) {
                        // Fallback: calculate from hourly breakdown totals
                        const sanitize = (val: number | undefined) => (val !== undefined && val >= 0) ? val : 0;
                        const totals = cell.hourlyBreakdown.reduce((acc, seg) => {
                          const b = seg.breakdown || { transient: 0, events: 0, reserved: 0, unavailable: 0, readyToUse: 0 };
                          return {
                            transient: acc.transient + sanitize(b.transient),
                            events: acc.events + sanitize(b.events),
                            reserved: acc.reserved + sanitize(b.reserved),
                            unavailable: acc.unavailable + sanitize(b.unavailable),
                            readyToUse: acc.readyToUse + sanitize(b.readyToUse),
                          };
                        }, { transient: 0, events: 0, reserved: 0, unavailable: 0, readyToUse: 0 });
                        setCustomCategoryGoals(totals);
                      } else {
                        setCustomCategoryGoals({ transient: 0, events: 0, reserved: 0, unavailable: 0, readyToUse: 0 });
                      }
                      setShowCapacityModal(true);
                    }}
                  >
                    <div className="text-sm font-semibold mb-1 text-gray-900">{cell.date.getDate()}</div>

                    {/* Capacity Display */}
                    {cell.calculatedCapacity !== undefined && (
                      <div className="text-xs flex items-center gap-1 mt-1 text-teal-700 font-bold">
                        <Users className="w-3 h-3" />
                        {cell.calculatedCapacity}
                      </div>
                    )}

                    {/* Revenue Goal Display */}
                    {(() => {
                      // If there's a set revenue goal, show it
                      if (cell.revenueGoal && cell.revenueGoal.dailyGoal) {
                        return (
                          <div className="text-xs flex items-center gap-1 mt-1 text-green-700 font-bold">
                            <DollarSign className="w-3 h-3" />
                            ${(cell.revenueGoal.dailyGoal / 1000).toFixed(1)}k
                          </div>
                        );
                      }

                      // Otherwise, show calculated goal from allocated capacity (default)
                      if (entityType === 'sublocation' && currentEntity?.defaultHourlyRate && cell.hourlyBreakdown) {
                        const totalAllocated = cell.hourlyBreakdown.reduce((sum, seg) => sum + seg.allocatedCapacity, 0);
                        const allocatedGoal = Math.round(currentEntity.defaultHourlyRate * totalAllocated);
                        if (allocatedGoal > 0) {
                          return (
                            <div className="text-xs flex items-center gap-1 mt-1 text-purple-600 font-medium">
                              <DollarSign className="w-3 h-3" />
                              ${(allocatedGoal / 1000).toFixed(1)}k
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}

                    {/* Revenue Goal Type Badge - only show if there's a revenue goal with a type */}
                    {hasRevenueGoalOverride && cell.revenueGoal?.revenueGoalType && (
                      <div className={`text-[10px] mt-1 px-1.5 py-0.5 rounded inline-block font-semibold ${
                        cell.revenueGoal.revenueGoalType === 'max'
                          ? 'bg-green-100 text-green-700'
                          : cell.revenueGoal.revenueGoalType === 'allocated'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {cell.revenueGoal.revenueGoalType === 'max' ? 'MAX' : cell.revenueGoal.revenueGoalType === 'allocated' ? 'ALLOC' : 'CUSTOM'}
                      </div>
                    )}

                    {/* Capacity Breakdown Mini Bar */}
                    {cell.capacityBreakdown && (
                      <div className="mt-2">
                        <DayCapacityMiniBar
                          breakdown={cell.capacityBreakdown}
                          totalCapacity={cell.calculatedCapacity || 100}
                          compact={true}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dashboard Tiles */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Current Week Progress Tile */}
            <div
              className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg cursor-help"
              title={`Week ${currentWeekProgress.weekStart} to ${currentWeekProgress.weekEnd}\nActual: $${currentWeekProgress.actualRevenue.toLocaleString()} / Goal: $${currentWeekProgress.totalGoal.toLocaleString()}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  <h3 className="text-sm font-medium opacity-90">Current Week</h3>
                </div>
                <Target className="w-8 h-8 opacity-20" />
              </div>
              {loading || dayCells.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              ) : (() => {
                const weekStartDate = new Date(currentWeekProgress.weekStart);
                const weekEndDate = new Date(currentWeekProgress.weekEnd);
                const monthStart = weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const monthEnd = weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                return (
                  <>
                    <div className="text-xs opacity-75 mb-2">{monthStart} - {monthEnd}</div>
                    <div className="text-3xl font-bold mb-2">{currentWeekProgress.progressPercentage}%</div>
                    <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mb-2">
                      <div
                        className="bg-white rounded-full h-2 transition-all duration-300"
                        style={{ width: `${Math.min(currentWeekProgress.progressPercentage, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs opacity-75">
                      ${currentWeekProgress.actualRevenue.toLocaleString()} / ${currentWeekProgress.totalGoal.toLocaleString()}
                    </p>
                    <p className="text-xs opacity-60 mt-1">
                      {currentWeekProgress.daysComplete} of {currentWeekProgress.totalDays} days complete
                    </p>
                  </>
                );
              })()}
            </div>

            {/* Monthly Goal Tile */}
            <div
              className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white shadow-lg cursor-help"
              title={`${monthlyGoal.daysWithSetGoals} days with set goals, ${monthlyGoal.daysCalculated} days calculated from allocated capacity`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  <h3 className="text-sm font-medium opacity-90">Monthly Goal</h3>
                </div>
                <Target className="w-8 h-8 opacity-20" />
              </div>
              {loading || dayCells.length === 0 ? (
                <div className="flex items-center justify-center h-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              ) : (
                <>
                  <div className="text-3xl font-bold mb-1">
                    ${monthlyGoal.total.toLocaleString()}
                  </div>
                  {monthlyGoal.daysWithSetGoals > 0 && monthlyGoal.daysCalculated > 0 ? (
                    <>
                      <p className="text-xs opacity-75">
                        ${monthlyGoal.setGoals.toLocaleString()} set + ${monthlyGoal.calculatedGoals.toLocaleString()} calculated
                      </p>
                      <p className="text-xs opacity-60 mt-1">
                        {monthlyGoal.daysWithSetGoals} days set, {monthlyGoal.daysCalculated} days calculated
                      </p>
                    </>
                  ) : monthlyGoal.daysWithSetGoals > 0 ? (
                    <p className="text-xs opacity-75">
                      {monthlyGoal.daysWithSetGoals} days with set goals
                    </p>
                  ) : monthlyGoal.daysCalculated > 0 ? (
                    <p className="text-xs opacity-75">
                      {monthlyGoal.daysCalculated} days calculated from capacity
                    </p>
                  ) : (
                    <p className="text-xs opacity-75">
                      No goals set
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Occupancy Percentage Tile */}
            <div
              className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white shadow-lg cursor-help"
              title="Occupancy = (Allocated Capacity / Max Capacity) × 100"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <h3 className="text-sm font-medium opacity-90">Occupancy</h3>
                </div>
                <Percent className="w-8 h-8 opacity-20" />
              </div>
              {loading || dayCells.length === 0 ? (
                <div className="flex items-center justify-center h-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              ) : (
                <>
                  <div className="text-3xl font-bold mb-1">
                    {monthlyOccupancy}%
                  </div>
                  <p className="text-xs opacity-75">Allocated vs Max for the month</p>
                </>
              )}
            </div>

            {/* Planning Coverage Tile */}
            <div
              className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-6 text-white shadow-lg cursor-help"
              title={
                planningCoverage.datesWithoutGoals.length === 0
                  ? 'All days have revenue goals set!'
                  : `Days without goals:\n${planningCoverage.datesWithoutGoals.slice(0, 10).join(', ')}${planningCoverage.datesWithoutGoals.length > 10 ? '...' : ''}`
              }
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <h3 className="text-sm font-medium opacity-90">Planning Coverage</h3>
                </div>
                {planningCoverage.percentage === 100 ? (
                  <CheckCircle className="w-8 h-8 opacity-20" />
                ) : (
                  <AlertCircle className="w-8 h-8 opacity-20" />
                )}
              </div>
              {loading || dayCells.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              ) : (
                <>
                  <div className="text-3xl font-bold mb-2">
                    {planningCoverage.daysWithGoals} / {planningCoverage.totalDays}
                  </div>
                  <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mb-2">
                    <div
                      className="bg-white rounded-full h-2 transition-all duration-300"
                      style={{ width: `${planningCoverage.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs opacity-75">
                    {planningCoverage.percentage}% of days planned
                  </p>
                  {planningCoverage.datesWithoutGoals.length > 0 ? (
                    <p className="text-xs opacity-60 mt-1">
                      {planningCoverage.datesWithoutGoals.length} day{planningCoverage.datesWithoutGoals.length !== 1 ? 's' : ''} need goals
                    </p>
                  ) : (
                    <p className="text-xs opacity-60 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> All days planned!
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Bounds Modal */}
      {showBoundsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Edit Capacity Bounds</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Min Capacity</label>
                <input
                  type="number"
                  value={minCapacity}
                  onChange={(e) => setMinCapacity(Number(e.target.value))}
                  className="w-full border rounded px-3 py-2 text-gray-900"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Max Capacity</label>
                <input
                  type="number"
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(Number(e.target.value))}
                  className="w-full border rounded px-3 py-2 text-gray-900"
                  min={minCapacity}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleUpdateBounds}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setShowBoundsModal(false)}
                className="flex-1 border py-2 rounded hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Capacity & Goal Modal */}
      {showCapacityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Edit Date: {selectedDate}
              </h3>
              <button
                onClick={() => {
                  setShowCapacityModal(false);
                  setSelectedDate('');
                  setDailyGoal(undefined);
                }}
                className="p-1 hover:bg-blue-800 rounded-full transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
              {/* Daily Revenue Goal Section */}
              <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                <h4 className="text-sm font-semibold mb-3 text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Daily Revenue Goal
                </h4>
                <p className="text-xs text-gray-600 mb-3">
                  Set a revenue target based on capacity calculations or enter a custom override.
                </p>

                {/* Revenue Goal Calculation Table */}
                {selectedCell?.hourlyBreakdown && selectedCell.hourlyBreakdown.length > 0 && currentEntity.defaultHourlyRate && (() => {
                  // Helper to sanitize breakdown values (-9 = UNKNOWN becomes 0)
                  // This matches HourlyBreakdownTable's getBreakdown() logic
                  const sanitizeValue = (val: number | undefined) => (val !== undefined && val >= 0) ? val : 0;

                  // Calculate totals for all allocation categories from hourly breakdown
                  const totals = selectedCell.hourlyBreakdown.reduce((acc, seg) => {
                    const breakdown = seg.breakdown || { transient: 0, events: 0, reserved: 0, unavailable: 0, readyToUse: 0 };
                    return {
                      maxCapacity: acc.maxCapacity + seg.maxCapacity,
                      allocatedCapacity: acc.allocatedCapacity + seg.allocatedCapacity,
                      transient: acc.transient + sanitizeValue(breakdown.transient),
                      events: acc.events + sanitizeValue(breakdown.events),
                      reserved: acc.reserved + sanitizeValue(breakdown.reserved),
                      unavailable: acc.unavailable + sanitizeValue(breakdown.unavailable),
                      readyToUse: acc.readyToUse + sanitizeValue(breakdown.readyToUse),
                    };
                  }, { maxCapacity: 0, allocatedCapacity: 0, transient: 0, events: 0, reserved: 0, unavailable: 0, readyToUse: 0 });

                  // Allocation category colors
                  const categoryColors = {
                    transient: '#14B8A6',
                    events: '#EC4899',
                    reserved: '#8B5CF6',
                    unavailable: '#9CA3AF',
                    readyToUse: '#F59E0B',
                  };

                  // Hourly rate for revenue calculations
                  const hourlyRate = currentEntity.defaultHourlyRate;

                  // Mini bar component for allocation breakdown with revenue
                  // -9 indicates unknown/not tracked value
                  const UNKNOWN_VALUE = -9;
                  const isUnknownOrZero = (val: number) => val <= 0 || val === UNKNOWN_VALUE;
                  const displayValue = (val: number) => val === UNKNOWN_VALUE || val < 0 ? '—' : val.toString();
                  const displayRevenue = (val: number) => val === UNKNOWN_VALUE || val < 0 ? '—' : `$${Math.round(hourlyRate * val).toLocaleString()}`;

                  const AllocationMiniBar = ({ categories, total, showAllCategories = false }: { categories: { name: string; value: number; color: string }[]; total: number; showAllCategories?: boolean }) => (
                    <div className="space-y-1.5">
                      <div className="flex h-3 rounded-full overflow-hidden bg-gray-200">
                        {categories.map((cat, idx) => {
                          const effectiveValue = cat.value > 0 ? cat.value : 0;
                          const width = total > 0 ? (effectiveValue / total) * 100 : 0;
                          return width > 0 ? (
                            <div
                              key={idx}
                              style={{ width: `${width}%`, backgroundColor: cat.color }}
                              title={`${cat.name}: ${displayValue(cat.value)} (${displayRevenue(cat.value)})`}
                            />
                          ) : null;
                        })}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                        {categories.filter(c => showAllCategories || c.value > 0).map((cat, idx) => (
                          <span key={idx} className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="text-gray-600">{cat.name}:</span>
                            <span className={`font-medium ${isUnknownOrZero(cat.value) ? 'text-gray-400' : 'text-gray-900'}`}>
                              {displayValue(cat.value)}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className={`font-semibold ${isUnknownOrZero(cat.value) ? 'text-gray-400' : 'text-green-700'}`}>
                              {displayRevenue(cat.value)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );

                  return (
                    <div className="mb-4 overflow-hidden border border-gray-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b w-12">Active</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b w-36">Calculation Method</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Allocation Breakdown</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-b w-20">Total</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-b w-24">Revenue Goal</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {/* Max Capacity Calculation */}
                          <tr className={`hover:bg-gray-50 ${revenueGoalType === 'max' ? 'bg-green-50' : ''}`}>
                            <td className="px-3 py-3 text-center">
                              <input
                                type="radio"
                                name="revenueGoalType"
                                value="max"
                                checked={revenueGoalType === 'max'}
                                onChange={(e) => setRevenueGoalType(e.target.value as 'max' | 'allocated' | 'custom')}
                                className="w-4 h-4 text-green-600 focus:ring-2 focus:ring-green-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="font-medium text-gray-900">Max Capacity</span>
                              </div>
                              <div className="text-[10px] text-gray-500 ml-4 mt-0.5">
                                All categories included
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <AllocationMiniBar
                                categories={[
                                  { name: 'Transient', value: totals.transient, color: categoryColors.transient },
                                  { name: 'Events', value: totals.events, color: categoryColors.events },
                                  { name: 'Reserved', value: totals.reserved, color: categoryColors.reserved },
                                  { name: 'Unavailable', value: totals.unavailable, color: categoryColors.unavailable },
                                  { name: 'Ready to Use', value: totals.readyToUse, color: categoryColors.readyToUse },
                                ]}
                                total={totals.maxCapacity}
                                showAllCategories={true}
                              />
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="font-semibold text-green-600">
                                {totals.maxCapacity}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="font-bold text-green-700">
                                ${Math.round(currentEntity.defaultHourlyRate * totals.maxCapacity).toLocaleString()}
                              </span>
                            </td>
                          </tr>

                          {/* Allocated Capacity Calculation */}
                          <tr className={`hover:bg-gray-50 ${revenueGoalType === 'allocated' ? 'bg-purple-50' : ''}`}>
                            <td className="px-3 py-3 text-center">
                              <input
                                type="radio"
                                name="revenueGoalType"
                                value="allocated"
                                checked={revenueGoalType === 'allocated'}
                                onChange={(e) => setRevenueGoalType(e.target.value as 'max' | 'allocated' | 'custom')}
                                className="w-4 h-4 text-purple-600 focus:ring-2 focus:ring-purple-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                <span className="font-medium text-gray-900">Allocated</span>
                              </div>
                              <div className="text-[10px] text-gray-500 ml-4 mt-0.5">
                                Transient + Events + Reserved
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <AllocationMiniBar
                                categories={[
                                  { name: 'Transient', value: totals.transient, color: categoryColors.transient },
                                  { name: 'Events', value: totals.events, color: categoryColors.events },
                                  { name: 'Reserved', value: totals.reserved, color: categoryColors.reserved },
                                ]}
                                total={totals.allocatedCapacity}
                                showAllCategories={true}
                              />
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="font-semibold text-purple-600">
                                {totals.allocatedCapacity}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="font-bold text-purple-700">
                                ${Math.round(currentEntity.defaultHourlyRate * totals.allocatedCapacity).toLocaleString()}
                              </span>
                            </td>
                          </tr>

                          {/* Custom Override */}
                          <tr className={`hover:bg-blue-100 ${revenueGoalType === 'custom' ? 'bg-blue-100' : 'bg-blue-50'}`}>
                            <td className="px-3 py-3 text-center align-top pt-4">
                              <input
                                type="radio"
                                name="revenueGoalType"
                                value="custom"
                                checked={revenueGoalType === 'custom'}
                                onChange={(e) => setRevenueGoalType(e.target.value as 'max' | 'allocated' | 'custom')}
                                className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-3 align-top">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="font-medium text-gray-900">Custom</span>
                              </div>
                              <div className="text-[10px] text-gray-500 ml-4 mt-0.5">
                                Define per category
                              </div>
                            </td>
                            <td className="px-3 py-3" colSpan={3}>
                              {/* Custom category inputs */}
                              <div className="space-y-2">
                                {/* Mini bar visualization */}
                                {(() => {
                                  const customTotal = customCategoryGoals.transient + customCategoryGoals.events + customCategoryGoals.reserved + customCategoryGoals.unavailable + customCategoryGoals.readyToUse;
                                  return customTotal > 0 ? (
                                    <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 mb-2">
                                      {customCategoryGoals.transient > 0 && (
                                        <div style={{ width: `${(customCategoryGoals.transient / customTotal) * 100}%`, backgroundColor: categoryColors.transient }} />
                                      )}
                                      {customCategoryGoals.events > 0 && (
                                        <div style={{ width: `${(customCategoryGoals.events / customTotal) * 100}%`, backgroundColor: categoryColors.events }} />
                                      )}
                                      {customCategoryGoals.reserved > 0 && (
                                        <div style={{ width: `${(customCategoryGoals.reserved / customTotal) * 100}%`, backgroundColor: categoryColors.reserved }} />
                                      )}
                                      {customCategoryGoals.unavailable > 0 && (
                                        <div style={{ width: `${(customCategoryGoals.unavailable / customTotal) * 100}%`, backgroundColor: categoryColors.unavailable }} />
                                      )}
                                      {customCategoryGoals.readyToUse > 0 && (
                                        <div style={{ width: `${(customCategoryGoals.readyToUse / customTotal) * 100}%`, backgroundColor: categoryColors.readyToUse }} />
                                      )}
                                    </div>
                                  ) : null;
                                })()}

                                {/* Category input grid */}
                                {(() => {
                                  const maxCapacity = totals.maxCapacity;
                                  const customTotal = customCategoryGoals.transient + customCategoryGoals.events + customCategoryGoals.reserved + customCategoryGoals.unavailable + customCategoryGoals.readyToUse;
                                  const isOverMax = customTotal > maxCapacity;

                                  // Validation helper for category updates
                                  const handleCategoryChange = (category: keyof typeof customCategoryGoals, newValue: number) => {
                                    const otherCategoriesTotal = customTotal - customCategoryGoals[category];
                                    const newTotal = otherCategoriesTotal + newValue;

                                    if (newValue < 0) {
                                      alert('Category values cannot be negative.');
                                      return;
                                    }

                                    if (newTotal > maxCapacity) {
                                      alert(`Total capacity (${newTotal}) would exceed maximum capacity (${maxCapacity}).\n\nYou can redistribute capacity between categories, but the total cannot exceed ${maxCapacity}.`);
                                      return;
                                    }

                                    setCustomCategoryGoals(prev => ({ ...prev, [category]: newValue }));
                                    setRevenueGoalType('custom');
                                  };

                                  return (
                                    <>
                                      <div className="grid grid-cols-5 gap-2">
                                        {/* Transient */}
                                        <div className="flex flex-col">
                                          <label className="text-[9px] font-medium text-gray-500 mb-0.5 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors.transient }} />
                                            Transient
                                          </label>
                                          <input
                                            type="number"
                                            value={customCategoryGoals.transient || ''}
                                            onChange={(e) => handleCategoryChange('transient', e.target.value ? Number(e.target.value) : 0)}
                                            className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs text-gray-900 focus:ring-1 focus:ring-blue-500 text-right"
                                            placeholder="0"
                                            min={0}
                                          />
                                          <span className="text-[9px] text-green-600 mt-0.5 text-right">
                                            ${Math.round(hourlyRate * customCategoryGoals.transient).toLocaleString()}
                                          </span>
                                        </div>
                                        {/* Events */}
                                        <div className="flex flex-col">
                                          <label className="text-[9px] font-medium text-gray-500 mb-0.5 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors.events }} />
                                            Events
                                          </label>
                                          <input
                                            type="number"
                                            value={customCategoryGoals.events || ''}
                                            onChange={(e) => handleCategoryChange('events', e.target.value ? Number(e.target.value) : 0)}
                                            className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs text-gray-900 focus:ring-1 focus:ring-blue-500 text-right"
                                            placeholder="0"
                                            min={0}
                                          />
                                          <span className="text-[9px] text-green-600 mt-0.5 text-right">
                                            ${Math.round(hourlyRate * customCategoryGoals.events).toLocaleString()}
                                          </span>
                                        </div>
                                        {/* Reserved */}
                                        <div className="flex flex-col">
                                          <label className="text-[9px] font-medium text-gray-500 mb-0.5 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors.reserved }} />
                                            Reserved
                                          </label>
                                          <input
                                            type="number"
                                            value={customCategoryGoals.reserved || ''}
                                            onChange={(e) => handleCategoryChange('reserved', e.target.value ? Number(e.target.value) : 0)}
                                            className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs text-gray-900 focus:ring-1 focus:ring-blue-500 text-right"
                                            placeholder="0"
                                            min={0}
                                          />
                                          <span className="text-[9px] text-green-600 mt-0.5 text-right">
                                            ${Math.round(hourlyRate * customCategoryGoals.reserved).toLocaleString()}
                                          </span>
                                        </div>
                                        {/* Unavailable */}
                                        <div className="flex flex-col">
                                          <label className="text-[9px] font-medium text-gray-500 mb-0.5 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors.unavailable }} />
                                            Unavail.
                                          </label>
                                          <input
                                            type="number"
                                            value={customCategoryGoals.unavailable || ''}
                                            onChange={(e) => handleCategoryChange('unavailable', e.target.value ? Number(e.target.value) : 0)}
                                            className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs text-gray-900 focus:ring-1 focus:ring-blue-500 text-right"
                                            placeholder="0"
                                            min={0}
                                          />
                                          <span className="text-[9px] text-green-600 mt-0.5 text-right">
                                            ${Math.round(hourlyRate * customCategoryGoals.unavailable).toLocaleString()}
                                          </span>
                                        </div>
                                        {/* Ready To Use */}
                                        <div className="flex flex-col">
                                          <label className="text-[9px] font-medium text-gray-500 mb-0.5 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors.readyToUse }} />
                                            Ready
                                          </label>
                                          <input
                                            type="number"
                                            value={customCategoryGoals.readyToUse || ''}
                                            onChange={(e) => handleCategoryChange('readyToUse', e.target.value ? Number(e.target.value) : 0)}
                                            className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs text-gray-900 focus:ring-1 focus:ring-blue-500 text-right"
                                            placeholder="0"
                                            min={0}
                                          />
                                          <span className="text-[9px] text-green-600 mt-0.5 text-right">
                                            ${Math.round(hourlyRate * customCategoryGoals.readyToUse).toLocaleString()}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Total row with max capacity indicator */}
                                      <div className={`flex justify-between items-center pt-2 border-t mt-2 ${isOverMax ? 'border-red-300 bg-red-50 -mx-2 px-2 rounded' : 'border-blue-200'}`}>
                                        <span className="text-xs font-medium text-gray-700">Total Capacity:</span>
                                        <span className={`font-bold ${isOverMax ? 'text-red-600' : 'text-blue-700'}`}>
                                          {customTotal} / {maxCapacity}
                                          {isOverMax && <span className="ml-1 text-red-500">⚠️</span>}
                                        </span>
                                        <span className="text-xs font-medium text-gray-700">Revenue Goal:</span>
                                        <span className={`font-bold ${isOverMax ? 'text-red-600' : 'text-blue-700'}`}>
                                          ${Math.round(hourlyRate * customTotal).toLocaleString()}
                                        </span>
                                      </div>

                                      {/* Warning message when over max */}
                                      {isOverMax && (
                                        <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700">
                                          <strong>⚠️ Exceeds Maximum:</strong> Total ({customTotal}) is greater than max capacity ({maxCapacity}). Please reduce category values.
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                <div className="text-xs text-gray-600 bg-white p-3 rounded border border-gray-200">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-semibold">💡</span>
                    <div>
                      <div className="font-medium mb-1">How it works:</div>
                      <ul className="space-y-1 ml-2">
                        <li>• <strong>Max Capacity:</strong> Revenue based on maximum possible capacity (${currentEntity.defaultHourlyRate || 0}/hr × total max)</li>
                        <li>• <strong>Allocated Capacity:</strong> Revenue based on currently allocated capacity (${currentEntity.defaultHourlyRate || 0}/hr × total allocated)</li>
                        <li>• <strong>Custom Override:</strong> Set your own target amount manually</li>
                        <li className="pt-1 border-t border-gray-200 mt-2">
                          <strong>Note:</strong> Select the active method using the radio button. The selected calculation will be used for this date's revenue goal.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hourly Breakdown Section */}
              {selectedCell && selectedCell.hourlyBreakdown && selectedCell.hourlyBreakdown.length > 0 && (
                <div className="mt-4">
                  <HourlyBreakdownTable
                    hourlyBreakdown={selectedCell.hourlyBreakdown}
                    date={selectedCell.date}
                    subLocationId={currentEntity?._id}
                    editable={entityType === 'sublocation'}
                    onHourlyCapacityUpdate={async () => {
                      // Reload entity and regenerate calendar
                      await reloadCurrentEntity();

                      // Manually recalculate capacity for the selected date to get fresh data
                      const startTime = new Date(selectedDate + 'T00:00:00');
                      const endTime = new Date(selectedDate + 'T23:59:59');

                      try {
                        const response = await fetch('/api/capacity/calculate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            subLocationId: currentEntity._id,
                            startTime: startTime.toISOString(),
                            endTime: endTime.toISOString(),
                          }),
                        });

                        if (response.ok) {
                          const result = await response.json();

                          // Build fresh hourly breakdown (include per-hour allocation breakdown)
                          if (result.segments && result.segments.length > 0) {
                            const freshBreakdown = result.segments.map((seg: any) => ({
                              hour: new Date(seg.startTime).getHours(),
                              startTime: new Date(seg.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                              endTime: new Date(seg.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                              minCapacity: seg.minCapacity,
                              maxCapacity: seg.maxCapacity,
                              defaultCapacity: seg.defaultCapacity,
                              allocatedCapacity: seg.allocatedCapacity,
                              source: seg.source,
                              capacitySheetName: seg.capacitySheet?.name,
                              capacitySheetLevel: seg.capacitySheet?.level,
                              isAvailable: seg.isAvailable,
                              // Per-hour allocation breakdown
                              breakdown: seg.breakdown ? {
                                transient: seg.breakdown.transient,
                                events: seg.breakdown.events,
                                reserved: seg.breakdown.reserved,
                                unavailable: seg.breakdown.unavailable,
                                readyToUse: seg.breakdown.readyToUse,
                                isOverride: seg.breakdown.isOverride,
                              } : undefined,
                            }));

                            // Calculate fresh capacity values
                            const calculatedCapacity = freshBreakdown.reduce((sum: number, seg: any) => sum + seg.maxCapacity, 0);
                            const calculatedGoal = currentEntity.defaultHourlyRate
                              ? Math.round(currentEntity.defaultHourlyRate * calculatedCapacity)
                              : undefined;

                            // Build fresh capacity breakdown from API response
                            let freshCapacityBreakdown: CapacityBreakdown | undefined;
                            if (result.allocationBreakdown) {
                              freshCapacityBreakdown = {
                                transient: result.allocationBreakdown.allocated.transient,
                                events: result.allocationBreakdown.allocated.events,
                                reserved: result.allocationBreakdown.allocated.reserved,
                                unavailable: result.allocationBreakdown.unallocated.unavailable,
                                readyToUse: result.allocationBreakdown.unallocated.readyToUse,
                              };
                            }

                            // Update selected cell with fresh data
                            setSelectedCell({
                              ...selectedCell,
                              calculatedCapacity,
                              calculatedGoal,
                              hourlyBreakdown: freshBreakdown,
                              capacityBreakdown: freshCapacityBreakdown,
                            });
                          }
                        }
                      } catch (error) {
                        console.error('Failed to refresh cell data:', error);
                      }

                      // Regenerate calendar in background (for dashboard tiles and calendar display)
                      generateCalendar();
                    }}
                  />
                </div>
              )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-2">
                <button
                  onClick={handleSetCapacity}
                  className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                {dayCells.find(c => c.dateStr === selectedDate)?.isOverride && (
                  <button
                    onClick={() => {
                      handleDeleteCapacity(selectedDate);
                      setShowCapacityModal(false);
                    }}
                    className="px-4 bg-red-600 text-white py-2 rounded hover:bg-red-700"
                    disabled={loading}
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowCapacityModal(false);
                    setSelectedDate('');
                    setDailyGoal(undefined);
                  }}
                  className="flex-1 border py-2 rounded hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aggregation Panel */}
      {showAggregation && aggregationData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">Capacity Aggregation</h3>
              <button
                onClick={() => setShowAggregation(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-md">
                <div className="text-sm text-gray-600 mb-1">Total Capacity (Today)</div>
                <div className="text-3xl font-bold text-gray-900">{aggregationData.totalCapacity}</div>
              </div>

              <div className="bg-green-50 p-4 rounded-md">
                <div className="text-sm text-gray-600 mb-2">Total Revenue Goals</div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-gray-600">Daily</div>
                    <div className="text-xl font-bold text-gray-900">
                      ${aggregationData.totalGoals.dailyGoal.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Weekly</div>
                    <div className="text-xl font-bold text-gray-900">
                      ${aggregationData.totalGoals.weeklyGoal.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Monthly</div>
                    <div className="text-xl font-bold text-gray-900">
                      ${aggregationData.totalGoals.monthlyGoal.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2 text-gray-900">Breakdown</h4>
                <div className="space-y-2">
                  {aggregationData.breakdown && Object.entries(aggregationData.breakdown).map(([key, value]: [string, any]) => {
                    if (Array.isArray(value)) {
                      return (
                        <div key={key}>
                          <div className="font-medium text-sm text-gray-700 mb-1 capitalize">{key}</div>
                          {value.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between bg-gray-50 p-2 rounded text-sm text-gray-900">
                              <span>{item.name || item.label}</span>
                              <span className="font-medium">{item.capacity}</span>
                            </div>
                          ))}
                        </div>
                      );
                    } else if (typeof value === 'object') {
                      return (
                        <div key={key} className="bg-gray-50 p-2 rounded flex justify-between text-gray-900">
                          <span>{value.name || value.label}</span>
                          <span className="font-medium">{value.capacity}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Loading Indicator */}
      {loading && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded shadow-lg">
          Loading...
        </div>
      )}
    </div>
  );
}
