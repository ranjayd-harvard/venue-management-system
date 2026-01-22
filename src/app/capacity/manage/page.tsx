'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Users,
  Building2,
  MapPin,
  TrendingUp,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Edit,
  Target,
  Percent,
  X
} from 'lucide-react';
import { getWeeklyGoalTotal, getMonthlyGoalTotal, getMonthlyOccupancyPercentage } from '@/lib/capacity-utils';
import HourlyBreakdownTable from '@/components/HourlyBreakdownTable';

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

  // Aggregation View
  const [showAggregation, setShowAggregation] = useState(false);
  const [aggregationData, setAggregationData] = useState<any>(null);

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

  useEffect(() => {
    if (currentEntity) {
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

      const response = await fetch(endpoint);
      const data = await response.json();
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

    if (id) {
      await loadEntity(entityType, id);
    }
  };

  const generateCalendar = async () => {
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
              // Build hourly breakdown first
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
              }));

              hourlyBreakdown = breakdown;

              // Calculate daily capacity as SUM of all hourly max capacities
              calculatedCapacity = breakdown.reduce((sum: number, seg: HourlySegment) => sum + seg.maxCapacity, 0);

              // Calculate revenue goal if we have hourly rate
              // Revenue = hourlyRate * SUM(hourly capacities)
              if (currentEntity.defaultHourlyRate && calculatedCapacity) {
                calculatedGoal = Math.round(currentEntity.defaultHourlyRate * calculatedCapacity);
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
      });
    }

    setDayCells(cells);
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
        } else if (revenueGoalType === 'custom' && dailyGoal) {
          // Use custom value
          goalToSave = dailyGoal;
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
            revenueGoalType: revenueGoalType, // Store the type with the goal
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
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const getCapacityColor = (capacity: number, max: number) => {
    const ratio = capacity / max;
    if (ratio >= 0.8) return 'bg-green-100 text-green-800';
    if (ratio >= 0.5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
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
              {Array.from({ length: dayCells[0]?.date.getDay() || 0 }).map((_, i) => (
                <div key={`padding-${i}`} className="p-2"></div>
              ))}

              {/* Calendar Days */}
              {dayCells.map((cell) => {
                // Determine if there's a revenue goal override
                const hasRevenueGoalOverride = cell.revenueGoal && cell.revenueGoal.dailyGoal !== undefined;

                // Determine border style: solid green if override, dotted green if default
                const borderStyle = hasRevenueGoalOverride
                  ? 'border-green-500 border-[4px] border-solid'
                  : 'border-gray-400 border-[2px] border-dotted';

                return (
                  <div
                    key={cell.dateStr}
                    className={`p-3 rounded-md cursor-pointer hover:shadow-md transition-shadow relative ${borderStyle} ${getCapacityColor(cell.capacity, maxCapacity)}`}
                    onClick={() => {
                      setSelectedDate(cell.dateStr);
                      setSelectedCell(cell);
                      setDailyGoal(cell.revenueGoal?.dailyGoal);
                      // Initialize from revenue goal's type, default to 'max' if not set
                      setRevenueGoalType(cell.revenueGoal?.revenueGoalType || 'max');
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
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dashboard Tiles */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Weekly Goal Tile */}
            <div
              className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg cursor-help"
              title={(() => {
                const selectedDateStr = viewDate.toISOString().split('T')[0];
                const result = getWeeklyGoalTotal(
                  currentEntity?.capacityConfig,
                  selectedDateStr,
                  {
                    includeCalculated: true,
                    hourlyRate: entityType === 'sublocation' ? currentEntity?.defaultHourlyRate : undefined,
                    dayCells: dayCells
                  }
                );
                return `${result.daysWithSetGoals} days with set goals, ${result.daysCalculated} days calculated from allocated capacity`;
              })()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  <h3 className="text-sm font-medium opacity-90">Weekly Goal</h3>
                </div>
                <Target className="w-8 h-8 opacity-20" />
              </div>
              <div className="text-3xl font-bold mb-1">
                ${(() => {
                  const selectedDateStr = viewDate.toISOString().split('T')[0];
                  const result = getWeeklyGoalTotal(
                    currentEntity?.capacityConfig,
                    selectedDateStr,
                    {
                      includeCalculated: true,
                      hourlyRate: entityType === 'sublocation' ? currentEntity?.defaultHourlyRate : undefined,
                      dayCells: dayCells
                    }
                  );
                  return result.setGoals.toLocaleString();
                })()}
              </div>
              <p className="text-xs opacity-75">
                {(() => {
                  const selectedDateStr = viewDate.toISOString().split('T')[0];
                  const result = getWeeklyGoalTotal(
                    currentEntity?.capacityConfig,
                    selectedDateStr,
                    {
                      includeCalculated: true,
                      hourlyRate: entityType === 'sublocation' ? currentEntity?.defaultHourlyRate : undefined,
                      dayCells: dayCells
                    }
                  );
                  return `${result.daysWithSetGoals} days set`;
                })()}
              </p>
              {(() => {
                const selectedDateStr = viewDate.toISOString().split('T')[0];
                const result = getWeeklyGoalTotal(
                  currentEntity?.capacityConfig,
                  selectedDateStr,
                  {
                    includeCalculated: true,
                    hourlyRate: entityType === 'sublocation' ? currentEntity?.defaultHourlyRate : undefined,
                    dayCells: dayCells
                  }
                );
                if (result.calculatedGoals > 0) {
                  return (
                    <p className="text-xs opacity-60 mt-1">
                      + ${(result.calculatedGoals / 1000).toFixed(1)}k potential
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            {/* Monthly Goal Tile */}
            <div
              className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white shadow-lg cursor-help"
              title={(() => {
                const selectedDateStr = viewDate.toISOString().split('T')[0];
                const result = getMonthlyGoalTotal(
                  currentEntity?.capacityConfig,
                  selectedDateStr,
                  {
                    includeCalculated: true,
                    hourlyRate: entityType === 'sublocation' ? currentEntity?.defaultHourlyRate : undefined,
                    dayCells: dayCells
                  }
                );
                return `${result.daysWithSetGoals} days with set goals, ${result.daysCalculated} days calculated from allocated capacity`;
              })()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  <h3 className="text-sm font-medium opacity-90">Monthly Goal</h3>
                </div>
                <Target className="w-8 h-8 opacity-20" />
              </div>
              <div className="text-3xl font-bold mb-1">
                ${(() => {
                  const selectedDateStr = viewDate.toISOString().split('T')[0];
                  const result = getMonthlyGoalTotal(
                    currentEntity?.capacityConfig,
                    selectedDateStr,
                    {
                      includeCalculated: true,
                      hourlyRate: entityType === 'sublocation' ? currentEntity?.defaultHourlyRate : undefined,
                      dayCells: dayCells
                    }
                  );
                  return result.setGoals.toLocaleString();
                })()}
              </div>
              <p className="text-xs opacity-75">
                {(() => {
                  const selectedDateStr = viewDate.toISOString().split('T')[0];
                  const result = getMonthlyGoalTotal(
                    currentEntity?.capacityConfig,
                    selectedDateStr,
                    {
                      includeCalculated: true,
                      hourlyRate: entityType === 'sublocation' ? currentEntity?.defaultHourlyRate : undefined,
                      dayCells: dayCells
                    }
                  );
                  return `${result.daysWithSetGoals} days set`;
                })()}
              </p>
              {(() => {
                const selectedDateStr = viewDate.toISOString().split('T')[0];
                const result = getMonthlyGoalTotal(
                  currentEntity?.capacityConfig,
                  selectedDateStr,
                  {
                    includeCalculated: true,
                    hourlyRate: entityType === 'sublocation' ? currentEntity?.defaultHourlyRate : undefined,
                    dayCells: dayCells
                  }
                );
                if (result.calculatedGoals > 0) {
                  return (
                    <p className="text-xs opacity-60 mt-1">
                      + ${(result.calculatedGoals / 1000).toFixed(1)}k potential
                    </p>
                  );
                }
                return null;
              })()}
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
              <div className="text-3xl font-bold mb-1">
                {(() => {
                  const selectedDateStr = viewDate.toISOString().split('T')[0];
                  const occupancy = getMonthlyOccupancyPercentage(currentEntity, selectedDateStr, dayCells);
                  return `${occupancy}%`;
                })()}
              </div>
              <p className="text-xs opacity-75">Allocated vs Max for the month</p>
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
                {selectedCell?.hourlyBreakdown && selectedCell.hourlyBreakdown.length > 0 && currentEntity.defaultHourlyRate && (
                  <div className="mb-4 overflow-hidden border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 border-b w-16">Active</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 border-b">Calculation Method</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b">Total Capacity</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 border-b">Revenue Goal</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {/* Max Capacity Calculation */}
                        <tr className={`hover:bg-gray-50 ${revenueGoalType === 'max' ? 'bg-green-50' : ''}`}>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="radio"
                              name="revenueGoalType"
                              value="max"
                              checked={revenueGoalType === 'max'}
                              onChange={(e) => setRevenueGoalType(e.target.value as 'max' | 'allocated' | 'custom')}
                              className="w-4 h-4 text-green-600 focus:ring-2 focus:ring-green-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="font-medium text-gray-900">Max Capacity</span>
                            </div>
                            <div className="text-xs text-gray-500 ml-4 mt-0.5">
                              Sum of all hourly max capacities
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-green-600">
                              {selectedCell.hourlyBreakdown.reduce((sum, seg) => sum + seg.maxCapacity, 0)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-green-700">
                              ${(() => {
                                const totalMax = selectedCell.hourlyBreakdown.reduce((sum, seg) => sum + seg.maxCapacity, 0);
                                return Math.round(currentEntity.defaultHourlyRate * totalMax).toLocaleString();
                              })()}
                            </span>
                          </td>
                        </tr>

                        {/* Allocated Capacity Calculation */}
                        <tr className={`hover:bg-gray-50 ${revenueGoalType === 'allocated' ? 'bg-purple-50' : ''}`}>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="radio"
                              name="revenueGoalType"
                              value="allocated"
                              checked={revenueGoalType === 'allocated'}
                              onChange={(e) => setRevenueGoalType(e.target.value as 'max' | 'allocated' | 'custom')}
                              className="w-4 h-4 text-purple-600 focus:ring-2 focus:ring-purple-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                              <span className="font-medium text-gray-900">Allocated Capacity</span>
                            </div>
                            <div className="text-xs text-gray-500 ml-4 mt-0.5">
                              Sum of all hourly allocated capacities
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-purple-600">
                              {selectedCell.hourlyBreakdown.reduce((sum, seg) => sum + seg.allocatedCapacity, 0)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-purple-700">
                              ${(() => {
                                const totalAllocated = selectedCell.hourlyBreakdown.reduce((sum, seg) => sum + seg.allocatedCapacity, 0);
                                return Math.round(currentEntity.defaultHourlyRate * totalAllocated).toLocaleString();
                              })()}
                            </span>
                          </td>
                        </tr>

                        {/* Custom Override */}
                        <tr className={`hover:bg-blue-100 ${revenueGoalType === 'custom' ? 'bg-blue-100' : 'bg-blue-50'}`}>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="radio"
                              name="revenueGoalType"
                              value="custom"
                              checked={revenueGoalType === 'custom'}
                              onChange={(e) => setRevenueGoalType(e.target.value as 'max' | 'allocated' | 'custom')}
                              className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="font-medium text-gray-900">Custom Override</span>
                            </div>
                            <div className="text-xs text-gray-500 ml-4 mt-0.5">
                              Manual target value
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-400 text-xs">
                            N/A
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end">
                              <span className="font-bold text-gray-900 mr-1">$</span>
                              <input
                                type="number"
                                value={dailyGoal || ''}
                                onChange={(e) => {
                                  setDailyGoal(e.target.value ? Number(e.target.value) : undefined);
                                  if (e.target.value) {
                                    setRevenueGoalType('custom');
                                  }
                                }}
                                className="w-32 px-2 py-1 border border-blue-300 rounded text-right text-gray-900 focus:ring-2 focus:ring-blue-500 font-semibold"
                                placeholder="Enter amount"
                                min={0}
                              />
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

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
                      await reloadCurrentEntity();
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
