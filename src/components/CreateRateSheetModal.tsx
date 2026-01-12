'use client';

import { useState } from 'react';
import { X, Calendar, Clock, DollarSign, Layers, CheckCircle2, AlertCircle } from 'lucide-react';

interface SubLocation {
  _id: string;
  label: string;
  description?: string;
}

interface Location {
  _id: string;
  name: string;
}

interface TimeWindow {
  startTime: string;
  endTime: string;
  pricePerHour: number;
}

interface DurationRule {
  durationHours: number;
  totalPrice: number;
  description?: string;
}

interface CreateRatesheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  sublocations: SubLocation[];
  onSuccess: () => void;
}

type RatesheetType = 'TIMING_BASED' | 'DURATION_BASED';
type RecurrencePattern = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
type ConflictResolution = 'PRIORITY' | 'HIGHEST_PRICE' | 'LOWEST_PRICE';

const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function CreateRatesheetModal({
  isOpen,
  onClose,
  locations,
  sublocations,
  onSuccess
}: CreateRatesheetModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<RatesheetType>('TIMING_BASED');
  const [layer, setLayer] = useState<'CUSTOMER' | 'LOCATION' | 'SUBLOCATION'>('SUBLOCATION');
  const [entityId, setEntityId] = useState('');
  const [priority, setPriority] = useState(50);
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('PRIORITY');
  
  // Date range
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  
  // Recurrence
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('NONE');
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState<number | undefined>();
  
  // Timing-based
  const [timeWindows, setTimeWindows] = useState<TimeWindow[]>([
    { startTime: '09:00', endTime: '17:00', pricePerHour: 100 }
  ]);
  
  // Duration-based
  const [durationRules, setDurationRules] = useState<DurationRule[]>([
    { durationHours: 4, totalPrice: 350, description: '4-hour package' }
  ]);

  const resetForm = () => {
    setStep(1);
    setName('');
    setDescription('');
    setType('TIMING_BASED');
    setLayer('SUBLOCATION');
    setEntityId('');
    setPriority(50);
    setConflictResolution('PRIORITY');
    setEffectiveFrom('');
    setEffectiveTo('');
    setRecurrencePattern('NONE');
    setDaysOfWeek([]);
    setDayOfMonth(undefined);
    setTimeWindows([{ startTime: '09:00', endTime: '17:00', pricePerHour: 100 }]);
    setDurationRules([{ durationHours: 4, totalPrice: 350, description: '4-hour package' }]);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError('');

      // Build request body
      const ratesheetData = {
        name,
        description,
        type,
        layer,
        entityId,
        priority,
        conflictResolution,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : undefined,
        recurrence: recurrencePattern !== 'NONE' ? {
          pattern: recurrencePattern,
          daysOfWeek: recurrencePattern === 'WEEKLY' ? daysOfWeek : undefined,
          dayOfMonth: recurrencePattern === 'MONTHLY' ? dayOfMonth : undefined
        } : undefined,
        timeWindows: type === 'TIMING_BASED' ? timeWindows : undefined,
        durationRules: type === 'DURATION_BASED' ? durationRules : undefined,
        status: 'DRAFT'
      };

      const response = await fetch('/api/ratesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ratesheetData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create ratesheet');
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addTimeWindow = () => {
    setTimeWindows([...timeWindows, { startTime: '09:00', endTime: '17:00', pricePerHour: 100 }]);
  };

  const removeTimeWindow = (index: number) => {
    setTimeWindows(timeWindows.filter((_, i) => i !== index));
  };

  const updateTimeWindow = (index: number, field: keyof TimeWindow, value: any) => {
    const updated = [...timeWindows];
    updated[index] = { ...updated[index], [field]: value };
    setTimeWindows(updated);
  };

  const addDurationRule = () => {
    setDurationRules([...durationRules, { durationHours: 4, totalPrice: 350, description: '' }]);
  };

  const removeDurationRule = (index: number) => {
    setDurationRules(durationRules.filter((_, i) => i !== index));
  };

  const updateDurationRule = (index: number, field: keyof DurationRule, value: any) => {
    const updated = [...durationRules];
    updated[index] = { ...updated[index], [field]: value };
    setDurationRules(updated);
  };

  const toggleDayOfWeek = (day: string) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day]);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim() && type && layer && entityId;
      case 2:
        return effectiveFrom;
      case 3:
        if (type === 'TIMING_BASED') {
          return timeWindows.length > 0 && timeWindows.every(tw => 
            tw.startTime && tw.endTime && tw.pricePerHour > 0
          );
        } else {
          return durationRules.length > 0 && durationRules.every(dr => 
            dr.durationHours > 0 && dr.totalPrice > 0
          );
        }
      default:
        return true;
    }
  };

  if (!isOpen) return null;

  const totalSteps = 4;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Create New Ratesheet</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                    s < step ? 'bg-green-500' :
                    s === step ? 'bg-white text-indigo-600' :
                    'bg-white/30'
                  }`}>
                    {s < step ? <CheckCircle2 className="w-5 h-5" /> : s}
                  </div>
                  <div className="ml-2 text-sm font-medium">
                    {s === 1 && 'Basic Info'}
                    {s === 2 && 'Schedule'}
                    {s === 3 && 'Pricing'}
                    {s === 4 && 'Review'}
                  </div>
                </div>
                {s < totalSteps && (
                  <div className={`flex-1 h-1 mx-2 ${
                    s < step ? 'bg-green-500' : 'bg-white/30'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-220px)]">
          {/* Step 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ratesheet Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Weekend Premium Rates"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description of this ratesheet..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ratesheet Type *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setType('TIMING_BASED')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      type === 'TIMING_BASED'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Clock className="w-8 h-8 text-indigo-600 mb-2" />
                    <div className="font-semibold">Timing-Based</div>
                    <div className="text-sm text-gray-600">Different rates for different times of day</div>
                  </button>
                  <button
                    onClick={() => setType('DURATION_BASED')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      type === 'DURATION_BASED'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Calendar className="w-8 h-8 text-indigo-600 mb-2" />
                    <div className="font-semibold">Duration-Based</div>
                    <div className="text-sm text-gray-600">Package pricing based on booking length</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Apply To *
                </label>
                <select
                  value={layer}
                  onChange={(e) => {
                    setLayer(e.target.value as any);
                    setEntityId('');
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                >
                  <option value="SUBLOCATION">Specific Sub-Location</option>
                  <option value="LOCATION">Entire Location</option>
                  <option value="CUSTOMER">Customer-wide</option>
                </select>
              </div>

              {layer === 'SUBLOCATION' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Sub-Location *
                  </label>
                  <select
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  >
                    <option value="">Choose a sub-location...</option>
                    {sublocations.map((sl) => (
                      <option key={sl._id} value={sl._id}>
                        {sl.label} {sl.description && `- ${sl.description}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {layer === 'LOCATION' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Location *
                  </label>
                  <select
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  >
                    <option value="">Choose a location...</option>
                    {locations.map((loc) => (
                      <option key={loc._id} value={loc._id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Priority (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">Higher priority ratesheets apply first</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Conflict Resolution
                  </label>
                  <select
                    value={conflictResolution}
                    onChange={(e) => setConflictResolution(e.target.value as ConflictResolution)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  >
                    <option value="PRIORITY">By Priority</option>
                    <option value="HIGHEST_PRICE">Highest Price</option>
                    <option value="LOWEST_PRICE">Lowest Price</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Schedule */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Effective From *
                  </label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Effective To (Optional)
                  </label>
                  <input
                    type="date"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty for no end date</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Recurrence Pattern
                </label>
                <select
                  value={recurrencePattern}
                  onChange={(e) => setRecurrencePattern(e.target.value as RecurrencePattern)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                >
                  <option value="NONE">No Recurrence (One-time or always active)</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>

              {recurrencePattern === 'WEEKLY' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Days of Week
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day}
                        onClick={() => toggleDayOfWeek(day)}
                        className={`py-2 px-1 text-xs font-medium rounded-lg transition-all ${
                          daysOfWeek.includes(day)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recurrencePattern === 'MONTHLY' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Day of Month
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dayOfMonth || ''}
                    onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                    placeholder="1-31"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 3: Pricing Rules */}
          {step === 3 && type === 'TIMING_BASED' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Time Windows</h3>
                <button
                  onClick={addTimeWindow}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  + Add Time Window
                </button>
              </div>

              {timeWindows.map((tw, index) => (
                <div key={index} className="p-4 border-2 border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-700">Time Window {index + 1}</span>
                    {timeWindows.length > 1 && (
                      <button
                        onClick={() => removeTimeWindow(index)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={tw.startTime}
                        onChange={(e) => updateTimeWindow(index, 'startTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                      <input
                        type="time"
                        value={tw.endTime}
                        onChange={(e) => updateTimeWindow(index, 'endTime', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price per Hour</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={tw.pricePerHour}
                          onChange={(e) => updateTimeWindow(index, 'pricePerHour', parseFloat(e.target.value))}
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && type === 'DURATION_BASED' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Duration Rules</h3>
                <button
                  onClick={addDurationRule}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  + Add Duration Rule
                </button>
              </div>

              {durationRules.map((dr, index) => (
                <div key={index} className="p-4 border-2 border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-700">Package {index + 1}</span>
                    {durationRules.length > 1 && (
                      <button
                        onClick={() => removeDurationRule(index)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration (Hours)</label>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={dr.durationHours}
                        onChange={(e) => updateDurationRule(index, 'durationHours', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Price</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={dr.totalPrice}
                          onChange={(e) => updateDurationRule(index, 'totalPrice', parseFloat(e.target.value))}
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                    <input
                      type="text"
                      value={dr.description || ''}
                      onChange={(e) => updateDurationRule(index, 'description', e.target.value)}
                      placeholder="e.g., 4-hour morning package"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                  {dr.durationHours > 0 && dr.totalPrice > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      Effective rate: ${(dr.totalPrice / dr.durationHours).toFixed(2)}/hour
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">Review Your Ratesheet</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Name:</dt>
                    <dd className="font-medium">{name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Type:</dt>
                    <dd className="font-medium">{type === 'TIMING_BASED' ? 'Timing-Based' : 'Duration-Based'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Layer:</dt>
                    <dd className="font-medium">{layer}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Effective From:</dt>
                    <dd className="font-medium">{new Date(effectiveFrom).toLocaleDateString()}</dd>
                  </div>
                  {effectiveTo && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Effective To:</dt>
                      <dd className="font-medium">{new Date(effectiveTo).toLocaleDateString()}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Priority:</dt>
                    <dd className="font-medium">{priority}</dd>
                  </div>
                  {type === 'TIMING_BASED' && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Time Windows:</dt>
                      <dd className="font-medium">{timeWindows.length}</dd>
                    </div>
                  )}
                  {type === 'DURATION_BASED' && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Duration Rules:</dt>
                      <dd className="font-medium">{durationRules.length}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Ratesheet will be created as DRAFT</p>
                  <p>You'll need to submit it for approval before it becomes active.</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1 || saving}
            className="px-6 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            
            {step < totalSteps ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Create Ratesheet'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
