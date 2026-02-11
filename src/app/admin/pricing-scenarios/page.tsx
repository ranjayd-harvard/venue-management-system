'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Power, FolderOpen, ExternalLink } from 'lucide-react';
import { PricingScenario } from '@/models/types';

export default function AdminPricingScenariosPage() {
  const [scenarios, setScenarios] = useState<PricingScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    loadScenarios();
  }, [filterStatus]);

  const loadScenarios = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/pricing-scenarios', window.location.origin);
      if (filterStatus !== 'all') {
        url.searchParams.set('includeInactive', 'true');
      }

      const response = await fetch(url.toString());
      if (response.ok) {
        let data = await response.json();

        // Filter by status
        if (filterStatus === 'active') {
          data = data.filter((s: PricingScenario) => s.isActive);
        } else if (filterStatus === 'inactive') {
          data = data.filter((s: PricingScenario) => !s.isActive);
        }

        setScenarios(data);
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (scenarioId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/pricing-scenarios/${scenarioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) throw new Error('Failed to toggle status');
      await loadScenarios();
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('Failed to toggle scenario status');
    }
  };

  const deleteScenario = async (scenarioId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/pricing-scenarios/${scenarioId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete scenario');
      await loadScenarios();
      alert('Scenario deleted successfully');
    } catch (error) {
      console.error('Error deleting scenario:', error);
      alert('Failed to delete scenario');
    }
  };

  const getHierarchyBadge = (level: string) => {
    const badges = {
      CUSTOMER: { text: '👤 Customer', color: 'bg-blue-50 text-blue-700 border-blue-200' },
      LOCATION: { text: '📍 Location', color: 'bg-green-50 text-green-700 border-green-200' },
      SUBLOCATION: { text: '🏢 SubLocation', color: 'bg-purple-50 text-purple-700 border-purple-200' },
      EVENT: { text: '🗓️ Event', color: 'bg-pink-50 text-pink-700 border-pink-200' },
    };
    return badges[level as keyof typeof badges] || { text: level, color: 'bg-gray-50 text-gray-700 border-gray-200' };
  };

  const formatDateTime = (dateString: string | Date) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      timezone: date.toLocaleTimeString('en-US', {
        timeZoneName: 'short'
      }).split(' ').slice(-1)[0] // Extracts timezone abbreviation (e.g., "CST", "PST")
    };
  };

  const getCounts = () => ({
    all: scenarios.length,
    active: scenarios.filter(s => s.isActive).length,
    inactive: scenarios.filter(s => !s.isActive).length,
  });

  const counts = getCounts();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading scenarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">Pricing Scenarios</h1>
              <p className="text-pink-100 text-lg">Manage saved simulation configurations</p>
            </div>
            <a
              href="/pricing/timeline-simulator"
              className="bg-white text-pink-600 px-6 py-3 rounded-xl font-semibold hover:bg-pink-50 transition-all shadow-lg flex items-center gap-2"
            >
              <ExternalLink size={20} />
              Open Simulator
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-2 mb-6 flex gap-2">
          {[
            { key: 'all', label: 'All Scenarios', count: counts.all },
            { key: 'active', label: 'Active', count: counts.active },
            { key: 'inactive', label: 'Inactive', count: counts.inactive },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key as any)}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
                filterStatus === tab.key
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
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

        {/* Scenarios List */}
        {scenarios.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Scenarios Found</h3>
            <p className="text-gray-600 mb-6">
              {filterStatus === 'all'
                ? 'Create your first scenario in the Timeline Simulator'
                : `No ${filterStatus} scenarios found`}
            </p>
            <a
              href="/pricing/timeline-simulator"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-700 hover:to-purple-700 transition-all"
            >
              <ExternalLink size={20} />
              Go to Simulator
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {scenarios.map((scenario) => {
              const hierarchyBadge = getHierarchyBadge(scenario.appliesTo.level);

              return (
                <div
                  key={scenario._id?.toString()}
                  className={`bg-white rounded-xl shadow-lg overflow-hidden border-l-4 border-purple-500 transition-all hover:shadow-xl ${
                    !scenario.isActive ? 'opacity-60' : ''
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{scenario.name}</h3>
                        {scenario.description && (
                          <p className="text-sm text-gray-600">{scenario.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          scenario.isActive
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : 'bg-gray-100 text-gray-800 border-gray-300'
                        }`}>
                          {scenario.isActive ? 'Active' : 'Inactive'}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${hierarchyBadge.color}`}>
                          {hierarchyBadge.text}
                        </div>
                      </div>
                    </div>

                    {/* Entity Info */}
                    {(scenario as any).customer && (
                      <div className="text-sm text-gray-600 mb-3 flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                        <span className="font-semibold text-blue-800">{(scenario as any).customer.name}</span>
                      </div>
                    )}
                    {(scenario as any).location && (
                      <div className="text-sm text-gray-600 mb-3 flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
                        <span className="font-semibold text-green-800">
                          {(scenario as any).location.name} ({(scenario as any).location.city})
                        </span>
                      </div>
                    )}
                    {(scenario as any).sublocation && (
                      <div className="text-sm text-gray-600 mb-3 flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg">
                        <span className="font-semibold text-purple-800">{(scenario as any).sublocation.label}</span>
                      </div>
                    )}
                    {(scenario as any).event && (
                      <div className="text-sm text-gray-600 mb-3 flex items-center gap-2 bg-pink-50 px-3 py-2 rounded-lg">
                        <span className="font-semibold text-pink-800">{(scenario as any).event.name}</span>
                      </div>
                    )}

                    {/* Configuration Summary */}
                    <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-100 pt-4 mt-4">
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <p className="font-semibold text-gray-900">{scenario.config.selectedDuration}h</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Enabled Layers:</span>
                        <p className="font-semibold text-gray-900">{scenario.config.enabledLayers.length}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Event Booking:</span>
                        <p className="font-semibold text-gray-900">
                          {scenario.config.isEventBooking ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Surge Enabled:</span>
                        <p className="font-semibold text-gray-900">
                          {scenario.config.surgeEnabled ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>

                    {/* Time Windows */}
                    <div className="border-t border-gray-100 pt-4 mt-4">
                      <span className="text-xs text-gray-500 font-semibold mb-3 block">Time Windows:</span>
                      <div className="grid grid-cols-1 gap-3">
                        {/* View Window */}
                        <div className="bg-indigo-50 px-3 py-2 rounded-lg">
                          <div className="text-xs text-indigo-600 font-semibold mb-1">View Window</div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-indigo-500">Start:</span>
                              <div className="text-indigo-900 font-semibold">
                                {formatDateTime(scenario.config.viewStart).date}
                                <span className="ml-1 text-indigo-700">{formatDateTime(scenario.config.viewStart).time}</span>
                                <span className="ml-1 text-indigo-500 text-[10px]">{formatDateTime(scenario.config.viewStart).timezone}</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-indigo-500">End:</span>
                              <div className="text-indigo-900 font-semibold">
                                {formatDateTime(scenario.config.viewEnd).date}
                                <span className="ml-1 text-indigo-700">{formatDateTime(scenario.config.viewEnd).time}</span>
                                <span className="ml-1 text-indigo-500 text-[10px]">{formatDateTime(scenario.config.viewEnd).timezone}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Data Range */}
                        <div className="bg-teal-50 px-3 py-2 rounded-lg">
                          <div className="text-xs text-teal-600 font-semibold mb-1">Data Range</div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-teal-500">Start:</span>
                              <div className="text-teal-900 font-semibold">
                                {formatDateTime(scenario.config.rangeStart).date}
                                <span className="ml-1 text-teal-700">{formatDateTime(scenario.config.rangeStart).time}</span>
                                <span className="ml-1 text-teal-500 text-[10px]">{formatDateTime(scenario.config.rangeStart).timezone}</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-teal-500">End:</span>
                              <div className="text-teal-900 font-semibold">
                                {formatDateTime(scenario.config.rangeEnd).date}
                                <span className="ml-1 text-teal-700">{formatDateTime(scenario.config.rangeEnd).time}</span>
                                <span className="ml-1 text-teal-500 text-[10px]">{formatDateTime(scenario.config.rangeEnd).timezone}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pricing Coefficients (if set) */}
                    {(scenario.config.pricingCoefficientsUp || scenario.config.pricingCoefficientsDown || scenario.config.bias) && (
                      <div className="border-t border-gray-100 pt-4 mt-4">
                        <span className="text-xs text-gray-500 font-semibold">Pricing Coefficients:</span>
                        <div className="flex gap-3 mt-2">
                          {scenario.config.pricingCoefficientsUp && (
                            <div className="px-3 py-1 rounded-lg bg-blue-50">
                              <span className="text-xs text-blue-700">
                                Up: <span className="font-bold">{scenario.config.pricingCoefficientsUp}</span>
                              </span>
                            </div>
                          )}
                          {scenario.config.pricingCoefficientsDown && (
                            <div className="px-3 py-1 rounded-lg bg-orange-50">
                              <span className="text-xs text-orange-700">
                                Down: <span className="font-bold">{scenario.config.pricingCoefficientsDown}</span>
                              </span>
                            </div>
                          )}
                          {scenario.config.bias && (
                            <div className="px-3 py-1 rounded-lg bg-purple-50">
                              <span className="text-xs text-purple-700">
                                Bias: <span className="font-bold">{scenario.config.bias}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="border-t border-gray-100 pt-3 mt-4 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <div className="text-gray-900 font-semibold">
                            {formatDateTime(scenario.createdAt).date}
                            <span className="ml-1 text-gray-600">{formatDateTime(scenario.createdAt).time}</span>
                            <span className="ml-1 text-gray-500 text-[10px]">{formatDateTime(scenario.createdAt).timezone}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Updated:</span>
                          <div className="text-gray-900 font-semibold">
                            {formatDateTime(scenario.updatedAt).date}
                            <span className="ml-1 text-gray-600">{formatDateTime(scenario.updatedAt).time}</span>
                            <span className="ml-1 text-gray-500 text-[10px]">{formatDateTime(scenario.updatedAt).timezone}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(scenario._id?.toString() || '', scenario.isActive)}
                        className={`p-2 rounded-lg transition-all ${
                          scenario.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                        }`}
                        title={scenario.isActive ? 'Disable' : 'Enable'}
                      >
                        <Power size={18} />
                      </button>
                      <span className={`text-xs font-semibold ${
                        scenario.isActive ? 'text-green-700' : 'text-gray-500'
                      }`}>
                        {scenario.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={`/pricing/timeline-simulator?scenarioId=${scenario._id?.toString()}`}
                        className="px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-lg hover:from-purple-200 hover:to-pink-200 transition-all font-medium flex items-center gap-2"
                        title="Open in Simulator"
                      >
                        <FolderOpen size={16} />
                        Load
                      </a>
                      <button
                        onClick={() => deleteScenario(scenario._id?.toString() || '', scenario.name)}
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
    </div>
  );
}
