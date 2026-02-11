'use client';

import { useState, useEffect } from 'react';
import { PieChart, Users, Building2, MapPin, Clock, RefreshCw } from 'lucide-react';
import PricingFilters from '@/components/PricingFilters';
import CapacityAllocationChart, { AllocationData } from '@/components/CapacityAllocationChart';

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

export default function CapacityAllocationPage() {
  // Filter state
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedSubLocation, setSelectedSubLocation] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(12);

  // Data state
  const [allocationData, setAllocationData] = useState<AllocationBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch allocation data when sublocation changes
  useEffect(() => {
    if (selectedSubLocation) {
      fetchAllocationData();
    } else {
      setAllocationData(null);
    }
  }, [selectedSubLocation, selectedDuration]);

  const fetchAllocationData = async () => {
    if (!selectedSubLocation) return;

    setLoading(true);
    setError(null);

    try {
      // Calculate time range based on duration
      const now = new Date();
      const startTime = new Date(now.getTime() - (selectedDuration / 2) * 60 * 60 * 1000);
      const endTime = new Date(now.getTime() + (selectedDuration / 2) * 60 * 60 * 1000);

      const response = await fetch('/api/capacity/allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subLocationId: selectedSubLocation,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
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
      setError(err.message || 'Failed to fetch allocation data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchAllocationData();
  };

  // Convert allocation data to chart format
  const chartData: AllocationData = allocationData
    ? {
        transient: allocationData.allocated.transient,
        events: allocationData.allocated.events,
        reserved: allocationData.allocated.reserved,
        unavailable: allocationData.unallocated.unavailable,
        readyToUse: allocationData.unallocated.readyToUse,
      }
    : { transient: 0, events: 0, reserved: 0, unavailable: 0, readyToUse: 0 };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-green-50 to-emerald-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-green-600 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <PieChart className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Capacity Allocation Breakdown</h1>
                <p className="text-teal-100 text-sm">
                  Visualize how capacity is distributed across different categories
                </p>
              </div>
            </div>
            {selectedSubLocation && (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Filters */}
        <PricingFilters
          selectedLocation={selectedLocation}
          selectedSubLocation={selectedSubLocation}
          selectedEventId={selectedEventId}
          onLocationChange={(id) => {
            setSelectedLocation(id);
            setSelectedSubLocation('');
            setSelectedEventId('');
          }}
          onSubLocationChange={(id) => {
            setSelectedSubLocation(id);
            setSelectedEventId('');
          }}
          onEventChange={setSelectedEventId}
          selectedDuration={selectedDuration}
          onDurationChange={setSelectedDuration}
        />

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-600"></div>
              <p className="text-gray-600">Calculating allocation breakdown...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <p className="text-red-700">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-2 text-sm text-red-600 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* No Selection State */}
        {!selectedSubLocation && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <div className="text-center">
              <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Select a SubLocation
              </h3>
              <p className="text-gray-600">
                Choose a location and sub-location to view capacity allocation breakdown
              </p>
            </div>
          </div>
        )}

        {/* Allocation Data Display */}
        {allocationData && !loading && !error && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Total Capacity */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <Users className="w-5 h-5 text-teal-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Total Capacity</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {allocationData.totalCapacity}
                </div>
                <div className="text-sm text-gray-500">people</div>
              </div>

              {/* Allocated */}
              <div className="bg-white rounded-xl shadow-sm border border-teal-200 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <Building2 className="w-5 h-5 text-teal-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Allocated</span>
                </div>
                <div className="text-3xl font-bold text-teal-600">
                  {allocationData.allocated.total}
                </div>
                <div className="text-sm text-gray-500">
                  {Math.round((allocationData.allocated.total / allocationData.totalCapacity) * 100)}% of total
                </div>
              </div>

              {/* Unallocated */}
              <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <MapPin className="w-5 h-5 text-amber-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Unallocated</span>
                </div>
                <div className="text-3xl font-bold text-amber-600">
                  {allocationData.unallocated.total}
                </div>
                <div className="text-sm text-gray-500">
                  {Math.round((allocationData.unallocated.total / allocationData.totalCapacity) * 100)}% of total
                </div>
              </div>

              {/* Time Window */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Clock className="w-5 h-5 text-gray-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Time Window</span>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {allocationData.metadata.totalHours}h
                </div>
                <div className="text-sm text-gray-500">
                  {allocationData.metadata.availableHours}h available
                </div>
              </div>
            </div>

            {/* SubLocation Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                {allocationData.subLocationLabel}
              </h2>
              <p className="text-sm text-gray-600">
                Showing capacity allocation from{' '}
                <span className="font-medium">
                  {new Date(allocationData.metadata.startTime).toLocaleString()}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {new Date(allocationData.metadata.endTime).toLocaleString()}
                </span>{' '}
                ({allocationData.metadata.timezone})
              </p>
            </div>

            {/* Visualization */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">
                Capacity Breakdown
              </h2>
              <CapacityAllocationChart
                data={chartData}
                totalCapacity={allocationData.totalCapacity}
                showTreemap={true}
                showStackedBar={true}
                height={350}
              />
            </div>

            {/* Detailed Metrics */}
            <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Allocation Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Allocated Section */}
                <div className="space-y-4">
                  <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-teal-500" />
                    Allocated Capacity
                  </h3>
                  <div className="space-y-3 pl-4 border-l-2 border-teal-200">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Transient (Walk-ins)</span>
                      <span className="font-bold text-teal-600">
                        {allocationData.allocated.transient} ({allocationData.percentages.transient}%)
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Events</span>
                      <span className="font-bold text-pink-600">
                        {allocationData.allocated.events} ({allocationData.percentages.events}%)
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Reserved (Pre-set)</span>
                      <span className="font-bold text-violet-600">
                        {allocationData.allocated.reserved} ({allocationData.percentages.reserved}%)
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between items-center">
                      <span className="text-gray-800 font-medium">Total Allocated</span>
                      <span className="font-bold text-gray-900">
                        {allocationData.allocated.total}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Unallocated Section */}
                <div className="space-y-4">
                  <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    Unallocated Capacity
                  </h3>
                  <div className="space-y-3 pl-4 border-l-2 border-amber-200">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Unavailable (Closed/Blackout)</span>
                      <span className="font-bold text-gray-500">
                        {allocationData.unallocated.unavailable} ({allocationData.percentages.unavailable}%)
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Ready To Use (Available)</span>
                      <span className="font-bold text-amber-600">
                        {allocationData.unallocated.readyToUse} ({allocationData.percentages.readyToUse}%)
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between items-center">
                      <span className="text-gray-800 font-medium">Total Unallocated</span>
                      <span className="font-bold text-gray-900">
                        {allocationData.unallocated.total}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
