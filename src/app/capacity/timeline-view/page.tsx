'use client';

import { useState, useEffect } from 'react';
import { Calendar, Users, TrendingUp, ChevronDown, ChevronUp, Info } from 'lucide-react';

interface CapacitySheet {
  _id: string;
  name: string;
  type: string;
  priority: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  timeWindows?: Array<{
    startTime: string;
    endTime: string;
    minCapacity: number;
    maxCapacity: number;
    defaultCapacity: number;
    allocatedCapacity?: number;
  }>;
  appliesTo: {
    level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
    entityId: string;
  };
  customer?: { _id: string; name: string };
  location?: { _id: string; name: string };
  sublocation?: { _id: string; label: string };
  event?: { _id: string; name: string };
}

interface Location {
  _id: string;
  name: string;
  customerId: string;
  minCapacity?: number;
  maxCapacity?: number;
  defaultCapacity?: number;
}

interface SubLocation {
  _id: string;
  label: string;
  locationId: string;
  minCapacity?: number;
  maxCapacity?: number;
  defaultCapacity?: number;
}

interface TimeSlot {
  hour: number;
  label: string;
  date: Date;
  capacitySheets: Array<{
    sheet: CapacitySheet;
    maxCapacity: number;
    isActive: boolean;
  }>;
  winningSheet?: CapacitySheet;
  maxCapacity?: number;
  availableCapacity?: number;
  isDefaultCapacity?: boolean;
}

export default function CapacityTimelineViewPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [capacitySheets, setCapacitySheets] = useState<CapacitySheet[]>([]);
  const [loading, setLoading] = useState(false);

  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentSubLocation, setCurrentSubLocation] = useState<SubLocation | null>(null);

  // Date range for timeline (24 hours starting from now)
  const [viewStart, setViewStart] = useState<Date>(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now;
  });

  const [viewEnd, setViewEnd] = useState<Date>(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  });

  const [expandedSheet, setExpandedSheet] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  // Load locations on mount
  useEffect(() => {
    fetch('/api/locations')
      .then(res => res.json())
      .then(data => setLocations(data))
      .catch(err => console.error('Failed to load locations:', err));
  }, []);

  // Load sublocations when location changes
  useEffect(() => {
    if (selectedLocation) {
      setLoading(true);
      fetch(`/api/sublocations?locationId=${selectedLocation}`)
        .then(res => res.json())
        .then(data => {
          setSublocations(data.filter((sl: SubLocation) => sl.isActive));
          setSelectedSubLocation('');

          // Get location details
          const loc = locations.find(l => l._id === selectedLocation);
          setCurrentLocation(loc || null);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to load sublocations:', err);
          setLoading(false);
        });
    } else {
      setSublocations([]);
      setSelectedSubLocation('');
      setCurrentLocation(null);
    }
  }, [selectedLocation, locations]);

  // Load capacity sheets when sublocation changes
  useEffect(() => {
    if (selectedSubLocation) {
      setLoading(true);

      // Get sublocation details
      const subloc = sublocations.find(s => s._id === selectedSubLocation);
      setCurrentSubLocation(subloc || null);

      // Fetch capacity sheets with hierarchy resolution
      fetch(`/api/capacitysheets?subLocationId=${selectedSubLocation}&resolveHierarchy=true&includeInactive=false&approvalStatus=APPROVED`)
        .then(res => res.json())
        .then(data => {
          setCapacitySheets(data);
          buildTimeSlots(data, subloc);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to load capacity sheets:', err);
          setLoading(false);
        });
    } else {
      setCapacitySheets([]);
      setTimeSlots([]);
      setCurrentSubLocation(null);
    }
  }, [selectedSubLocation, sublocations]);

  const buildTimeSlots = (sheets: CapacitySheet[], subloc: SubLocation | undefined) => {
    const slots: TimeSlot[] = [];
    const start = new Date(viewStart);
    const end = new Date(viewEnd);

    let current = new Date(start);
    while (current < end) {
      const hour = current.getHours();
      const hourStr = String(hour).padStart(2, '0') + ':00';

      // Find applicable capacity sheets for this hour
      const applicableSheets = sheets
        .filter(sheet => {
          // Check if sheet is effective at this time
          const effectiveFrom = new Date(sheet.effectiveFrom);
          const effectiveTo = sheet.effectiveTo ? new Date(sheet.effectiveTo) : null;

          if (current < effectiveFrom) return false;
          if (effectiveTo && current > effectiveTo) return false;

          // Check if TIME_BASED sheet has matching time window
          if (sheet.type === 'TIME_BASED' && sheet.timeWindows) {
            return sheet.timeWindows.some(tw => {
              const startHour = parseInt(tw.startTime.split(':')[0]);
              const endHour = parseInt(tw.endTime.split(':')[0]);
              return hour >= startHour && hour < endHour;
            });
          }

          return true;
        })
        .map(sheet => {
          let maxCapacity = 100; // default

          if (sheet.type === 'TIME_BASED' && sheet.timeWindows) {
            const window = sheet.timeWindows.find(tw => {
              const startHour = parseInt(tw.startTime.split(':')[0]);
              const endHour = parseInt(tw.endTime.split(':')[0]);
              return hour >= startHour && hour < endHour;
            });
            if (window) maxCapacity = window.maxCapacity;
          }

          return {
            sheet,
            maxCapacity,
            isActive: true
          };
        });

      // Sort by priority (Event > SubLocation > Location > Customer, then by priority number)
      applicableSheets.sort((a, b) => {
        const levelPriority = {
          'EVENT': 4,
          'SUBLOCATION': 3,
          'LOCATION': 2,
          'CUSTOMER': 1
        };

        const aLevel = levelPriority[a.sheet.appliesTo.level];
        const bLevel = levelPriority[b.sheet.appliesTo.level];

        if (aLevel !== bLevel) return bLevel - aLevel;
        return b.sheet.priority - a.sheet.priority;
      });

      const winningSheet = applicableSheets[0]?.sheet;
      const maxCapacity = applicableSheets[0]?.maxCapacity || subloc?.maxCapacity || 100;
      const allocated = 0; // TODO: Calculate from bookings
      const available = maxCapacity - allocated;

      slots.push({
        hour,
        label: hourStr,
        date: new Date(current),
        capacitySheets: applicableSheets,
        winningSheet,
        maxCapacity,
        availableCapacity: available,
        isDefaultCapacity: applicableSheets.length === 0
      });

      current = new Date(current.getTime() + 60 * 60 * 1000); // +1 hour
    }

    setTimeSlots(slots);
  };

  const getLevelColor = (level: string): string => {
    const colors = {
      'CUSTOMER': 'bg-blue-100 text-blue-800 border-blue-300',
      'LOCATION': 'bg-green-100 text-green-800 border-green-300',
      'SUBLOCATION': 'bg-orange-100 text-orange-800 border-orange-300',
      'EVENT': 'bg-pink-100 text-pink-800 border-pink-300',
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getCapacityBarColor = (available: number, max: number): string => {
    const percentage = (available / max) * 100;
    if (percentage > 75) return 'bg-green-500';
    if (percentage > 50) return 'bg-yellow-500';
    if (percentage > 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-green-50 to-emerald-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-green-600 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex items-center gap-3">
            <Calendar className="w-10 h-10" />
            <div>
              <h1 className="text-4xl font-bold mb-2">Capacity Timeline View</h1>
              <p className="text-teal-100 text-lg">Visual capacity analysis over time</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Selection Panel */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 text-gray-700">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Select Location...</option>
                {locations.map((loc) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sub-Location *</label>
              <select
                value={selectedSubLocation}
                onChange={(e) => setSelectedSubLocation(e.target.value)}
                disabled={!selectedLocation}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">Select Sub-Location...</option>
                {sublocations.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {currentSubLocation && (
            <div className="mt-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
              <h3 className="font-semibold text-teal-900 mb-2">Default Capacity</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Min:</span>
                  <span className="ml-2 font-bold text-teal-900">{currentSubLocation.minCapacity || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Max:</span>
                  <span className="ml-2 font-bold text-teal-900">{currentSubLocation.maxCapacity || 100}</span>
                </div>
                <div>
                  <span className="text-gray-600">Default:</span>
                  <span className="ml-2 font-bold text-teal-900">{currentSubLocation.defaultCapacity || 50}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading capacity timeline...</p>
          </div>
        ) : timeSlots.length > 0 ? (
          <div className="space-y-6">
            {/* Stats Summary */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-teal-500">
                <div className="text-sm text-gray-600">Total Sheets</div>
                <div className="text-2xl font-bold text-teal-900">{capacitySheets.length}</div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-green-500">
                <div className="text-sm text-gray-600">Avg Max Capacity</div>
                <div className="text-2xl font-bold text-green-900">
                  {Math.round(timeSlots.reduce((sum, slot) => sum + (slot.maxCapacity || 0), 0) / timeSlots.length)}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-blue-500">
                <div className="text-sm text-gray-600">Time Slots</div>
                <div className="text-2xl font-bold text-blue-900">{timeSlots.length}h</div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-purple-500">
                <div className="text-sm text-gray-600">Using Defaults</div>
                <div className="text-2xl font-bold text-purple-900">
                  {timeSlots.filter(s => s.isDefaultCapacity).length}
                </div>
              </div>
            </div>

            {/* Timeline Grid */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-teal-600 to-green-600 text-white px-6 py-4">
                <h3 className="text-xl font-bold">24-Hour Capacity Timeline</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity Bar</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase w-24">Max</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase w-24">Available</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-48">Source</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">Sheets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {timeSlots.map((slot, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {slot.label}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-4">
                              <div
                                className={`h-4 rounded-full ${getCapacityBarColor(slot.availableCapacity || 0, slot.maxCapacity || 100)}`}
                                style={{ width: `${((slot.availableCapacity || 0) / (slot.maxCapacity || 100)) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600 w-12">
                              {Math.round(((slot.availableCapacity || 0) / (slot.maxCapacity || 100)) * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                          {slot.maxCapacity}
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-bold text-green-700">
                          {slot.availableCapacity}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {slot.winningSheet ? (
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getLevelColor(slot.winningSheet.appliesTo.level)}`}>
                                {slot.winningSheet.appliesTo.level}
                              </span>
                              <span className="text-xs truncate">{slot.winningSheet.name}</span>
                            </div>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                              Default
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {slot.capacitySheets.length > 0 ? (
                            <button
                              onClick={() => setExpandedSheet(expandedSheet === `${index}` ? null : `${index}`)}
                              className="text-teal-600 hover:text-teal-800 font-medium text-sm"
                            >
                              {slot.capacitySheets.length}
                              {expandedSheet === `${index}` ? <ChevronUp className="inline ml-1" size={14} /> : <ChevronDown className="inline ml-1" size={14} />}
                            </button>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Capacity Sheets Legend */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Active Capacity Sheets</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {capacitySheets.map((sheet) => (
                  <div key={sheet._id} className="p-4 border border-gray-200 rounded-lg hover:border-teal-300 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{sheet.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getLevelColor(sheet.appliesTo.level)}`}>
                        {sheet.appliesTo.level}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div>Priority: <span className="font-semibold">{sheet.priority}</span></div>
                      <div>Type: <span className="font-semibold">{sheet.type}</span></div>
                      <div>
                        Effective: {new Date(sheet.effectiveFrom).toLocaleDateString()} -
                        {sheet.effectiveTo ? new Date(sheet.effectiveTo).toLocaleDateString() : ' Indefinite'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Timeline Data</h3>
            <p className="text-gray-600">
              Select a location and sublocation to view capacity timeline
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
