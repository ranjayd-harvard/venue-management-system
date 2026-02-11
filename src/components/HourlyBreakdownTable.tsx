import React, { useState } from 'react';
import { Edit2, Save, X, CheckSquare, Square, Eye, Zap } from 'lucide-react';

// Allocation breakdown categories
interface AllocationBreakdown {
  transient: number;
  events: number;
  reserved: number;
  unavailable: number;
  readyToUse: number;
  isOverride?: boolean;
}

interface HourlySegment {
  hour: number;
  startTime: string;
  endTime: string;
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity: number;
  source: string;
  capacitySheetName?: string;
  capacitySheetLevel?: string;
  isAvailable?: boolean;
  // Per-hour allocation breakdown (from API)
  breakdown?: AllocationBreakdown;
}

interface HourlyBreakdownTableProps {
  hourlyBreakdown: HourlySegment[];
  date?: Date;
  subLocationId?: string;
  editable?: boolean;
  onHourlyCapacityUpdate?: () => void;
}

// Allocation category colors (matching DayCapacityMiniBar)
const COLORS = {
  transient: '#14B8A6',    // teal-500
  events: '#EC4899',       // pink-500
  reserved: '#8B5CF6',     // violet-500
  unavailable: '#9CA3AF',  // gray-400
  readyToUse: '#F59E0B',   // amber-500
};

type BulkEditField = 'maxCapacity' | 'allocatedCapacity' | 'transient' | 'events' | 'reserved' | 'unavailable' | 'readyToUse';

interface PreviewChange {
  hour: number;
  field: BulkEditField;
  oldValue: number;
  newValue: number;
}

export default function HourlyBreakdownTable({
  hourlyBreakdown,
  date,
  subLocationId,
  editable = false,
  onHourlyCapacityUpdate
}: HourlyBreakdownTableProps) {
  // Individual edit mode
  const [editingHour, setEditingHour] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    minCapacity: number;
    maxCapacity: number;
    defaultCapacity: number;
    allocatedCapacity: number;
    transient: number;
    events: number;
    reserved: number;
    unavailable: number;
    readyToUse: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Bulk edit mode
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedHours, setSelectedHours] = useState<Set<number>>(new Set());
  const [bulkEditField, setBulkEditField] = useState<BulkEditField>('transient');
  const [bulkEditValue, setBulkEditValue] = useState<number>(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewChanges, setPreviewChanges] = useState<PreviewChange[]>([]);

  // Get breakdown values for a segment (fallback to 0 if not available)
  const getBreakdown = (segment: HourlySegment): AllocationBreakdown => {
    if (segment.breakdown) {
      return {
        transient: segment.breakdown.transient >= 0 ? segment.breakdown.transient : 0,
        events: segment.breakdown.events >= 0 ? segment.breakdown.events : 0,
        reserved: segment.breakdown.reserved >= 0 ? segment.breakdown.reserved : 0,
        unavailable: segment.breakdown.unavailable >= 0 ? segment.breakdown.unavailable : 0,
        readyToUse: segment.breakdown.readyToUse >= 0 ? segment.breakdown.readyToUse : 0,
        isOverride: segment.breakdown.isOverride,
      };
    }
    // Fallback: derive from allocatedCapacity
    return {
      transient: segment.allocatedCapacity,
      events: 0,
      reserved: 0,
      unavailable: segment.source === 'OPERATING_HOURS' && segment.isAvailable === false ? segment.maxCapacity : 0,
      readyToUse: segment.maxCapacity - segment.allocatedCapacity,
      isOverride: false,
    };
  };

  // Individual edit handlers
  const handleEdit = (segment: HourlySegment) => {
    const breakdown = getBreakdown(segment);
    setEditingHour(segment.hour);
    setEditValues({
      minCapacity: segment.minCapacity,
      maxCapacity: segment.maxCapacity,
      defaultCapacity: segment.defaultCapacity,
      allocatedCapacity: segment.allocatedCapacity,
      transient: breakdown.transient,
      events: breakdown.events,
      reserved: breakdown.reserved,
      unavailable: breakdown.unavailable,
      readyToUse: breakdown.readyToUse,
    });
  };

  const handleCancel = () => {
    setEditingHour(null);
    setEditValues(null);
  };

  const handleSave = async (hour: number) => {
    if (!editValues || !date || !subLocationId) return;

    setSaving(true);
    try {
      const dateStr = date.toISOString().split('T')[0];

      const response = await fetch('/api/capacity/hourly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subLocationId,
          date: dateStr,
          hour,
          maxCapacity: editValues.maxCapacity,
          allocatedCapacity: editValues.allocatedCapacity,
          // Allocation categories
          transient: editValues.transient,
          events: editValues.events,
          reserved: editValues.reserved,
          unavailable: editValues.unavailable,
          readyToUse: editValues.readyToUse,
        })
      });

      if (response.ok) {
        setEditingHour(null);
        setEditValues(null);
        if (onHourlyCapacityUpdate) {
          onHourlyCapacityUpdate();
        }
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to save hourly capacity:', error);
      alert('Failed to save hourly capacity');
    } finally {
      setSaving(false);
    }
  };

  // Bulk edit handlers
  const toggleBulkEditMode = () => {
    setBulkEditMode(!bulkEditMode);
    setSelectedHours(new Set());
    setPreviewMode(false);
    setPreviewChanges([]);
    setBulkEditValue(0);
  };

  const toggleSelectAll = () => {
    if (selectedHours.size === hourlyBreakdown.length) {
      setSelectedHours(new Set());
    } else {
      setSelectedHours(new Set(hourlyBreakdown.map(s => s.hour)));
    }
  };

  const toggleHourSelection = (hour: number) => {
    const newSelection = new Set(selectedHours);
    if (newSelection.has(hour)) {
      newSelection.delete(hour);
    } else {
      newSelection.add(hour);
    }
    setSelectedHours(newSelection);
  };

  const getFieldValue = (segment: HourlySegment, field: BulkEditField): number => {
    if (field === 'maxCapacity') return segment.maxCapacity;
    if (field === 'allocatedCapacity') return segment.allocatedCapacity;
    const breakdown = getBreakdown(segment);
    return breakdown[field as keyof AllocationBreakdown] as number || 0;
  };

  const handlePreview = () => {
    if (selectedHours.size === 0) {
      alert('Please select at least one hour to update');
      return;
    }

    const changes: PreviewChange[] = [];
    selectedHours.forEach(hour => {
      const segment = hourlyBreakdown.find(s => s.hour === hour);
      if (segment) {
        const oldValue = getFieldValue(segment, bulkEditField);
        if (oldValue !== bulkEditValue) {
          changes.push({
            hour,
            field: bulkEditField,
            oldValue,
            newValue: bulkEditValue
          });
        }
      }
    });

    if (changes.length === 0) {
      alert('No changes detected. The new value is the same as existing values.');
      return;
    }

    setPreviewChanges(changes);
    setPreviewMode(true);
  };

  const handleCancelPreview = () => {
    setPreviewMode(false);
    setPreviewChanges([]);
  };

  const handleApplyChanges = async () => {
    if (!date || !subLocationId || previewChanges.length === 0) return;

    setSaving(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      const failedHours: number[] = [];
      const successHours: number[] = [];

      for (const change of previewChanges) {
        try {
          const updateData: Record<string, number> = {};
          updateData[change.field] = change.newValue;

          const response = await fetch('/api/capacity/hourly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subLocationId,
              date: dateStr,
              hour: change.hour,
              ...updateData
            })
          });

          if (response.ok) {
            successHours.push(change.hour);
          } else {
            failedHours.push(change.hour);
            const errorData = await response.json();
            console.error(`Failed to update hour ${change.hour}:`, errorData);
          }
        } catch (error) {
          failedHours.push(change.hour);
          console.error(`Error updating hour ${change.hour}:`, error);
        }
      }

      if (failedHours.length > 0) {
        alert(`Warning: ${failedHours.length} hours failed to update: ${failedHours.join(', ')}`);
      } else {
        alert(`Successfully updated ${successHours.length} hours`);
      }

      setBulkEditMode(false);
      setSelectedHours(new Set());
      setPreviewMode(false);
      setPreviewChanges([]);
      setBulkEditValue(0);

      if (onHourlyCapacityUpdate) {
        onHourlyCapacityUpdate();
      }
    } catch (error) {
      console.error('Failed to apply bulk changes:', error);
      alert('Failed to apply changes');
    } finally {
      setSaving(false);
    }
  };

  // Totals
  const totals = hourlyBreakdown.reduce((acc, seg) => {
    const breakdown = getBreakdown(seg);
    return {
      transient: acc.transient + breakdown.transient,
      events: acc.events + breakdown.events,
      reserved: acc.reserved + breakdown.reserved,
      unavailable: acc.unavailable + breakdown.unavailable,
      readyToUse: acc.readyToUse + breakdown.readyToUse,
      maxCapacity: acc.maxCapacity + seg.maxCapacity,
    };
  }, { transient: 0, events: 0, reserved: 0, unavailable: 0, readyToUse: 0, maxCapacity: 0 });

  const getPreviewChange = (hour: number, field: BulkEditField) => {
    return previewChanges.find(c => c.hour === hour && c.field === field);
  };

  const fieldLabels: Record<BulkEditField, string> = {
    maxCapacity: 'Max Capacity',
    allocatedCapacity: 'Allocated',
    transient: 'Transient',
    events: 'Events',
    reserved: 'Reserved',
    unavailable: 'Unavailable',
    readyToUse: 'Ready To Use',
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {date && (
        <div className="bg-gradient-to-r from-teal-600 to-green-600 text-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm">
                {date.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </h4>
              <p className="text-xs text-teal-100">
                Hourly Capacity Breakdown with Allocation Categories
              </p>
            </div>
            {editable && (
              <button
                onClick={toggleBulkEditMode}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  bulkEditMode
                    ? 'bg-white text-teal-600 hover:bg-teal-50'
                    : 'bg-teal-700 text-white hover:bg-teal-800'
                }`}
              >
                {bulkEditMode ? 'Exit Bulk Edit' : 'Bulk Edit Mode'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bulk Edit Control Panel */}
      {bulkEditMode && !previewMode && (
        <div className="bg-blue-50 px-4 py-3 border-b border-blue-200">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-700">Field:</label>
              <select
                value={bulkEditField}
                onChange={(e) => setBulkEditField(e.target.value as BulkEditField)}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
              >
                <optgroup label="Capacity">
                  <option value="maxCapacity">Max Capacity</option>
                  <option value="allocatedCapacity">Allocated Capacity</option>
                </optgroup>
                <optgroup label="Allocation Categories">
                  <option value="transient">Transient</option>
                  <option value="events">Events</option>
                  <option value="reserved">Reserved</option>
                  <option value="unavailable">Unavailable</option>
                  <option value="readyToUse">Ready To Use</option>
                </optgroup>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-700">New Value:</label>
              <input
                type="number"
                value={bulkEditValue}
                onChange={(e) => setBulkEditValue(Number(e.target.value))}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
                min={0}
              />
            </div>
            <button
              onClick={handlePreview}
              disabled={selectedHours.size === 0}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              Preview Changes ({selectedHours.size} hours)
            </button>
          </div>
        </div>
      )}

      {/* Preview Mode Control Panel */}
      {previewMode && (
        <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-gray-900">
                Preview: {previewChanges.length} changes to {fieldLabels[bulkEditField]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelPreview}
                disabled={saving}
                className="px-3 py-1.5 bg-gray-500 text-white text-xs font-medium rounded hover:bg-gray-600 disabled:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyChanges}
                disabled={saving}
                className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:bg-gray-300 flex items-center gap-1"
              >
                <Zap className="w-3 h-3" />
                {saving ? 'Applying...' : 'Apply Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {bulkEditMode && (
                <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 hover:bg-gray-200 rounded"
                    title={selectedHours.size === hourlyBreakdown.length ? 'Deselect All' : 'Select All'}
                  >
                    {selectedHours.size === hourlyBreakdown.length ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </th>
              )}
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">Hour</th>
              <th className="px-2 py-2 text-right text-xs font-semibold border-b" style={{ color: COLORS.transient }}>
                <div className="flex items-center justify-end gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.transient }} />
                  Transient
                </div>
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold border-b" style={{ color: COLORS.events }}>
                <div className="flex items-center justify-end gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.events }} />
                  Events
                </div>
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold border-b" style={{ color: COLORS.reserved }}>
                <div className="flex items-center justify-end gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.reserved }} />
                  Reserved
                </div>
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold border-b" style={{ color: COLORS.unavailable }}>
                <div className="flex items-center justify-end gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.unavailable }} />
                  Unavail.
                </div>
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold border-b" style={{ color: COLORS.readyToUse }}>
                <div className="flex items-center justify-end gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.readyToUse }} />
                  Ready
                </div>
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-gray-700 border-b">Max</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-gray-700 border-b">Source</th>
              {editable && !bulkEditMode && (
                <th className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b">Edit</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {hourlyBreakdown.map((segment, idx) => {
              const breakdown = getBreakdown(segment);
              const transientPreview = getPreviewChange(segment.hour, 'transient');
              const eventsPreview = getPreviewChange(segment.hour, 'events');
              const reservedPreview = getPreviewChange(segment.hour, 'reserved');
              const unavailablePreview = getPreviewChange(segment.hour, 'unavailable');
              const readyToUsePreview = getPreviewChange(segment.hour, 'readyToUse');
              const maxPreview = getPreviewChange(segment.hour, 'maxCapacity');
              const hasPreview = transientPreview || eventsPreview || reservedPreview || unavailablePreview || readyToUsePreview || maxPreview;

              return (
                <tr
                  key={idx}
                  className={`hover:bg-gray-50 ${
                    hasPreview ? 'bg-yellow-50' : breakdown.isOverride ? 'bg-blue-50/30' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  {bulkEditMode && (
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => toggleHourSelection(segment.hour)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {selectedHours.has(segment.hour) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </td>
                  )}

                  <td className="px-2 py-2 font-medium text-gray-900 whitespace-nowrap">
                    {segment.hour.toString().padStart(2, '0')}:00
                  </td>

                  {editingHour === segment.hour && editValues && !bulkEditMode ? (
                    <>
                      {/* Editable inputs for all categories */}
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          value={editValues.transient}
                          onChange={(e) => setEditValues({ ...editValues, transient: Number(e.target.value) })}
                          className="w-14 px-1 py-0.5 border rounded text-right text-xs font-medium"
                          style={{ color: COLORS.transient }}
                          min={0}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          value={editValues.events}
                          onChange={(e) => setEditValues({ ...editValues, events: Number(e.target.value) })}
                          className="w-14 px-1 py-0.5 border rounded text-right text-xs font-medium"
                          style={{ color: COLORS.events }}
                          min={0}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          value={editValues.reserved}
                          onChange={(e) => setEditValues({ ...editValues, reserved: Number(e.target.value) })}
                          className="w-14 px-1 py-0.5 border rounded text-right text-xs font-medium"
                          style={{ color: COLORS.reserved }}
                          min={0}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          value={editValues.unavailable}
                          onChange={(e) => setEditValues({ ...editValues, unavailable: Number(e.target.value) })}
                          className="w-14 px-1 py-0.5 border rounded text-right text-xs font-medium"
                          style={{ color: COLORS.unavailable }}
                          min={0}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          value={editValues.readyToUse}
                          onChange={(e) => setEditValues({ ...editValues, readyToUse: Number(e.target.value) })}
                          className="w-14 px-1 py-0.5 border rounded text-right text-xs font-medium"
                          style={{ color: COLORS.readyToUse }}
                          min={0}
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <input
                          type="number"
                          value={editValues.maxCapacity}
                          onChange={(e) => setEditValues({ ...editValues, maxCapacity: Number(e.target.value) })}
                          className="w-14 px-1 py-0.5 border rounded text-right text-xs font-bold text-gray-700"
                          min={0}
                        />
                      </td>
                      <td className="px-2 py-2 text-gray-700">
                        <span className="text-xs text-orange-600 font-semibold">Editing...</span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleSave(segment.hour)}
                            disabled={saving}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Save"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={saving}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      {/* Transient */}
                      <td className="px-2 py-2 text-right">
                        {transientPreview ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-400 line-through text-xs">{transientPreview.oldValue}</span>
                            <span className="font-bold" style={{ color: COLORS.transient }}>→ {transientPreview.newValue}</span>
                          </div>
                        ) : (
                          <span className="font-semibold" style={{ color: COLORS.transient }}>{breakdown.transient}</span>
                        )}
                      </td>

                      {/* Events */}
                      <td className="px-2 py-2 text-right">
                        {eventsPreview ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-400 line-through text-xs">{eventsPreview.oldValue}</span>
                            <span className="font-bold" style={{ color: COLORS.events }}>→ {eventsPreview.newValue}</span>
                          </div>
                        ) : (
                          <span className="font-semibold" style={{ color: COLORS.events }}>{breakdown.events}</span>
                        )}
                      </td>

                      {/* Reserved */}
                      <td className="px-2 py-2 text-right">
                        {reservedPreview ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-400 line-through text-xs">{reservedPreview.oldValue}</span>
                            <span className="font-bold" style={{ color: COLORS.reserved }}>→ {reservedPreview.newValue}</span>
                          </div>
                        ) : (
                          <span className="font-semibold" style={{ color: COLORS.reserved }}>{breakdown.reserved}</span>
                        )}
                      </td>

                      {/* Unavailable */}
                      <td className="px-2 py-2 text-right">
                        {unavailablePreview ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-400 line-through text-xs">{unavailablePreview.oldValue}</span>
                            <span className="font-bold" style={{ color: COLORS.unavailable }}>→ {unavailablePreview.newValue}</span>
                          </div>
                        ) : (
                          <span className="font-semibold" style={{ color: COLORS.unavailable }}>{breakdown.unavailable}</span>
                        )}
                      </td>

                      {/* Ready To Use */}
                      <td className="px-2 py-2 text-right">
                        {readyToUsePreview ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-400 line-through text-xs">{readyToUsePreview.oldValue}</span>
                            <span className="font-bold" style={{ color: COLORS.readyToUse }}>→ {readyToUsePreview.newValue}</span>
                          </div>
                        ) : (
                          <span className="font-bold" style={{ color: COLORS.readyToUse }}>{breakdown.readyToUse}</span>
                        )}
                      </td>

                      {/* Max Capacity */}
                      <td className="px-2 py-2 text-right">
                        {maxPreview ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-400 line-through text-xs">{maxPreview.oldValue}</span>
                            <span className="font-bold text-gray-700">→ {maxPreview.newValue}</span>
                          </div>
                        ) : (
                          <span className="font-bold text-gray-700">{segment.maxCapacity}</span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="px-2 py-2 text-gray-700">
                        {segment.capacitySheetName ? (
                          <div className="flex items-center gap-1" title={segment.capacitySheetName}>
                            <span className="inline-block w-2 h-2 bg-teal-500 rounded-full"></span>
                            <span className="text-xs truncate max-w-[100px]">{segment.capacitySheetName}</span>
                          </div>
                        ) : segment.source === 'OPERATING_HOURS' && segment.isAvailable === false ? (
                          <div className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
                            <span className="text-xs text-gray-500">Closed</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
                            <span className="text-xs text-gray-500">Default</span>
                          </div>
                        )}
                        {breakdown.isOverride && (
                          <span className="ml-1 px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">Override</span>
                        )}
                      </td>

                      {/* Actions */}
                      {editable && !bulkEditMode && (
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => handleEdit(segment)}
                              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                              title="Edit this hour"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-100 sticky bottom-0">
            <tr>
              {bulkEditMode && <td className="px-2 py-2"></td>}
              <td className="px-2 py-2 font-bold text-gray-900">Total</td>
              <td className="px-2 py-2 text-right font-bold" style={{ color: COLORS.transient }}>{totals.transient}</td>
              <td className="px-2 py-2 text-right font-bold" style={{ color: COLORS.events }}>{totals.events}</td>
              <td className="px-2 py-2 text-right font-bold" style={{ color: COLORS.reserved }}>{totals.reserved}</td>
              <td className="px-2 py-2 text-right font-bold" style={{ color: COLORS.unavailable }}>{totals.unavailable}</td>
              <td className="px-2 py-2 text-right font-bold" style={{ color: COLORS.readyToUse }}>{totals.readyToUse}</td>
              <td className="px-2 py-2 text-right font-bold text-gray-700">{totals.maxCapacity}</td>
              <td className="px-2 py-2"></td>
              {editable && !bulkEditMode && <td className="px-2 py-2"></td>}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.transient }}></span>
              <span className="text-gray-600">Transient (Walk-ins)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.events }}></span>
              <span className="text-gray-600">Events</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.reserved }}></span>
              <span className="text-gray-600">Reserved</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.unavailable }}></span>
              <span className="text-gray-600">Unavailable</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.readyToUse }}></span>
              <span className="text-gray-600">Ready To Use</span>
            </div>
          </div>
          {editable && (
            <div className="flex items-center gap-1 text-xs">
              <span className="inline-block w-2 h-2 bg-orange-500 rounded-full"></span>
              <span className="text-gray-600">Click <Edit2 className="w-3 h-3 inline" /> to edit</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
