'use client';

import { useState } from 'react';
import { Plus, X, RotateCcw, Clock, Edit2 } from 'lucide-react';
import { TimeSlot, DayOfWeekKey } from '@/models/types';
import { formatTimeForDisplay, sortTimeSlots } from '@/lib/operating-hours';
import DayCapacityMiniBar from './DayCapacityMiniBar';
import DayEditModal from './DayEditModal';

// 24-hour slot constant
const FULL_DAY_SLOT: TimeSlot = { startTime: '00:00', endTime: '23:59' };

// Check if a slot represents 24 hours
const is24HourSlot = (slot: TimeSlot): boolean => {
  return slot.startTime === '00:00' && slot.endTime === '23:59';
};

// Check if slots array represents 24 hours open
const is24Hours = (slots: TimeSlot[] | undefined): boolean => {
  return slots?.length === 1 && is24HourSlot(slots[0]) || false;
};

interface CapacityBreakdown {
  transient: number;
  events: number;
  reserved: number;
  unavailable: number;
  readyToUse: number;
}

interface DayScheduleEditorProps {
  day: DayOfWeekKey;
  dayLabel: string;
  slots: TimeSlot[] | undefined; // undefined = inherit, [] = closed, [...] = open
  inheritedSlots: TimeSlot[] | undefined;
  inheritedSource: string | undefined;
  isOwn: boolean;
  onChange: (slots: TimeSlot[] | undefined) => void;
  // Capacity props (optional - only shown when available)
  capacityBreakdown?: CapacityBreakdown;
  totalCapacity?: number;
  entityName?: string;
  showCapacity?: boolean;
}

export default function DayScheduleEditor({
  day,
  dayLabel,
  slots,
  inheritedSlots,
  inheritedSource,
  isOwn,
  onChange,
  capacityBreakdown,
  totalCapacity = 100,
  entityName = '',
  showCapacity = false,
}: DayScheduleEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Effective slots to display
  const effectiveSlots = isOwn ? slots : inheritedSlots;
  const isOpen = effectiveSlots && effectiveSlots.length > 0;
  const isClosed = effectiveSlots && effectiveSlots.length === 0;
  const isInheriting = !isOwn && inheritedSlots !== undefined;
  const isFullDay = is24Hours(effectiveSlots);

  const handleToggleOpen = () => {
    if (isOwn) {
      // Toggle between open and closed
      if (isOpen) {
        onChange([]); // Set to closed
      } else {
        onChange([FULL_DAY_SLOT]); // Default to 24 hours
      }
    } else {
      // Start overriding with default
      if (isOpen) {
        onChange([]); // Override to closed
      } else {
        onChange([FULL_DAY_SLOT]); // Override to 24 hours
      }
    }
  };

  const handleSet24Hours = () => {
    onChange([FULL_DAY_SLOT]);
  };

  const handleSetCustomHours = () => {
    onChange([{ startTime: '09:00', endTime: '17:00' }]);
  };

  const handleResetToInherit = () => {
    onChange(undefined);
    setIsEditing(false);
  };

  const handleAddSlot = () => {
    const currentSlots = slots || [];
    const lastSlot = currentSlots[currentSlots.length - 1];
    const newStart = lastSlot ? lastSlot.endTime : '09:00';
    const newEnd = lastSlot
      ? `${Math.min(23, parseInt(lastSlot.endTime.split(':')[0]) + 4).toString().padStart(2, '0')}:00`
      : '17:00';

    onChange([...currentSlots, { startTime: newStart, endTime: newEnd }]);
  };

  const handleRemoveSlot = (index: number) => {
    const currentSlots = slots || [];
    const updated = currentSlots.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleSlotChange = (
    index: number,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    const currentSlots = slots || [];
    const updated = [...currentSlots];
    updated[index] = { ...updated[index], [field]: value };
    onChange(sortTimeSlots(updated));
  };

  // Determine background color based on state
  const getBgClass = () => {
    if (isOwn && inheritedSlots !== undefined) {
      return 'bg-yellow-50 border-yellow-200'; // Override
    }
    if (isInheriting) {
      return 'bg-blue-50 border-blue-200'; // Inherited
    }
    if (isOwn) {
      return 'bg-white border-gray-200'; // Own (no inheritance)
    }
    return 'bg-gray-50 border-gray-200'; // Not defined anywhere
  };

  const getStatusBadge = () => {
    if (isOwn && inheritedSlots !== undefined) {
      return (
        <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">
          Override
        </span>
      );
    }
    if (isInheriting && inheritedSource) {
      return (
        <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">
          ← {inheritedSource}
        </span>
      );
    }
    if (isOwn) {
      return (
        <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">
          Own
        </span>
      );
    }
    return null;
  };

  return (
    <div className={`border rounded-lg p-3 ${getBgClass()}`}>
      <div className="flex items-center gap-3">
        {/* Day Label */}
        <div className="w-24 font-medium text-gray-700">{dayLabel}</div>

        {/* Open/Closed Toggle */}
        <button
          onClick={handleToggleOpen}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            isOpen
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
          }`}
        >
          {isOpen ? 'Open' : 'Closed'}
        </button>

        {/* Time Slots Display/Edit */}
        <div className="flex-1 flex flex-wrap gap-2 items-center">
          {/* 24 Hours display */}
          {isOpen && isFullDay && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-purple-100 border border-purple-300 rounded px-2 py-1">
                <Clock className="w-3 h-3 text-purple-600" />
                <span className="text-sm font-medium text-purple-700">24 Hours</span>
              </div>
              {isOwn && (
                <button
                  onClick={handleSetCustomHours}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Set custom hours
                </button>
              )}
            </div>
          )}

          {/* Custom time slots */}
          {isOpen && !isFullDay &&
            effectiveSlots?.map((slot, index) => (
              <div
                key={index}
                className="flex items-center gap-1 bg-white border border-gray-300 rounded px-2 py-1"
              >
                {isOwn ? (
                  <>
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(e) =>
                        handleSlotChange(index, 'startTime', e.target.value)
                      }
                      className="text-sm border-none focus:ring-0 p-0 w-20 text-gray-900"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(e) =>
                        handleSlotChange(index, 'endTime', e.target.value)
                      }
                      className="text-sm border-none focus:ring-0 p-0 w-20 text-gray-900"
                    />
                    {(slots?.length || 0) > 1 && (
                      <button
                        onClick={() => handleRemoveSlot(index)}
                        className="ml-1 text-red-500 hover:text-red-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-gray-600">
                    {is24HourSlot(slot) ? '24 Hours' : `${formatTimeForDisplay(slot.startTime)} - ${formatTimeForDisplay(slot.endTime)}`}
                  </span>
                )}
              </div>
            ))}

          {/* 24hr and Add Slot Buttons (only when own, open, and not already 24hr) */}
          {isOwn && isOpen && !isFullDay && (
            <>
              <button
                onClick={handleSet24Hours}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 px-2 py-1 border border-dashed border-purple-400 rounded hover:bg-purple-50"
                title="Set to 24 hours"
              >
                <Clock className="w-3 h-3" />
                24hr
              </button>
              <button
                onClick={handleAddSlot}
                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 px-2 py-1 border border-dashed border-teal-400 rounded hover:bg-teal-50"
              >
                <Plus className="w-3 h-3" />
                Add Slot
              </button>
            </>
          )}

          {/* Show "Closed" text when explicitly closed */}
          {isClosed && (
            <span className="text-sm text-gray-500 italic">Closed</span>
          )}

          {/* Show "Not defined" when nothing is set */}
          {!isOwn && !isInheriting && (
            <span className="text-sm text-gray-400 italic">Not defined</span>
          )}
        </div>

        {/* Status Badge and Actions */}
        <div className="flex items-center gap-2">
          {getStatusBadge()}

          {/* Reset to Inherit Button */}
          {isOwn && inheritedSlots !== undefined && (
            <button
              onClick={handleResetToInherit}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Reset to inherit from parent"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {/* Edit Modal Button */}
          {showCapacity && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="p-1 text-teal-500 hover:text-teal-700 hover:bg-teal-100 rounded"
              title="View capacity details"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Capacity Mini Bar - shown below the main row when capacity data is available */}
      {showCapacity && capacityBreakdown && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <DayCapacityMiniBar
            breakdown={isClosed
              ? { transient: 0, events: 0, reserved: 0, unavailable: totalCapacity, readyToUse: 0 }
              : capacityBreakdown
            }
            totalCapacity={totalCapacity}
            isClosed={isClosed}
            compact={true}
          />
        </div>
      )}

      {/* Day Edit Modal */}
      <DayEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        day={day}
        dayLabel={dayLabel}
        slots={slots}
        inheritedSlots={inheritedSlots}
        inheritedSource={inheritedSource}
        isOwn={isOwn}
        onChange={onChange}
        capacityBreakdown={isClosed
          ? { transient: 0, events: 0, reserved: 0, unavailable: totalCapacity, readyToUse: 0 }
          : capacityBreakdown
        }
        totalCapacity={totalCapacity}
        entityName={entityName}
      />
    </div>
  );
}
