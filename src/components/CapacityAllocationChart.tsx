'use client';

import { useMemo, useState } from 'react';
import {
  Treemap,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { BarChart3, Circle, LayoutGrid } from 'lucide-react';

// Color scheme matching capacity theme
const COLORS = {
  // Allocated colors
  transient: '#14B8A6',    // teal-500
  events: '#EC4899',       // pink-500
  reserved: '#8B5CF6',     // violet-500
  // Unallocated colors
  unavailable: '#9CA3AF',  // gray-400
  readyToUse: '#F59E0B',   // amber-500
};

// Group colors for the outer ring / headers
const GROUP_COLORS = {
  allocated: '#0D9488',    // teal-600
  unallocated: '#D97706',  // amber-600
};

const LABELS = {
  transient: 'Transient',
  events: 'Events',
  reserved: 'Reserved',
  unavailable: 'Unavailable',
  readyToUse: 'Ready To Use',
};

const DESCRIPTIONS = {
  transient: 'Walk-in and regular bookings',
  events: 'Reserved for events',
  reserved: 'Pre-reserved capacity',
  unavailable: 'Closed or blackout periods',
  readyToUse: 'Available for future allocation',
};

export interface AllocationData {
  transient: number;
  events: number;
  reserved: number;
  unavailable: number;
  readyToUse: number;
}

type ViewMode = 'grouped-bar' | 'donut' | 'treemap';

interface CapacityAllocationChartProps {
  data: AllocationData;
  totalCapacity: number;
  /** @deprecated Use the built-in view mode toggle instead */
  showTreemap?: boolean;
  /** @deprecated Use the built-in view mode toggle instead */
  showStackedBar?: boolean;
  height?: number;
}

// Custom Treemap content renderer
const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, value, color, percentage } = props;

  if (width < 30 || height < 30) {
    return null;
  }

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: color,
          stroke: '#fff',
          strokeWidth: 2,
          strokeOpacity: 1,
        }}
        rx={4}
      />
      {width > 60 && height > 40 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 10}
            textAnchor="middle"
            fill="#fff"
            fontSize={14}
            fontWeight="bold"
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            fill="#fff"
            fontSize={12}
          >
            {percentage}%
          </text>
          {height > 60 && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 28}
              textAnchor="middle"
              fill="rgba(255,255,255,0.8)"
              fontSize={11}
            >
              {value} people
            </text>
          )}
        </>
      )}
    </g>
  );
};

// Custom tooltip for treemap
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border-2 border-gray-200 rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-4 h-4 rounded"
            style={{ backgroundColor: data.color }}
          />
          <span className="font-bold text-gray-900">{data.name}</span>
        </div>
        <div className="text-sm text-gray-600 mb-1">{data.description}</div>
        <div className="text-sm">
          <span className="text-gray-700">Capacity: </span>
          <span className="font-bold text-gray-900">{data.value} people</span>
        </div>
        <div className="text-sm">
          <span className="text-gray-700">Percentage: </span>
          <span className="font-bold text-gray-900">{data.percentage}%</span>
        </div>
      </div>
    );
  }
  return null;
};

// Custom label for donut chart
const renderDonutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percentage < 5) return null;

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
      {percentage}%
    </text>
  );
};

export default function CapacityAllocationChart({
  data,
  totalCapacity,
  height = 300,
}: CapacityAllocationChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grouped-bar');

  // Calculate percentages
  const percentages = useMemo(() => {
    const total = data.transient + data.events + data.reserved + data.unavailable + data.readyToUse;
    if (total === 0) {
      return { transient: 20, events: 20, reserved: 20, unavailable: 20, readyToUse: 20 };
    }
    return {
      transient: Math.round((data.transient / total) * 100),
      events: Math.round((data.events / total) * 100),
      reserved: Math.round((data.reserved / total) * 100),
      unavailable: Math.round((data.unavailable / total) * 100),
      readyToUse: Math.round((data.readyToUse / total) * 100),
    };
  }, [data]);

  // Group totals
  const allocatedTotal = data.transient + data.events + data.reserved;
  const unallocatedTotal = data.unavailable + data.readyToUse;
  const grandTotal = allocatedTotal + unallocatedTotal;
  const allocatedPct = grandTotal > 0 ? Math.round((allocatedTotal / grandTotal) * 100) : 0;
  const unallocatedPct = grandTotal > 0 ? Math.round((unallocatedTotal / grandTotal) * 100) : 0;

  // Within-group percentages (for grouped bar segments)
  const allocatedSegments = useMemo(() => {
    if (allocatedTotal === 0) return { transient: 33, events: 33, reserved: 34 };
    return {
      transient: Math.round((data.transient / allocatedTotal) * 100),
      events: Math.round((data.events / allocatedTotal) * 100),
      reserved: Math.round((data.reserved / allocatedTotal) * 100),
    };
  }, [data, allocatedTotal]);

  const unallocatedSegments = useMemo(() => {
    if (unallocatedTotal === 0) return { unavailable: 50, readyToUse: 50 };
    return {
      unavailable: Math.round((data.unavailable / unallocatedTotal) * 100),
      readyToUse: Math.round((data.readyToUse / unallocatedTotal) * 100),
    };
  }, [data, unallocatedTotal]);

  // Donut chart data
  const allocatedDonutData = useMemo(() => [
    { name: LABELS.transient, value: data.transient, color: COLORS.transient, percentage: percentages.transient, description: DESCRIPTIONS.transient },
    { name: LABELS.events, value: data.events, color: COLORS.events, percentage: percentages.events, description: DESCRIPTIONS.events },
    { name: LABELS.reserved, value: data.reserved, color: COLORS.reserved, percentage: percentages.reserved, description: DESCRIPTIONS.reserved },
  ].filter(d => d.value > 0), [data, percentages]);

  const unallocatedDonutData = useMemo(() => [
    { name: LABELS.unavailable, value: data.unavailable, color: COLORS.unavailable, percentage: percentages.unavailable, description: DESCRIPTIONS.unavailable },
    { name: LABELS.readyToUse, value: data.readyToUse, color: COLORS.readyToUse, percentage: percentages.readyToUse, description: DESCRIPTIONS.readyToUse },
  ].filter(d => d.value > 0), [data, percentages]);

  // Prepare treemap data - separate for allocated and unallocated
  const allocatedTreemapData = useMemo(() => [
    { name: LABELS.transient, size: data.transient || 1, value: data.transient, color: COLORS.transient, percentage: percentages.transient, description: DESCRIPTIONS.transient },
    { name: LABELS.events, size: data.events || 1, value: data.events, color: COLORS.events, percentage: percentages.events, description: DESCRIPTIONS.events },
    { name: LABELS.reserved, size: data.reserved || 1, value: data.reserved, color: COLORS.reserved, percentage: percentages.reserved, description: DESCRIPTIONS.reserved },
  ], [data, percentages]);

  const unallocatedTreemapData = useMemo(() => [
    { name: LABELS.unavailable, size: data.unavailable || 1, value: data.unavailable, color: COLORS.unavailable, percentage: percentages.unavailable, description: DESCRIPTIONS.unavailable },
    { name: LABELS.readyToUse, size: data.readyToUse || 1, value: data.readyToUse, color: COLORS.readyToUse, percentage: percentages.readyToUse, description: DESCRIPTIONS.readyToUse },
  ], [data, percentages]);

  const VIEW_OPTIONS: { mode: ViewMode; icon: typeof BarChart3; label: string }[] = [
    { mode: 'grouped-bar', icon: BarChart3, label: 'Grouped Bar' },
    { mode: 'donut', icon: Circle, label: 'Donut' },
    { mode: 'treemap', icon: LayoutGrid, label: 'Treemap' },
  ];

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span className="font-medium">{totalCapacity} total capacity</span>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {VIEW_OPTIONS.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === mode
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== GROUPED BAR VIEW ===== */}
      {viewMode === 'grouped-bar' && (
        <div className="space-y-4">
          {/* Allocated Group */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS.allocated }} />
                <span className="text-sm font-semibold text-gray-700">Allocated</span>
              </div>
              <span className="text-sm font-bold text-teal-600">{allocatedTotal} people ({allocatedPct}%)</span>
            </div>
            <div className="relative h-10 bg-gray-100 rounded-lg overflow-hidden flex">
              <div
                className="h-full flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
                style={{ width: `${allocatedSegments.transient}%`, backgroundColor: COLORS.transient }}
                title={`${LABELS.transient}: ${data.transient} (${percentages.transient}%)`}
              >
                {allocatedSegments.transient > 12 && (
                  <span>{LABELS.transient} {data.transient}</span>
                )}
              </div>
              <div
                className="h-full flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
                style={{ width: `${allocatedSegments.events}%`, backgroundColor: COLORS.events }}
                title={`${LABELS.events}: ${data.events} (${percentages.events}%)`}
              >
                {allocatedSegments.events > 12 && (
                  <span>{LABELS.events} {data.events}</span>
                )}
              </div>
              <div
                className="h-full flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
                style={{ width: `${allocatedSegments.reserved}%`, backgroundColor: COLORS.reserved }}
                title={`${LABELS.reserved}: ${data.reserved} (${percentages.reserved}%)`}
              >
                {allocatedSegments.reserved > 12 && (
                  <span>{LABELS.reserved} {data.reserved}</span>
                )}
              </div>
            </div>
            {/* Mini legend for allocated */}
            <div className="flex flex-wrap gap-4 pl-4">
              {(['transient', 'events', 'reserved'] as const).map((key) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS[key] }} />
                  <span className="text-xs text-gray-600">{LABELS[key]}: <span className="font-semibold">{data[key]}</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* Unallocated Group */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS.unallocated }} />
                <span className="text-sm font-semibold text-gray-700">Unallocated</span>
              </div>
              <span className="text-sm font-bold text-amber-600">{unallocatedTotal} people ({unallocatedPct}%)</span>
            </div>
            <div className="relative h-10 bg-gray-100 rounded-lg overflow-hidden flex">
              <div
                className="h-full flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
                style={{ width: `${unallocatedSegments.unavailable}%`, backgroundColor: COLORS.unavailable }}
                title={`${LABELS.unavailable}: ${data.unavailable} (${percentages.unavailable}%)`}
              >
                {unallocatedSegments.unavailable > 15 && (
                  <span>{LABELS.unavailable} {data.unavailable}</span>
                )}
              </div>
              <div
                className="h-full flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
                style={{ width: `${unallocatedSegments.readyToUse}%`, backgroundColor: COLORS.readyToUse }}
                title={`${LABELS.readyToUse}: ${data.readyToUse} (${percentages.readyToUse}%)`}
              >
                {unallocatedSegments.readyToUse > 15 && (
                  <span>{LABELS.readyToUse} {data.readyToUse}</span>
                )}
              </div>
            </div>
            {/* Mini legend for unallocated */}
            <div className="flex flex-wrap gap-4 pl-4">
              {(['unavailable', 'readyToUse'] as const).map((key) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS[key] }} />
                  <span className="text-xs text-gray-600">{LABELS[key]}: <span className="font-semibold">{data[key]}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== DONUT VIEW ===== */}
      {viewMode === 'donut' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Allocated Donut */}
          <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl p-4 border border-teal-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS.allocated }} />
              <h4 className="text-sm font-semibold text-gray-700">Allocated Capacity</h4>
              <span className="ml-auto text-sm font-bold text-teal-600">{allocatedTotal} ({allocatedPct}%)</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={allocatedDonutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={renderDonutLabel}
                  labelLine={false}
                >
                  {allocatedDonutData.map((entry, index) => (
                    <Cell key={`alloc-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center">
              {allocatedDonutData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs text-gray-600">{entry.name}: <span className="font-semibold">{entry.value}</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* Unallocated Donut */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS.unallocated }} />
              <h4 className="text-sm font-semibold text-gray-700">Unallocated Capacity</h4>
              <span className="ml-auto text-sm font-bold text-amber-600">{unallocatedTotal} ({unallocatedPct}%)</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={unallocatedDonutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={renderDonutLabel}
                  labelLine={false}
                >
                  {unallocatedDonutData.map((entry, index) => (
                    <Cell key={`unalloc-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center">
              {unallocatedDonutData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs text-gray-600">{entry.name}: <span className="font-semibold">{entry.value}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== TREEMAP VIEW ===== */}
      {viewMode === 'treemap' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Allocated Treemap */}
          <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl p-4 border border-teal-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS.allocated }} />
              <h4 className="text-sm font-semibold text-gray-700">Allocated</h4>
              <span className="ml-auto text-sm font-bold text-teal-600">{allocatedTotal} ({allocatedPct}%)</span>
            </div>
            <ResponsiveContainer width="100%" height={height - 40}>
              <Treemap
                data={allocatedTreemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#fff"
                fill="#8884d8"
                content={<CustomTreemapContent />}
              >
                <Tooltip content={<CustomTooltip />} />
              </Treemap>
            </ResponsiveContainer>
          </div>

          {/* Unallocated Treemap */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS.unallocated }} />
              <h4 className="text-sm font-semibold text-gray-700">Unallocated</h4>
              <span className="ml-auto text-sm font-bold text-amber-600">{unallocatedTotal} ({unallocatedPct}%)</span>
            </div>
            <ResponsiveContainer width="100%" height={height - 40}>
              <Treemap
                data={unallocatedTreemapData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#fff"
                fill="#8884d8"
                content={<CustomTreemapContent />}
              >
                <Tooltip content={<CustomTooltip />} />
              </Treemap>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Grouped Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Allocated Cards */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS.allocated }} />
            <span className="text-sm font-semibold text-gray-700">Allocated</span>
            <span className="ml-auto text-xs font-medium text-teal-600">{allocatedTotal} people</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg border-2 border-teal-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                <span className="text-xs font-semibold text-gray-700">{LABELS.transient}</span>
              </div>
              <div className="text-xl font-bold text-teal-600">{data.transient}</div>
              <div className="text-xs text-gray-500">{percentages.transient}%</div>
            </div>
            <div className="bg-white rounded-lg border-2 border-pink-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                <span className="text-xs font-semibold text-gray-700">{LABELS.events}</span>
              </div>
              <div className="text-xl font-bold text-pink-600">{data.events}</div>
              <div className="text-xs text-gray-500">{percentages.events}%</div>
            </div>
            <div className="bg-white rounded-lg border-2 border-violet-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                <span className="text-xs font-semibold text-gray-700">{LABELS.reserved}</span>
              </div>
              <div className="text-xl font-bold text-violet-600">{data.reserved}</div>
              <div className="text-xs text-gray-500">{percentages.reserved}%</div>
            </div>
          </div>
        </div>

        {/* Unallocated Cards */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS.unallocated }} />
            <span className="text-sm font-semibold text-gray-700">Unallocated</span>
            <span className="ml-auto text-xs font-medium text-amber-600">{unallocatedTotal} people</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg border-2 border-gray-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                <span className="text-xs font-semibold text-gray-700">{LABELS.unavailable}</span>
              </div>
              <div className="text-xl font-bold text-gray-600">{data.unavailable}</div>
              <div className="text-xs text-gray-500">{percentages.unavailable}%</div>
            </div>
            <div className="bg-white rounded-lg border-2 border-amber-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-xs font-semibold text-gray-700">{LABELS.readyToUse}</span>
              </div>
              <div className="text-xl font-bold text-amber-600">{data.readyToUse}</div>
              <div className="text-xs text-gray-500">{percentages.readyToUse}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
