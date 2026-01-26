'use client';

import { useState, useEffect } from 'react';
import { Power, Trash2, Edit, Plus, ChevronDown, ChevronUp, Clock, DollarSign } from 'lucide-react';
import CreateRateSheetModal from '@/components/CreateRateSheetModal';
import EditRateSheetModal from '@/components/EditRateSheetModal';
import { PriorityConfig } from '@/models/types';

interface TimeWindow {
  startTime: string;
  endTime: string;
  pricePerHour: number;
}

interface DurationRule {
  durationHours: number;
  totalPrice: number;
  description: string;
}

interface Ratesheet {
  _id: string;
  subLocationId?: string;
  locationId?: string;
  customerId?: string;
  eventId?: string;
  name: string;
  description?: string;
  type: 'TIMING_BASED' | 'DURATION_BASED';
  priority: number;
  conflictResolution: 'PRIORITY' | 'HIGHEST_PRICE' | 'LOWEST_PRICE';
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  timeWindows?: TimeWindow[];
  durationRules?: DurationRule[];
  customer?: { _id: string; name: string };
  location?: { _id: string; name: string; city: string };
  sublocation?: { _id: string; label: string };
  event?: { _id: string; name: string; startDate: string; endDate: string };
  ratesheetType?: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
}

export default function AdminPricingPage() {
  const [priorityConfigs, setPriorityConfigs] = useState<PriorityConfig[]>([]);
  const [ratesheets, setRatesheets] = useState<Ratesheet[]>([]);
  const [filteredRatesheets, setFilteredRatesheets] = useState<Ratesheet[]>([]);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRatesheet, setSelectedRatesheet] = useState<Ratesheet | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT'>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterRatesheets();
  }, [activeFilter, ratesheets]);

  const loadData = async () => {
    setLoading(true);
    try {
      const configRes = await fetch('/api/pricing/priority-config');
      if (configRes.ok) {
        const configs = await configRes.json();
        setPriorityConfigs(configs);
      }

      const rateRes = await fetch('/api/ratesheets?includeInactive=true');
      if (rateRes.ok) {
        const rates = await rateRes.json();
        setRatesheets(rates);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterRatesheets = () => {
    if (activeFilter === 'ALL') {
      setFilteredRatesheets(ratesheets);
    } else {
      setFilteredRatesheets(ratesheets.filter(r => r.ratesheetType === activeFilter));
    }
  };

  const toggleExpanded = (ratesheetId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(ratesheetId)) {
      newExpanded.delete(ratesheetId);
    } else {
      newExpanded.add(ratesheetId);
    }
    setExpandedCards(newExpanded);
  };

  const toggleActive = async (ratesheetId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/ratesheets/${ratesheetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) throw new Error('Failed to toggle status');
      await loadData();
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('Failed to toggle ratesheet status');
    }
  };

  const deleteRatesheet = async (ratesheetId: string, name: string) => {
    // Check if it's an auto-generated ratesheet
    if (name && name.startsWith('Auto-')) {
      alert('⚠️ Warning: This is an auto-generated ratesheet.\n\nIt is automatically managed and cannot be deleted directly.\n\nIt will be automatically deleted when the associated event is deleted.');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/ratesheets/${ratesheetId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete ratesheet');
      await loadData();
      alert('Ratesheet deleted successfully');
    } catch (error) {
      console.error('Error deleting ratesheet:', error);
      alert('Failed to delete ratesheet');
    }
  };

  const handleEdit = (ratesheet: Ratesheet) => {
    // Check if it's an auto-generated ratesheet
    if (ratesheet.name && ratesheet.name.startsWith('Auto-')) {
      alert('⚠️ Warning: This is an auto-generated ratesheet.\n\nIt is automatically managed from event settings and cannot be edited directly.\n\nTo modify this ratesheet, please edit the associated event instead.');
      return;
    }
    setSelectedRatesheet(ratesheet);
    setShowEditModal(true);
  };

  const getTypeColor = (type?: string) => {
    const config = priorityConfigs.find(c => c.level === type);
    return config?.color || '#6B7280';
  };

  const getTypeBadge = (type?: string) => {
    const colors = {
      CUSTOMER: 'bg-blue-100 text-blue-800 border-blue-300',
      LOCATION: 'bg-green-100 text-green-800 border-green-300',
      SUBLOCATION: 'bg-orange-100 text-orange-800 border-orange-300',
      EVENT: 'bg-pink-100 text-pink-800 border-pink-300',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getCounts = () => ({
    all: ratesheets.length,
    customer: ratesheets.filter(r => r.ratesheetType === 'CUSTOMER').length,
    location: ratesheets.filter(r => r.ratesheetType === 'LOCATION').length,
    sublocation: ratesheets.filter(r => r.ratesheetType === 'SUBLOCATION').length,
    event: ratesheets.filter(r => r.ratesheetType === 'EVENT').length,
  });

  const counts = getCounts();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading pricing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">Pricing Administration</h1>
              <p className="text-purple-100 text-lg">Manage ratesheets and priority configurations</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-white text-purple-600 px-6 py-3 rounded-xl font-semibold hover:bg-purple-50 transition-all shadow-lg flex items-center gap-2"
            >
              <Plus size={20} />
              Create Ratesheet
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Priority Ranges */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Priority Ranges</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {priorityConfigs.map((config) => (
              <div
                key={config._id?.toString()}
                className="bg-white rounded-xl p-6 shadow-lg border-l-4"
                style={{ borderColor: config.color }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-900">{config.level}</h3>
                  <div
                    className="px-3 py-1 rounded-full text-sm font-semibold"
                    style={{ backgroundColor: `${config.color}20`, color: config.color }}
                  >
                    {config.minPriority}-{config.maxPriority}
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  {config.description}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {config.enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-2 mb-6 flex gap-2">
          {[
            { key: 'ALL', label: 'All Ratesheets', count: counts.all },
            { key: 'CUSTOMER', label: 'Customer', count: counts.customer },
            { key: 'LOCATION', label: 'Location', count: counts.location },
            { key: 'SUBLOCATION', label: 'Sub-Location', count: counts.sublocation },
            { key: 'EVENT', label: 'Event', count: counts.event },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as any)}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
                activeFilter === tab.key
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white bg-opacity-20">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Ratesheets List */}
        {filteredRatesheets.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Ratesheets Found</h3>
            <p className="text-gray-600 mb-6">
              {activeFilter === 'ALL' 
                ? 'Create your first ratesheet to get started'
                : `No ${activeFilter.toLowerCase()} ratesheets found`}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all"
            >
              Create Ratesheet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredRatesheets.map((ratesheet) => {
              const isExpanded = expandedCards.has(ratesheet._id);
              
              return (
                <div
                  key={ratesheet._id}
                  className={`bg-white rounded-xl shadow-lg overflow-hidden border-l-4 transition-all hover:shadow-xl ${
                    !ratesheet.isActive ? 'opacity-60' : ''
                  }`}
                  style={{ borderColor: getTypeColor(ratesheet.ratesheetType) }}
                >
                  {/* Card Header */}
                  <div className="p-6 pb-4">
                    {/* Auto-generated warning banner */}
                    {ratesheet.name && ratesheet.name.startsWith('Auto-') && (
                      <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-amber-600 text-lg">⚠️</span>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-amber-800 mb-1">Auto-Generated Ratesheet</p>
                            <p className="text-xs text-amber-700">This ratesheet is automatically managed from event settings. Edit the event to modify it.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{ratesheet.name}</h3>
                        {ratesheet.description && (
                          <p className="text-sm text-gray-600">{ratesheet.description}</p>
                        )}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getTypeBadge(ratesheet.ratesheetType)}`}>
                        {ratesheet.ratesheetType}
                      </div>
                    </div>

                    {/* Entity Hierarchy */}
                    <div className="text-sm text-gray-600 mb-3">
                      {ratesheet.customer && (
                        <span className="font-medium text-blue-600">{ratesheet.customer.name}</span>
                      )}
                      {ratesheet.location && (
                        <>
                          <span className="mx-2">→</span>
                          <span className="font-medium text-green-600">
                            {ratesheet.location.name} ({ratesheet.location.city})
                          </span>
                        </>
                      )}
                      {ratesheet.sublocation && (
                        <>
                          <span className="mx-2">→</span>
                          <span className="font-medium text-orange-600">{ratesheet.sublocation.label}</span>
                        </>
                      )}
                      {ratesheet.event && (
                        <>
                          <span className="mx-2">→</span>
                          <span className="font-medium text-pink-600">
                            {ratesheet.event.name} ({new Date(ratesheet.event.startDate).toLocaleDateString()} - {new Date(ratesheet.event.endDate).toLocaleDateString()})
                          </span>
                        </>
                      )}
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-100 pt-4">
                      <div>
                        <span className="text-gray-500">Type:</span>
                        <p className="font-semibold text-gray-900">
                          {ratesheet.type === 'TIMING_BASED' ? '🕐 Time-Based' : '📅 Package'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Priority:</span>
                        <p className="font-semibold text-gray-900">{ratesheet.priority}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Effective From:</span>
                        <p className="font-semibold text-gray-900">
                          {new Date(ratesheet.effectiveFrom).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Effective To:</span>
                        <p className="font-semibold text-gray-900">
                          {ratesheet.effectiveTo
                            ? new Date(ratesheet.effectiveTo).toLocaleString()
                            : 'Indefinite'}
                        </p>
                      </div>
                    </div>

                    {/* Pricing Summary with Expand Button */}
                    <div className="mt-4">
                      <button
                        onClick={() => toggleExpanded(ratesheet._id)}
                        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg hover:from-blue-100 hover:to-purple-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {ratesheet.type === 'TIMING_BASED' ? (
                            <>
                              <Clock className="text-blue-600" size={18} />
                              <span className="text-sm font-semibold text-blue-900">
                                {ratesheet.timeWindows?.length || 0} Time Windows
                              </span>
                            </>
                          ) : (
                            <>
                              <DollarSign className="text-purple-600" size={18} />
                              <span className="text-sm font-semibold text-purple-900">
                                {ratesheet.durationRules?.length || 0} Packages
                              </span>
                            </>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="text-gray-600" size={18} />
                        ) : (
                          <ChevronDown className="text-gray-600" size={18} />
                        )}
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-3 space-y-2">
                          {ratesheet.type === 'TIMING_BASED' && ratesheet.timeWindows?.map((tw: any, idx) => (
                            <div key={idx} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                  <Clock className="text-blue-600" size={16} />
                                  <span className="font-semibold text-blue-900">
                                    {tw.windowType === 'DURATION_BASED' || tw.startMinute !== undefined
                                      ? `${tw.startMinute || 0}min - ${tw.endMinute || 0}min`
                                      : `${tw.startTime || '-'} - ${tw.endTime || '-'}`
                                    }
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold text-blue-900">
                                    ${tw.pricePerHour}<span className="text-sm font-normal">/hr</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          {ratesheet.type === 'DURATION_BASED' && ratesheet.durationRules?.map((dr, idx) => (
                            <div key={idx} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-semibold text-purple-900">
                                    {dr.durationHours} Hours
                                  </div>
                                  {dr.description && (
                                    <div className="text-xs text-purple-700">{dr.description}</div>
                                  )}
                                </div>
                                <div className="text-lg font-bold text-purple-900">
                                  ${dr.totalPrice}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(ratesheet._id, ratesheet.isActive)}
                        className={`p-2 rounded-lg transition-all ${
                          ratesheet.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                        }`}
                        title={ratesheet.isActive ? 'Disable' : 'Enable'}
                      >
                        <Power size={18} />
                      </button>
                      <span className={`text-xs font-semibold ${
                        ratesheet.isActive ? 'text-green-700' : 'text-gray-500'
                      }`}>
                        {ratesheet.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(ratesheet)}
                        className={`px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${
                          ratesheet.name && ratesheet.name.startsWith('Auto-')
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                        title={ratesheet.name && ratesheet.name.startsWith('Auto-') ? 'Auto-generated ratesheets cannot be edited' : 'Edit ratesheet'}
                      >
                        <Edit size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => deleteRatesheet(ratesheet._id, ratesheet.name)}
                        className={`px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${
                          ratesheet.name && ratesheet.name.startsWith('Auto-')
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                        title={ratesheet.name && ratesheet.name.startsWith('Auto-') ? 'Auto-generated ratesheets cannot be deleted' : 'Delete ratesheet'}
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateRateSheetModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            loadData();
            setShowCreateModal(false);
          }}
        />
      )}

      {showEditModal && selectedRatesheet && (
        <EditRateSheetModal
          isOpen={showEditModal}
          ratesheet={selectedRatesheet}
          onClose={() => {
            setShowEditModal(false);
            setSelectedRatesheet(null);
          }}
          onSuccess={() => {
            loadData();
            setShowEditModal(false);
            setSelectedRatesheet(null);
          }}
        />
      )}
    </div>
  );
}
