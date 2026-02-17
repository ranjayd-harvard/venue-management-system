'use client';

import { Lock, Loader2 } from 'lucide-react';
import type { PricingLayer, TimeSlot, Ratesheet } from '@/lib/timeline-simulator-types';

interface PricingWaterfallGridProps {
  timeSlots: TimeSlot[];
  allLayers: PricingLayer[];
  enabledLayers: Set<string>;
  isSimulationEnabled: boolean;
  ratesheets: Ratesheet[];
  onToggleLayer: (layerId: string) => void;
  onTileClick: (slotIdx: number, layerId: string, slot: TimeSlot) => void;
  onTileHover: (slotIdx: number, layerId: string) => void;
  onTileLeave: () => void;
  selectedSlot: { slotIdx: number; layerId: string } | null;
  hoveredSlot: { slotIdx: number; layerId: string } | null;
  pricingDataLoading: boolean;
  isRefreshing: boolean;
}

export default function PricingWaterfallGrid({
  timeSlots,
  allLayers,
  enabledLayers,
  isSimulationEnabled,
  ratesheets,
  onToggleLayer,
  onTileClick,
  onTileHover,
  onTileLeave,
  selectedSlot,
  hoveredSlot,
  pricingDataLoading,
  isRefreshing,
}: PricingWaterfallGridProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 relative">
      <h3 className="text-xl font-bold text-gray-900 text-center ml-6">
        All Tiles Evaluated By Hour
      </h3>
      {/* Loading Overlay */}
      {(pricingDataLoading || isRefreshing) && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            <span className="text-sm font-medium text-gray-600">Loading waterfall data...</span>
          </div>
        </div>
      )}
      {/* Waterfall layers */}
      <div className="space-y-2 mb-6">
      {allLayers.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No pricing rules found</p>
          <p className="text-sm mt-2">
            No ratesheets or default rates are configured for this sublocation.
          </p>
        </div>
      )}
      {allLayers.map((layer, layerIdx) => {
        // Check if this layer has any active tiles in the current time window
        const hasActiveTiles = timeSlots.some(slot => {
          const layerData = slot.layers.find(l => l.layer.id === layer.id);
          return layerData?.isActive;
        });

        // Skip rendering this layer if it has no active tiles
        // ONLY in Live Mode - in Simulation Mode, show all layers (for planning)
        if (!hasActiveTiles && !isSimulationEnabled) {
          return null;
        }

        const isLayerEnabled = enabledLayers.has(layer.id);

        // Check if this layer can be disabled
        // Count enabled DEFAULT layers AFTER removing this layer
        // DEFAULT layers are always active, so we need at least one
        const enabledDefaultLayersAfterDisable = Array.from(enabledLayers)
          .filter(id => id !== layer.id) // Exclude current layer
          .filter(id => {
            const l = allLayers.find(layer => layer.id === id);
            return l && (
              l.type === 'SUBLOCATION_DEFAULT' ||
              l.type === 'LOCATION_DEFAULT' ||
              l.type === 'CUSTOMER_DEFAULT'
            );
          });

        // Cannot disable if it would leave zero DEFAULT layers
        // BUT SURGE and RATESHEET layers can always be toggled off
        const wouldLeaveNoDefaultLayers = enabledDefaultLayersAfterDisable.length === 0;
        const canToggleOff = layer.type === 'SURGE' || layer.type === 'RATESHEET' || !wouldLeaveNoDefaultLayers;

        // Debug logging for layer toggle state
        if (layerIdx === 0 || layer.type === 'SURGE') {
          console.log(`🔒 [Layer Toggle Debug] ${layer.name}:`, {
            layerId: layer.id,
            layerType: layer.type,
            isEnabled: isLayerEnabled,
            enabledDefaultLayersAfterDisable: enabledDefaultLayersAfterDisable.length,
            wouldLeaveNoDefaultLayers,
            canToggleOff,
            shouldShowLock: isLayerEnabled && !canToggleOff,
            allEnabledLayers: Array.from(enabledLayers),
            allLayers: allLayers.map(l => ({ id: l.id, name: l.name, type: l.type }))
          });
        }

        return (
        <div key={layer.id}>
          {/* Layer label with toggle */}
          <div className="flex items-center gap-2 mb-1">
            {/* Toggle switch */}
            <button
              onClick={() => isSimulationEnabled && canToggleOff && onToggleLayer(layer.id)}
              disabled={!isSimulationEnabled || (isLayerEnabled && !canToggleOff)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                !isSimulationEnabled || (isLayerEnabled && !canToggleOff) ? 'bg-gray-400 opacity-60 cursor-not-allowed' :
                isLayerEnabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              title={
                !isSimulationEnabled ? 'Enable Simulation mode to toggle layers' :
                (isLayerEnabled && !canToggleOff) ? 'Cannot disable - at least one DEFAULT layer must remain enabled (always-active pricing)' :
                isLayerEnabled ? 'Click to disable this layer' : 'Click to enable this layer'
              }
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isLayerEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
            <div className="text-xs font-medium text-gray-700 flex items-center gap-1" title={layer.name}>
              <span className="font-semibold">{layer.name}</span>
              {(isLayerEnabled && !canToggleOff) && (
                <span title="Cannot disable - at least one DEFAULT layer required (always-active pricing)">
                  <Lock className="w-3 h-3 text-gray-500" />
                </span>
              )}
              <span className="text-[10px] text-gray-500 ml-2">Priority: {layer.priority}</span>
            </div>
          </div>

          {/* Tiles for each time slot in a grid */}
          <div className="grid grid-cols-12 gap-1">
            {timeSlots.length === 0 ? (
              <div className="col-span-12 rounded-lg border-2 border-gray-300 bg-gray-50 h-[60px] flex items-center justify-center">
                <div className="text-gray-500 font-medium text-xs text-center px-2">
                  No Price Info
                </div>
              </div>
            ) : (
              timeSlots.map((slot, slotIdx) => {
                const layerData = slot.layers.find(l => l.layer.id === layer.id);
                const isWinner = slot.winningLayer?.id === layer.id;
                const isHovered = hoveredSlot?.slotIdx === slotIdx && hoveredSlot?.layerId === layer.id;
                const isSelected = selectedSlot?.slotIdx === slotIdx && selectedSlot?.layerId === layer.id;

                // Determine if this tile should be grayed out (active but layer is disabled)
                const isDisabled = !isLayerEnabled && layerData?.isActive;

                return (
                  <div
                    key={slotIdx}
                    onClick={() => layerData?.isActive && isLayerEnabled && onTileClick(slotIdx, layer.id, slot)}
                    onMouseEnter={() => onTileHover(slotIdx, layer.id)}
                    onMouseLeave={onTileLeave}
                    title={
                      isDisabled
                        ? `${layer.name} - $${layerData.price}/hr (Priority: ${layer.priority}) - DISABLED`
                        : layerData?.isActive
                          ? layer.type === 'SURGE'
                            ? `${layer.name} - $${layerData.price}/hr (${((ratesheets.find(rs => rs._id === layer.id) as any)?.surgeMultiplierSnapshot || 0).toFixed(2)}x) (Priority: ${layer.priority})`
                            : `${layer.name} - $${layerData.price}/hr (Priority: ${layer.priority})`
                          : 'Not active for this time'
                    }
                    className={`rounded-lg transition-all cursor-pointer ${
                      isDisabled
                        ? 'bg-gray-400 border-gray-500 opacity-40'
                        : layerData?.isActive
                          ? isWinner
                            ? `${layer.color} border-black shadow-xl`
                            : `${layer.color} border-gray-400 opacity-70 shadow-sm`
                          : 'bg-gray-100 border-gray-300 opacity-30'
                    }`}
                    style={{
                      height: '60px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: isSelected ? '5px' : isWinner ? '4px' : '2px',
                      borderStyle: isWinner ? 'solid' : 'dotted',
                      borderColor: isSelected ? '#2563eb' : undefined,
                      transform: isHovered || isSelected ? 'scale(1.05)' : 'scale(1)',
                      zIndex: isSelected ? 15 : isHovered ? 10 : 1
                    }}
                  >
                    {layerData?.isActive && layerData.price !== null && (
                      <div className="flex flex-col items-center justify-center gap-0.5 px-1">
                        {/* Price (all layers show dollar amount) */}
                        <div className={`font-bold text-sm drop-shadow-md ${
                          isDisabled ? 'text-gray-600 line-through' : 'text-white'
                        }`}>
                          ${typeof layerData.price === 'number' ? layerData.price.toFixed(2) : layerData.price}
                        </div>
                        {/* Surge Multiplier */}
                        {layer.type === 'SURGE' && (() => {
                          const multiplier = (ratesheets.find(rs => rs._id === layer.id) as any)?.surgeMultiplierSnapshot;
                          if (!multiplier) return null;
                          return (
                            <div className={`text-[9px] font-bold drop-shadow-md ${
                              isDisabled ? 'text-gray-500' : multiplier > 1 ? 'text-red-200' : multiplier < 1 ? 'text-green-200' : 'text-white opacity-90'
                            }`}>
                              {multiplier.toFixed(2)}x
                            </div>
                          );
                        })()}
                        {/* Capacity */}
                        {slot.capacity && (
                          <div className="flex flex-col items-center gap-0 w-full">
                            <div className={`text-[8px] font-semibold flex items-baseline gap-0.5 ${
                              isDisabled ? 'text-gray-500' : 'text-white'
                            }`}>
                              <span className="opacity-90">{slot.capacity.allocated}</span>
                              <span className="opacity-60 text-[7px]">/</span>
                              <span className="opacity-70 text-[7px]">{slot.capacity.max}</span>
                            </div>
                            {/* Mini capacity bar */}
                            {!isDisabled && (
                              <div className="w-full h-0.5 bg-white bg-opacity-30 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-white"
                                  style={{
                                    width: `${Math.min((slot.capacity.allocated / slot.capacity.max) * 100, 100)}%`
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        );
      })}
      </div>
    </div>
  );
}
