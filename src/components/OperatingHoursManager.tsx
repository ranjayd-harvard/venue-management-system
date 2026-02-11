'use client';

import { useState, useEffect } from 'react';
import { Save, Clock, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import {
  OperatingHours,
  WeeklySchedule,
  TimeSlot,
  Blackout,
  ResolvedDaySchedule,
  ResolvedBlackout,
  DayOfWeekKey,
} from '@/models/types';
import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  validateSchedule,
  generateBlackoutId,
  isDayDefined,
  SCHEDULE_24_7,
  is24_7Schedule,
} from '@/lib/operating-hours';
import DayScheduleEditor from './DayScheduleEditor';
import BlackoutEditor from './BlackoutEditor';

interface CapacityBreakdown {
  transient: number;
  events: number;
  unavailable: number;
  reserved: number;
}

interface OperatingHoursManagerProps {
  operatingHours: OperatingHours | undefined;
  inheritedSchedule: ResolvedDaySchedule[];
  inheritedBlackouts: ResolvedBlackout[];
  onSave: (hours: OperatingHours) => Promise<void>;
  entityName: string;
  // Capacity props (optional - for sublocations)
  capacityBreakdown?: CapacityBreakdown;
  totalCapacity?: number;
  showCapacity?: boolean;
}

export default function OperatingHoursManager({
  operatingHours,
  inheritedSchedule,
  inheritedBlackouts,
  onSave,
  entityName,
  capacityBreakdown,
  totalCapacity = 100,
  showCapacity = false,
}: OperatingHoursManagerProps) {
  const [localSchedule, setLocalSchedule] = useState<WeeklySchedule>(
    operatingHours?.schedule || {}
  );
  const [localBlackouts, setLocalBlackouts] = useState<Blackout[]>(
    operatingHours?.blackouts || []
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [scheduleExpanded, setScheduleExpanded] = useState(true);
  const [blackoutsExpanded, setBlackoutsExpanded] = useState(true);

  // Reset local state when props change
  useEffect(() => {
    setLocalSchedule(operatingHours?.schedule || {});
    setLocalBlackouts(operatingHours?.blackouts || []);
  }, [operatingHours]);

  const handleSave = async () => {
    // Validate schedule
    const validationErrors = validateSchedule(localSchedule);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setSaving(true);
    try {
      await onSave({
        schedule: localSchedule,
        blackouts: localBlackouts,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDayChange = (day: DayOfWeekKey, slots: TimeSlot[] | undefined) => {
    setLocalSchedule((prev) => {
      const updated = { ...prev };
      if (slots === undefined) {
        // Remove override, inherit from parent
        delete updated[day];
      } else {
        updated[day] = slots;
      }
      return updated;
    });
  };

  const handleSetAll24_7 = () => {
    setLocalSchedule({ ...SCHEDULE_24_7 });
  };

  const handleClearAllSchedule = () => {
    setLocalSchedule({});
  };

  // Check if current schedule is 24/7
  const isCurrently24_7 = is24_7Schedule(localSchedule);

  const handleAddBlackout = () => {
    const newBlackout: Blackout = {
      id: generateBlackoutId(),
      date: new Date().toISOString().split('T')[0],
      type: 'FULL_DAY',
      name: '',
    };
    setLocalBlackouts((prev) => [...prev, newBlackout]);
  };

  const handleUpdateBlackout = (index: number, blackout: Blackout) => {
    setLocalBlackouts((prev) => {
      const updated = [...prev];
      updated[index] = blackout;
      return updated;
    });
  };

  const handleRemoveBlackout = (index: number) => {
    setLocalBlackouts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCancelInheritedBlackout = (blackoutId: string) => {
    // Add a cancel entry for this inherited blackout
    const cancelBlackout: Blackout = {
      id: blackoutId,
      date: '', // Not used for cancel
      type: 'FULL_DAY',
      cancelled: true,
    };
    setLocalBlackouts((prev) => [...prev, cancelBlackout]);
  };

  // Get the effective schedule for each day (considering inheritance)
  const getEffectiveSchedule = (day: DayOfWeekKey): {
    slots: TimeSlot[];
    source: string;
    isOwn: boolean;
    isOverride: boolean;
  } => {
    const inherited = inheritedSchedule.find((s) => s.day === day);
    const isOwn = isDayDefined(localSchedule, day);

    if (isOwn) {
      return {
        slots: localSchedule[day] || [],
        source: entityName,
        isOwn: true,
        isOverride: !!inherited && !inherited.isInherited,
      };
    }

    return {
      slots: inherited?.slots || [],
      source: inherited?.source || '',
      isOwn: false,
      isOverride: false,
    };
  };

  // Count own definitions
  const ownDayCount = DAYS_OF_WEEK.filter((day) =>
    isDayDefined(localSchedule, day)
  ).length;
  const ownBlackoutCount = localBlackouts.filter((b) => !b.cancelled).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-teal-600" />
          <h3 className="text-lg font-semibold text-gray-800">
            Operating Hours for {entityName}
          </h3>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:bg-gray-400"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Hours'}
        </button>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-red-800 mb-2">
            Please fix the following errors:
          </h4>
          <ul className="list-disc list-inside text-sm text-red-700">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Weekly Schedule Section */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <button
          onClick={() => setScheduleExpanded(!scheduleExpanded)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-800">Weekly Schedule</span>
            {ownDayCount > 0 && (
              <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded">
                {ownDayCount} day{ownDayCount > 1 ? 's' : ''} defined
              </span>
            )}
          </div>
          {scheduleExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {scheduleExpanded && (
          <div className="border-t border-gray-200 p-4 space-y-2">
            {/* Quick Actions */}
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
              <span className="text-xs text-gray-500">Quick actions:</span>
              <button
                onClick={handleSetAll24_7}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  isCurrently24_7
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-600 border border-gray-200'
                }`}
              >
                <Clock className="w-3 h-3 inline mr-1" />
                Set All 24/7
              </button>
              {ownDayCount > 0 && (
                <button
                  onClick={handleClearAllSchedule}
                  className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full border border-gray-200"
                >
                  Clear All (Inherit)
                </button>
              )}
            </div>

            {DAYS_OF_WEEK.map((day) => {
              const effective = getEffectiveSchedule(day);
              const inherited = inheritedSchedule.find((s) => s.day === day);

              return (
                <DayScheduleEditor
                  key={day}
                  day={day}
                  dayLabel={DAY_LABELS[day]}
                  slots={effective.isOwn ? localSchedule[day] : undefined}
                  inheritedSlots={inherited?.isInherited ? inherited.slots : undefined}
                  inheritedSource={inherited?.isInherited ? inherited.source : undefined}
                  isOwn={effective.isOwn}
                  onChange={(slots) => handleDayChange(day, slots)}
                  capacityBreakdown={capacityBreakdown}
                  totalCapacity={totalCapacity}
                  entityName={entityName}
                  showCapacity={showCapacity}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Blackouts & Holidays Section */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <button
          onClick={() => setBlackoutsExpanded(!blackoutsExpanded)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-800">Blackouts & Holidays</span>
            {(ownBlackoutCount > 0 || inheritedBlackouts.length > 0) && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                {ownBlackoutCount + inheritedBlackouts.filter(b =>
                  !localBlackouts.some(lb => lb.id === b.id && lb.cancelled)
                ).length} total
              </span>
            )}
          </div>
          {blackoutsExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {blackoutsExpanded && (
          <div className="border-t border-gray-200 p-4">
            <BlackoutEditor
              blackouts={localBlackouts.filter((b) => !b.cancelled)}
              inheritedBlackouts={inheritedBlackouts.filter(
                (b) => !localBlackouts.some((lb) => lb.id === b.id && lb.cancelled)
              )}
              onAdd={handleAddBlackout}
              onUpdate={handleUpdateBlackout}
              onRemove={handleRemoveBlackout}
              onCancelInherited={handleCancelInheritedBlackout}
              entityName={entityName}
            />
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
        <p className="mb-1">
          <strong>Inheritance:</strong> Days not defined here will inherit from the parent entity.
        </p>
        <p>
          <strong>Blackouts:</strong> All parent blackouts are inherited. You can add more or cancel inherited ones.
        </p>
      </div>
    </div>
  );
}
