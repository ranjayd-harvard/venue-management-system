'use client';

import { useState } from 'react';
import { Activity, ChevronDown, ChevronRight } from 'lucide-react';
import { AllocationConsumption, CategoryConsumption, CapacityCategory } from '@/models/types';

interface AllocationConsumptionPanelProps {
  allocationConsumption: AllocationConsumption;
  totalCapacity: number;
}

// Color and label config per category
const categoryConfig: Record<CapacityCategory, { label: string; color: string; barColor: string }> = {
  events: { label: 'Events', color: 'text-pink-600', barColor: 'bg-pink-500' },
  transient: { label: 'Transient', color: 'text-teal-600', barColor: 'bg-teal-500' },
  reserved: { label: 'Reserved', color: 'text-violet-600', barColor: 'bg-violet-500' },
  unavailable: { label: 'Unavailable', color: 'text-gray-500', barColor: 'bg-gray-400' },
  readyToUse: { label: 'Ready To Use', color: 'text-amber-600', barColor: 'bg-amber-500' },
};

// Stacked bar segment colors
const segmentColors = {
  consumed: 'bg-emerald-500',
  upcoming: 'bg-sky-400',
  noShow: 'bg-amber-400',
  overstay: 'bg-red-400',
  unauthorized: 'bg-orange-500',
  available: 'bg-gray-200',
};

function ConsumptionBar({ cat }: { cat: CategoryConsumption }) {
  if (cat.planned === 0) {
    return <div className="h-4 rounded-full bg-gray-100 w-full" />;
  }

  const segments = [
    { key: 'consumed', value: cat.consumed, color: segmentColors.consumed, label: 'Consumed' },
    { key: 'upcoming', value: cat.upcoming, color: segmentColors.upcoming, label: 'Upcoming' },
    { key: 'noShow', value: cat.noShow, color: segmentColors.noShow, label: 'No-Show' },
    { key: 'overstay', value: cat.overstay, color: segmentColors.overstay, label: 'Overstay' },
    { key: 'unauthorized', value: cat.unauthorized, color: segmentColors.unauthorized, label: 'Unauthorized' },
    { key: 'available', value: cat.available, color: segmentColors.available, label: 'Available' },
  ].filter(s => s.value > 0);

  return (
    <div className="h-4 rounded-full overflow-hidden flex bg-gray-100 w-full" title={`${cat.utilizationPct}% utilized`}>
      {segments.map((seg) => {
        const pct = (seg.value / cat.planned) * 100;
        return (
          <div
            key={seg.key}
            className={`${seg.color} transition-all relative group`}
            style={{ width: `${pct}%` }}
          >
            <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none z-10">
              {seg.label}: {seg.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CategoryRow({ cat }: { cat: CategoryConsumption }) {
  const [expanded, setExpanded] = useState(false);
  const config = categoryConfig[cat.category];
  const hasDetails = cat.upcoming > 0 || cat.noShow > 0 || cat.overstay > 0 || cat.unauthorized > 0;

  return (
    <>
      <tr
        className={`border-b border-gray-100 ${hasDetails ? 'cursor-pointer hover:bg-gray-50' : ''}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {/* Category name */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-2">
            {hasDetails ? (
              expanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />
            ) : (
              <span className="w-3" />
            )}
            <span className={`font-medium text-sm ${config.color}`}>{config.label}</span>
          </div>
        </td>

        {/* Progress bar */}
        <td className="py-3 px-3 w-1/3">
          <ConsumptionBar cat={cat} />
        </td>

        {/* Planned */}
        <td className="py-3 px-3 text-right text-sm text-gray-500">{cat.planned}</td>

        {/* Consumed */}
        <td className="py-3 px-3 text-right text-sm font-bold text-emerald-600">{cat.consumed}</td>

        {/* Available */}
        <td className="py-3 px-3 text-right text-sm text-gray-600">{cat.available}</td>

        {/* Utilization */}
        <td className="py-3 px-3 text-right">
          <span className={`text-sm font-bold ${
            cat.utilizationPct >= 80 ? 'text-red-600' :
            cat.utilizationPct >= 50 ? 'text-amber-600' :
            'text-emerald-600'
          }`}>
            {cat.utilizationPct}%
          </span>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && hasDetails && (
        <tr className="bg-gray-50 border-b border-gray-100">
          <td colSpan={6} className="py-2 px-8">
            <div className="grid grid-cols-4 gap-4 text-xs">
              {cat.upcoming > 0 && (
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${segmentColors.upcoming}`} />
                  <span className="text-gray-500">Upcoming:</span>
                  <span className="font-semibold text-gray-700">{cat.upcoming}</span>
                </div>
              )}
              {cat.noShow > 0 && (
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${segmentColors.noShow}`} />
                  <span className="text-gray-500">No-Show:</span>
                  <span className="font-semibold text-amber-600">{cat.noShow}</span>
                </div>
              )}
              {cat.overstay > 0 && (
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${segmentColors.overstay}`} />
                  <span className="text-gray-500">Overstay:</span>
                  <span className="font-semibold text-red-600">{cat.overstay}</span>
                </div>
              )}
              {cat.unauthorized > 0 && (
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${segmentColors.unauthorized}`} />
                  <span className="text-gray-500">Unauthorized:</span>
                  <span className="font-semibold text-orange-600">{cat.unauthorized}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AllocationConsumptionPanel({
  allocationConsumption,
  totalCapacity,
}: AllocationConsumptionPanelProps) {
  const { categories, totalPlanned, totalConsumed, totalAvailable, overallUtilizationPct, attributionAssumptions } = allocationConsumption;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-bold text-gray-900">Allocation Consumption</h2>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">
            Planned: <span className="font-bold text-gray-700">{totalPlanned}</span>
          </span>
          <span className="text-gray-500">
            Consumed: <span className="font-bold text-emerald-600">{totalConsumed}</span>
          </span>
          <span className="text-gray-500">
            Available: <span className="font-bold text-gray-700">{totalAvailable}</span>
          </span>
          <span className={`font-bold text-sm px-2 py-1 rounded-full ${
            overallUtilizationPct >= 80 ? 'bg-red-100 text-red-700' :
            overallUtilizationPct >= 50 ? 'bg-amber-100 text-amber-700' :
            'bg-emerald-100 text-emerald-700'
          }`}>
            {overallUtilizationPct}% util
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className={`w-3 h-3 rounded ${segmentColors.consumed}`} />
          Consumed
        </div>
        <div className="flex items-center gap-1">
          <span className={`w-3 h-3 rounded ${segmentColors.upcoming}`} />
          Upcoming
        </div>
        <div className="flex items-center gap-1">
          <span className={`w-3 h-3 rounded ${segmentColors.noShow}`} />
          No-Show
        </div>
        <div className="flex items-center gap-1">
          <span className={`w-3 h-3 rounded ${segmentColors.overstay}`} />
          Overstay
        </div>
        <div className="flex items-center gap-1">
          <span className={`w-3 h-3 rounded ${segmentColors.unauthorized}`} />
          Unauthorized
        </div>
        <div className="flex items-center gap-1">
          <span className={`w-3 h-3 rounded ${segmentColors.available}`} />
          Available
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase w-1/3">Usage</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Planned</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Consumed</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Available</th>
              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Util %</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <CategoryRow key={cat.category} cat={cat} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Assumptions */}
      {attributionAssumptions.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Attribution Assumptions</p>
          <ul className="text-xs text-gray-600 space-y-1">
            {attributionAssumptions.map((a, i) => (
              <li key={i} className="flex gap-1">
                <span className="text-gray-400">*</span> {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
