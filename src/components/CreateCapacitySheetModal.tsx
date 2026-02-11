'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

interface CreateCapacitySheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateCapacitySheetModal({ isOpen, onClose, onSuccess }: CreateCapacitySheetModalProps) {
  const [applyTo, setApplyTo] = useState<'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT'>('SUBLOCATION');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'TIME_BASED' | 'DATE_BASED' | 'EVENT_BASED'>('TIME_BASED');
  const [priority, setPriority] = useState('3100');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [timeWindows, setTimeWindows] = useState([
    { startTime: '09:00', endTime: '17:00', minCapacity: 100, maxCapacity: 400, defaultCapacity: 250, allocatedCapacity: 0 }
  ]);
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      setEffectiveFrom(now.toISOString().split('T')[0]);
      loadEntities();
    }
  }, [isOpen, applyTo]);

  const loadEntities = async () => {
    try {
      let url = '';
      if (applyTo === 'CUSTOMER') url = '/api/customers';
      else if (applyTo === 'LOCATION') url = '/api/locations';
      else if (applyTo === 'SUBLOCATION') url = '/api/sublocations';
      else if (applyTo === 'EVENT') url = '/api/events';

      const res = await fetch(url);
      const data = await res.json();
      setEntities(data);
    } catch (error) {
      console.error('Error loading entities:', error);
    }
  };

  const addTimeWindow = () => {
    setTimeWindows([...timeWindows, {
      startTime: '17:00',
      endTime: '22:00',
      minCapacity: 100,
      maxCapacity: 400,
      defaultCapacity: 250,
      allocatedCapacity: 0
    }]);
  };

  const removeTimeWindow = (index: number) => {
    setTimeWindows(timeWindows.filter((_, i) => i !== index));
  };

  const updateTimeWindow = (index: number, field: string, value: any) => {
    const updated = [...timeWindows];
    updated[index] = { ...updated[index], [field]: value };
    setTimeWindows(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name,
        description,
        type,
        appliesTo: {
          level: applyTo,
          entityId: selectedEntity
        },
        priority: parseInt(priority),
        conflictResolution: 'PRIORITY',
        effectiveFrom,
        effectiveTo: null,
        timeWindows: type === 'TIME_BASED' ? timeWindows : undefined,
        isActive: true,
        createdBy: 'admin'
      };

      const response = await fetch('/api/capacitysheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create capacity sheet');
      }

      onSuccess();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-teal-600 to-green-600 text-white p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Create Capacity Sheet</h2>
          <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 text-gray-700">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Basic Information</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sheet Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Weekend Peak Capacity"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Capacity for weekend events"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="TIME_BASED">Time-Based</option>
                  <option value="DATE_BASED">Date-Based</option>
                  <option value="EVENT_BASED">Event-Based</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Effective From *</label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Apply To */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Apply To</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Level *</label>
              <div className="grid grid-cols-4 gap-2">
                {['CUSTOMER', 'LOCATION', 'SUBLOCATION', 'EVENT'].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      setApplyTo(level as any);
                      setSelectedEntity('');
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      applyTo === level
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select {applyTo} *</label>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Select {applyTo}...</option>
                {entities.map((entity) => (
                  <option key={entity._id} value={entity._id}>
                    {entity.name || entity.label || entity._id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority *</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="3100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Customer: 1000-1999 | Location: 2000-2999 | SubLocation: 3000-3999 | Event: 4000-4999
              </p>
            </div>
          </div>

          {/* Time Windows */}
          {type === 'TIME_BASED' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold text-gray-900">Time Windows</h3>
                <button
                  type="button"
                  onClick={addTimeWindow}
                  className="bg-teal-100 text-teal-700 px-3 py-1 rounded-lg hover:bg-teal-200 transition-all flex items-center gap-1 text-sm font-medium"
                >
                  <Plus size={16} />
                  Add Window
                </button>
              </div>

              {timeWindows.map((window, index) => (
                <div key={index} className="p-4 bg-teal-50 rounded-lg border border-teal-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-teal-900">Window {index + 1}</h4>
                    {timeWindows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTimeWindow(index)}
                        className="text-red-600 hover:bg-red-100 p-1 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={window.startTime}
                        onChange={(e) => updateTimeWindow(index, 'startTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
                      <input
                        type="time"
                        value={window.endTime}
                        onChange={(e) => updateTimeWindow(index, 'endTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Min Capacity</label>
                      <input
                        type="number"
                        value={window.minCapacity}
                        onChange={(e) => updateTimeWindow(index, 'minCapacity', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Max Capacity</label>
                      <input
                        type="number"
                        value={window.maxCapacity}
                        onChange={(e) => updateTimeWindow(index, 'maxCapacity', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Default Capacity</label>
                      <input
                        type="number"
                        value={window.defaultCapacity}
                        onChange={(e) => updateTimeWindow(index, 'defaultCapacity', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Allocated</label>
                      <input
                        type="number"
                        value={window.allocatedCapacity}
                        onChange={(e) => updateTimeWindow(index, 'allocatedCapacity', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-gradient-to-r from-teal-600 to-green-600 text-white rounded-lg font-medium hover:from-teal-700 hover:to-green-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Capacity Sheet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
