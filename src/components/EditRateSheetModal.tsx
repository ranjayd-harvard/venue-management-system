'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface PriorityConfig {
  _id: string;
  type: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
  minPriority: number;
  maxPriority: number;
  color: string;
  description: string;
}

interface Ratesheet {
  _id: string;
  subLocationId?: string;
  locationId?: string;
  customerId?: string;
  name: string;
  description?: string;
  type: 'TIMING_BASED' | 'DURATION_BASED';
  priority: number;
  conflictResolution: 'PRIORITY' | 'HIGHEST_PRICE' | 'LOWEST_PRICE';
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  ratesheetType?: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
}

interface EditRateSheetModalProps {
  isOpen: boolean;
  ratesheet: Ratesheet | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditRateSheetModal({ isOpen, ratesheet, onClose, onSuccess }: EditRateSheetModalProps) {
  const [priorityConfigs, setPriorityConfigs] = useState<PriorityConfig[]>([]);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('');
  const [conflictResolution, setConflictResolution] = useState<'PRIORITY' | 'HIGHEST_PRICE' | 'LOWEST_PRICE'>('PRIORITY');
  const [effectiveFrom, setEffectiveFrom] = useState(''); // Now stores datetime-local format
  const [effectiveTo, setEffectiveTo] = useState('');     // Now stores datetime-local format
  const [isActive, setIsActive] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Helper to convert ISO string to datetime-local format (YYYY-MM-DDTHH:MM)
  const isoToDateTimeLocal = (isoString: string): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Load priority configs on mount
  useEffect(() => {
    if (isOpen) {
      loadPriorityConfigs();
    }
  }, [isOpen]);

  // Populate form when ratesheet changes
  useEffect(() => {
    if (ratesheet) {
      setName(ratesheet.name);
      setDescription(ratesheet.description || '');
      setPriority(ratesheet.priority.toString());
      setConflictResolution(ratesheet.conflictResolution);
      
      // Convert ISO strings to datetime-local format
      setEffectiveFrom(isoToDateTimeLocal(ratesheet.effectiveFrom));
      setEffectiveTo(ratesheet.effectiveTo ? isoToDateTimeLocal(ratesheet.effectiveTo) : '');
      
      setIsActive(ratesheet.isActive);
    }
  }, [ratesheet]);

  const loadPriorityConfigs = async () => {
    try {
      const res = await fetch('/api/pricing/priority-config');
      if (res.ok) {
        const configs = await res.json();
        setPriorityConfigs(configs);
      }
    } catch (err) {
      console.error('Error loading priority configs:', err);
    }
  };

  const getPriorityConfig = () => {
    if (!ratesheet?.ratesheetType) return null;
    return priorityConfigs.find(c => c.type === ratesheet.ratesheetType);
  };

  const validateForm = () => {
    if (!name.trim()) {
      setError('Ratesheet name is required');
      return false;
    }

    const priorityNum = parseInt(priority);
    if (!priority || isNaN(priorityNum)) {
      setError('Priority is required and must be a number');
      return false;
    }

    const config = getPriorityConfig();
    if (config) {
      if (priorityNum < config.minPriority || priorityNum > config.maxPriority) {
        setError(`Priority must be between ${config.minPriority} and ${config.maxPriority} for ${ratesheet?.ratesheetType} level`);
        return false;
      }
    }

    if (!effectiveFrom) {
      setError('Effective from date/time is required');
      return false;
    }

    // NEW: Validate that effectiveTo is after effectiveFrom
    if (effectiveTo) {
      const fromDate = new Date(effectiveFrom);
      const toDate = new Date(effectiveTo);
      
      if (toDate <= fromDate) {
        setError('End date/time must be after start date/time');
        return false;
      }
    }

    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !ratesheet) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        name,
        description,
        priority: parseInt(priority),
        conflictResolution,
        isActive,
        effectiveFrom: new Date(effectiveFrom).toISOString(), // Convert to ISO
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : null, // Convert to ISO
      };

      const response = await fetch(`/api/ratesheets/${ratesheet._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update ratesheet');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update ratesheet');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !ratesheet) return null;

  const priorityConfig = getPriorityConfig();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Edit Ratesheet</h2>
            <p className="text-blue-100 text-sm mt-1">
              {ratesheet.ratesheetType} Level • {ratesheet.type === 'TIMING_BASED' ? 'Time-Based' : 'Package'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Status Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="font-semibold text-gray-900">Active Status</label>
              <p className="text-sm text-gray-600">Enable or disable this ratesheet</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                isActive ? 'bg-green-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Ratesheet Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>

          {/* Priority Range Display */}
          {priorityConfig && (
            <div
              className="p-4 rounded-lg border-2"
              style={{
                borderColor: priorityConfig.color,
                backgroundColor: `${priorityConfig.color}10`,
              }}
            >
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Priority Range: {priorityConfig.minPriority} - {priorityConfig.maxPriority}
              </p>
              <p className="text-xs text-gray-600">{priorityConfig.description}</p>
            </div>
          )}

          {/* Priority and Conflict Resolution */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Priority {priorityConfig ? `(${priorityConfig.minPriority}-${priorityConfig.maxPriority})` : ''} *
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                min={priorityConfig?.minPriority || 0}
                max={priorityConfig?.maxPriority || 100}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Higher priority applies first</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Conflict Resolution
              </label>
              <select
                value={conflictResolution}
                onChange={(e) => setConflictResolution(e.target.value as any)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="PRIORITY">By Priority</option>
                <option value="HIGHEST_PRICE">Highest Price</option>
                <option value="LOWEST_PRICE">Lowest Price</option>
              </select>
            </div>
          </div>

          {/* Dates with Time - FIXED */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Effective From (Date & Time) *
              </label>
              <input
                type="datetime-local"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                required
              />
              <p className="text-xs text-gray-500 mt-1">📅 Select date and time</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Effective To (Date & Time)
              </label>
              <input
                type="datetime-local"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for indefinite</p>
            </div>
          </div>

          {/* Show validation hint */}
          {effectiveFrom && effectiveTo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                ✓ Duration: {new Date(effectiveFrom).toLocaleString()} to {new Date(effectiveTo).toLocaleString()}
                {new Date(effectiveTo) <= new Date(effectiveFrom) && (
                  <span className="block text-red-600 font-semibold mt-1">
                    ⚠️ End time must be after start time!
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              ℹ️ <strong>Note:</strong> Time windows and duration rules cannot be edited here. 
              To modify pricing rules, please create a new ratesheet and disable this one.
            </p>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-6 flex justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            disabled={loading}
          >
            Cancel
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors font-medium disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
