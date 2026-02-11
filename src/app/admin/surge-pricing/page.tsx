'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Power, Zap, ExternalLink, TrendingUp, TrendingDown, Rocket, RefreshCw, FileText, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { SurgeConfig } from '@/models/types';
import CreateSurgeConfigModal from '@/components/CreateSurgeConfigModal';
import EditSurgeConfigModal from '@/components/EditSurgeConfigModal';

interface MaterializationStatus {
  configId: string;
  hasRatesheet: boolean;
  status: 'none' | 'draft' | 'pending' | 'approved' | 'rejected';
  ratesheetId?: string;
  multiplier?: number;
}

export default function AdminSurgePricingPage() {
  const [configs, setConfigs] = useState<SurgeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<SurgeConfig | null>(null);
  const [materializationStatuses, setMaterializationStatuses] = useState<Map<string, MaterializationStatus>>(new Map());
  const [materializing, setMaterializing] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadConfigs();
  }, [filterStatus]);

  useEffect(() => {
    // Load materialization statuses for all configs
    if (configs.length > 0) {
      loadMaterializationStatuses();
    }
  }, [configs]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/surge-pricing/configs', window.location.origin);
      if (filterStatus !== 'all') {
        url.searchParams.set('includeInactive', 'true');
      }

      const response = await fetch(url.toString());
      if (response.ok) {
        let data = await response.json();

        // Filter by status
        if (filterStatus === 'active') {
          data = data.filter((c: SurgeConfig) => c.isActive);
        } else if (filterStatus === 'inactive') {
          data = data.filter((c: SurgeConfig) => !c.isActive);
        }

        setConfigs(data);
      }
    } catch (error) {
      console.error('Failed to load surge configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (configId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/surge-pricing/configs/${configId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) throw new Error('Failed to toggle status');
      await loadConfigs();
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('Failed to toggle config status');
    }
  };

  const deleteConfig = async (configId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/surge-pricing/configs/${configId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete config');
      await loadConfigs();
      alert('Surge config deleted successfully');
    } catch (error) {
      console.error('Error deleting config:', error);
      alert('Failed to delete surge config');
    }
  };

  const loadMaterializationStatuses = async () => {
    const statusMap = new Map<string, MaterializationStatus>();

    for (const config of configs) {
      const configId = config._id?.toString();
      if (!configId) continue;

      try {
        const response = await fetch(`/api/surge-pricing/configs/${configId}/ratesheet`);
        if (response.ok) {
          const data = await response.json();
          statusMap.set(configId, {
            configId,
            hasRatesheet: data.status !== 'none',
            status: data.status,
            ratesheetId: data.ratesheet?._id?.toString(),
            multiplier: data.ratesheet?.surgeMultiplierSnapshot
          });
        }
      } catch (error) {
        console.error(`Failed to load materialization status for ${configId}:`, error);
      }
    }

    setMaterializationStatuses(statusMap);
  };

  const materializeConfig = async (configId: string, configName: string) => {
    if (!confirm(`Materialize "${configName}" into a surge ratesheet?\n\nThis will create a DRAFT ratesheet that requires approval.`)) return;

    setMaterializing(prev => new Set(prev).add(configId));

    try {
      const response = await fetch(`/api/surge-pricing/configs/${configId}/materialize`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to materialize config');

      const data = await response.json();
      alert(`✅ Surge ratesheet created!\n\nMultiplier: ${data.multiplier.toFixed(3)}x\nStatus: DRAFT (requires approval)\n\nNavigate to Ratesheet management to approve.`);

      await loadMaterializationStatuses();
    } catch (error) {
      console.error('Error materializing config:', error);
      alert('Failed to materialize surge config');
    } finally {
      setMaterializing(prev => {
        const next = new Set(prev);
        next.delete(configId);
        return next;
      });
    }
  };

  const recalculateConfig = async (configId: string, configName: string) => {
    if (!confirm(`Recalculate surge multiplier for "${configName}"?\n\nThis will create a new DRAFT ratesheet with updated demand/supply data.`)) return;

    setMaterializing(prev => new Set(prev).add(configId));

    try {
      const response = await fetch(`/api/surge-pricing/configs/${configId}/recalculate`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to recalculate config');

      const data = await response.json();
      alert(`✅ Surge recalculated!\n\nOld Multiplier: ${data.oldMultiplier.toFixed(3)}x\nNew Multiplier: ${data.newMultiplier.toFixed(3)}x\nChange: ${data.changePercent}\n\nStatus: DRAFT (requires approval)`);

      await loadMaterializationStatuses();
    } catch (error) {
      console.error('Error recalculating config:', error);
      alert('Failed to recalculate surge config');
    } finally {
      setMaterializing(prev => {
        const next = new Set(prev);
        next.delete(configId);
        return next;
      });
    }
  };

  const viewRatesheet = (ratesheetId: string) => {
    // Navigate to ratesheet management page (pricing admin page)
    window.open(`/admin/pricing?highlight=${ratesheetId}`, '_blank');
  };

  const getHierarchyBadge = (level: string) => {
    const badges = {
      LOCATION: { text: '📍 Location', color: 'bg-green-50 text-green-700 border-green-200' },
      SUBLOCATION: { text: '🏢 SubLocation', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    };
    return badges[level as keyof typeof badges] || { text: level, color: 'bg-gray-50 text-gray-700 border-gray-200' };
  };

  const getSurgeIndicator = (config: SurgeConfig) => {
    // Calculate current surge factor for display
    const { demandSupplyParams, surgeParams } = config;
    const pressure = demandSupplyParams.currentDemand / demandSupplyParams.currentSupply;
    const normalized = pressure / demandSupplyParams.historicalAvgPressure;
    const rawFactor = 1 + surgeParams.alpha * Math.log(normalized);
    const surgeFactor = Math.max(
      surgeParams.minMultiplier,
      Math.min(surgeParams.maxMultiplier, rawFactor)
    );

    const isIncrease = surgeFactor > 1.0;
    const isDecrease = surgeFactor < 1.0;

    return {
      surgeFactor,
      isIncrease,
      isDecrease,
      color: isIncrease
        ? 'bg-gradient-to-r from-orange-100 to-red-100 text-red-700 border-red-300'
        : isDecrease
        ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border-green-300'
        : 'bg-gray-100 text-gray-700 border-gray-300',
      icon: isIncrease ? TrendingUp : isDecrease ? TrendingDown : Zap,
    };
  };

  const getCounts = () => ({
    all: configs.length,
    active: configs.filter(c => c.isActive).length,
    inactive: configs.filter(c => !c.isActive).length,
  });

  const getMaterializationBadge = (status: 'none' | 'draft' | 'pending' | 'approved' | 'rejected') => {
    const badges = {
      none: { text: 'Not Materialized', color: 'bg-gray-100 text-gray-600 border-gray-300', icon: AlertCircle },
      draft: { text: 'Draft', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: FileText },
      pending: { text: 'Pending Approval', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: Clock },
      approved: { text: 'Approved', color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle },
      rejected: { text: 'Rejected', color: 'bg-red-100 text-red-700 border-red-300', icon: XCircle },
    };
    return badges[status];
  };

  const counts = getCounts();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading surge configs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <Zap className="w-10 h-10" />
                Surge Pricing
              </h1>
              <p className="text-orange-100 text-lg">Dynamic pricing configurations based on demand/supply pressure</p>
            </div>
            <div className="flex gap-3">
              <a
                href="/pricing/timeline-simulator"
                className="bg-white text-orange-600 px-6 py-3 rounded-xl font-semibold hover:bg-orange-50 transition-all shadow-lg flex items-center gap-2"
              >
                <ExternalLink size={20} />
                Open Simulator
              </a>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-white text-orange-600 px-6 py-3 rounded-xl font-semibold hover:bg-orange-50 transition-all shadow-lg flex items-center gap-2"
              >
                <Plus size={20} />
                Create Surge Config
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-2 mb-6 flex gap-2">
          {[
            { key: 'all', label: 'All Configs', count: counts.all },
            { key: 'active', label: 'Active', count: counts.active },
            { key: 'inactive', label: 'Inactive', count: counts.inactive },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key as any)}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
                filterStatus === tab.key
                  ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-md'
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

        {/* Configs List */}
        {configs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">⚡</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Surge Configs Found</h3>
            <p className="text-gray-600 mb-6">
              {filterStatus === 'all'
                ? 'Create your first surge pricing configuration'
                : `No ${filterStatus} surge configs found`}
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-orange-700 hover:to-red-700 transition-all"
            >
              <Plus size={20} />
              Create Surge Config
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {configs.map((config) => {
              const hierarchyBadge = getHierarchyBadge(config.appliesTo.level);
              const surgeIndicator = getSurgeIndicator(config);
              const SurgeIcon = surgeIndicator.icon;
              const configId = config._id?.toString() || '';
              const materializationStatus = materializationStatuses.get(configId);
              const isMaterializing = materializing.has(configId);
              const materializationBadge = materializationStatus ? getMaterializationBadge(materializationStatus.status) : null;

              return (
                <div
                  key={config._id?.toString()}
                  className={`bg-white rounded-xl shadow-lg overflow-hidden border-l-4 border-orange-500 transition-all hover:shadow-xl ${
                    !config.isActive ? 'opacity-60' : ''
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                          <Zap className="w-5 h-5 text-orange-600" />
                          {config.name}
                        </h3>
                        {config.description && (
                          <p className="text-sm text-gray-600">{config.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          config.isActive
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : 'bg-gray-100 text-gray-800 border-gray-300'
                        }`}>
                          {config.isActive ? 'Active' : 'Inactive'}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${hierarchyBadge.color}`}>
                          {hierarchyBadge.text}
                        </div>
                      </div>
                    </div>

                    {/* Entity Info */}
                    {(config as any).location && (
                      <div className="text-sm text-gray-600 mb-3 flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
                        <span className="font-semibold text-green-800">
                          {(config as any).location.name} ({(config as any).location.city})
                        </span>
                      </div>
                    )}
                    {(config as any).sublocation && (
                      <div className="text-sm text-gray-600 mb-3 flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg">
                        <span className="font-semibold text-purple-800">{(config as any).sublocation.label}</span>
                      </div>
                    )}

                    {/* Surge Multiplier Display */}
                    <div className={`mb-4 p-4 rounded-lg border-2 ${surgeIndicator.color}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold flex items-center gap-1">
                          <SurgeIcon className="w-4 h-4" />
                          Current Surge
                        </span>
                        <span className="text-2xl font-bold">
                          {surgeIndicator.surgeFactor.toFixed(2)}x
                        </span>
                      </div>
                      <div className="text-xs opacity-75">
                        Demand: {config.demandSupplyParams.currentDemand} / Supply: {config.demandSupplyParams.currentSupply}
                        {' '}→ Pressure: {(config.demandSupplyParams.currentDemand / config.demandSupplyParams.currentSupply).toFixed(2)}
                      </div>
                    </div>

                    {/* Configuration Summary */}
                    <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-100 pt-4">
                      <div>
                        <span className="text-gray-500">Priority:</span>
                        <p className="font-semibold text-gray-900">{config.priority}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Multiplier Range:</span>
                        <p className="font-semibold text-gray-900">
                          {config.surgeParams.minMultiplier}x - {config.surgeParams.maxMultiplier}x
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Sensitivity (α):</span>
                        <p className="font-semibold text-gray-900">{config.surgeParams.alpha}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Historical Avg:</span>
                        <p className="font-semibold text-gray-900">
                          {config.demandSupplyParams.historicalAvgPressure.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">EMA Alpha:</span>
                        <p className="font-semibold text-gray-900">{config.surgeParams.emaAlpha}</p>
                      </div>
                    </div>

                    {/* Time Windows */}
                    {config.timeWindows && config.timeWindows.length > 0 && (
                      <div className="border-t border-gray-100 pt-4 mt-4">
                        <span className="text-xs text-gray-500 font-semibold">Time Windows:</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {config.timeWindows.map((window, idx) => (
                            <div key={idx} className="px-2 py-1 rounded-lg bg-orange-50 text-xs text-orange-700">
                              {window.daysOfWeek && window.daysOfWeek.length > 0 && (
                                <span className="font-semibold">
                                  {window.daysOfWeek.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}
                                </span>
                              )}
                              {window.startTime && window.endTime && (
                                <span className="ml-1">
                                  {window.startTime} - {window.endTime}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="border-t border-gray-100 pt-3 mt-4 text-xs text-gray-500">
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="font-semibold text-gray-600">Effective:</span>
                          <span>
                            {new Date(config.effectiveFrom).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between pl-4">
                          <span className="text-gray-400">UTC:</span>
                          <span className="text-gray-400">
                            {new Date(config.effectiveFrom).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                              timeZone: 'UTC'
                            })}
                          </span>
                        </div>
                        {config.effectiveTo && (
                          <>
                            <div className="flex justify-between mt-2">
                              <span className="font-semibold text-gray-600">Until:</span>
                              <span>
                                {new Date(config.effectiveTo).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </span>
                            </div>
                            <div className="flex justify-between pl-4">
                              <span className="text-gray-400">UTC:</span>
                              <span className="text-gray-400">
                                {new Date(config.effectiveTo).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                  timeZone: 'UTC'
                                })}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Materialization Status & Actions */}
                    {materializationBadge && (
                      <div className="border-t border-gray-100 pt-4 mt-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-gray-500 font-semibold">Surge Ratesheet:</span>
                          <div className={`px-2 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 ${materializationBadge.color}`}>
                            <materializationBadge.icon className="w-3 h-3" />
                            {materializationBadge.text}
                          </div>
                        </div>

                        {materializationStatus?.status === 'none' && (
                          <button
                            onClick={() => materializeConfig(configId, config.name)}
                            disabled={isMaterializing}
                            className="w-full bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 px-3 py-2 rounded-lg hover:from-purple-200 hover:to-indigo-200 transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isMaterializing ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-700"></div>
                                Materializing...
                              </>
                            ) : (
                              <>
                                <Rocket className="w-4 h-4" />
                                Materialize to Ratesheet
                              </>
                            )}
                          </button>
                        )}

                        {materializationStatus?.status !== 'none' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => recalculateConfig(configId, config.name)}
                              disabled={isMaterializing}
                              className="flex-1 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 px-3 py-2 rounded-lg hover:from-blue-200 hover:to-cyan-200 transition-all font-medium flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isMaterializing ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                              ) : (
                                <>
                                  <RefreshCw className="w-4 h-4" />
                                  Recalculate
                                </>
                              )}
                            </button>
                            {materializationStatus?.ratesheetId && (
                              <button
                                onClick={() => viewRatesheet(materializationStatus.ratesheetId!)}
                                className="flex-1 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 px-3 py-2 rounded-lg hover:from-green-200 hover:to-emerald-200 transition-all font-medium flex items-center justify-center gap-2 text-sm"
                              >
                                <FileText className="w-4 h-4" />
                                View Ratesheet
                              </button>
                            )}
                          </div>
                        )}

                        {materializationStatus?.multiplier && (
                          <div className="mt-2 text-xs text-gray-500 text-center">
                            Last materialized: <span className="font-semibold text-gray-700">{materializationStatus.multiplier.toFixed(3)}x</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(config._id?.toString() || '', config.isActive)}
                        className={`p-2 rounded-lg transition-all ${
                          config.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                        }`}
                        title={config.isActive ? 'Disable' : 'Enable'}
                      >
                        <Power size={18} />
                      </button>
                      <span className={`text-xs font-semibold ${
                        config.isActive ? 'text-green-700' : 'text-gray-500'
                      }`}>
                        {config.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedConfig(config);
                          setIsEditModalOpen(true);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-orange-100 to-red-100 text-orange-700 rounded-lg hover:from-orange-200 hover:to-red-200 transition-all font-medium flex items-center gap-2"
                      >
                        <Edit size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => deleteConfig(config._id?.toString() || '', config.name)}
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

      {/* Create Modal */}
      <CreateSurgeConfigModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          loadConfigs();
          setIsCreateModalOpen(false);
        }}
      />

      {/* Edit Modal */}
      <EditSurgeConfigModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedConfig(null);
        }}
        onSuccess={() => {
          loadConfigs();
          setIsEditModalOpen(false);
          setSelectedConfig(null);
        }}
        config={selectedConfig}
      />
    </div>
  );
}
