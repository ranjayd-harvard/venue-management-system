'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X, Clock, Calendar, DollarSign, Layers } from 'lucide-react';
import CreateRatesheetModal from '@/components/CreateRatesheetModal';

interface Ratesheet {
  _id: string;
  name: string;
  description?: string;
  type: 'TIMING_BASED' | 'DURATION_BASED';
  layer: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
  entityId: string;
  priority: number;
  conflictResolution: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  timeWindows?: any[];
  durationRules?: any[];
  createdAt: string;
  updatedAt: string;
}

interface Location {
  _id: string;
  name: string;
  city: string;
}

interface SubLocation {
  _id: string;
  locationId: string;
  label: string;
  description?: string;
}

export default function AdminPricingPage() {
  const [ratesheets, setRatesheets] = useState<Ratesheet[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ratesheetsRes, locationsRes, sublocationsRes] = await Promise.all([
        fetch('/api/ratesheets'),
        fetch('/api/locations'),
        fetch('/api/sublocations')
      ]);

      const ratesheetsData = await ratesheetsRes.json();
      const locationsData = await locationsRes.json();
      const sublocationsData = await sublocationsRes.json();

      console.log('[LoadData] Raw ratesheets:', ratesheetsData);

      // Ensure all ratesheets have a status field (default to DRAFT if missing)
      const normalizedRatesheets = ratesheetsData.map((rs: Ratesheet) => {
        console.log(`[LoadData] Ratesheet ${rs.name}: status=${rs.status}`);
        return {
          ...rs,
          status: rs.status || 'DRAFT'
        };
      });

      setRatesheets(normalizedRatesheets);
      setLocations(locationsData);
      setSublocations(sublocationsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ratesheet?')) return;

    try {
      const response = await fetch(`/api/ratesheets?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to delete ratesheet:', error);
    }
  };

  const handleSubmitForApproval = async (id: string) => {
    if (!confirm('Submit this ratesheet for approval?')) return;

    try {
      const response = await fetch('/api/ratesheets/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'submit' })
      });

      const data = await response.json();
      console.log('[Submit] Response:', data);

      if (response.ok) {
        console.log('[Submit] Success, reloading data...');
        await loadData();
        console.log('[Submit] Data reloaded');
      } else {
        alert(`Failed to submit: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to submit ratesheet:', error);
      alert('Failed to submit ratesheet');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch('/api/ratesheets/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id, 
          action: 'approve',
          approvedBy: 'Admin' // TODO: Get from auth context
        })
      });

      if (response.ok) {
        loadData();
      } else {
        const errorData = await response.json();
        alert(`Failed to approve: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Failed to approve ratesheet:', error);
      alert('Failed to approve ratesheet');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const response = await fetch('/api/ratesheets/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id, 
          action: 'reject',
          rejectionReason: reason
        })
      });

      if (response.ok) {
        loadData();
      } else {
        const errorData = await response.json();
        alert(`Failed to reject: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Failed to reject ratesheet:', error);
      alert('Failed to reject ratesheet');
    }
  };

  const filteredRatesheets = ratesheets.filter(rs => {
    const status = rs.status || 'DRAFT'; // Fallback to DRAFT
    if (filterStatus !== 'ALL' && status !== filterStatus) return false;
    if (filterType !== 'ALL' && rs.type !== filterType) return false;
    return true;
  });

  const getStatusColor = (status?: string) => {
    // Default to DRAFT if status is undefined
    const actualStatus = status || 'DRAFT';
    switch (actualStatus) {
      case 'DRAFT': return 'bg-gray-100 text-gray-700';
      case 'PENDING_APPROVAL': return 'bg-yellow-100 text-yellow-700';
      case 'APPROVED': return 'bg-green-100 text-green-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      case 'ARCHIVED': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status?: string) => {
    const actualStatus = status || 'DRAFT';
    return actualStatus.replace('_', ' ');
  };

  const getLayerLabel = (layer: string, entityId: string) => {
    if (layer === 'SUBLOCATION') {
      const sublocation = sublocations.find(sl => sl._id === entityId);
      return sublocation ? sublocation.label : 'Unknown SubLocation';
    }
    if (layer === 'LOCATION') {
      const location = locations.find(l => l._id === entityId);
      return location ? location.name : 'Unknown Location';
    }
    return 'Customer-wide';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading ratesheets...</p>
        </div>
      </div>
    );
  }

  // Count ratesheets by status (with fallback)
  const countByStatus = (status: string) => 
    ratesheets.filter(r => (r.status || 'DRAFT') === status).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Ratesheet Management</h1>
              <p className="text-indigo-100">Create and manage pricing rules for your venues</p>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Ratesheet
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total Ratesheets', count: ratesheets.length, color: 'from-blue-500 to-blue-600', icon: Layers },
            { label: 'Active', count: countByStatus('APPROVED'), color: 'from-green-500 to-green-600', icon: Check },
            { label: 'Pending Approval', count: countByStatus('PENDING_APPROVAL'), color: 'from-yellow-500 to-yellow-600', icon: Clock },
            { label: 'Drafts', count: countByStatus('DRAFT'), color: 'from-gray-500 to-gray-600', icon: Edit2 },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${stat.color} mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stat.count}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              >
                <option value="ALL">All Types</option>
                <option value="TIMING_BASED">Timing-Based</option>
                <option value="DURATION_BASED">Duration-Based</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ratesheets List */}
        <div className="space-y-4">
          {filteredRatesheets.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-gray-100">
              <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Ratesheets Found</h3>
              <p className="text-gray-500 mb-6">Get started by creating your first ratesheet</p>
              <button
                onClick={() => setModalOpen(true)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Create Ratesheet
              </button>
            </div>
          ) : (
            filteredRatesheets.map((ratesheet) => {
              const status = ratesheet.status || 'DRAFT';
              return (
                <div key={ratesheet._id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">{ratesheet.name}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)}`}>
                            {getStatusLabel(status)}
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                            {ratesheet.type === 'TIMING_BASED' ? 'Timing' : 'Duration'}
                          </span>
                        </div>
                        {ratesheet.description && (
                          <p className="text-gray-600 text-sm mb-3">{ratesheet.description}</p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center text-gray-600">
                            <Layers className="w-4 h-4 mr-1" />
                            {ratesheet.layer}: {getLayerLabel(ratesheet.layer, ratesheet.entityId)}
                          </div>
                          <div className="flex items-center text-gray-600">
                            <Calendar className="w-4 h-4 mr-1" />
                            From: {new Date(ratesheet.effectiveFrom).toLocaleDateString()}
                          </div>
                          {ratesheet.effectiveTo && (
                            <div className="flex items-center text-gray-600">
                              To: {new Date(ratesheet.effectiveTo).toLocaleDateString()}
                            </div>
                          )}
                          <div className="flex items-center text-gray-600">
                            Priority: {ratesheet.priority}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {status === 'DRAFT' && (
                          <button
                            onClick={() => handleSubmitForApproval(ratesheet._id)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
                            title="Submit for Approval"
                          >
                            Submit for Approval
                          </button>
                        )}
                        {status === 'PENDING_APPROVAL' && (
                          <>
                            <button
                              onClick={() => handleApprove(ratesheet._id)}
                              className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                              title="Approve"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleReject(ratesheet._id)}
                              className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                              title="Reject"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {/* TODO: Edit functionality */}}
                          className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(ratesheet._id)}
                          className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Rules Preview */}
                    {ratesheet.type === 'TIMING_BASED' && ratesheet.timeWindows && ratesheet.timeWindows.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="text-sm font-medium text-gray-700 mb-2">Time Windows:</div>
                        <div className="flex flex-wrap gap-2">
                          {ratesheet.timeWindows.slice(0, 3).map((tw: any, idx: number) => (
                            <div key={idx} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs">
                              {tw.startTime} - {tw.endTime}: ${tw.pricePerHour}/hr
                            </div>
                          ))}
                          {ratesheet.timeWindows.length > 3 && (
                            <div className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs">
                              +{ratesheet.timeWindows.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {ratesheet.type === 'DURATION_BASED' && ratesheet.durationRules && ratesheet.durationRules.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="text-sm font-medium text-gray-700 mb-2">Duration Packages:</div>
                        <div className="flex flex-wrap gap-2">
                          {ratesheet.durationRules.slice(0, 3).map((dr: any, idx: number) => (
                            <div key={idx} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs">
                              {dr.durationHours}h: ${dr.totalPrice}
                            </div>
                          ))}
                          {ratesheet.durationRules.length > 3 && (
                            <div className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs">
                              +{ratesheet.durationRules.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create Modal */}
      <CreateRatesheetModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        locations={locations}
        sublocations={sublocations}
        onSuccess={loadData}
      />
    </div>
  );
}
