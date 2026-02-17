'use client';

import { RefreshCw, Loader2 } from 'lucide-react';
import type { TimeSlot } from '@/lib/timeline-simulator-types';

interface HourlyRateChartProps {
  timeSlots: TimeSlot[];
  viewStart: Date;
  selectedDuration: number;
  onDurationChange: (hours: number) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  pricingDataLoading: boolean;
}

const formatDateTime = (date: Date): string => {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export default function HourlyRateChart({
  timeSlots,
  viewStart,
  selectedDuration,
  onDurationChange,
  onRefresh,
  isRefreshing,
  pricingDataLoading,
}: HourlyRateChartProps) {
  if (timeSlots.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 mt-6 ml-6 mr-6 relative">
      {/* Loading Overlay */}
      {(pricingDataLoading || isRefreshing) && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="text-sm font-medium text-gray-600">Loading pricing data...</span>
          </div>
        </div>
      )}
      {/* Header with Stats */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xl font-bold text-gray-900">
              Hourly Rate Breakdown
            </h3>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`p-1.5 rounded-lg transition-all ${
                isRefreshing
                  ? 'bg-blue-100 text-blue-600 cursor-wait'
                  : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600'
              }`}
              title="Refresh pricing data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-sm text-gray-600">
            Next {timeSlots.length} hours starting from {formatDateTime(viewStart)}
          </p>
        </div>

        {/* Min/Avg/Max Visual Slider */}
        <div className="flex items-center gap-4 min-w-[280px]">
          {(() => {
            const prices = timeSlots.filter(s => s.winningPrice).map(s => s.winningPrice!);
            if (prices.length === 0) return null;

            const min = Math.min(...prices);
            const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
            const max = Math.max(...prices);

            const range = max - min;
            const avgPosition = range > 0 ? ((avg - min) / range) * 100 : 50;

            return (
              <div className="flex-1">
                <div className="relative pt-2 pb-1">
                  <div className="relative h-2 bg-gradient-to-r from-blue-100 via-blue-200 to-red-100 rounded-full overflow-hidden shadow-inner">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent"></div>
                  </div>

                  <div
                    className="absolute top-0 transform -translate-x-1/2"
                    style={{ left: `${avgPosition}%` }}
                  >
                    <div className="absolute left-1/2 -translate-x-1/2 w-0.5 h-2 bg-blue-600"></div>
                    <div className="relative mt-2">
                      <div className="w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-lg"></div>
                      <div className="absolute inset-0 w-3 h-3 bg-blue-600 rounded-full animate-ping opacity-75"></div>
                    </div>
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <div className="bg-blue-600 text-white px-2 py-1 rounded-md text-xs font-bold shadow-lg">
                        ${avg.toFixed(2)}
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-blue-600 transform rotate-45"></div>
                    </div>
                  </div>

                  <div className="flex justify-between mt-2 text-xs">
                    <div className="text-blue-600 font-semibold">${min.toFixed(2)}</div>
                    <div className="text-red-600 font-semibold">${max.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Duration Toggle */}
        <div className="flex gap-2 ml-6">
          {[12, 24, 48].map(hours => (
            <button
              key={hours}
              onClick={() => onDurationChange(hours)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedDuration === hours
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {hours}h
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full" style={{ height: '320px' }}>
        <svg className="w-full h-full" viewBox="0 0 1000 320" preserveAspectRatio="xMidYMid meet">
          {/* Gradients */}
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1000" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="eventIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>

          {/* Chart calculation and rendering */}
          {(() => {
            const prices = timeSlots.map(s => s.winningPrice || 0);
            const maxPrice = Math.max(...prices);
            const validPrices = prices.filter(p => p > 0);
            const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : maxPrice;
            const range = maxPrice - minPrice || 1;
            const padding = range * 0.15;

            const chartHeight = 180;
            const chartBaseline = 240;
            const leftMargin = 40;
            const rightMargin = 20;
            const chartWidth = 1000 - leftMargin - rightMargin;

            let yAxisMax, yAxisMin, yAxisRange;

            if (range < 1) {
              const avgPrice = (maxPrice + minPrice) / 2;
              yAxisMin = Math.floor(avgPrice) - 0.5;
              yAxisMax = Math.ceil(avgPrice) + 0.5;
              yAxisRange = yAxisMax - yAxisMin;
            } else if (range < 5) {
              yAxisMax = maxPrice + padding;
              yAxisMin = minPrice - padding;
              yAxisRange = yAxisMax - yAxisMin;
            } else {
              yAxisMax = Math.ceil(maxPrice + padding);
              yAxisMin = Math.floor(minPrice - padding);
              yAxisRange = yAxisMax - yAxisMin;
            }

            if (!isFinite(yAxisRange) || yAxisRange < 0.1) {
              yAxisRange = 1;
              yAxisMax = maxPrice + 0.5;
              yAxisMin = maxPrice - 0.5;
            }

            const points = timeSlots.map((slot, i) => {
              const x = timeSlots.length === 1
                ? leftMargin + chartWidth / 2
                : leftMargin + (i / (timeSlots.length - 1)) * chartWidth;

              const normalizedPrice = ((slot.winningPrice || 0) - yAxisMin) / yAxisRange;
              const y = chartBaseline - (normalizedPrice * chartHeight);

              return { x, y, slot };
            });

            const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
            const hasInvalidPoints = points.some(p => !isFinite(p.x) || !isFinite(p.y));

            return (
              <>
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map(i => {
                  const price = yAxisMax - (i * yAxisRange / 4);
                  const normalizedPrice = (price - yAxisMin) / yAxisRange;
                  const y = chartBaseline - (normalizedPrice * chartHeight);

                  return (
                    <line
                      key={`grid-${i}`}
                      x1={leftMargin}
                      y1={y}
                      x2={leftMargin + chartWidth}
                      y2={y}
                      stroke="#e5e7eb"
                      strokeWidth="0.5"
                      opacity="0.5"
                    />
                  );
                })}

                {/* Area fill */}
                <polygon
                  points={`${leftMargin},${chartBaseline} ${pointsStr} ${leftMargin + chartWidth},${chartBaseline}`}
                  fill="url(#areaGradient)"
                />

                {/* Line */}
                {!hasInvalidPoints && (
                  <>
                    <polyline
                      points={pointsStr}
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points={pointsStr}
                      fill="none"
                      stroke="url(#lineGradient)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.2"
                      filter="blur(4px)"
                    />
                    <polyline
                      points={pointsStr}
                      fill="none"
                      stroke="url(#lineGradient)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                )}

                {/* Data points */}
                {points.map(({ x, y, slot }, i) => {
                  const hasEvents = slot.events && slot.events.length > 0;
                  const eventCount = slot.events?.length || 0;

                  return (
                    <g key={i}>
                      {hasEvents && slot.events!.map((event, eventIdx) => {
                        const ringRadius = 10 + ((eventCount - eventIdx - 1) * 4);

                        return (
                          <g key={`event-circle-${i}-${eventIdx}`}>
                            <circle
                              cx={x}
                              cy={y}
                              r={ringRadius + 2}
                              fill="none"
                              stroke="url(#lineGradient)"
                              strokeWidth="4"
                              opacity="0.15"
                            />
                            <circle
                              cx={x}
                              cy={y}
                              r={ringRadius}
                              fill="rgba(255, 255, 255, 0.95)"
                              stroke="url(#lineGradient)"
                              strokeWidth="2"
                              opacity="0.9"
                            />
                            <title>{event.name} (Priority: {event.priority})</title>
                          </g>
                        );
                      })}

                      <circle
                        cx={x}
                        cy={y}
                        r="5"
                        fill="#ffffff"
                        stroke="url(#lineGradient)"
                        strokeWidth="3"
                      />

                      <title>
                        {slot.label} - ${slot.winningPrice?.toFixed(2) || '0.00'}/hr
                        {hasEvents && `\n\n🗓️ ${eventCount} Event${eventCount > 1 ? 's' : ''}:\n${slot.events!.map(e => `• ${e.name} (Priority: ${e.priority})`).join('\n')}`}
                      </title>
                    </g>
                  );
                })}

                {/* X-axis labels */}
                {points.map(({ x, slot }, i) => {
                  const labelInterval = timeSlots.length <= 12 ? 2 : timeSlots.length <= 24 ? 4 : 8;
                  if (i % labelInterval !== 0 && i !== points.length - 1) return null;

                  const showDayLabel = i === 0 || slot.date.getDate() !== points[i - 1]?.slot.date.getDate();

                  return (
                    <g key={`label-${i}`}>
                      <line
                        x1={x}
                        y1={chartBaseline}
                        x2={x}
                        y2={chartBaseline + 6}
                        stroke="#cbd5e1"
                        strokeWidth="1.5"
                      />
                      <text
                        x={x}
                        y={chartBaseline + 20}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="11"
                        fontWeight="600"
                      >
                        {slot.label}
                      </text>
                      {showDayLabel && (
                        <text
                          x={x}
                          y={chartBaseline + 34}
                          textAnchor="middle"
                          fill="#94a3b8"
                          fontSize="9"
                          fontWeight="500"
                        >
                          {slot.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Y-axis labels */}
                {[0, 1, 2, 3, 4].map(i => {
                  const price = yAxisMax - (i * yAxisRange / 4);
                  const normalizedPrice = (price - yAxisMin) / yAxisRange;
                  const y = chartBaseline - (normalizedPrice * chartHeight);

                  let decimals;
                  if (yAxisRange < 2) {
                    decimals = 2;
                  } else if (yAxisRange < 10) {
                    decimals = 1;
                  } else {
                    decimals = 0;
                  }

                  return (
                    <text
                      key={`y-${i}`}
                      x="30"
                      y={y + 5}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize="11"
                      fontWeight="600"
                    >
                      ${price.toFixed(decimals)}
                    </text>
                  );
                })}
              </>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
