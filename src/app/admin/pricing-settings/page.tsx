'use client';

import { useState, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  DollarSign, 
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
  TrendingUp,
  Lightbulb,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Zap,
  ArrowLeft
} from 'lucide-react';

interface Customer {
  _id: string;
  name: string;
  defaultHourlyRate?: number;
}

interface Location {
  _id: string;
  customerId: string;
  name: string;
  city: string;
  state?: string;
  defaultHourlyRate?: number;
}

interface SubLocation {
  _id: string;
  locationId: string;
  label: string;
  description?: string;
  allocatedCapacity?: number;
  pricingEnabled: boolean;
  isActive: boolean;
  defaultHourlyRate?: number;
}

interface HierarchyNode {
  customer: Customer;
  locations: Array<{
    location: Location;
    sublocations: SubLocation[];
  }>;
}

interface RateHistory {
  _id: string;
  entityType: 'customer' | 'location' | 'sublocation';
  entityId: string;
  entityName: string;
  oldRate?: number;
  newRate: number;
  changedBy?: string;
  changedAt: Date;
  reason?: string;
}

interface AreaStats {
  avgRate: number;
  minRate: number;
  maxRate: number;
  sampleSize: number;
}

export default function PricingSettingsPhase2() {
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
  const [filteredHierarchy, setFilteredHierarchy] = useState<HierarchyNode[]>([]);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingRates, setEditingRates] = useState<Map<string, number>>(new Map());
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Bulk Operations
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkOperation, setBulkOperation] = useState<'apply' | 'reset' | 'enable' | 'disable' | null>(null);
  const [bulkRate, setBulkRate] = useState<number>(0);
  const [selectedEntity, setSelectedEntity] = useState<{ type: 'customer' | 'location'; id: string; name: string } | null>(null);
  // Cascade Modal (after inline rate edit)
  const [showCascadeModal, setShowCascadeModal] = useState(false);
  const [cascadeData, setCascadeData] = useState<{
    entityType: 'customer' | 'location';
    entityId: string;
    entityName: string;
    newRate: number;
    hasCustomChildren: boolean;
    childrenCount: { locations?: number; sublocations: number };
  } | null>(null);
  const [cascadeOption, setCascadeOption] = useState<'none' | 'locations' | 'sublocations' | 'both'>('none');

  // Progress Modal
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progress, setProgress] = useState<{
    total: number;
    completed: number;
    currentEntity: string;
    results: any[];
  }>({ total: 0, completed: 0, currentEntity: '', results: [] });
  
  // Rate History
  const [showHistory, setShowHistory] = useState(false);
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
  const [historyEntity, setHistoryEntity] = useState<{ type: string; id: string; name: string } | null>(null);
  
  // Smart Suggestions
  const [areaStats, setAreaStats] = useState<Map<string, AreaStats>>(new Map());
  const [showSuggestions, setShowSuggestions] = useState(true);

  useEffect(() => {
    fetchHierarchy();
    fetchAreaStats();
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

      const hierarchyData: HierarchyNode[] = customers.map(customer => ({
        customer,
        locations: locations
          .filter(loc => loc.customerId === customer._id)
          .map(location => ({
            location,
            sublocations: sublocations.filter(sub => sub.locationId === location._id)
          }))
      }));

      setHierarchy(hierarchyData);
    } catch (error) {
      console.error('Failed to fetch hierarchy:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAreaStats = async () => {
    try {
      const response = await fetch('/api/pricing/area-stats');
      const stats = await response.json();
      
      const statsMap = new Map<string, AreaStats>();
      stats.forEach((stat: any) => {
        const key = `${stat.city}-${stat.state}`;
        statsMap.set(key, {
          avgRate: stat.avgRate,
          minRate: stat.minRate,
          maxRate: stat.maxRate,
          sampleSize: stat.count
        });
      });
      
      setAreaStats(statsMap);
    } catch (error) {
      console.error('Failed to fetch area stats:', error);
    }
  };

  const fetchRateHistory = async (entityType: string, entityId: string, entityName: string) => {
    try {
      const response = await fetch(`/api/pricing/rate-history?entityType=${entityType}&entityId=${entityId}`);
      const history = await response.json();
      setRateHistory(history);
      setHistoryEntity({ type: entityType, id: entityId, name: entityName });
      setShowHistory(true);
    } catch (error) {
      console.error('Failed to fetch rate history:', error);
    }
  };

  const rollbackRate = async (historyId: string, entityType: string, entityId: string, oldRate: number) => {
    setSaving(entityId);
    try {
      await handleSaveRate(entityType as any, entityId, oldRate);
      await fetchRateHistory(entityType, entityId, historyEntity?.name || '');
    } catch (error) {
      console.error('Failed to rollback rate:', error);
    } finally {
      setSaving(null);
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
            filterStatus === 'enabled' ? sub.pricingEnabled : !sub.pricingEnabled
          )
        })).filter(locNode => locNode.sublocations.length > 0)
      })).filter(node => node.locations.length > 0);
    }

    setFilteredHierarchy(filtered);
  };

  const toggleCustomer = (customerId: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId);
    } else {
      newExpanded.add(customerId);
    }
    setExpandedCustomers(newExpanded);
  };

  const toggleLocation = (locationId: string) => {
    const newExpanded = new Set(expandedLocations);
    if (newExpanded.has(locationId)) {
      newExpanded.delete(locationId);
    } else {
      newExpanded.add(locationId);
    }
    setExpandedLocations(newExpanded);
  };

  const handleTogglePricing = async (subLocationId: string, currentStatus: boolean) => {
    setSaving(subLocationId);
    try {
      const response = await fetch(`/api/sublocations/${subLocationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricingEnabled: !currentStatus })
      });

      if (response.ok) {
        await fetchHierarchy();
      }
    } catch (error) {
      console.error('Failed to toggle pricing:', error);
    } finally {
      setSaving(null);
    }
  };

  const checkForCustomRates = (
    entityType: 'customer' | 'location',
    entityId: string
  ): { hasCustom: boolean; counts: { locations?: number; sublocations: number } } => {
    if (entityType === 'customer') {
      const node = hierarchy.find(n => n.customer._id === entityId);
      if (!node) return { hasCustom: false, counts: { sublocations: 0 } };

      let hasCustom = false;
      let locationCount = 0;
      let sublocationCount = 0;

      node.locations.forEach(locNode => {
        if (locNode.location.defaultHourlyRate) hasCustom = true;
        locationCount++;

        locNode.sublocations.forEach(sub => {
          if (sub.defaultHourlyRate) hasCustom = true;
          sublocationCount++;
        });
      });

      return { 
        hasCustom, 
        counts: { locations: locationCount, sublocations: sublocationCount } 
      };
    } else {
      // Location level
      const node = hierarchy.find(n => 
        n.locations.some(l => l.location._id === entityId)
      );
      if (!node) return { hasCustom: false, counts: { sublocations: 0 } };

      const locNode = node.locations.find(l => l.location._id === entityId);
      if (!locNode) return { hasCustom: false, counts: { sublocations: 0 } };

      const hasCustom = locNode.sublocations.some(sub => sub.defaultHourlyRate !== undefined);
      
      return { 
        hasCustom, 
        counts: { sublocations: locNode.sublocations.length } 
      };
    }
  };  

  const handleSaveRate = async (
    entityType: 'customer' | 'location' | 'sublocation',
    entityId: string,
    rate: number
  ) => {
    setSaving(entityId);
    try {
      let endpoint = '';
      if (entityType === 'customer') endpoint = `/api/customers/${entityId}`;
      if (entityType === 'location') endpoint = `/api/locations/${entityId}`;
      if (entityType === 'sublocation') endpoint = `/api/sublocations/${entityId}`;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultHourlyRate: rate })
      });

      if (response.ok) {
        await fetchHierarchy();
        
        const newRates = new Map(editingRates);
        newRates.delete(entityId);
        setEditingRates(newRates);

        // Smart Cascade Logic (Option C)
        if (entityType === 'customer' || entityType === 'location') {
          const { hasCustom, counts } = checkForCustomRates(entityType, entityId);
          
          // Get entity name
          let entityName = '';
          if (entityType === 'customer') {
            const node = hierarchy.find(n => n.customer._id === entityId);
            entityName = node?.customer.name || '';
          } else {
            const node = hierarchy.find(n => 
              n.locations.some(l => l.location._id === entityId)
            );
            const locNode = node?.locations.find(l => l.location._id === entityId);
            entityName = locNode?.location.name || '';
          }

          // Around line 410-440
          if (hasCustom) {
            // Children have custom rates - ASK user
            setCascadeData({
              entityType,
              entityId,
              entityName,
              newRate: rate,
              hasCustomChildren: true,
              childrenCount: counts
            });
            setShowCascadeModal(true);
          } else {
            // All children inherit - AUTO CASCADE SILENTLY
            console.log('✨ Auto-cascading (no custom rates)');
            
            // Don't show progress modal for auto-cascade, just do it silently
            await executeQuietCascade(entityType, entityId, rate, 'both');
          }
        }
      }
    } catch (error) {
      console.error('Failed to save rate:', error);
    } finally {
      setSaving(null);
    }
  };

  const executeCascade = async (
    entityType: 'customer' | 'location',
    entityId: string,
    rate: number,
    option: 'none' | 'locations' | 'sublocations' | 'both'
  ) => {
    if (option === 'none') return;

    // Show progress modal
    setShowProgressModal(true);
    setProgress({ total: 0, completed: 0, currentEntity: 'Starting...', results: [] });

    try {
      // Calculate total operations
      let total = 0;
      if (entityType === 'customer') {
        const node = hierarchy.find(n => n.customer._id === entityId);
        if (node) {
          if (option === 'locations' || option === 'both') total += node.locations.length;
          if (option === 'sublocations' || option === 'both') {
            total += node.locations.reduce((sum, l) => sum + l.sublocations.length, 0);
          }
        }
      } else {
        const node = hierarchy.find(n => n.locations.some(l => l.location._id === entityId));
        const locNode = node?.locations.find(l => l.location._id === entityId);
        if (locNode) {
          total = locNode.sublocations.length;
        }
      }

      setProgress(prev => ({ ...prev, total }));

      // Execute cascade with progress updates
      const results: any[] = [];
      let completed = 0;

      if (entityType === 'customer') {
        const node = hierarchy.find(n => n.customer._id === entityId);
        if (!node) return;

        for (const locNode of node.locations) {
          // Update location if requested
          if (option === 'locations' || option === 'both') {
            setProgress(prev => ({ ...prev, currentEntity: `Location: ${locNode.location.name}` }));
            
            await fetch(`/api/locations/${locNode.location._id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ defaultHourlyRate: rate })
            });
            
            results.push({ type: 'location', name: locNode.location.name });
            completed++;
            setProgress(prev => ({ ...prev, completed, results }));
            
            // Small delay for visual feedback
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Update sublocations if requested
          if (option === 'sublocations' || option === 'both') {
            for (const sublocation of locNode.sublocations) {
              setProgress(prev => ({ ...prev, currentEntity: `SubLocation: ${sublocation.label}` }));
              
              await fetch(`/api/sublocations/${sublocation._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultHourlyRate: rate })
              });
              
              results.push({ type: 'sublocation', name: sublocation.label });
              completed++;
              setProgress(prev => ({ ...prev, completed, results }));
              
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }
      } else {
        // Location level
        const node = hierarchy.find(n => n.locations.some(l => l.location._id === entityId));
        const locNode = node?.locations.find(l => l.location._id === entityId);
        
        if (locNode) {
          for (const sublocation of locNode.sublocations) {
            setProgress(prev => ({ ...prev, currentEntity: `SubLocation: ${sublocation.label}` }));
            
            await fetch(`/api/sublocations/${sublocation._id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ defaultHourlyRate: rate })
            });
            
            results.push({ type: 'sublocation', name: sublocation.label });
            completed++;
            setProgress(prev => ({ ...prev, completed, results }));
            
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      // Refresh hierarchy
      await fetchHierarchy();
      
      // Show completion for a moment
      // setTimeout(() => {
      //   setShowProgressModal(false);
      //   setProgress({ total: 0, completed: 0, currentEntity: '', results: [] });
      // }, 1500);

    } catch (error) {
      console.error('Cascade failed:', error);
      setShowProgressModal(false);
    }
  };  


  const executeQuietCascade = async (
    entityType: 'customer' | 'location',
    entityId: string,
    rate: number,
    option: 'none' | 'locations' | 'sublocations' | 'both'
  ) => {
    if (option === 'none') return;

    try {
      // Execute cascade WITHOUT showing progress modal
      if (entityType === 'customer') {
        const node = hierarchy.find(n => n.customer._id === entityId);
        if (!node) return;

        for (const locNode of node.locations) {
          // Update location if requested
          if (option === 'locations' || option === 'both') {
            await fetch(`/api/locations/${locNode.location._id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ defaultHourlyRate: rate })
            });
          }

          // Update sublocations if requested
          if (option === 'sublocations' || option === 'both') {
            for (const sublocation of locNode.sublocations) {
              await fetch(`/api/sublocations/${sublocation._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultHourlyRate: rate })
              });
            }
          }
        }
      } else {
        // Location level
        const node = hierarchy.find(n => n.locations.some(l => l.location._id === entityId));
        const locNode = node?.locations.find(l => l.location._id === entityId);
        
        if (locNode) {
          for (const sublocation of locNode.sublocations) {
            await fetch(`/api/sublocations/${sublocation._id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ defaultHourlyRate: rate })
            });
          }
        }
      }

      // Refresh hierarchy after quiet cascade
      await fetchHierarchy();
      
    } catch (error) {
      console.error('Quiet cascade failed:', error);
    }
  };

  // Bulk Operations
  const openBulkModal = (
    operation: 'apply' | 'reset' | 'enable' | 'disable',
    entityType: 'customer' | 'location',
    entityId: string,
    entityName: string
  ) => {
    setBulkOperation(operation);
    setSelectedEntity({ type: entityType, id: entityId, name: entityName });
    setShowBulkModal(true);
  };

  const executeBulkOperation = async () => {
    if (!selectedEntity || !bulkOperation) return;

    // Show progress modal
    setShowProgressModal(true);
    setSaving(selectedEntity.id);

    try {
      const response = await fetch('/api/pricing/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: bulkOperation,
          entityType: selectedEntity.type,
          entityId: selectedEntity.id,
          rate: bulkRate
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Show results in progress modal
        setProgress({
          total: data.affectedCount,
          completed: data.affectedCount,
          currentEntity: 'Completed!',
          results: data.results
        });

        await fetchHierarchy();
        
        // Close bulk modal but keep progress modal open
        setShowBulkModal(false);
        setBulkOperation(null);
        setSelectedEntity(null);
        setBulkRate(0);
      } else {
        throw new Error(data.error || 'Bulk operation failed');
      }
    } catch (error) {
      console.error('Failed to execute bulk operation:', error);
      setShowProgressModal(false);
      alert('Failed to execute operation. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  // Enable/Disable at Customer/Location level
  const togglePricingForAll = async (
    entityType: 'customer' | 'location',
    entityId: string,
    enable: boolean
  ) => {
    openBulkModal(enable ? 'enable' : 'disable', entityType, entityId, '');
  };

  const getEffectiveRate = (
    sublocation: SubLocation,
    location: Location,
    customer: Customer
  ): { rate: number; source: 'sublocation' | 'location' | 'customer' | 'none'; isOverride: boolean } => {
    if (sublocation.defaultHourlyRate && sublocation.defaultHourlyRate > 0) {
      return { rate: sublocation.defaultHourlyRate, source: 'sublocation', isOverride: true };
    }
    if (location.defaultHourlyRate && location.defaultHourlyRate > 0) {
      return { rate: location.defaultHourlyRate, source: 'location', isOverride: false };
    }
    if (customer.defaultHourlyRate && customer.defaultHourlyRate > 0) {
      return { rate: customer.defaultHourlyRate, source: 'customer', isOverride: false };
    }
    return { rate: 0, source: 'none', isOverride: false };
  };

  const getAreaSuggestion = (city: string, state?: string): AreaStats | null => {
    const key = `${city}-${state || ''}`;
    return areaStats.get(key) || null;
  };

  const startEditingRate = (entityId: string, currentRate?: number) => {
    const newRates = new Map(editingRates);
    newRates.set(entityId, currentRate || 0);
    setEditingRates(newRates);
  };

  const cancelEditingRate = (entityId: string) => {
    const newRates = new Map(editingRates);
    newRates.delete(entityId);
    setEditingRates(newRates);
  };

  const updateEditingRate = (entityId: string, value: number) => {
    const newRates = new Map(editingRates);
    newRates.set(entityId, value);
    setEditingRates(newRates);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading pricing hierarchy...</p>
        </div>
      </div>
    );
  }

  const totalSublocations = hierarchy.reduce((sum, h) => 
    sum + h.locations.reduce((locSum, l) => locSum + l.sublocations.length, 0), 0
  );
  const enabledSublocations = hierarchy.reduce((sum, h) => 
    sum + h.locations.reduce((locSum, l) => locSum + l.sublocations.filter(s => s.pricingEnabled).length, 0), 0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl shadow-2xl p-8 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Hierarchical Pricing Settings</h1>
              <p className="text-indigo-100 text-lg">
                Manage pricing cascade with bulk operations & smart suggestions
              </p>
            </div>
            <div className="flex gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="text-sm text-indigo-100 mb-1">Total</div>
                <div className="text-3xl font-bold">{totalSublocations}</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                <div className="text-sm text-indigo-100 mb-1">Enabled</div>
                <div className="text-3xl font-bold">{enabledSublocations}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers, locations, or sublocations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                showFilters 
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700' 
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                showSuggestions 
                  ? 'bg-yellow-50 border-yellow-300 text-yellow-700' 
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              <Lightbulb className="w-5 h-5" />
              Suggestions
            </button>
          </div>

          {showFilters && (
            <div className="flex gap-2 pt-4 border-t">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filterStatus === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({totalSublocations})
              </button>
              <button
                onClick={() => setFilterStatus('enabled')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filterStatus === 'enabled'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Enabled ({enabledSublocations})
              </button>
              <button
                onClick={() => setFilterStatus('disabled')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filterStatus === 'disabled'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Disabled ({totalSublocations - enabledSublocations})
              </button>
            </div>
          )}
        </div>

        {/* Pricing Legend */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-indigo-600" />
            How Pricing Cascade Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-800">Customer Level</div>
                <div className="text-sm text-gray-600">Base rate for all locations</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-800">Location Level</div>
                <div className="text-sm text-gray-600">Overrides customer rate</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-800">SubLocation Level</div>
                <div className="text-sm text-gray-600">Highest priority override</div>
              </div>
            </div>
          </div>
        </div>

        {/* Hierarchy Tree */}
        <div className="space-y-4">
          {filteredHierarchy.map(node => {
            const isCustomerExpanded = expandedCustomers.has(node.customer._id);
            const totalSublocationsForCustomer = node.locations.reduce((sum, l) => sum + l.sublocations.length, 0);
            const enabledSublocationsForCustomer = node.locations.reduce(
              (sum, l) => sum + l.sublocations.filter(s => s.pricingEnabled).length, 
              0
            );

            return (
              <div key={node.customer._id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                {/* Customer Level */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div 
                      className="flex items-center gap-4 cursor-pointer flex-1"
                      onClick={() => toggleCustomer(node.customer._id)}
                    >
                      {isCustomerExpanded ? (
                        <ChevronDown className="w-6 h-6 text-indigo-600" />
                      ) : (
                        <ChevronRight className="w-6 h-6 text-indigo-600" />
                      )}
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                        {node.customer.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">{node.customer.name}</h3>
                        <p className="text-sm text-gray-600">
                          {node.locations.length} locations • {totalSublocationsForCustomer} sublocations • {enabledSublocationsForCustomer} enabled
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Customer Rate Editor */}
                      {editingRates.has(node.customer._id) ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-white rounded-lg shadow-sm border-2 border-indigo-300 px-3 py-2">
                            <span className="text-gray-600 mr-2">$</span>
                            <input
                              type="number"
                              value={editingRates.get(node.customer._id)}
                              onChange={(e) => updateEditingRate(node.customer._id, parseFloat(e.target.value) || 0)}
                              className="w-20 outline-none text-gray-900 font-semibold"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-gray-500 ml-2">/hr</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveRate('customer', node.customer._id, editingRates.get(node.customer._id)!);
                            }}
                            disabled={saving === node.customer._id}
                            className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelEditingRate(node.customer._id);
                            }}
                            className="p-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingRate(node.customer._id, node.customer.defaultHourlyRate);
                            }}
                            className="flex items-center gap-2 bg-white hover:bg-indigo-50 px-4 py-2 rounded-lg shadow-sm border border-indigo-200 transition-colors"
                          >
                            <DollarSign className="w-5 h-5 text-indigo-600" />
                            <span className="font-semibold text-gray-800">
                              {node.customer.defaultHourlyRate ? `$${node.customer.defaultHourlyRate}/hr` : 'Set Rate'}
                            </span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              fetchRateHistory('customer', node.customer._id, node.customer.name);
                            }}
                            className="p-2 bg-white hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 transition-colors"
                            title="View rate history"
                          >
                            <History className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Customer Level Bulk Actions */}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-indigo-200">
                    <button
                      onClick={() => openBulkModal('apply', 'customer', node.customer._id, node.customer.name)}
                      className="flex items-center gap-2 px-3 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      Apply Rate to All
                    </button>
                    <button
                      onClick={() => openBulkModal('reset', 'customer', node.customer._id, node.customer.name)}
                      className="flex items-center gap-2 px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reset to Inherit
                    </button>
                    {/* Conditionally show Enable or Disable based on current status */}
                    {enabledSublocationsForCustomer < totalSublocationsForCustomer && (
                      <button
                        onClick={() => togglePricingForAll('customer', node.customer._id, true)}
                        className="flex items-center gap-2 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Enable All ({totalSublocationsForCustomer - enabledSublocationsForCustomer} disabled)
                      </button>
                    )}
                    {enabledSublocationsForCustomer > 0 && (
                      <button
                        onClick={() => togglePricingForAll('customer', node.customer._id, false)}
                        className="flex items-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        <EyeOff className="w-4 h-4" />
                        Disable All ({enabledSublocationsForCustomer} enabled)
                      </button>
                    )}
                  </div>
                </div>

                {/* Locations */}
                {isCustomerExpanded && (
                  <div className="bg-gray-50 p-4">
                    {node.locations.map(locNode => {
                      const isLocationExpanded = expandedLocations.has(locNode.location._id);
                      const enabledCount = locNode.sublocations.filter(s => s.pricingEnabled).length;
                      const areaSuggestion = getAreaSuggestion(locNode.location.city, locNode.location.state);

                      return (
                        <div key={locNode.location._id} className="mb-4 last:mb-0">
                          {/* Location Level */}
                          <div className="bg-white rounded-lg shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                              <div 
                                className="flex items-center gap-3 cursor-pointer flex-1"
                                onClick={() => toggleLocation(locNode.location._id)}
                              >
                                {isLocationExpanded ? (
                                  <ChevronDown className="w-5 h-5 text-green-600" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-green-600" />
                                )}
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
                                  <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-gray-800">{locNode.location.name}</h4>
                                  <p className="text-sm text-gray-600">
                                    {locNode.location.city} • {locNode.sublocations.length} sublocations • {enabledCount} enabled
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Location Rate Editor */}
                                {editingRates.has(locNode.location._id) ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center bg-white rounded-lg shadow-sm border-2 border-green-300 px-3 py-2">
                                      <span className="text-gray-600 mr-2">$</span>
                                      <input
                                        type="number"
                                        value={editingRates.get(locNode.location._id)}
                                        onChange={(e) => updateEditingRate(locNode.location._id, parseFloat(e.target.value) || 0)}
                                        className="w-20 outline-none text-gray-900 font-semibold"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <span className="text-gray-500 ml-2">/hr</span>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveRate('location', locNode.location._id, editingRates.get(locNode.location._id)!);
                                      }}
                                      disabled={saving === locNode.location._id}
                                      className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        cancelEditingRate(locNode.location._id);
                                      }}
                                      className="p-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex flex-col items-end">
                                      {locNode.location.defaultHourlyRate ? (
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded mb-1">
                                          Overrides customer rate
                                        </span>
                                      ) : (
                                        <span className="text-xs text-gray-500 bg-yellow-50 px-2 py-1 rounded mb-1">
                                          Inherits: ${node.customer.defaultHourlyRate || 0}/hr
                                        </span>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEditingRate(locNode.location._id, locNode.location.defaultHourlyRate);
                                        }}
                                        className="flex items-center gap-2 bg-white hover:bg-green-50 px-3 py-2 rounded-lg shadow-sm border border-green-200 transition-colors"
                                      >
                                        <DollarSign className="w-4 h-4 text-green-600" />
                                        <span className="font-semibold text-gray-800 text-sm">
                                          {locNode.location.defaultHourlyRate ? `$${locNode.location.defaultHourlyRate}/hr` : 'Set Rate'}
                                        </span>
                                      </button>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        fetchRateHistory('location', locNode.location._id, locNode.location.name);
                                      }}
                                      className="p-2 bg-white hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 transition-colors"
                                      title="View rate history"
                                    >
                                      <History className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Smart Suggestions for Location */}
                            {showSuggestions && areaSuggestion && (
                              <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                                <div className="flex items-start gap-2">
                                  <Lightbulb className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-sm font-semibold text-yellow-900">
                                      Smart Suggestion for {locNode.location.city}
                                    </p>
                                    <p className="text-xs text-yellow-700 mt-1">
                                      Avg rate in area: <strong>${areaSuggestion.avgRate.toFixed(0)}/hr</strong> | 
                                      Range: ${areaSuggestion.minRate}-${areaSuggestion.maxRate}/hr 
                                      ({areaSuggestion.sampleSize} venues)
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Location Level Bulk Actions */}
                            <div className="flex gap-2 pt-3 border-t border-gray-200">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openBulkModal('apply', 'location', locNode.location._id, locNode.location.name);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-xs font-medium transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                Apply to Sublocations
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openBulkModal('reset', 'location', locNode.location._id, locNode.location.name);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-xs font-medium transition-colors"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Reset Sublocations
                              </button>
                              {/* Location Level Enable/Disable */}
                              {enabledCount < locNode.sublocations.length && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePricingForAll('location', locNode.location._id, true);
                                  }}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-medium transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Enable All ({locNode.sublocations.length - enabledCount})
                                </button>
                              )}
                              {enabledCount > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePricingForAll('location', locNode.location._id, false);
                                  }}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                                >
                                  <EyeOff className="w-3.5 h-3.5" />
                                  Disable All ({enabledCount})
                                </button>
                              )}
                            </div>
                          </div>

                          {/* SubLocations */}
                          {isLocationExpanded && (
                            <div className="ml-12 mt-3 space-y-3">
                              {locNode.sublocations.map(sublocation => {
                                const effectiveRate = getEffectiveRate(sublocation, locNode.location, node.customer);

                                return (
                                  <div 
                                    key={sublocation._id}
                                    className={`bg-white rounded-lg shadow-sm p-4 border-2 transition-all ${
                                      sublocation.pricingEnabled 
                                        ? 'border-purple-300 bg-purple-50/30' 
                                        : 'border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 flex-1">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white">
                                          <Layers className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <h5 className="font-bold text-gray-800">{sublocation.label}</h5>
                                            {sublocation.pricingEnabled && (
                                              <span className="px-2 py-0.5 bg-purple-500 text-white text-xs font-semibold rounded-full">
                                                ENABLED
                                              </span>
                                            )}
                                          </div>
                                          {sublocation.description && (
                                            <p className="text-sm text-gray-600">{sublocation.description}</p>
                                          )}
                                          {sublocation.allocatedCapacity && (
                                            <p className="text-xs text-gray-500 mt-1">
                                              Capacity: {sublocation.allocatedCapacity}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3">
                                        {/* Rate Display/Editor */}
                                        <div className="text-right mr-4">
                                          {editingRates.has(sublocation._id) ? (
                                            <div className="flex items-center gap-2">
                                              <div className="flex items-center bg-white rounded-lg shadow-sm border-2 border-purple-300 px-3 py-2">
                                                <span className="text-gray-600 mr-2">$</span>
                                                <input
                                                  type="number"
                                                  value={editingRates.get(sublocation._id)}
                                                  onChange={(e) => updateEditingRate(sublocation._id, parseFloat(e.target.value) || 0)}
                                                  className="w-20 outline-none text-gray-900 font-semibold"
                                                />
                                                <span className="text-gray-500 ml-2">/hr</span>
                                              </div>
                                              <button
                                                onClick={() => handleSaveRate('sublocation', sublocation._id, editingRates.get(sublocation._id)!)}
                                                disabled={saving === sublocation._id}
                                                className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors disabled:opacity-50"
                                              >
                                                <Check className="w-4 h-4" />
                                              </button>
                                              <button
                                                onClick={() => cancelEditingRate(sublocation._id)}
                                                className="p-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                                              >
                                                <X className="w-4 h-4" />
                                              </button>
                                            </div>
                                          ) : (
                                            <>
                                              <div className="text-sm text-gray-600 mb-1">
                                                {effectiveRate.isOverride ? (
                                                  <span className="text-purple-600 font-semibold">✓ Override Rate</span>
                                                ) : (
                                                  <span className="text-gray-500">
                                                    Inherited from {effectiveRate.source}
                                                  </span>
                                                )}
                                              </div>
                                              <button
                                                onClick={() => startEditingRate(sublocation._id, sublocation.defaultHourlyRate)}
                                                className="flex items-center gap-2 bg-white hover:bg-purple-50 px-3 py-2 rounded-lg shadow-sm border border-purple-200 transition-colors"
                                              >
                                                <span className="text-2xl font-bold text-gray-900">
                                                  ${effectiveRate.rate}
                                                </span>
                                                <span className="text-sm text-gray-500">/hr</span>
                                              </button>
                                            </>
                                          )}
                                        </div>

                                        {/* History Button */}
                                        <button
                                          onClick={() => fetchRateHistory('sublocation', sublocation._id, sublocation.label)}
                                          className="p-2 bg-white hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 transition-colors"
                                          title="View rate history"
                                        >
                                          <History className="w-4 h-4" />
                                        </button>

                                        {/* Enable/Disable Toggle */}
                                        <button
                                          onClick={() => handleTogglePricing(sublocation._id, sublocation.pricingEnabled)}
                                          disabled={saving === sublocation._id}
                                          className={`px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 ${
                                            sublocation.pricingEnabled
                                              ? 'bg-red-500 hover:bg-red-600 text-white'
                                              : 'bg-purple-500 hover:bg-purple-600 text-white'
                                          }`}
                                        >
                                          {saving === sublocation._id ? (
                                            <span className="flex items-center gap-2">
                                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                              Saving...
                                            </span>
                                          ) : sublocation.pricingEnabled ? (
                                            'Disable'
                                          ) : (
                                            'Enable'
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Smart Cascade Modal */}
        {showCascadeModal && cascadeData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Zap className="w-6 h-6 text-yellow-500" />
                Apply to Children?
              </h3>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-green-900">
                  ✅ <strong>{cascadeData.entityName}</strong> rate updated to <strong>${cascadeData.newRate}/hr</strong>
                </p>
              </div>

              {cascadeData.hasCustomChildren && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded p-3 mb-4">
                  <p className="text-sm text-yellow-900">
                    ⚠️ Some children have custom rates. What would you like to do?
                  </p>
                </div>
              )}

              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                  <input
                    type="radio"
                    name="cascade"
                    value="none"
                    checked={cascadeOption === 'none'}
                    onChange={(e) => setCascadeOption(e.target.value as any)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">Keep existing rates</div>
                    <div className="text-sm text-gray-600">No changes to children</div>
                  </div>
                </label>

                {cascadeData.childrenCount.locations !== undefined && (
                  <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                    <input
                      type="radio"
                      name="cascade"
                      value="locations"
                      checked={cascadeOption === 'locations'}
                      onChange={(e) => setCascadeOption(e.target.value as any)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        Apply to locations only
                      </div>
                      <div className="text-sm text-gray-600">
                        Update {cascadeData.childrenCount.locations} locations
                      </div>
                    </div>
                  </label>
                )}

                <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                  <input
                    type="radio"
                    name="cascade"
                    value="sublocations"
                    checked={cascadeOption === 'sublocations'}
                    onChange={(e) => setCascadeOption(e.target.value as any)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      Apply to sublocations only
                    </div>
                    <div className="text-sm text-gray-600">
                      Update {cascadeData.childrenCount.sublocations} sublocations
                    </div>
                  </div>
                </label>

                {cascadeData.childrenCount.locations !== undefined && (
                  <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors">
                    <input
                      type="radio"
                      name="cascade"
                      value="both"
                      checked={cascadeOption === 'both'}
                      onChange={(e) => setCascadeOption(e.target.value as any)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        Apply to all
                      </div>
                      <div className="text-sm text-gray-600">
                        Update {cascadeData.childrenCount.locations} locations + {cascadeData.childrenCount.sublocations} sublocations
                      </div>
                    </div>
                  </label>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCascadeModal(false);
                    setCascadeData(null);
                    setCascadeOption('none');
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={async () => {
                    setShowCascadeModal(false);
                    await executeCascade(
                      cascadeData.entityType,
                      cascadeData.entityId,
                      cascadeData.newRate,
                      cascadeOption
                    );
                    setCascadeData(null);
                    setCascadeOption('none');
                  }}
                  disabled={cascadeOption === 'none'}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cascadeOption === 'none' ? 'Select Option' : 'Apply'}
                </button>
              </div>
            </div>
          </div>
        )}       

        {/* Progress Modal */}
        {showProgressModal && (
          <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4"
            onClick={(e) => {
              // Close on backdrop click
              if (e.target === e.currentTarget) {
                setShowProgressModal(false);
                setProgress({ total: 0, completed: 0, currentEntity: '', results: [] });
              }
            }}
            onKeyDown={(e) => {
              // Close on ESC key
              if (e.key === 'Escape') {
                setShowProgressModal(false);
                setProgress({ total: 0, completed: 0, currentEntity: '', results: [] });
              }
            }}
            tabIndex={-1}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  {progress.completed === progress.total ? (
                    <>
                      <Check className="w-6 h-6 text-green-500" />
                      Completed!
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
                      Updating Rates...
                    </>
                  )}
                </h3>
                
                {/* Close Button */}
                <button
                  onClick={() => {
                    setShowProgressModal(false);
                    setProgress({ total: 0, completed: 0, currentEntity: '', results: [] });
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Close (ESC)"
                >
                  <X className="w-6 h-6 text-gray-600" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>{progress.currentEntity}</span>
                  <span>{progress.completed} / {progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300 ease-out"
                    style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Results List */}
              <div className="max-h-64 overflow-y-auto space-y-2">
                {progress.results.map((result, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded"
                  >
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-gray-600">{result.type}:</span>
                    <span className="font-medium text-gray-900 truncate">{result.name}</span>
                    {result.oldRate !== undefined && (
                      <span className="text-gray-500 text-xs ml-auto">
                        ${result.oldRate || 0} → ${result.newRate}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {progress.completed === progress.total && (
                <div className="mt-4">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
                    <p className="text-sm text-green-900 text-center font-semibold">
                      ✅ Successfully updated {progress.total} {progress.total === 1 ? 'entity' : 'entities'}
                    </p>
                  </div>
                  
                  {/* Close Button when complete */}
                  <button
                    onClick={() => {
                      setShowProgressModal(false);
                      setProgress({ total: 0, completed: 0, currentEntity: '', results: [] });
                    }}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bulk Operations Modal */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[50] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {bulkOperation === 'apply' && '💵 Apply Rate to All Sublocations'}
                {bulkOperation === 'reset' && '🔄 Reset All to Inherit'}
                {bulkOperation === 'enable' && '✅ Enable All Sublocations'}
                {bulkOperation === 'disable' && '❌ Disable All Sublocations'}
              </h3>

              {bulkOperation === 'apply' && (
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    New Rate (per hour)
                  </label>
                  <div className="flex items-center bg-gray-50 rounded-lg border-2 border-gray-200 px-4 py-3">
                    <span className="text-gray-600 mr-2 text-lg">$</span>
                    <input
                      type="number"
                      value={bulkRate}
                      onChange={(e) => setBulkRate(parseFloat(e.target.value) || 0)}
                      className="flex-1 bg-transparent outline-none text-gray-900 font-semibold text-lg"
                      placeholder="0.00"
                    />
                    <span className="text-gray-500 ml-2">/hr</span>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">
                  This will update:
                </p>
                <ul className="text-sm text-blue-800 space-y-1">
                  {bulkOperation === 'apply' && (
                    <>
                      <li>✓ {selectedEntity?.type === 'customer' ? 'Customer' : 'Location'}: ${bulkRate}/hr</li>
                      {selectedEntity?.type === 'customer' && (
                        <>
                          <li>✓ All locations under this customer</li>
                          <li>✓ All sublocations (across all locations)</li>
                        </>
                      )}
                      {selectedEntity?.type === 'location' && (
                        <>
                          <li>✓ This location</li>
                          <li>✓ All sublocations in this location</li>
                        </>
                      )}
                    </>
                  )}
                  {bulkOperation === 'reset' && (
                    <>
                      <li>✓ Remove all custom rates</li>
                      <li>✓ All children will inherit from parents</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={executeBulkOperation}
                  disabled={bulkOperation === 'apply' && bulkRate <= 0}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkOperation === 'apply' && 'Apply Rate'}
                  {bulkOperation === 'reset' && 'Reset All'}
                  {bulkOperation === 'enable' && 'Enable All'}
                  {bulkOperation === 'disable' && 'Disable All'}
                </button>
                <button
                  onClick={() => {
                    setShowBulkModal(false);
                    setBulkOperation(null);
                    setSelectedEntity(null);
                    setBulkRate(0);
                  }}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rate History Modal */}
        {showHistory && historyEntity && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Rate History</h3>
                    <p className="text-sm text-gray-600 mt-1">{historyEntity.name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowHistory(false);
                      setHistoryEntity(null);
                      setRateHistory([]);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {rateHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No rate history available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {rateHistory.map((entry, index) => (
                      <div 
                        key={entry._id}
                        className="bg-gray-50 rounded-lg p-4 border-l-4 border-indigo-400"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {entry.oldRate !== undefined ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 line-through">
                                    ${entry.oldRate}/hr
                                  </span>
                                  <ArrowLeft className="w-4 h-4 text-gray-400 rotate-180" />
                                  <span className="text-gray-900 font-bold">
                                    ${entry.newRate}/hr
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-900 font-bold">
                                  ${entry.newRate}/hr
                                </span>
                              )}
                              {index === 0 && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              {new Date(entry.changedAt).toLocaleString()}
                            </p>
                            {entry.reason && (
                              <p className="text-xs text-gray-500 mt-1 italic">
                                "{entry.reason}"
                              </p>
                            )}
                          </div>
                          {index > 0 && entry.oldRate !== undefined && (
                            <button
                              onClick={() => rollbackRate(entry._id, historyEntity.type, historyEntity.id, entry.oldRate!)}
                              disabled={saving === historyEntity.id}
                              className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              Rollback
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
