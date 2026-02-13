'use client';

import { useState, useEffect } from 'react';
import { X, Zap, TrendingUp, TrendingDown, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { ObjectId } from 'bson';

interface CreateSurgeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Location {
  _id: ObjectId;
  name: string;
  city: string;
}

interface SubLocation {
  _id: ObjectId;
  label: string;
  locationId: ObjectId;
}

interface TimeWindowConfig {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
}

export default function CreateSurgeConfigModal({ isOpen, onClose, onSuccess }: CreateSurgeConfigModalProps) {
  // Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hierarchyLevel, setHierarchyLevel] = useState<'LOCATION' | 'SUBLOCATION'>('SUBLOCATION');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [priority, setPriority] = useState(700); // Default SUBLOCATION priority

  // Demand/Supply Parameters
  const [currentDemand, setCurrentDemand] = useState(15);
  const [currentSupply, setCurrentSupply] = useState(10);
  const [historicalAvgPressure, setHistoricalAvgPressure] = useState(1.2);

  // Surge Parameters
  const [alpha, setAlpha] = useState(0.3);
  const [minMultiplier, setMinMultiplier] = useState(0.75);
  const [maxMultiplier, setMaxMultiplier] = useState(1.8);
  const [emaAlpha, setEmaAlpha] = useState(0.3);

  // Time Windows - now supporting multiple windows with datetime
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 16)); // datetime-local format
  const [effectiveTo, setEffectiveTo] = useState('');
  const [timeWindows, setTimeWindows] = useState<TimeWindowConfig[]>([]);
  const [surgeDurationHours, setSurgeDurationHours] = useState(1);

  // Status
  const [isActive, setIsActive] = useState(true);

  // Data
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadLocationsAndSublocations();
    }
  }, [isOpen]);

  // Update priority when hierarchy level changes
  useEffect(() => {
    const defaultPriority = hierarchyLevel === 'SUBLOCATION' ? 700 : 400;
    setPriority(defaultPriority);
  }, [hierarchyLevel]);

  const loadLocationsAndSublocations = async () => {
    try {
      const [locResponse, sublocResponse] = await Promise.all([
        fetch('/api/locations'),
        fetch('/api/sublocations'),
      ]);

      if (locResponse.ok) {
        const locData = await locResponse.json();
        setLocations(locData);
      }

      if (sublocResponse.ok) {
        const sublocData = await sublocResponse.json();
        setSublocations(sublocData);
      }
    } catch (err) {
      console.error('Failed to load entities:', err);
    }
  };

  const calculateLivePreview = () => {
    if (currentSupply === 0) {
      return {
        surgeFactor: 1.0,
        pressure: 0,
        normalized: 0,
        rawFactor: 1.0,
        isValid: false,
        error: 'Supply cannot be zero',
      };
    }

    if (historicalAvgPressure === 0) {
      return {
        surgeFactor: 1.0,
        pressure: 0,
        normalized: 0,
        rawFactor: 1.0,
        isValid: false,
        error: 'Historical avg pressure cannot be zero',
      };
    }

    const pressure = currentDemand / currentSupply;
    const normalized = pressure / historicalAvgPressure;
    const rawFactor = 1 + alpha * Math.log(normalized);
    const surgeFactor = Math.max(minMultiplier, Math.min(maxMultiplier, rawFactor));

    return {
      surgeFactor,
      pressure,
      normalized,
      rawFactor,
      isValid: true,
      error: '',
    };
  };

  const preview = calculateLivePreview();

  // Time Window Management
  const addTimeWindow = () => {
    setTimeWindows([...timeWindows, { daysOfWeek: [], startTime: '09:00', endTime: '17:00' }]);
  };

  const removeTimeWindow = (index: number) => {
    setTimeWindows(timeWindows.filter((_, i) => i !== index));
  };

  const updateTimeWindow = (index: number, field: keyof TimeWindowConfig, value: any) => {
    const updated = [...timeWindows];
    updated[index] = { ...updated[index], [field]: value };
    setTimeWindows(updated);
  };

  const toggleDayInWindow = (windowIndex: number, day: number) => {
    const updated = [...timeWindows];
    const window = updated[windowIndex];
    const days = window.daysOfWeek.includes(day)
      ? window.daysOfWeek.filter(d => d !== day)
      : [...window.daysOfWeek, day].sort();
    updated[windowIndex] = { ...window, daysOfWeek: days };
    setTimeWindows(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validation
      if (!name.trim()) {
        throw new Error('Name is required');
      }

      if (!selectedEntityId) {
        throw new Error('Please select a location or sublocation');
      }

      if (currentDemand < 0 || currentSupply <= 0) {
        throw new Error('Invalid demand/supply parameters');
      }

      if (historicalAvgPressure <= 0) {
        throw new Error('Historical average pressure must be greater than 0');
      }

      // Validate time windows
      for (let i = 0; i < timeWindows.length; i++) {
        const tw = timeWindows[i];
        if (!tw.startTime || !tw.endTime) {
          throw new Error(`Time window ${i + 1}: Start and end times are required`);
        }
        if (tw.startTime >= tw.endTime) {
          throw new Error(`Time window ${i + 1}: Start time must be before end time`);
        }
      }

      // Build request body
      const body: any = {
        name: name.trim(),
        description: description.trim() || undefined,
        appliesTo: {
          level: hierarchyLevel,
          entityId: selectedEntityId,
        },
        priority,
        demandSupplyParams: {
          currentDemand,
          currentSupply,
          historicalAvgPressure,
        },
        surgeParams: {
          alpha,
          minMultiplier,
          maxMultiplier,
          emaAlpha,
        },
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : undefined,
        surgeDurationHours,
        isActive,
      };

      // Add time windows if configured
      if (timeWindows.length > 0) {
        body.timeWindows = timeWindows.map(tw => ({
          daysOfWeek: tw.daysOfWeek.length > 0 ? tw.daysOfWeek : undefined,
          startTime: tw.startTime,
          endTime: tw.endTime,
        }));
      }

      const response = await fetch('/api/surge-pricing/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create surge config');
      }

      // Success
      onSuccess();
      resetForm();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setHierarchyLevel('SUBLOCATION');
    setSelectedEntityId('');
    setPriority(700);
    setCurrentDemand(15);
    setCurrentSupply(10);
    setHistoricalAvgPressure(1.2);
    setAlpha(0.3);
    setMinMultiplier(0.75);
    setMaxMultiplier(1.8);
    setEmaAlpha(0.3);
    setEffectiveFrom(new Date().toISOString().slice(0, 16));
    setEffectiveTo('');
    setTimeWindows([]);
    setSurgeDurationHours(1);
    setIsActive(true);
    setError('');
  };

  if (!isOpen) return null;

  const entities = hierarchyLevel === 'LOCATION' ? locations : sublocations;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-8 py-6 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <Zap className="w-8 h-8" />
              Create Surge Config
            </h2>
            <p className="text-orange-100 mt-1">Configure dynamic pricing based on demand/supply</p>
          </div>
          <button
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-8">
            {/* Left Column - Form Inputs */}
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Basic Information</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
                      placeholder="e.g., Holiday Surge - Convention Center"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
                      placeholder="Optional description..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Hierarchy Level <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={hierarchyLevel}
                      onChange={(e) => {
                        setHierarchyLevel(e.target.value as 'LOCATION' | 'SUBLOCATION');
                        setSelectedEntityId('');
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
                    >
                      <option value="SUBLOCATION">SubLocation</option>
                      <option value="LOCATION">Location</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {hierarchyLevel === 'LOCATION' ? 'Location' : 'SubLocation'} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedEntityId}
                      onChange={(e) => setSelectedEntityId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
                      required
                    >
                      <option value="" className="text-gray-500">Select {hierarchyLevel === 'LOCATION' ? 'location' : 'sublocation'}...</option>
                      {entities.map((entity: any) => (
                        <option key={entity._id.toString()} value={entity._id.toString()} className="text-gray-900">
                          {hierarchyLevel === 'LOCATION'
                            ? `${entity.name} (${entity.city})`
                            : entity.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Priority <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={priority}
                      onChange={(e) => setPriority(Number(e.target.value))}
                      min="1"
                      max="10000"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Higher priority wins when multiple configs overlap. Typical ranges: SUBLOCATION (500-999), LOCATION (300-499)
                    </p>
                  </div>
                </div>
              </div>

              {/* Demand & Supply Parameters */}
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Demand & Supply Parameters</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                      <span>Current Demand</span>
                      <span className="text-orange-600 font-bold">{currentDemand}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={currentDemand}
                      onChange={(e) => setCurrentDemand(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Bookings or inquiries per hour</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                      <span>Current Supply</span>
                      <span className="text-orange-600 font-bold">{currentSupply}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={currentSupply}
                      onChange={(e) => setCurrentSupply(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Available capacity slots per hour</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                      <span>Historical Avg Pressure</span>
                      <span className="text-orange-600 font-bold">{historicalAvgPressure.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="5"
                      step="0.1"
                      value={historicalAvgPressure}
                      onChange={(e) => setHistoricalAvgPressure(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Baseline pressure ratio (demand/supply)</p>
                  </div>
                </div>
              </div>

              {/* Surge Calculation Parameters */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Surge Calculation Parameters</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                      <span>Alpha (α) - Sensitivity</span>
                      <span className="text-blue-600 font-bold">{alpha.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={alpha}
                      onChange={(e) => setAlpha(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Higher = more sensitive to demand changes</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                      <span>Min Multiplier (Floor)</span>
                      <span className="text-blue-600 font-bold">{minMultiplier.toFixed(2)}x</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="1.0"
                      step="0.05"
                      value={minMultiplier}
                      onChange={(e) => setMinMultiplier(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum price multiplier (e.g., 0.75 = 25% discount)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                      <span>Max Multiplier (Ceiling)</span>
                      <span className="text-blue-600 font-bold">{maxMultiplier.toFixed(2)}x</span>
                    </label>
                    <input
                      type="range"
                      min="1.0"
                      max="3.0"
                      step="0.1"
                      value={maxMultiplier}
                      onChange={(e) => setMaxMultiplier(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Maximum price multiplier (e.g., 1.8 = 80% surge)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                      <span>EMA Alpha (Smoothing)</span>
                      <span className="text-blue-600 font-bold">{emaAlpha.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="0.5"
                      step="0.05"
                      value={emaAlpha}
                      onChange={(e) => setEmaAlpha(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Exponential moving average smoothing factor</p>
                  </div>
                </div>
              </div>

              {/* Time Applicability */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Time Applicability</h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Effective From <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={effectiveFrom}
                        onChange={(e) => setEffectiveFrom(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {effectiveFrom && new Date(effectiveFrom).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Effective To (Optional)</label>
                      <input
                        type="datetime-local"
                        value={effectiveTo}
                        onChange={(e) => setEffectiveTo(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
                      />
                      {effectiveTo && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(effectiveTo).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Surge Duration */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Surge Duration (hours)
                    </label>
                    <input
                      type="number"
                      value={surgeDurationHours}
                      onChange={(e) => setSurgeDurationHours(Math.max(1, Number(e.target.value)))}
                      min="1"
                      max="24"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      How long each materialized surge ratesheet lasts (default: 1 hour)
                    </p>
                  </div>

                  {/* Time Windows */}
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-gray-700">
                        Time Windows (Optional)
                      </label>
                      <button
                        type="button"
                        onClick={addTimeWindow}
                        className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-all"
                      >
                        <Plus size={16} />
                        Add Window
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      Define specific day/time combinations when surge should apply
                    </p>

                    {timeWindows.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 text-sm bg-gray-100 rounded-lg">
                        No time windows configured. Surge will apply 24/7 within the effective date range.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {timeWindows.map((tw, index) => (
                          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-semibold text-gray-900">Window {index + 1}</span>
                              <button
                                type="button"
                                onClick={() => removeTimeWindow(index)}
                                className="text-red-600 hover:text-red-700 p-1"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            {/* Days of Week */}
                            <div className="mb-3">
                              <label className="block text-xs font-semibold text-gray-700 mb-2">
                                Days of Week (leave empty for all days)
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dayIdx) => (
                                  <button
                                    key={day}
                                    type="button"
                                    onClick={() => toggleDayInWindow(index, dayIdx)}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                      tw.daysOfWeek.includes(dayIdx)
                                        ? 'bg-orange-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                  >
                                    {day}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Time Range */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Start Time</label>
                                <input
                                  type="time"
                                  value={tw.startTime}
                                  onChange={(e) => updateTimeWindow(index, 'startTime', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">End Time</label>
                                <input
                                  type="time"
                                  value={tw.endTime}
                                  onChange={(e) => updateTimeWindow(index, 'endTime', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 bg-white"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-semibold text-gray-700">Active (apply surge immediately)</span>
                </label>
              </div>
            </div>

            {/* Right Column - Live Preview */}
            <div className="space-y-6">
              <div className="sticky top-0">
                <div className="bg-gradient-to-br from-orange-100 to-red-100 rounded-xl p-6 border-2 border-orange-300">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-orange-600" />
                    Live Preview
                  </h3>

                  {!preview.isValid ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-800">Validation Error</p>
                        <p className="text-sm text-red-600">{preview.error}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Surge Factor Display */}
                      <div className={`rounded-xl p-6 mb-6 border-2 ${
                        preview.surgeFactor > 1.0
                          ? 'bg-gradient-to-r from-orange-200 to-red-200 border-red-400'
                          : preview.surgeFactor < 1.0
                          ? 'bg-gradient-to-r from-green-200 to-emerald-200 border-green-400'
                          : 'bg-gray-200 border-gray-400'
                      }`}>
                        <div className="flex items-center justify-between mb-2 text-gray-900">
                          <span className="text-2xl font-semibold flex items-center gap-1">
                            {preview.surgeFactor > 1.0 ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : preview.surgeFactor < 1.0 ? (
                              <TrendingDown className="w-4 h-4" />
                            ) : (
                              <Zap className="w-4 h-4" />
                            )}
                            Surge Multiplier
                          </span>
                          <span className="text-2xl font-bold text-orange-900">
                            {preview.surgeFactor.toFixed(3)}x
                          </span>
                        </div>
                        <p className="text-md opacity-75 text-gray-700">
                          {preview.surgeFactor > 1.0
                            ? `Prices will increase by ${((preview.surgeFactor - 1) * 100).toFixed(1)}%`
                            : preview.surgeFactor < 1.0
                            ? `Prices will decrease by ${((1 - preview.surgeFactor) * 100).toFixed(1)}%`
                            : 'Prices remain unchanged'}
                        </p>
                      </div>

                      {/* Calculation Breakdown */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6 text-gray-900">
                        <h4 className="font-bold text-gray-900 mb-3">Calculation Breakdown</h4>
                        <div className="space-y-2 text-sm font-mono">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Pressure:</span>
                            <span className="font-semibold">{currentDemand} / {currentSupply} = {preview.pressure.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Normalized:</span>
                            <span className="font-semibold">{preview.pressure.toFixed(4)} / {historicalAvgPressure.toFixed(2)} = {preview.normalized.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Raw Factor:</span>
                            <span className="font-semibold">1 + {alpha.toFixed(2)} * ln({preview.normalized.toFixed(4)}) = {preview.rawFactor.toFixed(4)}</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-200 pt-2">
                            <span className="text-gray-600">Clamped:</span>
                            <span className="font-semibold">
                              max({minMultiplier.toFixed(2)}, min({maxMultiplier.toFixed(2)}, {preview.rawFactor.toFixed(4)}))
                            </span>
                          </div>
                          <div className="flex justify-between bg-orange-50 p-2 rounded">
                            <span className="text-orange-800 font-bold">Final Multiplier:</span>
                            <span className="text-orange-800 font-bold">{preview.surgeFactor.toFixed(4)}x</span>
                          </div>
                        </div>
                      </div>

                      {/* Example Price Adjustments */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200">
                        <h4 className="font-bold text-gray-900 mb-3">Example Price Adjustments</h4>
                        <div className="space-y-2">
                          {[50, 100, 200].map((basePrice) => {
                            const surgePrice = basePrice * preview.surgeFactor;
                            const difference = surgePrice - basePrice;
                            return (
                              <div key={basePrice} className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">${basePrice}/hr</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400">→</span>
                                  <span className="font-bold text-orange-600">${surgePrice.toFixed(2)}/hr</span>
                                  <span className={`text-xs ${difference >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    ({difference >= 0 ? '+' : ''}{difference.toFixed(2)})
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 flex justify-between items-center border-t border-gray-200">
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          {!error && <div />}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading || !preview.isValid}
              className="px-6 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Create Surge Config
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
