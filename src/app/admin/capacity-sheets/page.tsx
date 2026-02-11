'use client';

import { useState, useEffect } from 'react';
import { Power, Trash2, Edit, Plus, ChevronDown, ChevronUp, Users, TrendingUp } from 'lucide-react';
import CreateCapacitySheetModal from '@/components/CreateCapacitySheetModal';
import EditCapacitySheetModal from '@/components/EditCapacitySheetModal';
import { PriorityConfig } from '@/models/types';

interface TimeCapacityWindow {
  startTime: string;
  endTime: string;
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity?: number;
}

interface DateCapacityRange {
  startDate: string;
  endDate: string;
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity?: number;
}

interface EventCapacityRule {
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  reservedCapacity?: number;
}

interface CapacitySheet {
  _id: string;
  name: string;
  description?: string;
  type: 'TIME_BASED' | 'DATE_BASED' | 'EVENT_BASED';
  appliesTo: {
    level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
    entityId: string;
  };
  priority: number;
  conflictResolution: 'PRIORITY' | 'HIGHEST_CAPACITY' | 'LOWEST_CAPACITY';
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  timeWindows?: TimeCapacityWindow[];
  dateRanges?: DateCapacityRange[];
  eventCapacity?: EventCapacityRule;
  approvalStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  customer?: { _id: string; name: string };
  location?: { _id: string; name: string };
  sublocation?: { _id: string; label: string };
  event?: { _id: string; name: string };
}

export default function AdminCapacitySheetsPage() {
  const [priorityConfigs, setPriorityConfigs] = useState<PriorityConfig[]>([]);
  const [capacitySheets, setCapacitySheets] = useState<CapacitySheet[]>([]);
  const [filteredSheets, setFilteredSheets] = useState<CapacitySheet[]>([]);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<CapacitySheet | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterSheets();
  }, [activeFilter, statusFilter, capacitySheets]);

  const loadData = async () => {
    setLoading(true);
    try {
      const configRes = await fetch('/api/pricing/priority-config');
      if (configRes.ok) {
        const configs = await configRes.json();
        setPriorityConfigs(configs);
      }

      const sheetsRes = await fetch('/api/capacitysheets?includeInactive=true');
      if (sheetsRes.ok) {
        const sheets = await sheetsRes.json();
        setCapacitySheets(sheets);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterSheets = () => {
    let filtered = capacitySheets;

    if (activeFilter !== 'ALL') {
      filtered = filtered.filter(s => s.appliesTo.level === activeFilter);
    }

    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(s => s.approvalStatus === statusFilter);
    }

    setFilteredSheets(filtered);
  };

  const toggleExpanded = (sheetId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(sheetId)) {
      newExpanded.delete(sheetId);
    } else {
      newExpanded.add(sheetId);
    }
    setExpandedCards(newExpanded);
  };

  const toggleActive = async (sheetId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/capacitysheets/${sheetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) throw new Error('Failed to toggle status');
      await loadData();
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('Failed to toggle capacity sheet status');
    }
  };

  const deleteSheet = async (sheetId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/capacitysheets/${sheetId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete capacity sheet');
      await loadData();
      alert('Capacity sheet deleted successfully');
    } catch (error) {
      console.error('Error deleting capacity sheet:', error);
      alert('Failed to delete capacity sheet');
    }
  };

  const handleEdit = (sheet: CapacitySheet) => {
    setSelectedSheet(sheet);
    setShowEditModal(true);
  };

  const handleApproval = async (sheetId: string, action: 'submit' | 'approve' | 'reject') => {
    const approvedBy = action === 'approve' ? prompt('Enter your email for approval:') : null;
    const rejectionReason = action === 'reject' ? prompt('Enter rejection reason:') : null;

    if (action === 'approve' && !approvedBy) return;
    if (action === 'reject' && !rejectionReason) return;

    try {
      const response = await fetch('/api/capacitysheets/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sheetId, action, approvedBy, rejectionReason }),
      });

      if (!response.ok) throw new Error('Failed to process approval action');
      await loadData();
      alert(`Capacity sheet ${action}ed successfully`);
    } catch (error) {
      console.error('Error processing approval:', error);
      alert('Failed to process approval action');
    }
  };

  const getTypeColor = (level: string) => {
    const config = priorityConfigs.find(c => c.level === level);
    return config?.color || '#6B7280';
  };

  const getTypeBadge = (level: string) => {
    const colors = {
      CUSTOMER: 'bg-blue-100 text-blue-800 border-blue-300',
      LOCATION: 'bg-green-100 text-green-800 border-green-300',
      SUBLOCATION: 'bg-orange-100 text-orange-800 border-orange-300',
      EVENT: 'bg-pink-100 text-pink-800 border-pink-300',
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-800 border-gray-300',
      PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      APPROVED: 'bg-green-100 text-green-800 border-green-300',
      REJECTED: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getCounts = () => ({
    all: capacitySheets.length,
    customer: capacitySheets.filter(s => s.appliesTo.level === 'CUSTOMER').length,
    location: capacitySheets.filter(s => s.appliesTo.level === 'LOCATION').length,
    sublocation: capacitySheets.filter(s => s.appliesTo.level === 'SUBLOCATION').length,
    event: capacitySheets.filter(s => s.appliesTo.level === 'EVENT').length,
  });

  const counts = getCounts();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading capacity data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-green-50 to-emerald-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-green-600 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">Capacity Administration</h1>
              <p className="text-teal-100 text-lg">Manage capacity sheets and constraints</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-white text-teal-600 px-6 py-3 rounded-xl font-semibold hover:bg-teal-50 transition-all shadow-lg flex items-center gap-2"
            >
              <Plus size={20} />
              Create Capacity Sheet
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
        <div className="bg-white rounded-xl shadow-lg p-2 mb-4 flex gap-2">
          {[
            { key: 'ALL', label: 'All Sheets', count: counts.all },
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
                  ? 'bg-gradient-to-r from-teal-600 to-green-600 text-white shadow-md'
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

        {/* Status Filter */}
        <div className="bg-white rounded-xl shadow-lg p-2 mb-6 flex gap-2">
          {[
            { key: 'ALL', label: 'All Status' },
            { key: 'DRAFT', label: 'Draft' },
            { key: 'PENDING_APPROVAL', label: 'Pending' },
            { key: 'APPROVED', label: 'Approved' },
            { key: 'REJECTED', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key as any)}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
                statusFilter === tab.key
                  ? 'bg-gradient-to-r from-teal-600 to-green-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Capacity Sheets List */}
        {filteredSheets.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Capacity Sheets Found</h3>
            <p className="text-gray-600 mb-6">
              {activeFilter === 'ALL'
                ? 'Create your first capacity sheet to get started'
                : `No ${activeFilter.toLowerCase()} capacity sheets found`}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-teal-600 to-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-teal-700 hover:to-green-700 transition-all"
            >
              Create Capacity Sheet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredSheets.map((sheet) => {
              const isExpanded = expandedCards.has(sheet._id);

              return (
                <div
                  key={sheet._id}
                  className={`bg-white rounded-xl shadow-lg overflow-hidden border-l-4 transition-all hover:shadow-xl ${
                    !sheet.isActive ? 'opacity-60' : ''
                  }`}
                  style={{ borderColor: getTypeColor(sheet.appliesTo.level) }}
                >
                  {/* Card Header */}
                  <div className="p-6 pb-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{sheet.name}</h3>
                        {sheet.description && (
                          <p className="text-sm text-gray-600">{sheet.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getTypeBadge(sheet.appliesTo.level)}`}>
                          {sheet.appliesTo.level}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(sheet.approvalStatus)}`}>
                          {sheet.approvalStatus.replace('_', ' ')}
                        </div>
                      </div>
                    </div>

                    {/* Entity Hierarchy */}
                    <div className="text-sm text-gray-600 mb-3">
                      {sheet.customer && (
                        <span className="font-medium text-blue-600">{sheet.customer.name}</span>
                      )}
                      {sheet.location && (
                        <>
                          <span className="mx-2">→</span>
                          <span className="font-medium text-green-600">{sheet.location.name}</span>
                        </>
                      )}
                      {sheet.sublocation && (
                        <>
                          <span className="mx-2">→</span>
                          <span className="font-medium text-orange-600">{sheet.sublocation.label}</span>
                        </>
                      )}
                      {sheet.event && (
                        <>
                          <span className="mx-2">→</span>
                          <span className="font-medium text-pink-600">{sheet.event.name}</span>
                        </>
                      )}
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-100 pt-4">
                      <div>
                        <span className="text-gray-500">Type:</span>
                        <p className="font-semibold text-gray-900">
                          {sheet.type === 'TIME_BASED' ? '🕐 Time-Based' :
                           sheet.type === 'DATE_BASED' ? '📅 Date-Based' : '🎯 Event-Based'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Priority:</span>
                        <p className="font-semibold text-gray-900">{sheet.priority}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Effective From:</span>
                        <p className="font-semibold text-gray-900">
                          {new Date(sheet.effectiveFrom).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Effective To:</span>
                        <p className="font-semibold text-gray-900">
                          {sheet.effectiveTo
                            ? new Date(sheet.effectiveTo).toLocaleDateString()
                            : 'Indefinite'}
                        </p>
                      </div>
                    </div>

                    {/* Capacity Summary with Expand Button */}
                    <div className="mt-4">
                      <button
                        onClick={() => toggleExpanded(sheet._id)}
                        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-teal-50 to-green-50 rounded-lg hover:from-teal-100 hover:to-green-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {sheet.type === 'TIME_BASED' && (
                            <>
                              <Users className="text-teal-600" size={18} />
                              <span className="text-sm font-semibold text-teal-900">
                                {sheet.timeWindows?.length || 0} Time Windows
                              </span>
                            </>
                          )}
                          {sheet.type === 'DATE_BASED' && (
                            <>
                              <TrendingUp className="text-green-600" size={18} />
                              <span className="text-sm font-semibold text-green-900">
                                {sheet.dateRanges?.length || 0} Date Ranges
                              </span>
                            </>
                          )}
                          {sheet.type === 'EVENT_BASED' && (
                            <>
                              <Users className="text-pink-600" size={18} />
                              <span className="text-sm font-semibold text-pink-900">
                                Event Capacity Rules
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
                          {sheet.type === 'TIME_BASED' && sheet.timeWindows?.map((tw, idx) => (
                            <div key={idx} className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                              <div className="flex justify-between items-center">
                                <div className="font-semibold text-teal-900">
                                  {tw.startTime} - {tw.endTime}
                                </div>
                                <div className="text-right text-sm">
                                  <div className="text-teal-900">
                                    Min: <span className="font-bold">{tw.minCapacity}</span> |
                                    Max: <span className="font-bold">{tw.maxCapacity}</span>
                                  </div>
                                  <div className="text-teal-700">
                                    Default: {tw.defaultCapacity} | Allocated: {tw.allocatedCapacity || 0}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          {sheet.type === 'DATE_BASED' && sheet.dateRanges?.map((dr, idx) => (
                            <div key={idx} className="p-3 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex justify-between items-center">
                                <div className="font-semibold text-green-900">
                                  {new Date(dr.startDate).toLocaleDateString()} - {new Date(dr.endDate).toLocaleDateString()}
                                </div>
                                <div className="text-right text-sm">
                                  <div className="text-green-900">
                                    Min: <span className="font-bold">{dr.minCapacity}</span> |
                                    Max: <span className="font-bold">{dr.maxCapacity}</span>
                                  </div>
                                  <div className="text-green-700">
                                    Default: {dr.defaultCapacity}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          {sheet.type === 'EVENT_BASED' && sheet.eventCapacity && (
                            <div className="p-3 bg-pink-50 rounded-lg border border-pink-200">
                              <div className="text-sm">
                                <div className="text-pink-900 font-semibold mb-1">Event Capacity</div>
                                <div className="text-pink-800">
                                  Min: <span className="font-bold">{sheet.eventCapacity.minCapacity}</span> |
                                  Max: <span className="font-bold">{sheet.eventCapacity.maxCapacity}</span> |
                                  Default: <span className="font-bold">{sheet.eventCapacity.defaultCapacity}</span>
                                  {sheet.eventCapacity.reservedCapacity && (
                                    <> | Reserved: <span className="font-bold">{sheet.eventCapacity.reservedCapacity}</span></>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(sheet._id, sheet.isActive)}
                        className={`p-2 rounded-lg transition-all ${
                          sheet.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                        }`}
                        title={sheet.isActive ? 'Disable' : 'Enable'}
                      >
                        <Power size={18} />
                      </button>
                      <span className={`text-xs font-semibold ${
                        sheet.isActive ? 'text-green-700' : 'text-gray-500'
                      }`}>
                        {sheet.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {/* Approval Actions */}
                      {sheet.approvalStatus === 'DRAFT' && (
                        <button
                          onClick={() => handleApproval(sheet._id, 'submit')}
                          className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-all font-medium text-sm"
                        >
                          Submit
                        </button>
                      )}
                      {sheet.approvalStatus === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            onClick={() => handleApproval(sheet._id, 'approve')}
                            className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all font-medium text-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApproval(sheet._id, 'reject')}
                            className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all font-medium text-sm"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleEdit(sheet)}
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all font-medium flex items-center gap-2"
                      >
                        <Edit size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => deleteSheet(sheet._id, sheet.name)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all font-medium flex items-center gap-2"
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
        <CreateCapacitySheetModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            loadData();
            setShowCreateModal(false);
          }}
        />
      )}

      {showEditModal && selectedSheet && (
        <EditCapacitySheetModal
          isOpen={showEditModal}
          capacitySheet={selectedSheet}
          onClose={() => {
            setShowEditModal(false);
            setSelectedSheet(null);
          }}
          onSuccess={() => {
            loadData();
            setShowEditModal(false);
            setSelectedSheet(null);
          }}
        />
      )}
    </div>
  );
}
