'use client';

import { useMemo } from 'react';
import {
  Treemap,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

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

interface CapacityAllocationChartProps {
  data: AllocationData;
  totalCapacity: number;
  showTreemap?: boolean;
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

export default function CapacityAllocationChart({
  data,
  totalCapacity,
  showTreemap = true,
  showStackedBar = true,
  height = 300,
}: CapacityAllocationChartProps) {
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

  // Prepare treemap data with hierarchical structure
  const treemapData = useMemo(() => {
    return [
      {
        name: 'Allocated',
        children: [
          {
            name: LABELS.transient,
            size: data.transient || 1,
            value: data.transient,
            color: COLORS.transient,
            percentage: percentages.transient,
            description: DESCRIPTIONS.transient,
          },
          {
            name: LABELS.events,
            size: data.events || 1,
            value: data.events,
            color: COLORS.events,
            percentage: percentages.events,
            description: DESCRIPTIONS.events,
          },
          {
            name: LABELS.reserved,
            size: data.reserved || 1,
            value: data.reserved,
            color: COLORS.reserved,
            percentage: percentages.reserved,
            description: DESCRIPTIONS.reserved,
          },
        ],
      },
      {
        name: 'Unallocated',
        children: [
          {
            name: LABELS.unavailable,
            size: data.unavailable || 1,
            value: data.unavailable,
            color: COLORS.unavailable,
            percentage: percentages.unavailable,
            description: DESCRIPTIONS.unavailable,
          },
          {
            name: LABELS.readyToUse,
            size: data.readyToUse || 1,
            value: data.readyToUse,
            color: COLORS.readyToUse,
            percentage: percentages.readyToUse,
            description: DESCRIPTIONS.readyToUse,
          },
        ],
      },
    ];
  }, [data, percentages]);

  // Flatten data for treemap
  const flatTreemapData = useMemo(() => {
    return treemapData.flatMap(group =>
      group.children.map(child => ({
        ...child,
        parentName: group.name,
      }))
    );
  }, [treemapData]);

  return (
    <div className="space-y-6">
      {/* Stacked Bar Overview */}
      {showStackedBar && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>Capacity Distribution</span>
            <span className="font-medium">{totalCapacity} total</span>
          </div>
          <div className="relative h-10 bg-gray-100 rounded-lg overflow-hidden flex">
            {/* Allocated: Transient */}
            <div
              className="h-full flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
              style={{
                width: `${percentages.transient}%`,
                backgroundColor: COLORS.transient,
              }}
              title={`${LABELS.transient}: ${data.transient} (${percentages.transient}%)`}
            >
              {percentages.transient > 10 && `${percentages.transient}%`}
            </div>
            {/* Allocated: Events */}
            <div
              className="h-full flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
              style={{
                width: `${percentages.events}%`,
                backgroundColor: COLORS.events,
              }}
              title={`${LABELS.events}: ${data.events} (${percentages.events}%)`}
            >
              {percentages.events > 10 && `${percentages.events}%`}
            </div>
            {/* Allocated: Reserved */}
            <div
              className="h-full flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
              style={{
                width: `${percentages.reserved}%`,
                backgroundColor: COLORS.reserved,
              }}
              title={`${LABELS.reserved}: ${data.reserved} (${percentages.reserved}%)`}
            >
              {percentages.reserved > 10 && `${percentages.reserved}%`}
            </div>
            {/* Unallocated: Unavailable */}
            <div
              className="h-full flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
              style={{
                width: `${percentages.unavailable}%`,
                backgroundColor: COLORS.unavailable,
              }}
              title={`${LABELS.unavailable}: ${data.unavailable} (${percentages.unavailable}%)`}
            >
              {percentages.unavailable > 10 && `${percentages.unavailable}%`}
            </div>
            {/* Unallocated: Ready To Use */}
            <div
              className="h-full flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
              style={{
                width: `${percentages.readyToUse}%`,
                backgroundColor: COLORS.readyToUse,
              }}
              title={`${LABELS.readyToUse}: ${data.readyToUse} (${percentages.readyToUse}%)`}
            >
              {percentages.readyToUse > 10 && `${percentages.readyToUse}%`}
            </div>
          </div>

          {/* Legend for stacked bar */}
          <div className="flex flex-wrap gap-4 justify-center mt-2">
            {Object.entries(LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: COLORS[key as keyof typeof COLORS] }}
                />
                <span className="text-sm text-gray-700">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Treemap Visualization */}
      {showTreemap && (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4">
          <ResponsiveContainer width="100%" height={height}>
            <Treemap
              data={flatTreemapData}
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
      )}

      {/* Detailed breakdown cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Allocated: Transient */}
        <div className="bg-white rounded-lg border-2 border-teal-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-teal-500" />
            <span className="text-sm font-semibold text-gray-700">{LABELS.transient}</span>
          </div>
          <div className="text-2xl font-bold text-teal-600">{data.transient}</div>
          <div className="text-sm text-gray-500">{percentages.transient}% of capacity</div>
        </div>

        {/* Allocated: Events */}
        <div className="bg-white rounded-lg border-2 border-pink-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-pink-500" />
            <span className="text-sm font-semibold text-gray-700">{LABELS.events}</span>
          </div>
          <div className="text-2xl font-bold text-pink-600">{data.events}</div>
          <div className="text-sm text-gray-500">{percentages.events}% of capacity</div>
        </div>

        {/* Allocated: Reserved */}
        <div className="bg-white rounded-lg border-2 border-violet-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <span className="text-sm font-semibold text-gray-700">{LABELS.reserved}</span>
          </div>
          <div className="text-2xl font-bold text-violet-600">{data.reserved}</div>
          <div className="text-sm text-gray-500">{percentages.reserved}% of capacity</div>
        </div>

        {/* Unallocated: Unavailable */}
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <span className="text-sm font-semibold text-gray-700">{LABELS.unavailable}</span>
          </div>
          <div className="text-2xl font-bold text-gray-600">{data.unavailable}</div>
          <div className="text-sm text-gray-500">{percentages.unavailable}% of capacity</div>
        </div>

        {/* Unallocated: Ready To Use */}
        <div className="bg-white rounded-lg border-2 border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-sm font-semibold text-gray-700">{LABELS.readyToUse}</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">{data.readyToUse}</div>
          <div className="text-sm text-gray-500">{percentages.readyToUse}% of capacity</div>
        </div>
      </div>
    </div>
  );
}
