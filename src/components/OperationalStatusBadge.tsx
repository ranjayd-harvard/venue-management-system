'use client';

import { OperationalStatus } from '@/models/types';

interface OperationalStatusBadgeProps {
  status: OperationalStatus;
  count?: number;
  size?: 'sm' | 'md';
}

const statusConfig: Record<OperationalStatus, { label: string; bg: string; text: string; dot: string }> = {
  [OperationalStatus.SELLABLE]: {
    label: 'Sellable',
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  [OperationalStatus.NON_SELLABLE]: {
    label: 'Non-Sellable',
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    dot: 'bg-gray-500',
  },
  [OperationalStatus.ATTENTION_REQUIRED]: {
    label: 'Attention Required',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  [OperationalStatus.BILLING_REQUIRED]: {
    label: 'Billing Required',
    bg: 'bg-red-100',
    text: 'text-red-700',
    dot: 'bg-red-500',
  },
  [OperationalStatus.OTHER]: {
    label: 'Other',
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    dot: 'bg-purple-500',
  },
};

export default function OperationalStatusBadge({ status, count, size = 'md' }: OperationalStatusBadgeProps) {
  const config = statusConfig[status];
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses}`}>
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      {config.label}
      {count !== undefined && <span className="font-bold">({count})</span>}
    </span>
  );
}
