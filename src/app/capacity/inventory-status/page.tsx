'use client';

import { useState, useEffect } from 'react';
import { Shield, RefreshCw, MapPin, Calendar, Users } from 'lucide-react';
import PricingFilters from '@/components/PricingFilters';
import InventoryStatusCards from '@/components/InventoryStatusCards';
import CrossTabulationMatrix from '@/components/CrossTabulationMatrix';
import PhysicalStatusInput from '@/components/PhysicalStatusInput';
import OperationalStatusBadge from '@/components/OperationalStatusBadge';
import AllocationConsumptionPanel from '@/components/AllocationConsumptionPanel';
import { InventoryStatus4D, CommercialStatus, OperationalStatus } from '@/models/types';

export default function InventoryStatusPage() {
  // Filter state
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedSubLocation, setSelectedSubLocation] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(12);

  // Data state
  const [statusData, setStatusData] = useState<InventoryStatus4D | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch status when sublocation changes
  useEffect(() => {
    if (selectedSubLocation) {
      fetchStatus();
    } else {
      setStatusData(null);
    }
  }, [selectedSubLocation]);

  const fetchStatus = async () => {
    if (!selectedSubLocation) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/capacity/inventory-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subLocationId: selectedSubLocation,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch inventory status');
      }

      const data = await response.json();
      setStatusData(data);
    } catch (err: any) {
      console.error('Error fetching inventory status:', err);
      setError(err.message || 'Failed to fetch inventory status');
    } finally {
      setLoading(false);
    }
  };

  // Commercial status badge color
  const commercialStatusColor: Record<CommercialStatus, string> = {
    [CommercialStatus.NONE]: 'bg-gray-100 text-gray-600',
    [CommercialStatus.RESERVED_UPCOMING]: 'bg-sky-100 text-sky-700',
    [CommercialStatus.RESERVED_ACTIVE]: 'bg-blue-100 text-blue-700',
    [CommercialStatus.NO_SHOW]: 'bg-amber-100 text-amber-700',
    [CommercialStatus.OVERSTAY]: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-green-50 to-emerald-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-green-600 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Shield className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Inventory Status (4D View)</h1>
                <p className="text-teal-100 text-sm">
                  Full visibility across Capacity, Physical, Commercial, and Operational dimensions
                </p>
              </div>
            </div>
            {selectedSubLocation && (
              <button
                onClick={fetchStatus}
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
      <div className="max-w-7xl mx-auto px-8 py-8 space-y-6">
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

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-600" />
              <p className="text-gray-600">Computing 4D inventory status...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-red-700">{error}</p>
            <button onClick={fetchStatus} className="mt-2 text-sm text-red-600 underline hover:no-underline">
              Try again
            </button>
          </div>
        )}

        {/* No Selection */}
        {!selectedSubLocation && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <div className="text-center">
              <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Select a SubLocation</h3>
              <p className="text-gray-600">
                Choose a location and sub-location to view the 4-dimensional inventory status
              </p>
            </div>
          </div>
        )}

        {/* Status Data */}
        {statusData && !loading && !error && (
          <>
            {/* Total Capacity Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{statusData.subLocationLabel}</h2>
                <p className="text-sm text-gray-500">
                  Status as of {new Date(statusData.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                <span className="text-2xl font-bold text-gray-900">{statusData.totalCapacity}</span>
                <span className="text-sm text-gray-500">total capacity</span>
              </div>
            </div>

            {/* 4 Status Cards */}
            <InventoryStatusCards
              totalCapacity={statusData.totalCapacity}
              capacityStatus={statusData.capacityStatus}
              physicalStatus={statusData.physicalStatus}
              commercialStatus={statusData.commercialStatus}
              operationalStatus={statusData.operationalStatus}
            />

            {/* Allocation Consumption — bridges planning with reality */}
            {statusData.allocationConsumption && (
              <AllocationConsumptionPanel
                allocationConsumption={statusData.allocationConsumption}
                totalCapacity={statusData.totalCapacity}
              />
            )}

            {/* Cross-Tabulation Matrix */}
            <CrossTabulationMatrix
              crossTabulation={statusData.crossTabulation}
              totalCapacity={statusData.totalCapacity}
            />

            {/* Physical Status Input */}
            <PhysicalStatusInput
              subLocationId={selectedSubLocation}
              maxCapacity={statusData.totalCapacity}
              currentSnapshot={
                statusData.physicalStatus.unknown === statusData.totalCapacity &&
                statusData.physicalStatus.free === 0 &&
                statusData.physicalStatus.occupied === 0 &&
                statusData.physicalStatus.occupiedUnconfirmed === 0
                  ? null
                  : {
                      counts: statusData.physicalStatus,
                      updatedAt: new Date(),
                      updatedBy: 'current',
                      source: 'MANUAL',
                    }
              }
              onUpdated={fetchStatus}
            />

            {/* Active Events */}
            {statusData.activeEvents.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-amber-600" />
                  <h2 className="text-lg font-bold text-gray-900">Active Events ({statusData.activeEvents.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Event</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Start</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">End</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Attendees</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Commercial Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusData.activeEvents.map((event) => (
                        <tr key={event.eventId} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3 text-sm font-medium text-gray-900">{event.name}</td>
                          <td className="py-2 px-3 text-sm text-gray-600">
                            {new Date(event.startDate).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-sm text-gray-600">
                            {new Date(event.endDate).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-sm text-right font-bold text-gray-900">
                            {event.attendees}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${commercialStatusColor[event.commercialStatus]}`}>
                              {event.commercialStatus.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* No Events */}
            {statusData.activeEvents.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <h2 className="text-lg font-bold text-gray-900">Active Events</h2>
                </div>
                <p className="text-sm text-gray-500">No events currently overlapping this SubLocation.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
