'use client';

import { Zap, Loader2 } from 'lucide-react';
import type { TimeSlot } from '@/lib/timeline-simulator-types';
import { formatPriceWithSuperscript } from '@/lib/timeline-simulator-types';

interface WinningPriceGridProps {
  timeSlots: TimeSlot[];
  selectedSlot: { slotIdx: number; layerId: string } | null;
  hoveredSlot: { slotIdx: number; layerId: string } | null;
  onTileClick: (slotIdx: number, layerId: string, slot: TimeSlot) => void;
  onTileHover: (slotIdx: number, layerId: string) => void;
  onTileLeave: () => void;
  surgeEnabled: boolean;
  isSimulationEnabled: boolean;
  enabledLayers: Set<string>;
  pricingDataLoading: boolean;
  isRefreshing: boolean;
}

export default function WinningPriceGrid({
  timeSlots,
  selectedSlot,
  hoveredSlot,
  onTileClick,
  onTileHover,
  onTileLeave,
  surgeEnabled,
  isSimulationEnabled,
  enabledLayers,
  pricingDataLoading,
  isRefreshing,
}: WinningPriceGridProps) {
  return (
    <>
      {/* Time markers in grid with winning prices */}
      <h3 className="text-xl font-bold text-gray-900 text-center ml-6">
        Winning Price by Hour
      </h3>

      {/* Operating Hours Legend */}
      {timeSlots.some(slot => slot.isAvailable === false) && (
        <div className="flex items-center justify-center gap-6 mt-3 mb-2 text-xs">
          <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
            <span className="font-medium text-gray-600">Legend:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gradient-to-r from-blue-500 to-purple-500"></div>
              <span className="text-gray-600">Open</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gradient-to-r from-gray-400 to-gray-500"></div>
              <span className="text-gray-600">Closed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gradient-to-r from-red-500 to-red-600"></div>
              <span className="text-gray-600">Blackout</span>
            </div>
          </div>
          <div className="text-gray-500">
            {timeSlots.filter(s => s.isAvailable !== false).length} available / {timeSlots.length} total hours
          </div>
        </div>
      )}

      <div className="relative mb-6 mt-6 ml-6 mr-6">
        {/* Loading Overlay */}
        {(pricingDataLoading || isRefreshing) && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center min-h-[120px]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-pink-600 animate-spin" />
              <span className="text-sm font-medium text-gray-600">Calculating prices...</span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-12 gap-1">
          {timeSlots.map((slot, idx) => {
            const isSelected = selectedSlot?.slotIdx === idx;
            const isHovered = hoveredSlot?.slotIdx === idx;
            const isClosed = slot.isAvailable === false && slot.unavailableReason === 'CLOSED';
            const isBlackout = slot.isAvailable === false && slot.unavailableReason === 'BLACKOUT';
            const isUnavailable = isClosed || isBlackout;

            return (
              <div
                key={idx}
                className={`relative border rounded-xl overflow-hidden cursor-pointer transition-all ${
                  isClosed
                    ? 'bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200'
                    : isBlackout
                    ? 'bg-gradient-to-br from-red-100 via-red-50 to-red-100'
                    : 'bg-gradient-to-br from-silver-500 via-silver-50 to-silver-100'
                } ${
                  isSelected
                    ? 'border-blue-600 border-2 shadow-xl ring-2 ring-blue-300'
                    : isHovered
                    ? 'border-blue-400 border-2 shadow-lg'
                    : isClosed
                    ? 'border-gray-300 shadow-sm'
                    : isBlackout
                    ? 'border-red-300 shadow-sm'
                    : 'border-gray-200 shadow-sm'
                }`}
                onClick={() => onTileClick(idx, 'pricing-tile', slot)}
                onMouseEnter={() => onTileHover(idx, 'pricing-tile')}
                onMouseLeave={onTileLeave}
              >
                {/* Header with time */}
                <div className={`px-2 py-1.5 text-center ${
                  isClosed
                    ? 'bg-gradient-to-r from-gray-500 to-gray-600'
                    : isBlackout
                    ? 'bg-gradient-to-r from-red-600 to-red-700'
                    : 'bg-gradient-to-r from-slate-600 to-slate-700'
                }`}>
                  <div className="text-[11px] font-bold text-white tracking-tight">{slot.label}</div>
                  <div className={`text-[9px] font-medium ${
                    isClosed ? 'text-gray-300' : isBlackout ? 'text-red-200' : 'text-slate-300'
                  }`}>
                    {slot.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>

                {/* Pricing Section */}
                <div className={`px-2 py-3 border-b border-gray-100 ${
                  isClosed
                    ? 'bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100'
                    : isBlackout
                    ? 'bg-gradient-to-br from-red-50 via-red-25 to-red-50'
                    : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'
                }`}>
                  <div className="text-[8px] uppercase font-light text-gray-500 mb-1 tracking-wider flex items-center justify-left gap-1">
                    {isUnavailable ? 'Status' : 'Price'}
                    {!isUnavailable && surgeEnabled && slot.surgePrice !== undefined && slot.winningLayer?.type === 'SURGE' && (!isSimulationEnabled || (slot.winningLayer?.id && enabledLayers.has(slot.winningLayer.id))) && (
                      <Zap className="w-2 h-2 text-orange-600" />
                    )}
                  </div>
                  {isUnavailable ? (
                    <div className="flex flex-col items-start gap-1">
                      <div className={`text-base font-bold ${
                        isClosed ? 'text-gray-500' : 'text-red-600'
                      }`}>
                        {isClosed ? 'CLOSED' : 'BLACKOUT'}
                      </div>
                      <div className="text-[9px] text-gray-400">
                        {isClosed ? 'Outside hours' : 'Holiday/Closure'}
                      </div>
                    </div>
                  ) : slot.winningPrice !== undefined && slot.winningPrice !== null ? (
                    surgeEnabled && slot.surgePrice !== undefined && slot.winningLayer?.type === 'SURGE' && (!isSimulationEnabled || (slot.winningLayer?.id && enabledLayers.has(slot.winningLayer.id))) ? (
                      <div className="space-y-1">
                        {slot.basePrice !== undefined && (() => {
                          const { dollars, cents } = formatPriceWithSuperscript(slot.basePrice);
                          return (
                            <div className="relative text-sm font-bold text-gray-400 line-through" style={{ lineHeight: 1 }}>
                              ${dollars}<span className="text-xs relative -top-0.5 ml-0.5">.{cents}</span>
                            </div>
                          );
                        })()}
                        {(() => {
                          const { dollars, cents } = formatPriceWithSuperscript(slot.surgePrice);
                          return (
                            <div className={`relative text-2xl font-black ${
                              slot.basePrice && slot.surgePrice > slot.basePrice
                                ? 'bg-gradient-to-r from-orange-600 to-red-600'
                                : slot.basePrice && slot.surgePrice < slot.basePrice
                                ? 'bg-gradient-to-r from-green-600 to-emerald-600'
                                : 'bg-gradient-to-r from-gray-600 to-gray-700'
                            } bg-clip-text text-transparent`} style={{ lineHeight: 1 }}>
                              ${dollars}<span className="text-sm relative -top-1 ml-0.5">.{cents}</span>
                            </div>
                          );
                        })()}
                        {slot.surgeMultiplier && (
                          <div className={`text-[9px] font-bold ${
                            slot.surgeMultiplier > 1
                              ? 'text-red-600'
                              : slot.surgeMultiplier < 1
                              ? 'text-green-600'
                              : 'text-gray-600'
                          }`}>
                            {slot.surgeMultiplier.toFixed(2)}x
                          </div>
                        )}
                      </div>
                    ) : (() => {
                      const { dollars, cents } = formatPriceWithSuperscript(slot.winningPrice);
                      return (
                        <div className="relative text-xl font-extrabold font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent" style={{ lineHeight: 1 }}>
                          ${dollars}<span className="text-xs font-thin relative -top-1 ml-0.5">.{cents}</span>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-base font-extrabold text-gray-300">
                      -
                    </div>
                  )}
                </div>

                {/* Capacity Section */}
                {slot.capacity && (
                  <div className="bg-white px-2 py-2.5 border-b border-gray-100">
                    <div className="text-[8px] uppercase font-semibold text-gray-500 mb-1 tracking-wider">Capacity</div>
                    <div className="flex items-baseline justify-left gap-0">
                      <span className="text-base font-extrabold font-black text-slate-700">{slot.capacity.allocated}</span>
                      <span className="text-xs font-thin text-gray-400">/</span>
                      <span className="text-xs font-thin text-slate-600">{slot.capacity.max}</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min((slot.capacity.allocated / slot.capacity.max) * 100, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Revenue Section */}
                {slot.capacity && (slot.winningPrice !== undefined && slot.winningPrice !== null) && (
                  <div className="bg-gradient-to-br from-red-50 to-orange-50 px-2 py-2.5 border-b-2 border-silver-900 border-dashed">
                    <div className="text-[8px] uppercase font-semibold text-gray-500 mb-1 tracking-wider">Revenue Max</div>
                    <div className="flex items-baseline justify-left gap-0.5">
                      <span className="text-lg font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                        ${Math.ceil(slot.capacity.max * (surgeEnabled && slot.surgePrice && slot.winningLayer?.type === 'SURGE' && (!isSimulationEnabled || (slot.winningLayer?.id && enabledLayers.has(slot.winningLayer.id))) ? slot.surgePrice : slot.winningPrice)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Event Section */}
                {slot.eventNames && slot.eventNames.length > 0 && (
                  <div className="bg-gradient-to-br from-zinc-50 via-silver-50 to-silver-100 px-2 py-2.5">
                    <div className="text-[8px] uppercase font-thin text-black mb-1 tracking-wider">
                      {slot.eventNames.length > 1 ? 'Events' : 'Event'}
                    </div>
                    <div className="text-[10px] font-light text-gray-700 text-left space-y-1">
                      {slot.eventNames.map((eventName, eventIdx) => (
                        <div key={eventIdx} className="line-clamp-1 bg-white/40 rounded px-1 py-0.5">
                          {eventName}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
