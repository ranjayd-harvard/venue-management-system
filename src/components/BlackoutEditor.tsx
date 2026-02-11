'use client';

import { Plus, X, Calendar, Repeat, Ban } from 'lucide-react';
import { Blackout, ResolvedBlackout } from '@/models/types';
import { formatTimeForDisplay } from '@/lib/operating-hours';

interface BlackoutEditorProps {
  blackouts: Blackout[];
  inheritedBlackouts: ResolvedBlackout[];
  onAdd: () => void;
  onUpdate: (index: number, blackout: Blackout) => void;
  onRemove: (index: number) => void;
  onCancelInherited: (blackoutId: string) => void;
  entityName: string;
}

export default function BlackoutEditor({
  blackouts,
  inheritedBlackouts,
  onAdd,
  onUpdate,
  onRemove,
  onCancelInherited,
  entityName,
}: BlackoutEditorProps) {
  const handleFieldChange = (
    index: number,
    field: keyof Blackout,
    value: any
  ) => {
    const updated = { ...blackouts[index], [field]: value };

    // Clear time fields when switching to FULL_DAY
    if (field === 'type' && value === 'FULL_DAY') {
      delete updated.startTime;
      delete updated.endTime;
    }

    // Add default times when switching to TIME_RANGE
    if (field === 'type' && value === 'TIME_RANGE') {
      updated.startTime = updated.startTime || '09:00';
      updated.endTime = updated.endTime || '17:00';
    }

    onUpdate(index, updated);
  };

  const handleRecurringToggle = (index: number) => {
    const current = blackouts[index];
    if (current.recurring) {
      const updated = { ...current };
      delete updated.recurring;
      onUpdate(index, updated);
    } else {
      onUpdate(index, {
        ...current,
        recurring: { pattern: 'YEARLY' },
      });
    }
  };

  const formatBlackoutDisplay = (blackout: Blackout | ResolvedBlackout) => {
    const date = new Date(blackout.date + 'T00:00:00');
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    if (blackout.type === 'TIME_RANGE' && blackout.startTime && blackout.endTime) {
      return `${dateStr} (${formatTimeForDisplay(blackout.startTime)} - ${formatTimeForDisplay(blackout.endTime)})`;
    }
    return `${dateStr} (Full Day)`;
  };

  return (
    <div className="space-y-4">
      {/* Inherited Blackouts */}
      {inheritedBlackouts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-blue-800">
            Inherited Blackouts
          </h4>
          {inheritedBlackouts.map((blackout) => (
            <div
              key={blackout.id}
              className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"
            >
              <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">
                  {blackout.name || 'Unnamed Blackout'}
                </div>
                <div className="text-xs text-gray-600">
                  {formatBlackoutDisplay(blackout)}
                </div>
                {blackout.recurring && (
                  <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                    <Repeat className="w-3 h-3" />
                    Repeats yearly
                  </div>
                )}
              </div>
              <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">
                ← {blackout.source}
              </span>
              <button
                onClick={() => onCancelInherited(blackout.id)}
                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                title="Cancel this inherited blackout"
              >
                <Ban className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Own Blackouts */}
      {blackouts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-800">
            {entityName}&apos;s Blackouts
          </h4>
          {blackouts.map((blackout, index) => (
            <div
              key={blackout.id}
              className="flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {/* Date Input */}
                <input
                  type="date"
                  value={blackout.date}
                  onChange={(e) =>
                    handleFieldChange(index, 'date', e.target.value)
                  }
                  className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                />

                {/* Type Select */}
                <select
                  value={blackout.type}
                  onChange={(e) =>
                    handleFieldChange(index, 'type', e.target.value)
                  }
                  className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                >
                  <option value="FULL_DAY">Full Day</option>
                  <option value="TIME_RANGE">Time Range</option>
                </select>

                {/* Time Range Inputs */}
                {blackout.type === 'TIME_RANGE' && (
                  <>
                    <input
                      type="time"
                      value={blackout.startTime || '09:00'}
                      onChange={(e) =>
                        handleFieldChange(index, 'startTime', e.target.value)
                      }
                      className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="time"
                      value={blackout.endTime || '17:00'}
                      onChange={(e) =>
                        handleFieldChange(index, 'endTime', e.target.value)
                      }
                      className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                    />
                  </>
                )}

                {/* Recurring Toggle */}
                <button
                  onClick={() => handleRecurringToggle(index)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${
                    blackout.recurring
                      ? 'bg-purple-100 text-purple-700 border border-purple-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}
                  title={
                    blackout.recurring
                      ? 'Repeats yearly (click to disable)'
                      : 'Click to repeat yearly'
                  }
                >
                  <Repeat className="w-3 h-3" />
                  {blackout.recurring ? 'Yearly' : 'Once'}
                </button>

                {/* Remove Button */}
                <button
                  onClick={() => onRemove(index)}
                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Name and Reason Row */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={blackout.name || ''}
                  onChange={(e) =>
                    handleFieldChange(index, 'name', e.target.value)
                  }
                  placeholder="Name (e.g., Thanksgiving)"
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                />
                <input
                  type="text"
                  value={blackout.reason || ''}
                  onChange={(e) =>
                    handleFieldChange(index, 'reason', e.target.value)
                  }
                  placeholder="Reason (optional)"
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {blackouts.length === 0 && inheritedBlackouts.length === 0 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          No blackouts or holidays defined
        </div>
      )}

      {/* Add Blackout Button */}
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 text-sm text-orange-600 border border-dashed border-orange-400 rounded-lg hover:bg-orange-50 w-full justify-center"
      >
        <Plus className="w-4 h-4" />
        Add Blackout / Holiday
      </button>
    </div>
  );
}
