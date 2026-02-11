'use client';

import { useState, useEffect } from 'react';
import { X, Clock, Save, RotateCcw, Plus } from 'lucide-react';
import { TimeSlot, DayOfWeekKey } from '@/models/types';
import { formatTimeForDisplay, sortTimeSlots } from '@/lib/operating-hours';
import { DayCapacityDetailedView } from './DayCapacityMiniBar';

interface CapacityBreakdown {
  transient: number;
  events: number;
  reserved: number;
  unavailable: number;
  readyToUse: number;
}

interface DayEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: DayOfWeekKey;
  dayLabel: string;
  slots: TimeSlot[] | undefined;
  inheritedSlots: TimeSlot[] | undefined;
  inheritedSource: string | undefined;
  isOwn: boolean;
  onChange: (slots: TimeSlot[] | undefined) => void;
  capacityBreakdown?: CapacityBreakdown;
  totalCapacity?: number;
  entityName: string;
}

const FULL_DAY_SLOT: TimeSlot = { startTime: '00:00', endTime: '23:59' };

const is24HourSlot = (slot: TimeSlot): boolean => {
  return slot.startTime === '00:00' && slot.endTime === '23:59';
};

const is24Hours = (slots: TimeSlot[] | undefined): boolean => {
  return slots?.length === 1 && is24HourSlot(slots[0]) || false;
};

export default function DayEditModal({
  isOpen,
  onClose,
  day,
  dayLabel,
  slots,
  inheritedSlots,
  inheritedSource,
  isOwn,
  onChange,
  capacityBreakdown,
  totalCapacity = 100,
  entityName,
}: DayEditModalProps) {
  const [localSlots, setLocalSlots] = useState<TimeSlot[] | undefined>(slots);
  const [localIsOwn, setLocalIsOwn] = useState(isOwn);

  // Reset local state when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setLocalSlots(slots);
      setLocalIsOwn(isOwn);
    }
  }, [isOpen, slots, isOwn]);

  if (!isOpen) return null;

  const effectiveSlots = localIsOwn ? localSlots : inheritedSlots;
  const isOpen_ = effectiveSlots && effectiveSlots.length > 0;
  const isClosed = !isOpen_;
  const isFullDay = is24Hours(effectiveSlots);

  const handleToggleOpen = () => {
    if (isOpen_) {
      setLocalSlots([]);
      setLocalIsOwn(true);
    } else {
      setLocalSlots([FULL_DAY_SLOT]);
      setLocalIsOwn(true);
    }
  };

  const handleSet24Hours = () => {
    setLocalSlots([FULL_DAY_SLOT]);
    setLocalIsOwn(true);
  };

  const handleSetCustomHours = () => {
    setLocalSlots([{ startTime: '09:00', endTime: '17:00' }]);
    setLocalIsOwn(true);
  };

  const handleResetToInherit = () => {
    setLocalSlots(undefined);
    setLocalIsOwn(false);
  };

  const handleAddSlot = () => {
    const currentSlots = localSlots || [];
    const lastSlot = currentSlots[currentSlots.length - 1];
    const newStart = lastSlot ? lastSlot.endTime : '09:00';
    const newEnd = lastSlot
      ? `${Math.min(23, parseInt(lastSlot.endTime.split(':')[0]) + 4).toString().padStart(2, '0')}:00`
      : '17:00';

    setLocalSlots([...currentSlots, { startTime: newStart, endTime: newEnd }]);
    setLocalIsOwn(true);
  };

  const handleRemoveSlot = (index: number) => {
    const currentSlots = localSlots || [];
    const updated = currentSlots.filter((_, i) => i !== index);
    setLocalSlots(updated);
  };

  const handleSlotChange = (index: number, field: 'startTime' | 'endTime', value: string) => {
    const currentSlots = localSlots || [];
    const updated = [...currentSlots];
    updated[index] = { ...updated[index], [field]: value };
    setLocalSlots(sortTimeSlots(updated));
  };

  const handleSave = () => {
    onChange(localIsOwn ? localSlots : undefined);
    onClose();
  };

  // Determine capacity breakdown based on open/closed status
  const effectiveCapacity = isClosed
    ? { transient: 0, events: 0, reserved: 0, unavailable: totalCapacity, readyToUse: 0 }
    : capacityBreakdown || { transient: 50, events: 20, reserved: 0, unavailable: 0, readyToUse: 30 };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-teal-600 to-green-600 text-white px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">{dayLabel}</h2>
                <p className="text-teal-100 text-sm">{entityName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Capacity Breakdown Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-teal-500" />
              Capacity Allocation
            </h3>
            <DayCapacityDetailedView
              breakdown={effectiveCapacity}
              totalCapacity={totalCapacity}
              isClosed={isClosed}
            />
          </div>

          {/* Schedule Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-600" />
              Operating Hours
            </h3>

            {/* Inheritance status */}
            {inheritedSlots !== undefined && (
              <div className={`mb-4 p-3 rounded-lg ${
                localIsOwn
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${localIsOwn ? 'text-yellow-800' : 'text-blue-800'}`}>
                    {localIsOwn
                      ? '⚠️ Overriding inherited schedule'
                      : `← Inheriting from ${inheritedSource}`
                    }
                  </span>
                  {localIsOwn && (
                    <button
                      onClick={handleResetToInherit}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-100 rounded hover:bg-blue-200"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset to inherit
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Open/Closed Toggle */}
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm text-gray-600">Status:</span>
              <button
                onClick={handleToggleOpen}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isOpen_
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                {isOpen_ ? 'Open' : 'Closed'}
              </button>
            </div>

            {/* Time Slots */}
            {isOpen_ && (
              <div className="space-y-3">
                {/* Quick Actions */}
                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Quick:</span>
                  <button
                    onClick={handleSet24Hours}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      isFullDay
                        ? 'bg-purple-100 text-purple-700 border border-purple-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-600 border border-gray-200'
                    }`}
                  >
                    <Clock className="w-3 h-3 inline mr-1" />
                    24 Hours
                  </button>
                  {isFullDay && (
                    <button
                      onClick={handleSetCustomHours}
                      className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full border border-gray-200"
                    >
                      Set Custom Hours
                    </button>
                  )}
                </div>

                {/* Time Slots List */}
                {isFullDay ? (
                  <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <span className="text-purple-700 font-medium">Open 24 Hours</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {effectiveSlots?.map((slot, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
                      >
                        <span className="text-sm text-gray-500 w-16">Slot {index + 1}:</span>
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => handleSlotChange(index, 'startTime', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                          disabled={!localIsOwn}
                        />
                        <span className="text-gray-400">to</span>
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => handleSlotChange(index, 'endTime', e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                          disabled={!localIsOwn}
                        />
                        {localIsOwn && (localSlots?.length || 0) > 1 && (
                          <button
                            onClick={() => handleRemoveSlot(index)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Add Slot Button */}
                    {localIsOwn && !isFullDay && (
                      <button
                        onClick={handleAddSlot}
                        className="flex items-center gap-2 w-full p-3 border-2 border-dashed border-teal-300 rounded-lg text-teal-600 hover:bg-teal-50 hover:border-teal-400 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">Add Time Slot</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Closed state */}
            {isClosed && (
              <div className="p-4 bg-gray-100 rounded-lg text-center">
                <p className="text-gray-600">
                  This day is marked as <strong>Closed</strong>.
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  All capacity is marked as Unavailable.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-xl">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
