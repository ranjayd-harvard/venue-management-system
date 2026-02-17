'use client';

import {
  Clock,
  Filter,
  ChevronDown,
  X,
  Zap,
  FileText,
  Save,
  FolderOpen,
  Activity,
  Rocket,
} from 'lucide-react';
import { PricingScenario, SurgeConfig } from '@/models/types';

interface SimulatorHeaderProps {
  currentSubLocationLabel?: string;
  currentLocationName?: string;
  currentEventName?: string;
  selectedSubLocation: string;
  selectedDuration: number;
  isEventBooking: boolean;

  isSimulationEnabled: boolean;
  onSimulationToggle: (enabled: boolean) => void;
  isPlanningEnabled: boolean;
  onPlanningToggle: (enabled: boolean) => void;

  surgeEnabled: boolean;
  onSurgeToggle: (enabled: boolean) => void;
  activeSurgeConfig: SurgeConfig | null;
  appliedSurgeRatesheets: Array<{ id: string; name: string; priority: number }>;

  scenarios: PricingScenario[];
  currentScenarioId: string | null;
  hasUnsavedChanges: boolean;
  onSaveScenario: () => void;
  onLoadScenario: (scenario: PricingScenario) => void;
  onClearScenario: () => void;
  onPromoteToProduction: () => void;

  onOpenFilters: () => void;
}

export default function SimulatorHeader({
  currentSubLocationLabel,
  currentLocationName,
  currentEventName,
  selectedSubLocation,
  selectedDuration,
  isEventBooking,
  isSimulationEnabled,
  onSimulationToggle,
  isPlanningEnabled,
  onPlanningToggle,
  surgeEnabled,
  onSurgeToggle,
  activeSurgeConfig,
  appliedSurgeRatesheets,
  scenarios,
  currentScenarioId,
  hasUnsavedChanges,
  onSaveScenario,
  onLoadScenario,
  onClearScenario,
  onPromoteToProduction,
  onOpenFilters,
}: SimulatorHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-2xl">
      <div className="max-w-[1800px] mx-auto px-8 py-8">
        <div className="flex justify-between items-center">
          <div>
            {/* Dynamic Title: Show SubLocation name or default */}
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold">
                {currentSubLocationLabel || 'Pricing Simulator'}
              </h1>
              <button
                onClick={onOpenFilters}
                className="bg-white/10 backdrop-blur-sm border border-white/30 text-white p-2 rounded-lg hover:bg-white/20 transition-all shadow-lg"
                title="Change SubLocation"
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>

            {/* Location context and description */}
            {currentLocationName && currentSubLocationLabel ? (
              <p className="text-pink-100 font-thin">
                📍 {currentLocationName} • Visual waterfall showing pricing hierarchy
              </p>
            ) : (
              <p className="text-pink-100 font-thin">Visual waterfall showing pricing hierarchy and winning rates for each hour</p>
            )}

            {/* Selected Values Display */}
            {selectedSubLocation && (
              <div className="flex flex-wrap items-center gap-2 text-sm mt-4">
                {currentEventName && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white font-medium border border-white/30">
                    🗓️ {currentEventName}
                  </span>
                )}
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white font-medium border border-white/30">
                  ⏱️ {selectedDuration}h
                </span>
                {isEventBooking && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white font-medium border border-white/30">
                    🎫 Event Booking
                  </span>
                )}
                {/* Timezone Info */}
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white font-medium border border-white/30">
                  <Clock className="w-3 h-3 mr-1.5" />
                  {new Date().toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium border border-white/30">
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 items-end">
            {/* Mode Toggles - Hierarchical Structure */}
            <div className="flex flex-col gap-3 items-end w-full">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex flex-col gap-2 border border-white/20">
                {/* Mode Toggle - Radio Button Style */}
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-1 flex gap-1">
                    {/* Live Mode Button */}
                    <button
                      onClick={() => onSimulationToggle(false)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        !isSimulationEnabled
                          ? 'bg-white text-purple-600 shadow-sm'
                          : 'text-white hover:bg-white/10'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Live Mode
                    </button>

                    {/* Simulation Mode Button */}
                    <button
                      onClick={() => onSimulationToggle(true)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        isSimulationEnabled
                          ? 'bg-white text-purple-600 shadow-sm'
                          : 'text-white hover:bg-white/10'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Simulation
                    </button>
                  </div>
                </div>

                {/* Children of Simulation - Only show when Simulation is enabled */}
                {isSimulationEnabled && (
                  <div className="ml-6 flex flex-col gap-2 border-l-2 border-white/30 pl-4">
                    {/* Surge Pricing Toggle - Child of Simulation */}
                    <button
                      onClick={() => onSurgeToggle(!surgeEnabled)}
                      disabled={!activeSurgeConfig}
                      className={`flex items-center gap-2 group ${
                        !activeSurgeConfig ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                      title={!activeSurgeConfig ? 'No surge config available for this sublocation' : 'Toggle surge pricing'}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        surgeEnabled && activeSurgeConfig
                          ? 'bg-white border-white'
                          : 'border-white/50 group-hover:border-white/70'
                      }`}>
                        {surgeEnabled && activeSurgeConfig && (
                          <svg className="w-3 h-3 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <Zap className="w-4 h-4 text-white" />
                      <span className="text-white font-semibold text-sm">Surge Pricing</span>
                      {surgeEnabled && activeSurgeConfig && (
                        <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                          {(() => {
                            const { demandSupplyParams, surgeParams } = activeSurgeConfig;
                            const pressure = demandSupplyParams.currentDemand / demandSupplyParams.currentSupply;
                            const normalized = pressure / demandSupplyParams.historicalAvgPressure;
                            const rawFactor = 1 + surgeParams.alpha * Math.log(normalized);
                            const surgeFactor = Math.max(
                              surgeParams.minMultiplier,
                              Math.min(surgeParams.maxMultiplier, rawFactor)
                            );
                            return `${surgeFactor.toFixed(2)}x`;
                          })()}
                        </span>
                      )}
                    </button>

                    {/* Planning Toggle - Child of Simulation */}
                    <button
                      onClick={() => onPlanningToggle(!isPlanningEnabled)}
                      className="flex items-center gap-2 group"
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isPlanningEnabled
                          ? 'bg-white border-white'
                          : 'border-white/50 group-hover:border-white/70'
                      }`}>
                        {isPlanningEnabled && (
                          <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <FileText className="w-4 h-4 text-white" />
                      <span className="text-white font-semibold text-sm">Planning</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Scenario Management - Compact Card */}
              {isPlanningEnabled && isSimulationEnabled && selectedSubLocation && (
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 min-w-[280px]">
                  {/* Current Scenario Status */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/20">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${hasUnsavedChanges ? 'bg-yellow-400 animate-pulse' : currentScenarioId ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                      <span className="text-white/70 text-xs font-medium">
                        {currentScenarioId
                          ? (hasUnsavedChanges ? 'Modified' : 'Saved')
                          : 'No scenario'}
                      </span>
                    </div>
                    {currentScenarioId && (
                      <button
                        onClick={onClearScenario}
                        className="text-white/60 hover:text-red-400 transition-colors"
                        title="Clear scenario"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    {/* Save Button */}
                    <button
                      onClick={onSaveScenario}
                      className="w-full bg-white/20 hover:bg-white/30 border border-white/30 text-white px-3 py-2 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 group"
                    >
                      <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>{currentScenarioId && !hasUnsavedChanges ? 'Save As New' : 'Save Scenario'}</span>
                    </button>

                    {/* Load Scenario - Custom Dropdown */}
                    {scenarios.length > 0 && (
                      <div className="relative">
                        <select
                          onChange={(e) => {
                            const scenario = scenarios.find(s => s._id?.toString() === e.target.value);
                            if (scenario) onLoadScenario(scenario);
                          }}
                          value={currentScenarioId || ''}
                          className="w-full bg-white/20 hover:bg-white/30 border border-white/30 text-white px-3 py-2 pl-9 pr-8 rounded-lg font-medium text-sm transition-all appearance-none cursor-pointer"
                          style={{ backgroundImage: 'none' }}
                        >
                          <option value="" className="bg-purple-600 text-white">Load Scenario...</option>
                          {scenarios.map((scenario) => (
                            <option
                              key={scenario._id?.toString()}
                              value={scenario._id?.toString()}
                              className="bg-purple-600 text-white"
                            >
                              {scenario.name}
                              {scenario._id?.toString() === currentScenarioId && hasUnsavedChanges ? ' •' : ''}
                            </option>
                          ))}
                        </select>
                        <FolderOpen className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/70" />
                        <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/70" />
                      </div>
                    )}

                    {/* Promote to Production Button */}
                    {currentScenarioId && surgeEnabled && appliedSurgeRatesheets.length > 0 && (
                      <div className="pt-2 border-t border-white/20">
                        <button
                          onClick={onPromoteToProduction}
                          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-3 py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg group"
                        >
                          <Rocket className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          <span>Promote to Production</span>
                        </button>
                        <p className="text-xs text-white/60 text-center mt-1">
                          Materialize {appliedSurgeRatesheets.length} surge config{appliedSurgeRatesheets.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
