'use client';

import { useState, useEffect } from 'react';
import { Edit, Trash2, Plus, Power, PowerOff } from 'lucide-react';

interface PriorityConfig {
  _id?: string;
  type: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
  minPriority: number;
  maxPriority: number;
  color: string;
  description: string;
}

interface Ratesheet {
  _id: string;
  subLocationId?: string;
  locationId?: string;
  customerId?: string;
  name: string;
  description?: string;
  type: 'TIMING_BASED' | 'DURATION_BASED';
  priority: number;
  conflictResolution: 'PRIORITY' | 'HIGHEST_PRICE' | 'LOWEST_PRICE';
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  timeWindows?: Array<{
    startTime: string;
    endTime: string;
    pricePerHour: number;
  }>;
  durationRules?: Array<{
    durationHours: number;
    totalPrice: number;
    description: string;
  }>;
  createdAt: string;
  updatedAt: string;
  // Populated fields
  customer?: { _id: string; name: string };
  location?: { _id: string; name: string };
  sublocation?: { _id: string; label: string };
  ratesheetType?: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
}

interface Location {
  _id: string;
  customerId: string;
  name: string;
  city: string;
}

interface SubLocation {
  _id: string;
  locationId: string;
  label: string;
  pricingEnabled: boolean;
  isActive: boolean;
}

interface Customer {
  _id: string;
  name: string;
}

export default function AdminPricingPage() {
  const [ratesheets, setRatesheets] = useState<Ratesheet[]>([]);
  const [priorityConfigs, setPriorityConfigs] = useState<PriorityConfig[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load all data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load priority configs
      const configRes = await fetch('/api/pricing/priority-config');
      if (configRes.ok) {
        const configs = await configRes.json();
        setPriorityConfigs(configs);
      }

      // Load ratesheets
      const ratesheetsRes = await fetch('/api/ratesheets?includeInactive=true');
      const ratesheetsData = await ratesheetsRes.json();
      setRatesheets(ratesheetsData);

      // Load customers
      const customersRes = await fetch('/api/customers');
      const customersData = await customersRes.json();
      setCustomers(customersData);

      // Load locations
      const locationsRes = await fetch('/api/locations');
      const locationsData = await locationsRes.json();
      setLocations(locationsData);

      // Load sublocations
      const sublocationsRes = await fetch('/api/sublocations');
      const sublocationsData = await sublocationsRes.json();
      setSublocations(sublocationsData);

      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      setLoading(false);
    }
  };

  // Toggle ratesheet active status
  const toggleRatesheetStatus = async (ratesheetId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/ratesheets/${ratesheetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update ratesheet status');
      }

      // Reload data
      await loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Delete ratesheet
  const deleteRatesheet = async (ratesheetId: string) => {
    if (!confirm('Are you sure you want to delete this ratesheet? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/ratesheets/${ratesheetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete ratesheet');
      }

      await loadData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Get priority config for ratesheet type
  const getPriorityConfig = (type: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | undefined) => {
    if (!type) return null;
    return priorityConfigs.find(c => c.type === type);
  };

  // Get color for ratesheet type
  const getTypeColor = (type: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | undefined) => {
    const config = getPriorityConfig(type);
    return config?.color || 'gray';
  };

  // Filter ratesheets
  const filteredRatesheets = ratesheets.filter(rs => {
    if (filter === 'ALL') return true;
    return rs.ratesheetType === filter;
  });

  // Group by type
  const groupedRatesheets = {
    CUSTOMER: filteredRatesheets.filter(rs => rs.ratesheetType === 'CUSTOMER'),
    LOCATION: filteredRatesheets.filter(rs => rs.ratesheetType === 'LOCATION'),
    SUBLOCATION: filteredRatesheets.filter(rs => rs.ratesheetType === 'SUBLOCATION'),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading ratesheets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Pricing Administration</h1>
              <p className="text-gray-600">Manage ratesheets across customers, locations, and sublocations</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Create Ratesheet
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Priority Configuration Summary */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Priority Ranges</h2>
          <div className="grid grid-cols-3 gap-4">
            {priorityConfigs.map((config) => (
              <div
                key={config.type}
                className="border-2 rounded-lg p-4"
                style={{ borderColor: config.color }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{config.type}</h3>
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: config.color }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{config.description}</p>
                <div className="bg-gray-50 rounded px-3 py-2">
                  <p className="text-xs font-mono text-gray-700">
                    Range: {config.minPriority} - {config.maxPriority}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-lg mb-8">
          <div className="flex border-b">
            {(['ALL', 'CUSTOMER', 'LOCATION', 'SUBLOCATION'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-6 py-4 font-semibold transition-colors ${
                  filter === tab
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'ALL' ? 'All Ratesheets' : `${tab.charAt(0) + tab.slice(1).toLowerCase()} Level`}
                <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded-full">
                  {tab === 'ALL' 
                    ? ratesheets.length 
                    : ratesheets.filter(rs => rs.ratesheetType === tab).length
                  }
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Ratesheets List */}
        {filter === 'ALL' ? (
          // Show grouped view
          <div className="space-y-8">
            {Object.entries(groupedRatesheets).map(([type, sheets]) => (
              sheets.length > 0 && (
                <div key={type}>
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: getTypeColor(type as any) }}
                    ></div>
                    {type.charAt(0) + type.slice(1).toLowerCase()} Ratesheets ({sheets.length})
                  </h2>
                  <RatesheetsList
                    ratesheets={sheets}
                    onToggleStatus={toggleRatesheetStatus}
                    onDelete={deleteRatesheet}
                    priorityConfigs={priorityConfigs}
                  />
                </div>
              )
            ))}
          </div>
        ) : (
          // Show filtered view
          <RatesheetsList
            ratesheets={filteredRatesheets}
            onToggleStatus={toggleRatesheetStatus}
            onDelete={deleteRatesheet}
            priorityConfigs={priorityConfigs}
          />
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <CreateRatesheetModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              loadData();
            }}
            customers={customers}
            locations={locations}
            sublocations={sublocations}
            priorityConfigs={priorityConfigs}
          />
        )}
      </div>
    </div>
  );
}

// Ratesheets List Component
function RatesheetsList({
  ratesheets,
  onToggleStatus,
  onDelete,
  priorityConfigs,
}: {
  ratesheets: Ratesheet[];
  onToggleStatus: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
  priorityConfigs: PriorityConfig[];
}) {
  const getTypeColor = (type: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | undefined) => {
    if (!type) return 'gray';
    const config = priorityConfigs.find(c => c.type === type);
    return config?.color || 'gray';
  };

  if (ratesheets.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        No ratesheets found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {ratesheets.map((rs) => (
        <div
          key={rs._id}
          className={`bg-white rounded-lg shadow-lg border-l-4 overflow-hidden transition-all ${
            rs.isActive ? 'opacity-100' : 'opacity-60'
          }`}
          style={{ borderLeftColor: getTypeColor(rs.ratesheetType) }}
        >
          <div className="p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold text-gray-900">{rs.name}</h3>
                  <span
                    className="px-3 py-1 text-xs font-semibold rounded-full"
                    style={{
                      backgroundColor: `${getTypeColor(rs.ratesheetType)}20`,
                      color: getTypeColor(rs.ratesheetType),
                    }}
                  >
                    {rs.ratesheetType}
                  </span>
                  {rs.type === 'TIMING_BASED' && (
                    <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                      Timing-Based
                    </span>
                  )}
                  {rs.type === 'DURATION_BASED' && (
                    <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded">
                      Duration-Based
                    </span>
                  )}
                  {!rs.isActive && (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                      Disabled
                    </span>
                  )}
                </div>

                {rs.description && (
                  <p className="text-gray-600 mb-3">{rs.description}</p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Priority:</span>
                    <span className="ml-2 font-semibold text-gray-900">{rs.priority}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Conflict:</span>
                    <span className="ml-2 font-semibold text-gray-900">{rs.conflictResolution}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Effective From:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      {new Date(rs.effectiveFrom).toLocaleDateString()}
                    </span>
                  </div>
                  {rs.effectiveTo && (
                    <div>
                      <span className="text-gray-500">Effective To:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {new Date(rs.effectiveTo).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Associated Entity */}
                <div className="mt-3 flex items-center gap-2 text-sm">
                  {rs.customer && (
                    <span className="text-gray-600">
                      Customer: <strong>{rs.customer.name}</strong>
                    </span>
                  )}
                  {rs.location && (
                    <span className="text-gray-600">
                      → Location: <strong>{rs.location.name}</strong>
                    </span>
                  )}
                  {rs.sublocation && (
                    <span className="text-gray-600">
                      → SubLocation: <strong>{rs.sublocation.label}</strong>
                    </span>
                  )}
                </div>

                {/* Time Windows or Duration Rules */}
                {rs.type === 'TIMING_BASED' && rs.timeWindows && rs.timeWindows.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Time Windows:</p>
                    <div className="flex flex-wrap gap-2">
                      {rs.timeWindows.slice(0, 3).map((tw, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200"
                        >
                          {tw.startTime} - {tw.endTime}: ${tw.pricePerHour}/hr
                        </span>
                      ))}
                      {rs.timeWindows.length > 3 && (
                        <span className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          +{rs.timeWindows.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {rs.type === 'DURATION_BASED' && rs.durationRules && rs.durationRules.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Duration Rules:</p>
                    <div className="flex flex-wrap gap-2">
                      {rs.durationRules.map((dr, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 text-xs bg-orange-50 text-orange-700 rounded border border-orange-200"
                        >
                          {dr.durationHours}h: ${dr.totalPrice}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => onToggleStatus(rs._id, rs.isActive)}
                  className={`p-2 rounded-lg transition-colors ${
                    rs.isActive
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={rs.isActive ? 'Disable ratesheet' : 'Enable ratesheet'}
                >
                  {rs.isActive ? <Power size={20} /> : <PowerOff size={20} />}
                </button>
                <button
                  onClick={() => alert('Edit functionality coming soon!')}
                  className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  title="Edit ratesheet"
                >
                  <Edit size={20} />
                </button>
                <button
                  onClick={() => onDelete(rs._id)}
                  className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                  title="Delete ratesheet"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Create Ratesheet Modal
function CreateRatesheetModal({
  onClose,
  onSuccess,
  customers,
  locations,
  sublocations,
  priorityConfigs,
}: {
  onClose: () => void;
  onSuccess: () => void;
  customers: Customer[];
  locations: Location[];
  sublocations: SubLocation[];
  priorityConfigs: PriorityConfig[];
}) {
  const [level, setLevel] = useState<'CUSTOMER' | 'LOCATION' | 'SUBLOCATION'>('SUBLOCATION');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedSubLocation, setSelectedSubLocation] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'TIMING_BASED' | 'DURATION_BASED'>('TIMING_BASED');
  const [priority, setPriority] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const priorityConfig = priorityConfigs.find(c => c.type === level);

  const filteredLocations = selectedCustomer
    ? locations.filter(l => l.customerId === selectedCustomer)
    : [];

  const filteredSubLocations = selectedLocation
    ? sublocations.filter(sl => sl.locationId === selectedLocation && sl.pricingEnabled)
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload: any = {
        name,
        description,
        type,
        priority: parseInt(priority),
        conflictResolution: 'PRIORITY',
        isActive: true,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        timeWindows: type === 'TIMING_BASED' ? [
          { startTime: '09:00', endTime: '17:00', pricePerHour: 99 }
        ] : undefined,
        durationRules: type === 'DURATION_BASED' ? [
          { durationHours: 8, totalPrice: 500, description: '8-hour package' }
        ] : undefined,
      };

      // Add appropriate ID based on level
      if (level === 'CUSTOMER') {
        payload.customerId = selectedCustomer;
      } else if (level === 'LOCATION') {
        payload.locationId = selectedLocation;
      } else {
        payload.subLocationId = selectedSubLocation;
      }

      const response = await fetch('/api/ratesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create ratesheet');
      }

      onSuccess();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Create New Ratesheet</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Level Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Ratesheet Level
            </label>
            <select
              value={level}
              onChange={(e) => {
                setLevel(e.target.value as any);
                setSelectedCustomer('');
                setSelectedLocation('');
                setSelectedSubLocation('');
                setPriority('');
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="CUSTOMER">Customer Level</option>
              <option value="LOCATION">Location Level</option>
              <option value="SUBLOCATION">SubLocation Level</option>
            </select>
          </div>

          {/* Priority Range Info */}
          {priorityConfig && (
            <div
              className="p-4 rounded-lg border-2"
              style={{ borderColor: priorityConfig.color, backgroundColor: `${priorityConfig.color}10` }}
            >
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Priority Range: {priorityConfig.minPriority} - {priorityConfig.maxPriority}
              </p>
              <p className="text-xs text-gray-600">{priorityConfig.description}</p>
            </div>
          )}

          {/* Customer Selection (for all levels) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Customer
            </label>
            <select
              value={selectedCustomer}
              onChange={(e) => {
                setSelectedCustomer(e.target.value);
                setSelectedLocation('');
                setSelectedSubLocation('');
              }}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select customer...</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Location Selection (for location and sublocation levels) */}
          {(level === 'LOCATION' || level === 'SUBLOCATION') && selectedCustomer && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value);
                  setSelectedSubLocation('');
                }}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select location...</option>
                {filteredLocations.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name} - {l.city}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* SubLocation Selection (for sublocation level) */}
          {level === 'SUBLOCATION' && selectedLocation && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Sub-Location
              </label>
              <select
                value={selectedSubLocation}
                onChange={(e) => setSelectedSubLocation(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select sub-location...</option>
                {filteredSubLocations.map((sl) => (
                  <option key={sl._id} value={sl._id}>
                    {sl.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Ratesheet Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Weekend Premium Rates"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="Brief description of this ratesheet"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Ratesheet Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="TIMING_BASED">Timing-Based (hourly rates by time window)</option>
              <option value="DURATION_BASED">Duration-Based (package pricing)</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Priority {priorityConfig && `(${priorityConfig.minPriority}-${priorityConfig.maxPriority})`}
            </label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={priorityConfig ? `Enter ${priorityConfig.minPriority}-${priorityConfig.maxPriority}` : 'Enter priority'}
              min={priorityConfig?.minPriority}
              max={priorityConfig?.maxPriority}
              required
            />
          </div>

          {/* Effective From */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Effective From
            </label>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Ratesheet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
