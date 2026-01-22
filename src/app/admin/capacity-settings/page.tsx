'use client';

import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Building2,
  MapPin,
  Layers,
  Check,
  X,
  AlertCircle,
  Users,
  Search,
  Filter,
  RefreshCw,
  History,
  Lightbulb,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Zap,
  ArrowLeft,
  BarChart3
} from 'lucide-react';

interface Customer {
  _id: string;
  name: string;
  // Aggregated capacity from all locations
  minCapacity?: number;
  maxCapacity?: number;
  defaultCapacity?: number;
  allocatedCapacity?: number;
}

interface Location {
  _id: string;
  customerId: string;
  name: string;
  city: string;
  state?: string;
  // Aggregated capacity from all sublocations
  minCapacity?: number;
  maxCapacity?: number;
  defaultCapacity?: number;
  allocatedCapacity?: number;
}

interface SubLocation {
  _id: string;
  locationId: string;
  label: string;
  description?: string;
  minCapacity?: number;
  maxCapacity?: number;
  defaultCapacity?: number;
  allocatedCapacity?: number;
  isActive: boolean;
}

interface HierarchyNode {
  customer: Customer;
  locations: Array<{
    location: Location;
    sublocations: SubLocation[];
  }>;
}

export default function CapacitySettingsPage() {
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
  const [filteredHierarchy, setFilteredHierarchy] = useState<HierarchyNode[]>([]);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);

  // Editing states
  const [editingCapacity, setEditingCapacity] = useState<Map<string, {
    min: number;
    max: number;
    default: number;
    allocated: number;
  }>>(new Map());

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchHierarchy();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [hierarchy, searchQuery, filterStatus]);

  const fetchHierarchy = async () => {
    setLoading(true);
    try {
      const [customersRes, locationsRes, sublocationsRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/locations'),
        fetch('/api/sublocations')
      ]);

      const customers: Customer[] = await customersRes.json();
      const locations: Location[] = await locationsRes.json();
      const sublocations: SubLocation[] = await sublocationsRes.json();

      console.log('📊 Fetched sublocations:', sublocations.map(s => ({
        id: s._id,
        label: s.label,
        min: s.minCapacity,
        max: s.maxCapacity,
        default: s.defaultCapacity,
        allocated: s.allocatedCapacity
      })));

      // Calculate aggregated capacity for locations
      const locationsWithCapacity = locations.map(location => {
        const locationSublocations = sublocations.filter(sub =>
          String(sub.locationId) === String(location._id)
        );

        const minCapacity = locationSublocations.reduce((sum, sub) => sum + (sub.minCapacity || 0), 0);
        const maxCapacity = locationSublocations.reduce((sum, sub) => sum + (sub.maxCapacity || 0), 0);
        const defaultCapacity = locationSublocations.reduce((sum, sub) => sum + (sub.defaultCapacity || 0), 0);
        const allocatedCapacity = locationSublocations.reduce((sum, sub) => sum + (sub.allocatedCapacity || 0), 0);

        console.log(`📍 Location ${location.name} aggregated capacity:`, {
          sublocations: locationSublocations.length,
          min: minCapacity,
          max: maxCapacity,
          default: defaultCapacity,
          allocated: allocatedCapacity
        });

        return {
          ...location,
          minCapacity,
          maxCapacity,
          defaultCapacity,
          allocatedCapacity
        };
      });

      // Calculate aggregated capacity for customers
      const hierarchyData: HierarchyNode[] = customers.map(customer => {
        const customerLocations = locationsWithCapacity.filter(loc =>
          String(loc.customerId) === String(customer._id)
        );

        const minCapacity = customerLocations.reduce((sum, loc) => sum + (loc.minCapacity || 0), 0);
        const maxCapacity = customerLocations.reduce((sum, loc) => sum + (loc.maxCapacity || 0), 0);
        const defaultCapacity = customerLocations.reduce((sum, loc) => sum + (loc.defaultCapacity || 0), 0);
        const allocatedCapacity = customerLocations.reduce((sum, loc) => sum + (loc.allocatedCapacity || 0), 0);

        return {
          customer: {
            ...customer,
            minCapacity,
            maxCapacity,
            defaultCapacity,
            allocatedCapacity
          },
          locations: customerLocations.map(location => ({
            location,
            sublocations: sublocations.filter(sub =>
              String(sub.locationId) === String(location._id)
            )
          }))
        };
      });

      setHierarchy(hierarchyData);
    } catch (error) {
      console.error('Failed to fetch hierarchy:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...hierarchy];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.map(node => ({
        ...node,
        locations: node.locations.filter(locNode =>
          node.customer.name.toLowerCase().includes(query) ||
          locNode.location.name.toLowerCase().includes(query) ||
          locNode.location.city.toLowerCase().includes(query) ||
          locNode.sublocations.some(sub => sub.label.toLowerCase().includes(query))
        )
      })).filter(node =>
        node.customer.name.toLowerCase().includes(query) ||
        node.locations.length > 0
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.map(node => ({
        ...node,
        locations: node.locations.map(locNode => ({
          ...locNode,
          sublocations: locNode.sublocations.filter(sub =>
            filterStatus === 'active' ? sub.isActive : !sub.isActive
          )
        })).filter(locNode => locNode.sublocations.length > 0)
      })).filter(node => node.locations.length > 0);
    }

    setFilteredHierarchy(filtered);
  };

  const toggleCustomerExpand = (customerId: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId);
    } else {
      newExpanded.add(customerId);
    }
    setExpandedCustomers(newExpanded);
  };

  const toggleLocationExpand = (locationId: string) => {
    const newExpanded = new Set(expandedLocations);
    if (newExpanded.has(locationId)) {
      newExpanded.delete(locationId);
    } else {
      newExpanded.add(locationId);
    }
    setExpandedLocations(newExpanded);
  };

  const expandAllLocations = (customerId: string) => {
    const node = filteredHierarchy.find(n => n.customer._id === customerId);
    if (!node) return;
    const newExpanded = new Set(expandedLocations);
    node.locations.forEach(locNode => {
      newExpanded.add(locNode.location._id);
    });
    setExpandedLocations(newExpanded);
  };

  const collapseAllLocations = (customerId: string) => {
    const node = filteredHierarchy.find(n => n.customer._id === customerId);
    if (!node) return;
    const newExpanded = new Set(expandedLocations);
    node.locations.forEach(locNode => {
      newExpanded.delete(locNode.location._id);
    });
    setExpandedLocations(newExpanded);
  };

  const expandAllCustomers = () => {
    const allCustomerIds = filteredHierarchy.map(n => n.customer._id);
    setExpandedCustomers(new Set(allCustomerIds));
  };

  const collapseAllCustomers = () => {
    setExpandedCustomers(new Set());
  };

  const startEditingCapacity = (subLocationId: string, current: SubLocation) => {
    const newEditing = new Map(editingCapacity);
    newEditing.set(subLocationId, {
      min: current.minCapacity || 0,
      max: current.maxCapacity || 100,
      default: current.defaultCapacity || 50,
      allocated: current.allocatedCapacity || 0
    });
    setEditingCapacity(newEditing);
  };

  const updateEditingCapacity = (subLocationId: string, field: 'min' | 'max' | 'default' | 'allocated', value: number) => {
    const newEditing = new Map(editingCapacity);
    const current = newEditing.get(subLocationId);
    if (current) {
      current[field] = value;
      newEditing.set(subLocationId, current);
      setEditingCapacity(newEditing);
    }
  };

  const cancelEditingCapacity = (subLocationId: string) => {
    const newEditing = new Map(editingCapacity);
    newEditing.delete(subLocationId);
    setEditingCapacity(newEditing);
  };

  const handleSaveCapacity = async (subLocationId: string) => {
    const capacity = editingCapacity.get(subLocationId);
    if (!capacity) return;

    // Validate: allocated should be within min-max
    if (capacity.allocated < capacity.min || capacity.allocated > capacity.max) {
      alert(`Allocated capacity (${capacity.allocated}) must be between min (${capacity.min}) and max (${capacity.max})`);
      return;
    }

    // Validate: default should be within min-max
    if (capacity.default < capacity.min || capacity.default > capacity.max) {
      alert(`Default capacity (${capacity.default}) must be between min (${capacity.min}) and max (${capacity.max})`);
      return;
    }

    setSaving(subLocationId);
    try {
      const response = await fetch(`/api/sublocations/${subLocationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minCapacity: capacity.min,
          maxCapacity: capacity.max,
          defaultCapacity: capacity.default,
          allocatedCapacity: capacity.allocated
        })
      });

      if (!response.ok) throw new Error('Failed to save capacity');

      // Refresh hierarchy to update aggregated values
      await fetchHierarchy();

      // Clear editing state
      cancelEditingCapacity(subLocationId);
    } catch (error) {
      console.error('Failed to save capacity:', error);
      alert('Failed to save capacity');
    } finally {
      setSaving(null);
    }
  };

  const getUtilizationColor = (allocated: number, max: number): string => {
    if (!max) return 'text-gray-500';
    const utilization = (allocated / max) * 100;
    if (utilization >= 90) return 'text-red-600';
    if (utilization >= 75) return 'text-orange-600';
    if (utilization >= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getUtilizationPercentage = (allocated: number, max: number): number => {
    if (!max) return 0;
    return Math.round((allocated / max) * 100);
  };

  const handleMigrateCapacity = async () => {
    if (!confirm('This will initialize capacity values for all sublocations that don\'t have them set. Continue?')) {
      return;
    }

    setMigrating(true);
    try {
      const response = await fetch('/api/admin/migrate-capacity', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        alert(`Migration complete!\n\nUpdated: ${result.stats.updated} sublocations\nSkipped: ${result.stats.skipped} sublocations\n\nRefreshing...`);
        await fetchHierarchy();
      } else {
        alert(`Migration failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to migrate capacity:', error);
      alert('Failed to run migration');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Capacity Settings</h1>
          </div>
          <p className="text-gray-600">
            Configure capacity constraints and allocations for all sublocations
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers, locations, or sublocations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                showFilters
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>

            <button
              onClick={handleMigrateCapacity}
              disabled={migrating}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Zap className="w-5 h-5" />
              {migrating ? 'Migrating...' : 'Initialize Defaults'}
            </button>

            <button
              onClick={fetchHierarchy}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Sublocations
                </button>
                <button
                  onClick={() => setFilterStatus('active')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'active'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Active Only
                </button>
                <button
                  onClick={() => setFilterStatus('inactive')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'inactive'
                      ? 'bg-gray-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Inactive Only
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hierarchy Display */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Expand/Collapse All Customers */}
            {filteredHierarchy.length > 1 && (
              <div className="flex justify-end gap-2">
                <button
                  onClick={expandAllCustomers}
                  className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-2"
                >
                  <ChevronDown className="w-4 h-4" />
                  Expand All Customers
                </button>
                <button
                  onClick={collapseAllCustomers}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 border border-gray-200 transition-colors flex items-center gap-2"
                >
                  <ChevronRight className="w-4 h-4" />
                  Collapse All Customers
                </button>
              </div>
            )}
            {filteredHierarchy.map(node => (
              <div key={node.customer._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Customer Level */}
                <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 hover:from-blue-100 hover:to-indigo-100 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleCustomerExpand(node.customer._id)}
                        className="p-1 hover:bg-blue-100 rounded transition-colors"
                      >
                        {expandedCustomers.has(node.customer._id) ? (
                          <ChevronDown className="w-5 h-5 text-gray-600" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                      <Users className="w-6 h-6 text-blue-600" />
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{node.customer.name}</h3>
                        <div className="text-sm text-gray-600">
                          {node.locations.length} location{node.locations.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    {/* Customer Aggregated Capacity */}
                    <div className="flex items-center gap-6 text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="text-center">
                        <div className="text-gray-500 font-medium">Min</div>
                        <div className="text-lg font-bold text-gray-900">{node.customer.minCapacity || 0}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500 font-medium">Max</div>
                        <div className="text-lg font-bold text-gray-900">{node.customer.maxCapacity || 0}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500 font-medium">Default</div>
                        <div className="text-lg font-bold text-blue-600">{node.customer.defaultCapacity || 0}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500 font-medium">Allocated</div>
                        <div className={`text-lg font-bold ${getUtilizationColor(node.customer.allocatedCapacity || 0, node.customer.maxCapacity || 0)}`}>
                          {node.customer.allocatedCapacity || 0}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getUtilizationPercentage(node.customer.allocatedCapacity || 0, node.customer.maxCapacity || 0)}% utilized
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Locations */}
                {expandedCustomers.has(node.customer._id) && (
                  <div className="p-4 bg-gray-50">
                    {/* Expand/Collapse All Locations */}
                    {node.locations.length > 1 && (
                      <div className="flex justify-end gap-2 mb-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            expandAllLocations(node.customer._id);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1"
                        >
                          <ChevronDown className="w-3 h-3" />
                          Expand All
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            collapseAllLocations(node.customer._id);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 border border-gray-200 transition-colors flex items-center gap-1"
                        >
                          <ChevronRight className="w-3 h-3" />
                          Collapse All
                        </button>
                      </div>
                    )}
                    {node.locations.map(locNode => (
                      <div key={locNode.location._id} className="mb-3 last:mb-0">
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                          {/* Location Header */}
                          <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => toggleLocationExpand(locNode.location._id)}
                                  className="p-1 hover:bg-emerald-100 rounded transition-colors"
                                >
                                  {expandedLocations.has(locNode.location._id) ? (
                                    <ChevronDown className="w-5 h-5 text-gray-600" />
                                  ) : (
                                    <ChevronRight className="w-5 h-5 text-gray-600" />
                                  )}
                                </button>
                                <Building2 className="w-5 h-5 text-emerald-600" />
                                <div>
                                  <h4 className="font-semibold text-gray-900">{locNode.location.name}</h4>
                                  <div className="text-sm text-gray-600">
                                    {locNode.location.city}{locNode.location.state && `, ${locNode.location.state}`} • {locNode.sublocations.length} sublocation{locNode.sublocations.length !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              </div>

                              {/* Location Aggregated Capacity */}
                              <div className="flex items-center gap-4 text-sm" onClick={(e) => e.stopPropagation()}>
                                <div className="text-center">
                                  <div className="text-gray-500 text-xs">Min</div>
                                  <div className="font-bold text-gray-900">{locNode.location.minCapacity || 0}</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-gray-500 text-xs">Max</div>
                                  <div className="font-bold text-gray-900">{locNode.location.maxCapacity || 0}</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-gray-500 text-xs">Default</div>
                                  <div className="font-bold text-emerald-600">{locNode.location.defaultCapacity || 0}</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-gray-500 text-xs">Allocated</div>
                                  <div className={`font-bold ${getUtilizationColor(locNode.location.allocatedCapacity || 0, locNode.location.maxCapacity || 0)}`}>
                                    {locNode.location.allocatedCapacity || 0}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {getUtilizationPercentage(locNode.location.allocatedCapacity || 0, locNode.location.maxCapacity || 0)}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Sublocations */}
                          {expandedLocations.has(locNode.location._id) && (
                            <div className="p-4 space-y-2 bg-white">
                              {locNode.sublocations.map(subloc => {
                                const isEditing = editingCapacity.has(subloc._id);
                                const editValues = editingCapacity.get(subloc._id);

                                return (
                                  <div
                                    key={subloc._id}
                                    className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start gap-3 flex-1">
                                        <MapPin className="w-5 h-5 text-purple-600 mt-0.5" />
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <h5 className="font-semibold text-gray-900">{subloc.label}</h5>
                                            {!subloc.isActive && (
                                              <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">
                                                Inactive
                                              </span>
                                            )}
                                          </div>
                                          {subloc.description && (
                                            <p className="text-sm text-gray-600 mt-1">{subloc.description}</p>
                                          )}

                                          {/* Capacity Controls */}
                                          <div className="mt-3 grid grid-cols-4 gap-3" onClick={(e) => e.stopPropagation()}>
                                            {/* Min Capacity */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Min Capacity
                                              </label>
                                              {isEditing ? (
                                                <input
                                                  type="number"
                                                  value={editValues?.min || 0}
                                                  onChange={(e) => updateEditingCapacity(subloc._id, 'min', parseInt(e.target.value) || 0)}
                                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm text-gray-900"
                                                  min="0"
                                                />
                                              ) : (
                                                <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900">
                                                  {subloc.minCapacity || 0}
                                                </div>
                                              )}
                                            </div>

                                            {/* Max Capacity */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Max Capacity
                                              </label>
                                              {isEditing ? (
                                                <input
                                                  type="number"
                                                  value={editValues?.max || 100}
                                                  onChange={(e) => updateEditingCapacity(subloc._id, 'max', parseInt(e.target.value) || 0)}
                                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm text-gray-900"
                                                  min="0"
                                                />
                                              ) : (
                                                <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900">
                                                  {subloc.maxCapacity || 100}
                                                </div>
                                              )}
                                            </div>

                                            {/* Default Capacity */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Default Capacity
                                              </label>
                                              {isEditing ? (
                                                <input
                                                  type="number"
                                                  value={editValues?.default || 50}
                                                  onChange={(e) => updateEditingCapacity(subloc._id, 'default', parseInt(e.target.value) || 0)}
                                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm text-gray-900"
                                                  min="0"
                                                />
                                              ) : (
                                                <div className="px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm font-semibold text-purple-600">
                                                  {subloc.defaultCapacity || 50}
                                                </div>
                                              )}
                                            </div>

                                            {/* Allocated Capacity */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Allocated
                                              </label>
                                              {isEditing ? (
                                                <input
                                                  type="number"
                                                  value={editValues?.allocated || 0}
                                                  onChange={(e) => updateEditingCapacity(subloc._id, 'allocated', parseInt(e.target.value) || 0)}
                                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm text-gray-900"
                                                  min="0"
                                                />
                                              ) : (
                                                <div className={`px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold ${getUtilizationColor(subloc.allocatedCapacity || 0, subloc.maxCapacity || 100)}`}>
                                                  {subloc.allocatedCapacity || 0}
                                                  <span className="text-xs ml-1 text-gray-500">
                                                    ({getUtilizationPercentage(subloc.allocatedCapacity || 0, subloc.maxCapacity || 100)}%)
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          {/* Validation Messages */}
                                          {isEditing && editValues && (
                                            <div className="mt-2 space-y-1">
                                              {editValues.allocated < editValues.min || editValues.allocated > editValues.max ? (
                                                <div className="flex items-center gap-2 text-xs text-red-600">
                                                  <AlertCircle className="w-4 h-4" />
                                                  Allocated must be between min and max
                                                </div>
                                              ) : null}
                                              {editValues.default < editValues.min || editValues.default > editValues.max ? (
                                                <div className="flex items-center gap-2 text-xs text-red-600">
                                                  <AlertCircle className="w-4 h-4" />
                                                  Default must be between min and max
                                                </div>
                                              ) : null}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex items-center gap-2 ml-4">
                                        {isEditing ? (
                                          <>
                                            <button
                                              onClick={() => handleSaveCapacity(subloc._id)}
                                              disabled={saving === subloc._id}
                                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                                            >
                                              <Check className="w-4 h-4" />
                                              {saving === subloc._id ? 'Saving...' : 'Save'}
                                            </button>
                                            <button
                                              onClick={() => cancelEditingCapacity(subloc._id)}
                                              disabled={saving === subloc._id}
                                              className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm"
                                            >
                                              <X className="w-4 h-4" />
                                              Cancel
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            onClick={() => startEditingCapacity(subloc._id, subloc)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                                          >
                                            <Zap className="w-4 h-4" />
                                            Edit
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {filteredHierarchy.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Results Found</h3>
                <p className="text-gray-600">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
