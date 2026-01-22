import React, { useState } from 'react';
import { Edit2, Save, X, CheckSquare, Square, Eye, Zap } from 'lucide-react';

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
}

interface HourlyBreakdownTableProps {
  hourlyBreakdown: HourlySegment[];
  date?: Date;
  subLocationId?: string;
  editable?: boolean;
  onHourlyCapacityUpdate?: () => void;
}

type BulkEditField = 'maxCapacity' | 'allocatedCapacity';

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
  // Individual edit mode (original functionality)
  const [editingHour, setEditingHour] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    minCapacity: number;
    maxCapacity: number;
    defaultCapacity: number;
    allocatedCapacity: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Bulk edit mode
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedHours, setSelectedHours] = useState<Set<number>>(new Set());
  const [bulkEditField, setBulkEditField] = useState<BulkEditField>('maxCapacity');
  const [bulkEditValue, setBulkEditValue] = useState<number>(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewChanges, setPreviewChanges] = useState<PreviewChange[]>([]);

  // Individual edit handlers
  const handleEdit = (segment: HourlySegment) => {
    setEditingHour(segment.hour);
    setEditValues({
      minCapacity: segment.minCapacity,
      maxCapacity: segment.maxCapacity,
      defaultCapacity: segment.defaultCapacity,
      allocatedCapacity: segment.allocatedCapacity
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
          ...editValues
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

  const handlePreview = () => {
    if (selectedHours.size === 0) {
      alert('Please select at least one hour to update');
      return;
    }

    const changes: PreviewChange[] = [];
    selectedHours.forEach(hour => {
      const segment = hourlyBreakdown.find(s => s.hour === hour);
      if (segment) {
        const oldValue = segment[bulkEditField];
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

      // Apply changes sequentially
      const failedHours: number[] = [];
      const successHours: number[] = [];

      for (const change of previewChanges) {
        try {
          const updateData: any = {};
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

      // Reset bulk edit state
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

  const totalMaxCapacity = hourlyBreakdown.reduce((sum, s) => sum + s.maxCapacity, 0);

  const getPreviewChange = (hour: number, field: BulkEditField) => {
    return previewChanges.find(c => c.hour === hour && c.field === field);
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
                Hourly Capacity Breakdown | Daily Total (Max): {totalMaxCapacity}
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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-700">Field:</label>
              <select
                value={bulkEditField}
                onChange={(e) => setBulkEditField(e.target.value as BulkEditField)}
                className="px-2 py-1 border border-gray-300 rounded text-xs"
              >
                <option value="maxCapacity">Max Capacity</option>
                <option value="allocatedCapacity">Allocated Capacity</option>
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
                Preview: {previewChanges.length} changes to {bulkEditField === 'maxCapacity' ? 'Max Capacity' : 'Allocated Capacity'}
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

      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {bulkEditMode && (
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">
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
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Hour</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-green-600 border-b" title="Maximum Capacity">
                Max
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-purple-600 border-b" title="Allocated Capacity">
                Allocated
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-pink-600 border-b" title="Allocation Percentage (Allocated/Max)">
                %Alloc
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b">Source</th>
              {editable && !bulkEditMode && (
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {hourlyBreakdown.map((segment, idx) => {
              const maxPreview = getPreviewChange(segment.hour, 'maxCapacity');
              const allocatedPreview = getPreviewChange(segment.hour, 'allocatedCapacity');
              const hasPreview = maxPreview || allocatedPreview;

              return (
                <tr
                  key={idx}
                  className={`hover:bg-gray-50 ${
                    hasPreview ? 'bg-yellow-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  {bulkEditMode && (
                    <td className="px-3 py-2 text-center">
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

                  <td className="px-3 py-2 font-medium text-gray-900">
                    {segment.hour.toString().padStart(2, '0')}:00
                  </td>

                  {editingHour === segment.hour && editValues && !bulkEditMode ? (
                    <>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={editValues.maxCapacity}
                          onChange={(e) => setEditValues({ ...editValues, maxCapacity: Number(e.target.value) })}
                          className="w-16 px-2 py-1 border rounded text-right text-green-600 font-bold"
                          min={0}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={editValues.allocatedCapacity}
                          onChange={(e) => setEditValues({ ...editValues, allocatedCapacity: Number(e.target.value) })}
                          className="w-16 px-2 py-1 border rounded text-right text-purple-600 font-medium"
                          min={0}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-pink-600 font-medium">
                        {editValues.maxCapacity > 0
                          ? `${Math.round((editValues.allocatedCapacity / editValues.maxCapacity) * 100)}%`
                          : '0%'
                        }
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        <span className="text-xs text-orange-600 font-semibold">Editing...</span>
                      </td>
                      <td className="px-3 py-2">
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
                      {/* Max Capacity Column */}
                      <td className="px-3 py-2 text-right">
                        {maxPreview ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-gray-400 line-through text-xs">{maxPreview.oldValue}</span>
                            <span className="text-green-600 font-bold">→ {maxPreview.newValue}</span>
                          </div>
                        ) : (
                          <span className="text-green-600 font-bold">{segment.maxCapacity}</span>
                        )}
                      </td>

                      {/* Allocated Capacity Column */}
                      <td className="px-3 py-2 text-right">
                        {allocatedPreview ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-gray-400 line-through text-xs">{allocatedPreview.oldValue}</span>
                            <span className="text-purple-600 font-medium">→ {allocatedPreview.newValue}</span>
                          </div>
                        ) : (
                          <span className="text-purple-600 font-medium">{segment.allocatedCapacity}</span>
                        )}
                      </td>

                      {/* %Alloc Column */}
                      <td className="px-3 py-2 text-right text-pink-600 font-medium">
                        {(() => {
                          const max = maxPreview ? maxPreview.newValue : segment.maxCapacity;
                          const allocated = allocatedPreview ? allocatedPreview.newValue : segment.allocatedCapacity;
                          return max > 0 ? `${Math.round((allocated / max) * 100)}%` : '0%';
                        })()}
                      </td>

                      {/* Source Column */}
                      <td className="px-3 py-2 text-gray-700">
                        {segment.capacitySheetName ? (
                          <div className="flex items-center gap-1" title={segment.capacitySheetName}>
                            <span className="inline-block w-2 h-2 bg-teal-500 rounded-full"></span>
                            <span className="text-xs truncate max-w-[150px]">{segment.capacitySheetName}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
                            <span className="text-xs text-gray-500">Default</span>
                          </div>
                        )}
                      </td>

                      {/* Actions Column */}
                      {editable && !bulkEditMode && (
                        <td className="px-3 py-2">
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
              {bulkEditMode && <td className="px-3 py-2"></td>}
              <td className="px-3 py-2 font-bold text-gray-900">Total</td>
              <td className="px-3 py-2 text-right font-bold text-green-600">
                {hourlyBreakdown.reduce((sum, s) => sum + s.maxCapacity, 0)}
              </td>
              <td className="px-3 py-2 text-right font-bold text-purple-600">
                {hourlyBreakdown.reduce((sum, s) => sum + s.allocatedCapacity, 0)}
              </td>
              <td className="px-3 py-2 text-right font-bold text-pink-600">
                {(() => {
                  const totalMax = hourlyBreakdown.reduce((sum, s) => sum + s.maxCapacity, 0);
                  const totalAllocated = hourlyBreakdown.reduce((sum, s) => sum + s.allocatedCapacity, 0);
                  return totalMax > 0 ? `${Math.round((totalAllocated / totalMax) * 100)}%` : '0%';
                })()}
              </td>
              <td className="px-3 py-2"></td>
              {editable && !bulkEditMode && <td className="px-3 py-2"></td>}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-teal-500 rounded-full"></span>
              <span className="text-gray-600">Capacity Sheet</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
              <span className="text-gray-600">Default Values</span>
            </div>
            {editable && (
              <div className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-orange-500 rounded-full"></span>
                <span className="text-gray-600">Editable (click <Edit2 className="w-3 h-3 inline" />)</span>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-600 font-semibold">
            Daily Capacity Sum: {totalMaxCapacity}
          </div>
        </div>
      </div>
    </div>
  );
}
