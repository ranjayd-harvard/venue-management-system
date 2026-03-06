'use client';

import { useState, useEffect } from 'react';
import { PhysicalStatusCounts, PhysicalStatusSnapshot } from '@/models/types';
import { Eye, Save, AlertCircle } from 'lucide-react';

interface PhysicalStatusInputProps {
  subLocationId: string;
  maxCapacity: number;
  currentSnapshot: PhysicalStatusSnapshot | null;
  onUpdated: () => void;
}

export default function PhysicalStatusInput({
  subLocationId,
  maxCapacity,
  currentSnapshot,
  onUpdated,
}: PhysicalStatusInputProps) {
  const [counts, setCounts] = useState<PhysicalStatusCounts>({
    free: 0,
    occupied: 0,
    occupiedUnconfirmed: 0,
    unknown: maxCapacity,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync from snapshot when it changes
  useEffect(() => {
    if (currentSnapshot) {
      setCounts({ ...currentSnapshot.counts });
    } else {
      setCounts({ free: 0, occupied: 0, occupiedUnconfirmed: 0, unknown: maxCapacity });
    }
  }, [currentSnapshot, maxCapacity]);

  const sum = counts.free + counts.occupied + counts.occupiedUnconfirmed + counts.unknown;
  const isValid = sum === maxCapacity && counts.free >= 0 && counts.occupied >= 0 && counts.occupiedUnconfirmed >= 0 && counts.unknown >= 0;
  const diff = sum - maxCapacity;

  const handleChange = (field: keyof PhysicalStatusCounts, value: string) => {
    const num = parseInt(value) || 0;
    setCounts((prev) => ({ ...prev, [field]: num }));
    setError(null);
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    if (!isValid) return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/capacity/inventory-status/physical', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subLocationId,
          counts,
          updatedBy: 'manual',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update');
      }

      setSuccessMsg('Physical status updated successfully');
      onUpdated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof PhysicalStatusCounts; label: string; color: string }[] = [
    { key: 'free', label: 'Free', color: 'border-emerald-300 focus:ring-emerald-500' },
    { key: 'occupied', label: 'Occupied', color: 'border-blue-300 focus:ring-blue-500' },
    { key: 'occupiedUnconfirmed', label: 'Unconfirmed', color: 'border-orange-300 focus:ring-orange-500' },
    { key: 'unknown', label: 'Unknown', color: 'border-gray-300 focus:ring-gray-500' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-gray-900">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Physical Status (Manual Input)</h2>
        </div>
        {currentSnapshot && (
          <span className="text-xs text-gray-400">
            Last updated: {new Date(currentSnapshot.updatedAt).toLocaleString()} ({currentSnapshot.source})
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {fields.map(({ key, label, color }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
            <input
              type="number"
              min={0}
              max={maxCapacity}
              value={counts[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none ${color}`}
            />
          </div>
        ))}
      </div>

      {/* Sum validation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${isValid ? 'text-emerald-600' : 'text-red-600'}`}>
            Sum: {sum} / {maxCapacity}
            {!isValid && diff !== 0 && (
              <span className="ml-1">
                ({diff > 0 ? `+${diff} over` : `${diff} under`})
              </span>
            )}
          </span>
          {!isValid && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="w-3 h-3" />
              Must equal max capacity
            </span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={!isValid || saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Update'}
        </button>
      </div>

      {error && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          {successMsg}
        </div>
      )}
    </div>
  );
}
