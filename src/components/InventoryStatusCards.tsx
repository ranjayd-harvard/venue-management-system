'use client';

import {
  DefaultCapacities,
  PhysicalStatusCounts,
  CommercialStatusCounts,
  OperationalStatusCounts,
} from '@/models/types';
import { Layers, Eye, FileText, Zap } from 'lucide-react';

interface InventoryStatusCardsProps {
  totalCapacity: number;
  capacityStatus: DefaultCapacities | null;
  physicalStatus: PhysicalStatusCounts;
  commercialStatus: CommercialStatusCounts;
  operationalStatus: OperationalStatusCounts;
}

interface StatusItem {
  label: string;
  value: number;
  color: string;
}

function StatusCard({
  title,
  icon,
  borderColor,
  items,
  totalCapacity,
}: {
  title: string;
  icon: React.ReactNode;
  borderColor: string;
  items: StatusItem[];
  totalCapacity: number;
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border-2 ${borderColor} p-5`}>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const pct = totalCapacity > 0 ? Math.round((item.value / totalCapacity) * 100) : 0;
          return (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                <span className="text-sm text-gray-600">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{item.value}</span>
                <span className="text-xs text-gray-400">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
      {/* Mini bar */}
      <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-gray-100">
        {items.map((item) => {
          const pct = totalCapacity > 0 ? (item.value / totalCapacity) * 100 : 0;
          return pct > 0 ? (
            <div
              key={item.label}
              className={`${item.color} transition-all`}
              style={{ width: `${pct}%` }}
            />
          ) : null;
        })}
      </div>
    </div>
  );
}

export default function InventoryStatusCards({
  totalCapacity,
  capacityStatus,
  physicalStatus,
  commercialStatus,
  operationalStatus,
}: InventoryStatusCardsProps) {
  // Dimension 1: CapacityStatus
  const capacityItems: StatusItem[] = capacityStatus
    ? [
        { label: 'Transient', value: capacityStatus.allocated.transient, color: 'bg-teal-500' },
        { label: 'Events', value: capacityStatus.allocated.events, color: 'bg-pink-500' },
        { label: 'Reserved', value: capacityStatus.allocated.reserved, color: 'bg-violet-500' },
        { label: 'Unavailable', value: capacityStatus.unallocated.unavailable, color: 'bg-gray-400' },
        { label: 'Ready To Use', value: capacityStatus.unallocated.readyToUse, color: 'bg-amber-400' },
      ]
    : [{ label: 'Not configured', value: totalCapacity, color: 'bg-gray-300' }];

  // Dimension 2: PhysicalStatus
  const physicalItems: StatusItem[] = [
    { label: 'Free', value: physicalStatus.free, color: 'bg-emerald-500' },
    { label: 'Occupied', value: physicalStatus.occupied, color: 'bg-blue-500' },
    { label: 'Unconfirmed', value: physicalStatus.occupiedUnconfirmed, color: 'bg-orange-400' },
    { label: 'Unknown', value: physicalStatus.unknown, color: 'bg-gray-400' },
  ];

  // Dimension 3: CommercialStatus
  const commercialItems: StatusItem[] = [
    { label: 'None', value: commercialStatus.none, color: 'bg-gray-400' },
    { label: 'Upcoming', value: commercialStatus.reservedUpcoming, color: 'bg-sky-500' },
    { label: 'Active', value: commercialStatus.reservedActive, color: 'bg-blue-600' },
    { label: 'No-Show', value: commercialStatus.noShow, color: 'bg-amber-500' },
    { label: 'Overstay', value: commercialStatus.overstay, color: 'bg-red-500' },
  ];

  // Dimension 4: OperationalStatus
  const operationalItems: StatusItem[] = [
    { label: 'Sellable', value: operationalStatus.sellable, color: 'bg-emerald-500' },
    { label: 'Non-Sellable', value: operationalStatus.nonSellable, color: 'bg-gray-500' },
    { label: 'Attention', value: operationalStatus.attentionRequired, color: 'bg-amber-500' },
    { label: 'Billing', value: operationalStatus.billingRequired, color: 'bg-red-500' },
    { label: 'Other', value: operationalStatus.other, color: 'bg-purple-500' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatusCard
        title="Capacity (Planning)"
        icon={<Layers className="w-4 h-4 text-teal-600" />}
        borderColor="border-teal-200"
        items={capacityItems}
        totalCapacity={totalCapacity}
      />
      <StatusCard
        title="Physical (Reality)"
        icon={<Eye className="w-4 h-4 text-blue-600" />}
        borderColor="border-blue-200"
        items={physicalItems}
        totalCapacity={totalCapacity}
      />
      <StatusCard
        title="Commercial (Contract)"
        icon={<FileText className="w-4 h-4 text-amber-600" />}
        borderColor="border-amber-200"
        items={commercialItems}
        totalCapacity={totalCapacity}
      />
      <StatusCard
        title="Operational (Action)"
        icon={<Zap className="w-4 h-4 text-red-600" />}
        borderColor="border-red-200"
        items={operationalItems}
        totalCapacity={totalCapacity}
      />
    </div>
  );
}
