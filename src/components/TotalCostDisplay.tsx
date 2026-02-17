'use client';

import { Zap } from 'lucide-react';
import { formatPriceWithSuperscript } from '@/lib/timeline-simulator-types';

interface TotalCostDisplayProps {
  totalCost: number;
  totalDuration: string;
  isSimulationEnabled: boolean;
  preSimulationBaselinePrice: number;
  surgeEnabled: boolean;
  hasSurgeConfig: boolean;
}

export default function TotalCostDisplay({
  totalCost,
  totalDuration,
  isSimulationEnabled,
  preSimulationBaselinePrice,
  surgeEnabled,
  hasSurgeConfig,
}: TotalCostDisplayProps) {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-baseline gap-2 mb-2">
        <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Cost</span>
        {surgeEnabled && hasSurgeConfig && (
          <span className="px-2 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
            <Zap className="w-3 h-3" />
            SURGE
          </span>
        )}
      </div>
      <div className="flex items-center justify-center gap-3">
        {isSimulationEnabled && preSimulationBaselinePrice > 0 && totalCost !== preSimulationBaselinePrice ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-baseline gap-4">
              {(() => {
                const baselinePrice = formatPriceWithSuperscript(preSimulationBaselinePrice);
                return (
                  <div className="relative text-4xl font-medium text-gray-400 line-through" style={{ lineHeight: 1 }}>
                    ${baselinePrice.dollars}<span className="text-xs relative -top-2 ml-0.5">.{baselinePrice.cents}</span>
                  </div>
                );
              })()}
              {(() => {
                const currentPrice = formatPriceWithSuperscript(totalCost);
                const isIncrease = totalCost > preSimulationBaselinePrice;
                return (
                  <div className={`relative ${isIncrease ? 'bg-gradient-to-br from-orange-600 to-red-600' : 'bg-gradient-to-br from-green-600 to-emerald-600'} bg-clip-text text-transparent`} style={{ lineHeight: 1 }}>
                    <span className="text-8xl font-semibold tracking-tight">
                      ${currentPrice.dollars}
                    </span>
                    <span className="text-xl font-thin relative -top-4 ml-1">
                      .{currentPrice.cents}
                    </span>
                  </div>
                );
              })()}
            </div>
            <span className={`text-sm font-bold ${totalCost > preSimulationBaselinePrice ? 'text-red-600' : 'text-green-600'}`}>
              {totalCost > preSimulationBaselinePrice ? '+' : ''}
              ${(totalCost - preSimulationBaselinePrice).toLocaleString()}
              {' '}
              ({((totalCost / preSimulationBaselinePrice - 1) * 100).toFixed(1)}%)
            </span>
          </div>
        ) : (
          (() => {
            const price = formatPriceWithSuperscript(totalCost);
            return (
              <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent" style={{ lineHeight: 1 }}>
                <span className="text-8xl font-semibold tracking-tight">
                  ${price.dollars}
                </span>
                <span className="text-3xl font-thin relative -top-4 ml-1">
                  .{price.cents}
                </span>
              </div>
            );
          })()
        )}
      </div>
      <div className="mt-3 text-sm text-gray-500 font-medium">
        {totalDuration}
      </div>
    </div>
  );
}
