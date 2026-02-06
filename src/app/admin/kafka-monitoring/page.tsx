'use client';

import { useState, useEffect } from 'react';

interface Metrics {
  overview: {
    demandHistoryTotal: number;
    metricsLast24h: number;
    totalBookingsLast24h: number;
    avgPressureLast24h: string;
    activeSurgeConfigs: number;
    recentRatesheets: number;
    processedEvents: number;
  };
  topLocations: Array<{
    subLocationId: string;
    totalBookings: number;
    avgPressure: number;
    dataPoints: number;
  }>;
  recentMetrics: Array<{
    subLocationId: string;
    hour: string;
    bookingsCount: number;
    demandPressure: string;
    historicalAvg: string;
    timestamp: string;
  }>;
  surgeConfigs: Array<{
    id: string;
    name: string;
    level: string;
    entityId: string;
    currentDemand: number;
    currentSupply: number;
    historicalAvg: number;
    lastMaterialized?: string;
  }>;
  recentRatesheets: Array<{
    id: string;
    name: string;
    priority: number;
    multiplier: string;
    status: string;
    isActive: boolean;
    demandSnapshot: number;
    supplySnapshot: number;
    createdAt: string;
    createdBy: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    timeWindows?: Array<{
      windowType?: 'ABSOLUTE_TIME' | 'DURATION_BASED';
      startTime?: string;
      endTime?: string;
      startMinute?: number;
      endMinute?: number;
      pricePerHour: number;
    }>;
  }>;
}

interface GeneratorStatus {
  active: Array<{
    subLocationId: string;
    pid: number;
    running: boolean;
  }>;
  count: number;
}

interface SubLocation {
  id: string;
  label: string;
  locationId: string;
  locationName: string;
}

interface Location {
  id: string;
  name: string;
}

interface Entities {
  sublocations: SubLocation[];
  locations: Location[];
}

export default function KafkaMonitoringPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [generatorStatus, setGeneratorStatus] = useState<GeneratorStatus | null>(null);
  const [entities, setEntities] = useState<Entities | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Generator form state
  const [generatorMode, setGeneratorMode] = useState<'preset' | 'custom'>('preset');
  const [scenario, setScenario] = useState('RAPID_TEST');
  const [messagesPerSecond, setMessagesPerSecond] = useState(1);
  const [totalMessages, setTotalMessages] = useState(10);
  const [subLocationId, setSubLocationId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [startingGenerator, setStartingGenerator] = useState(false);

  const loadMetrics = async () => {
    try {
      const [metricsRes, generatorRes] = await Promise.all([
        fetch('/api/kafka/metrics'),
        fetch('/api/kafka/generator')
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data);
      }

      if (generatorRes.ok) {
        const data = await generatorRes.json();
        setGeneratorStatus(data);
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEntities = async () => {
    try {
      const res = await fetch('/api/kafka/entities');
      if (res.ok) {
        const data = await res.json();
        setEntities(data);
      }
    } catch (error) {
      console.error('Error loading entities:', error);
    }
  };

  const startGenerator = async () => {
    if (!subLocationId) {
      alert('Please select a sublocation');
      return;
    }

    setStartingGenerator(true);
    try {
      const body: any = {
        subLocationId,
        locationId: locationId || undefined
      };

      if (generatorMode === 'custom') {
        body.rate = messagesPerSecond;
        body.count = totalMessages;
      } else {
        body.scenario = scenario;
      }

      const res = await fetch('/api/kafka/generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        alert('Generator started successfully!');
        await loadMetrics();
      } else {
        const error = await res.json();
        alert(`Failed to start generator: ${error.error}`);
      }
    } catch (error) {
      alert('Error starting generator');
      console.error(error);
    } finally {
      setStartingGenerator(false);
    }
  };

  const stopGenerator = async (subLocId: string) => {
    try {
      const res = await fetch(`/api/kafka/generator?subLocationId=${subLocId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        alert('Generator stopped');
        await loadMetrics();
      } else {
        const error = await res.json();
        alert(`Failed to stop generator: ${error.error}`);
      }
    } catch (error) {
      alert('Error stopping generator');
      console.error(error);
    }
  };

  // Manual control state
  const [aggregating, setAggregating] = useState(false);
  const [materializing, setMaterializing] = useState(false);
  const [updatingRatesheet, setUpdatingRatesheet] = useState<string | null>(null);

  const aggregateDemandManually = async () => {
    if (!subLocationId) {
      alert('Please select a sublocation');
      return;
    }

    const confirmed = confirm(
      `This will aggregate demand data for the selected sublocation and create ONE demand_history record.\n\nSubLocation: ${subLocationId.substring(0, 12)}...\n\nContinue?`
    );
    if (!confirmed) return;

    setAggregating(true);
    try {
      const res = await fetch('/api/kafka/aggregate-demand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subLocationId })
      });

      if (res.ok) {
        const data = await res.json();
        alert(
          `✅ Demand aggregated successfully!\n\n` +
          `Bookings: ${data.metric.bookingsCount}\n` +
          `Demand Pressure: ${data.metric.demandPressure}\n` +
          `Historical Avg: ${data.metric.historicalAvg}\n` +
          `Delta: ${data.metric.pressureDelta > 0 ? '+' : ''}${data.metric.pressureDelta}`
        );
        await loadMetrics();
      } else {
        const error = await res.json();
        alert(`Failed to aggregate demand: ${error.error}`);
      }
    } catch (error) {
      alert('Error aggregating demand');
      console.error(error);
    } finally {
      setAggregating(false);
    }
  };

  const materializeSurgeManually = async () => {
    if (!subLocationId) {
      alert('Please select a sublocation');
      return;
    }

    const confirmed = confirm(
      `This will update surge configs and create ONE DRAFT ratesheet for the selected sublocation.\n\nSubLocation: ${subLocationId.substring(0, 12)}...\n\nContinue?`
    );
    if (!confirmed) return;

    setMaterializing(true);
    try {
      const res = await fetch('/api/kafka/materialize-surge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subLocationId, locationId: locationId || undefined })
      });

      if (res.ok) {
        const data = await res.json();
        alert(
          `✅ Surge ratesheets materialized!\n\n` +
          `Created: ${data.ratesheets.length} ratesheet(s)\n\n` +
          data.ratesheets.map((r: any) =>
            `• ${r.configName}\n  Multiplier: ${r.multiplier.toFixed(3)}\n  Demand: ${r.demand}, Supply: ${r.supply}`
          ).join('\n\n')
        );
        await loadMetrics();
      } else {
        const error = await res.json();
        alert(`Failed to materialize surge: ${error.error}`);
      }
    } catch (error) {
      alert('Error materializing surge');
      console.error(error);
    } finally {
      setMaterializing(false);
    }
  };

  const updateRatesheetStatus = async (ratesheetId: string, approvalStatus?: string, isActive?: boolean) => {
    setUpdatingRatesheet(ratesheetId);
    try {
      const res = await fetch(`/api/kafka/ratesheets/${ratesheetId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus, isActive })
      });

      if (res.ok) {
        await loadMetrics();
        const statusText = approvalStatus ? `Status: ${approvalStatus}` : '';
        const activeText = isActive !== undefined ? `Active: ${isActive}` : '';
        alert(`✅ Ratesheet updated!\n${statusText}${statusText && activeText ? ', ' : ''}${activeText}`);
      } else {
        const error = await res.json();
        alert(`Failed to update ratesheet: ${error.error}`);
      }
    } catch (error) {
      alert('Error updating ratesheet');
      console.error(error);
    } finally {
      setUpdatingRatesheet(null);
    }
  };

  useEffect(() => {
    loadMetrics();
    loadEntities();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(loadMetrics, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading metrics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              Kafka Monitoring Dashboard
            </h1>
            <p className="text-slate-600">
              Real-time demand metrics and surge pricing monitoring
            </p>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              autoRefresh
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-slate-300 text-slate-700 hover:bg-slate-400'
            }`}
          >
            {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
          </button>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Demand History"
            value={metrics?.overview.demandHistoryTotal.toLocaleString() || '0'}
            subtitle="Total records"
            color="blue"
          />
          <MetricCard
            title="Last 24h Metrics"
            value={metrics?.overview.metricsLast24h.toString() || '0'}
            subtitle={`${metrics?.overview.totalBookingsLast24h || 0} bookings`}
            color="purple"
          />
          <MetricCard
            title="Avg Pressure"
            value={metrics?.overview.avgPressureLast24h || '0.00'}
            subtitle="Last 24 hours"
            color="orange"
          />
          <MetricCard
            title="Active Surge Configs"
            value={metrics?.overview.activeSurgeConfigs.toString() || '0'}
            subtitle={`${metrics?.overview.recentRatesheets || 0} recent ratesheets`}
            color="green"
          />
        </div>

        {/* Data Generator Control Panel */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            🎮 Synthetic Data Generator
          </h2>

          {/* Active Generators */}
          {generatorStatus && generatorStatus.count > 0 && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="font-semibold text-green-800 mb-2">
                Active Generators ({generatorStatus.count})
              </div>
              {generatorStatus.active.map((gen) => (
                <div key={gen.subLocationId} className="flex justify-between items-center py-2">
                  <span className="text-sm text-green-700">
                    SubLocation: {gen.subLocationId.substring(0, 12)}... (PID: {gen.pid})
                  </span>
                  <button
                    onClick={() => stopGenerator(gen.subLocationId)}
                    className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                  >
                    Stop
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Mode Toggle */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setGeneratorMode('preset')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                generatorMode === 'preset'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              📋 Preset Scenarios
            </button>
            <button
              onClick={() => setGeneratorMode('custom')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                generatorMode === 'custom'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              ⚡ Custom Rate
            </button>
          </div>

          {/* Start Generator Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {generatorMode === 'preset' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Scenario
                </label>
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                >
                  <option value="RAPID_TEST">🚀 Rapid Test (1/min for 6 min)</option>
                  <option value="PEAK_HOUR">Peak Hour (1/3min for 1 hr)</option>
                  <option value="NORMAL">Normal (1/12min for 2 hr)</option>
                  <option value="LOW">Low (1/30min for 1 hr)</option>
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Messages/Second
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.5"
                    value={messagesPerSecond}
                    onChange={(e) => setMessagesPerSecond(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Total Messages
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    value={totalMessages}
                    onChange={(e) => setTotalMessages(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                SubLocation *
              </label>
              <select
                value={subLocationId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  setSubLocationId(selectedId);

                  // Auto-populate location when sublocation is selected
                  const selectedSublocation = entities?.sublocations.find(s => s.id === selectedId);
                  if (selectedSublocation) {
                    setLocationId(selectedSublocation.locationId);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              >
                <option value="">Select a sublocation...</option>
                {entities?.sublocations.map((subloc) => (
                  <option key={subloc.id} value={subloc.id}>
                    {subloc.label} ({subloc.locationName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Location (optional)
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              >
                <option value="">Auto (from sublocation)</option>
                {entities?.locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={startGenerator}
                disabled={startingGenerator}
                className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {startingGenerator ? 'Starting...' : 'Start Generator'}
              </button>
            </div>
          </div>
        </div>

        {/* Manual Controls Panel */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            🎯 Manual Test Controls
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Test the demand aggregation and surge materialization flow manually before enabling automatic mode.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Aggregate Demand */}
            <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">1️⃣</span>
                <h3 className="font-semibold text-slate-800">Aggregate Demand</h3>
              </div>
              <p className="text-sm text-slate-600 mb-3">
                Creates ONE demand_history record from generated events for the selected sublocation.
              </p>
              <button
                onClick={aggregateDemandManually}
                disabled={aggregating || !subLocationId}
                className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aggregating ? '⏳ Aggregating...' : '📊 Aggregate Demand'}
              </button>
            </div>

            {/* Step 2: Materialize Surge */}
            <div className="p-4 border border-orange-200 rounded-lg bg-orange-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">2️⃣</span>
                <h3 className="font-semibold text-slate-800">Materialize Ratesheet</h3>
              </div>
              <p className="text-sm text-slate-600 mb-3">
                Updates surge config and creates ONE DRAFT ratesheet for the selected sublocation.
              </p>
              <button
                onClick={materializeSurgeManually}
                disabled={materializing || !subLocationId}
                className="w-full px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {materializing ? '⏳ Materializing...' : '🔥 Materialize Ratesheet'}
              </button>
            </div>
          </div>

          {!subLocationId && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Please select a sublocation above to enable manual controls
              </p>
            </div>
          )}
        </div>

        {/* Top Locations */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            📊 Top Locations (Last 24h)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">SubLocation ID</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Total Bookings</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Avg Pressure</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Data Points</th>
                </tr>
              </thead>
              <tbody>
                {metrics?.topLocations.map((loc, idx) => (
                  <tr key={loc.subLocationId} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm font-mono text-slate-700">
                      {loc.subLocationId.substring(0, 16)}...
                    </td>
                    <td className="text-right py-3 px-4 text-sm font-semibold text-slate-900">
                      {loc.totalBookings}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-slate-700">
                      {loc.avgPressure.toFixed(2)}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-slate-600">
                      {loc.dataPoints}
                    </td>
                  </tr>
                ))}
                {(!metrics?.topLocations || metrics.topLocations.length === 0) && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-500">
                      No data available. Start the generator to create metrics.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Surge Configs Status */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            🔥 Active Surge Configs
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Name</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Level</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Demand</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Supply</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Historical Avg</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Last Materialized</th>
                </tr>
              </thead>
              <tbody>
                {metrics?.surgeConfigs.map((config) => (
                  <tr key={config.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm font-medium text-slate-900">{config.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                        {config.level}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-sm font-semibold text-orange-600">
                      {config.currentDemand}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-slate-700">
                      {config.currentSupply}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-slate-600">
                      {config.historicalAvg.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      {config.lastMaterialized
                        ? new Date(config.lastMaterialized).toLocaleString()
                        : 'Never'}
                    </td>
                  </tr>
                ))}
                {(!metrics?.surgeConfigs || metrics.surgeConfigs.length === 0) && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      No active surge configs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Ratesheets */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            📄 Recent Surge Ratesheets
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Name</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Multiplier</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Active</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Effective Period</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Time Windows</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Demand</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Supply</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Created</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {metrics?.recentRatesheets.slice(0, 10).map((ratesheet) => (
                  <tr key={ratesheet.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm text-slate-900">{ratesheet.name}</td>
                    <td className="text-right py-3 px-4 text-sm font-bold text-orange-600">
                      {ratesheet.multiplier}x
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          ratesheet.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : ratesheet.status === 'DRAFT'
                            ? 'bg-yellow-100 text-yellow-800'
                            : ratesheet.status === 'SUPERSEDED'
                            ? 'bg-gray-100 text-gray-600'
                            : ratesheet.status === 'ARCHIVED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {ratesheet.status}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          ratesheet.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {ratesheet.isActive ? '✓ Active' : '○ Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      <div className="text-xs">
                        <div>
                          <span className="text-slate-500">From:</span>{' '}
                          {ratesheet.effectiveFrom
                            ? new Date(ratesheet.effectiveFrom).toLocaleString()
                            : '—'}
                        </div>
                        <div>
                          <span className="text-slate-500">To:</span>{' '}
                          {ratesheet.effectiveTo
                            ? new Date(ratesheet.effectiveTo).toLocaleString()
                            : 'Indefinite'}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {ratesheet.timeWindows && ratesheet.timeWindows.length > 0 ? (
                        <div className="text-xs space-y-1">
                          {ratesheet.timeWindows.map((tw, idx) => (
                            <div key={idx} className="bg-slate-100 rounded px-2 py-1">
                              {tw.windowType === 'DURATION_BASED' ? (
                                <span>
                                  {tw.startMinute}–{tw.endMinute} min
                                </span>
                              ) : (
                                <span>
                                  {tw.startTime || '00:00'}–{tw.endTime || '24:00'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-slate-700">
                      {ratesheet.demandSnapshot}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-slate-700">
                      {ratesheet.supplySnapshot}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      <div className="text-xs">
                        {new Date(ratesheet.createdAt).toLocaleString()}
                        {ratesheet.createdBy && (
                          <div className="text-slate-400">by {ratesheet.createdBy}</div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1 justify-center">
                        {/* Approve button - only show for DRAFT */}
                        {ratesheet.status === 'DRAFT' && (
                          <button
                            onClick={() => updateRatesheetStatus(ratesheet.id, 'APPROVED')}
                            disabled={updatingRatesheet === ratesheet.id}
                            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Approve and activate"
                          >
                            ✓ Approve
                          </button>
                        )}

                        {/* Archive button - show for APPROVED or DRAFT */}
                        {(ratesheet.status === 'APPROVED' || ratesheet.status === 'DRAFT') && (
                          <button
                            onClick={() => updateRatesheetStatus(ratesheet.id, 'ARCHIVED')}
                            disabled={updatingRatesheet === ratesheet.id}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Archive and deactivate"
                          >
                            🗄️ Archive
                          </button>
                        )}

                        {/* Activate/Deactivate toggle - only for APPROVED */}
                        {ratesheet.status === 'APPROVED' && (
                          ratesheet.isActive ? (
                            <button
                              onClick={() => updateRatesheetStatus(ratesheet.id, undefined, false)}
                              disabled={updatingRatesheet === ratesheet.id}
                              className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Deactivate (keep approved)"
                            >
                              ⏸️ Pause
                            </button>
                          ) : (
                            <button
                              onClick={() => updateRatesheetStatus(ratesheet.id, undefined, true)}
                              disabled={updatingRatesheet === ratesheet.id}
                              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Activate"
                            >
                              ▶️ Activate
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!metrics?.recentRatesheets || metrics.recentRatesheets.length === 0) && (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-slate-500">
                      No surge ratesheets created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({
  title,
  value,
  subtitle,
  color
}: {
  title: string;
  value: string;
  subtitle: string;
  color: 'blue' | 'purple' | 'orange' | 'green';
}) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    green: 'from-green-500 to-green-600'
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
      <div className="text-sm font-medium text-slate-600 mb-2">{title}</div>
      <div className={`text-3xl font-bold bg-gradient-to-r ${colorClasses[color]} bg-clip-text text-transparent mb-1`}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{subtitle}</div>
    </div>
  );
}
