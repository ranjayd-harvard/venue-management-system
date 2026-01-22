'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Clock, Calendar, Globe } from 'lucide-react';
import TimezoneSelector from './TimezoneSelector';
import { PriorityConfig } from '@/models/types';

interface Customer {
  _id: string;
  name: string;
}

interface Location {
  _id: string;
  customerId: string;
  name: string;
  city: string;
}

interface SubLocation {
  _id: string;
  locationId: string;
  label: string;
  pricingEnabled: boolean;
}

interface Event {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  customerId?: string;
  locationId?: string;
  subLocationId?: string;
  timezone?: string;
  isActive: boolean;
}

interface TimeWindow {
  windowType?: 'ABSOLUTE_TIME' | 'DURATION_BASED';
  startTime?: string;
  endTime?: string;
  startMinute?: number;
  endMinute?: number;
  pricePerHour: number;
}

interface DurationRule {
  durationHours: number;
  totalPrice: number;
  description: string;
}

interface CreateRateSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateRateSheetModal({ isOpen, onClose, onSuccess }: CreateRateSheetModalProps) {
  const [step, setStep] = useState(1);
  const [priorityConfigs, setPriorityConfigs] = useState<PriorityConfig[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  // Form state
  const [applyTo, setApplyTo] = useState<'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT'>('SUBLOCATION');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedSubLocation, setSelectedSubLocation] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ratesheetType, setRatesheetType] = useState<'TIMING_BASED' | 'DURATION_BASED'>('TIMING_BASED');
  const [priority, setPriority] = useState('');
  const [conflictResolution, setConflictResolution] = useState('PRIORITY');
  const [timezone, setTimezone] = useState('');
  
  // Schedule state - NOW WITH TIME
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  
  // Pricing state
  const [timeWindows, setTimeWindows] = useState<TimeWindow[]>([
    { windowType: 'ABSOLUTE_TIME', startTime: '09:00', endTime: '17:00', pricePerHour: 100 }
  ]);
  const [durationRules, setDurationRules] = useState<DurationRule[]>([
    { durationHours: 4, totalPrice: 300, description: '4-hour package' },
    { durationHours: 8, totalPrice: 500, description: '8-hour package' }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Helper to format date for datetime-local input
  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Load data on mount
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      
      // Set default effectiveFrom to now
      setEffectiveFrom(formatDateTimeLocal(new Date()));
      
      fetch('/api/customers')
        .then(res => res.json())
        .then(data => {
          console.log('Customers loaded:', data);
          setCustomers(data);
        })
        .catch(err => console.error('Error loading customers:', err));
      
      fetch('/api/pricing/config')
        .then(res => res.json())
        .then(data => {
          console.log('Priority configs loaded:', data);
          setPriorityConfigs(data);
        })
        .catch(err => console.error('Error loading priority configs:', err));
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedCustomer) {
      loadLocations(selectedCustomer);
    } else {
      setLocations([]);
      setSublocations([]);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    if (selectedLocation) {
      loadSublocations(selectedLocation);
    } else {
      setSublocations([]);
    }
  }, [selectedLocation]);

  const loadEvents = async () => {
    try {
      // Always load all active events for EVENT-level ratesheets
      // The user can create event-specific rates regardless of hierarchy
      const res = await fetch('/api/events?filter=all');
      const data = await res.json();

      // Filter to only show active events
      const activeEvents = data.filter((e: Event) => e.isActive);
      setEvents(activeEvents);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  useEffect(() => {
    if (applyTo === 'EVENT') {
      loadEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyTo]);

  // Auto-populate priority and dates when an event is selected
  useEffect(() => {
    if (selectedEvent && applyTo === 'EVENT') {
      const event = events.find(e => e._id === selectedEvent);
      if (event) {
        // Set priority to middle of EVENT range (4000-4999)
        const eventConfig = priorityConfigs.find(c => c.level === 'EVENT');
        if (eventConfig && !priority) {
          const midPriority = Math.floor((eventConfig.minPriority + eventConfig.maxPriority) / 2);
          setPriority(midPriority.toString());
        }

        // Auto-populate effective dates from event dates
        if (!effectiveFrom) {
          setEffectiveFrom(formatDateTimeLocal(new Date(event.startDate)));
        }
        if (!effectiveTo) {
          setEffectiveTo(formatDateTimeLocal(new Date(event.endDate)));
        }

        // Auto-populate timezone if event has one
        if (event.timezone && !timezone) {
          setTimezone(event.timezone);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent, events, applyTo]);

  const loadInitialData = async () => {
    try {
      console.log('Loading initial data...');
      
      const [configsRes, customersRes] = await Promise.all([
        fetch('/api/pricing/config'),
        fetch('/api/customers')
      ]);

      console.log('Configs response status:', configsRes.status);
      console.log('Customers response status:', customersRes.status);

      if (!configsRes.ok) {
        console.error('Failed to load pricing configs:', configsRes.status);
      }
      
      if (!customersRes.ok) {
        console.error('Failed to load customers:', customersRes.status);
        setError('Failed to load customers. Please refresh the page.');
      }

      const configs = await configsRes.json();
      const customersData = await customersRes.json();

      console.log('Loaded configs:', configs);
      console.log('Loaded customers:', customersData);

      setPriorityConfigs(configs);
      setCustomers(customersData);
      
      if (customersData.length === 0) {
        setError('No customers found. Please create a customer first.');
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError('Failed to load initial data. Please check your connection and try again.');
    }
  };

  const loadLocations = async (customerId: string) => {
    try {
      const res = await fetch(`/api/locations?customerId=${customerId}`);
      const data = await res.json();
      setLocations(data);
    } catch (err) {
      console.error('Failed to load locations:', err);
    }
  };

  const loadSublocations = async (locationId: string) => {
    try {
      const res = await fetch(`/api/sublocations?locationId=${locationId}`);
      const data = await res.json();
      setSublocations(data);
    } catch (err) {
      console.error('Failed to load sublocations:', err);
    }
  };

  const getCurrentPriorityConfig = () => {
    return priorityConfigs.find(c => c.level === applyTo);
  };

  const addTimeWindow = () => {
    setTimeWindows([...timeWindows, { windowType: 'ABSOLUTE_TIME', startTime: '09:00', endTime: '17:00', pricePerHour: 100 }]);
  };

  const removeTimeWindow = (index: number) => {
    if (timeWindows.length > 1) {
      setTimeWindows(timeWindows.filter((_, i) => i !== index));
    }
  };

  const updateTimeWindow = (index: number, field: keyof TimeWindow, value: any) => {
    const updated = [...timeWindows];
    updated[index] = { ...updated[index], [field]: value };
    setTimeWindows(updated);
  };

  const addDurationRule = () => {
    setDurationRules([...durationRules, { durationHours: 4, totalPrice: 300, description: '' }]);
  };

  const removeDurationRule = (index: number) => {
    if (durationRules.length > 1) {
      setDurationRules(durationRules.filter((_, i) => i !== index));
    }
  };

  const updateDurationRule = (index: number, field: keyof DurationRule, value: any) => {
    const updated = [...durationRules];
    updated[index] = { ...updated[index], [field]: value };
    setDurationRules(updated);
  };

  const validateStep1 = () => {
    if (!name.trim()) return 'Name is required';

    // Validate entity selections based on applyTo level
    if (applyTo === 'EVENT') {
      if (!selectedEvent) return 'Event is required';
    } else {
      // For non-EVENT ratesheets, customer is required
      if (!selectedCustomer) return 'Customer is required';
      if (applyTo === 'LOCATION' && !selectedLocation) return 'Location is required';
      if (applyTo === 'SUBLOCATION' && !selectedSubLocation) return 'SubLocation is required';
    }

    if (!priority) return 'Priority is required';
    if (!timezone) return 'Timezone is required';

    const config = getCurrentPriorityConfig();
    const priorityNum = parseInt(priority);
    if (config && (priorityNum < config.minPriority || priorityNum > config.maxPriority)) {
      return `Priority must be between ${config.minPriority} and ${config.maxPriority}`;
    }

    return null;
  };

  const validateStep2 = () => {
    if (!effectiveFrom) return 'Start date/time is required';
    
    // NEW: Validate datetime format and that effectiveTo is after effectiveFrom
    if (effectiveTo) {
      const fromDate = new Date(effectiveFrom);
      const toDate = new Date(effectiveTo);
      
      if (toDate <= fromDate) {
        return 'End date/time must be after start date/time';
      }
    }
    
    return null;
  };

  const validateStep3 = () => {
    if (ratesheetType === 'TIMING_BASED') {
      if (timeWindows.length === 0) return 'At least one time window is required';

      for (let i = 0; i < timeWindows.length; i++) {
        const tw = timeWindows[i];
        const windowType = tw.windowType || 'ABSOLUTE_TIME';

        if (windowType === 'ABSOLUTE_TIME') {
          if (!tw.startTime || !tw.endTime) return `Time window ${i + 1}: Start and end times are required`;
          if (tw.startTime >= tw.endTime) return `Time window ${i + 1}: Start time must be before end time`;
        } else {
          if (tw.startMinute === undefined || tw.endMinute === undefined) return `Time window ${i + 1}: Start and end minutes are required`;
          if (tw.startMinute < 0) return `Time window ${i + 1}: Start minute cannot be negative`;
          if (tw.endMinute <= tw.startMinute) return `Time window ${i + 1}: End minute must be after start minute`;
        }

        if (tw.pricePerHour <= 0) return `Time window ${i + 1}: Price must be greater than 0`;
      }
    } else {
      if (durationRules.length === 0) return 'At least one duration package is required';
      
      for (let i = 0; i < durationRules.length; i++) {
        const dr = durationRules[i];
        if (dr.durationHours <= 0) return `Package ${i + 1}: Duration must be greater than 0`;
        if (dr.totalPrice <= 0) return `Package ${i + 1}: Price must be greater than 0`;
      }
    }
    
    return null;
  };

  const handleNext = () => {
    let validationError = null;
    
    if (step === 1) validationError = validateStep1();
    if (step === 2) validationError = validateStep2();
    if (step === 3) validationError = validateStep3();
    
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setError('');
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    const validationError = validateStep3();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload: any = {
        name,
        description,
        type: ratesheetType,
        priority: parseInt(priority),
        conflictResolution,
        effectiveFrom: new Date(effectiveFrom).toISOString(), // Convert to ISO
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : null, // Convert to ISO
        isActive: true,
        timezone,
      };

      if (applyTo === 'CUSTOMER') {
        payload.customerId = selectedCustomer;
      } else if (applyTo === 'LOCATION') {
        payload.locationId = selectedLocation;
      } else if (applyTo === 'SUBLOCATION') {
        payload.subLocationId = selectedSubLocation;
      } else if (applyTo === 'EVENT') {
        payload.eventId = selectedEvent;
      }

      if (ratesheetType === 'TIMING_BASED') {
        payload.timeWindows = timeWindows;
      } else {
        payload.packages = durationRules;
      }

      const response = await fetch('/api/ratesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create ratesheet');
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create ratesheet');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setError('');
    setName('');
    setDescription('');
    setPriority('');
    setSelectedCustomer('');
    setSelectedLocation('');
    setSelectedSubLocation('');
    setSelectedEvent('');
    setEffectiveFrom('');
    setEffectiveTo('');
    setTimezone('');
    setTimeWindows([{ windowType: 'ABSOLUTE_TIME', startTime: '09:00', endTime: '17:00', pricePerHour: 100 }]);
    setDurationRules([
      { durationHours: 4, totalPrice: 300, description: '4-hour package' },
      { durationHours: 8, totalPrice: 500, description: '8-hour package' }
    ]);
    onClose();
  };

  if (!isOpen) return null;

  const config = getCurrentPriorityConfig();

  const getEntityIdForTimezone = () => {
    if (applyTo === 'EVENT') return selectedEvent;
    if (applyTo === 'SUBLOCATION') return selectedSubLocation;
    if (applyTo === 'LOCATION') return selectedLocation;
    return selectedCustomer;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Create New Ratesheet</h2>
            <p className="text-blue-100 text-sm mt-1">
              Step {step} of 4: {
                step === 1 ? 'Basic Information' :
                step === 2 ? 'Schedule' :
                step === 3 ? 'Pricing Configuration' :
                'Review & Confirm'
              }
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    s <= step ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {s}
                </div>
                {s < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      s < step ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-red-800">
              {error}
            </div>
          )}

          {/* STEP 1: Basic Information */}
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
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 placeholder-gray-400 bg-white"
                  placeholder="e.g., Weekend Premium Rates"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 placeholder-gray-400 bg-white"
                  rows={3}
                  placeholder="Optional description..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Apply To *
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {(['CUSTOMER', 'LOCATION', 'SUBLOCATION', 'EVENT'] as const).map((type) => {
                    const config = priorityConfigs.find(c => c.level === type);
                    const isSelected = applyTo === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setApplyTo(type);
                          setPriority('');
                        }}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400 bg-white'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">{type}</div>
                        {config && (
                          <div className="text-xs text-gray-600 mt-1">
                            Priority: {config.minPriority}-{config.maxPriority}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {applyTo !== 'EVENT' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Customer *
                  </label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => {
                      console.log('Customer selected:', e.target.value);
                      setSelectedCustomer(e.target.value);
                      setSelectedLocation('');
                      setSelectedSubLocation('');
                    }}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 bg-white cursor-pointer"
                  >
                    <option value="" className="text-gray-500">Select customer...</option>
                    {customers.length === 0 && (
                      <option value="" disabled className="text-gray-400">Loading customers...</option>
                    )}
                    {customers.map((c) => (
                      <option key={c._id} value={c._id} className="text-gray-900">
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {customers.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      No customers found. Please create a customer first.
                    </p>
                  )}
                </div>
              )}

              {applyTo !== 'CUSTOMER' && applyTo !== 'EVENT' && selectedCustomer && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Location {applyTo === 'LOCATION' && '*'}
                  </label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => {
                      console.log('Location selected:', e.target.value);
                      setSelectedLocation(e.target.value);
                      setSelectedSubLocation('');
                    }}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 bg-white cursor-pointer"
                  >
                    <option value="" className="text-gray-500">Select location...</option>
                    {locations.length === 0 && (
                      <option value="" disabled className="text-gray-400">Loading locations...</option>
                    )}
                    {locations.map((l) => (
                      <option key={l._id} value={l._id} className="text-gray-900">
                        {l.name} ({l.city})
                      </option>
                    ))}
                  </select>
                  {locations.length === 0 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      No locations found for this customer.
                    </p>
                  )}
                </div>
              )}

              {applyTo === 'SUBLOCATION' && selectedLocation && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    SubLocation *
                  </label>
                  <select
                    value={selectedSubLocation}
                    onChange={(e) => {
                      console.log('SubLocation selected:', e.target.value);
                      setSelectedSubLocation(e.target.value);
                    }}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 bg-white cursor-pointer"
                  >
                    <option value="" className="text-gray-500">Select sublocation...</option>
                    {sublocations.filter(s => s.pricingEnabled).length === 0 && (
                      <option value="" disabled className="text-gray-400">No pricing-enabled sublocations...</option>
                    )}
                    {sublocations.filter(s => s.pricingEnabled).map((s) => (
                      <option key={s._id} value={s._id} className="text-gray-900">
                        {s.label}
                      </option>
                    ))}
                  </select>
                  {sublocations.filter(s => s.pricingEnabled).length === 0 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      No pricing-enabled sublocations for this location.
                    </p>
                  )}
                </div>
              )}

              {applyTo === 'EVENT' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Event *
                  </label>
                  <select
                    value={selectedEvent}
                    onChange={(e) => {
                      console.log('Event selected:', e.target.value);
                      setSelectedEvent(e.target.value);
                    }}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 bg-white cursor-pointer"
                  >
                    <option value="" className="text-gray-500">Select event...</option>
                    {events.length === 0 && (
                      <option value="" disabled className="text-gray-400">No events found...</option>
                    )}
                    {events.map((e) => (
                      <option key={e._id} value={e._id} className="text-gray-900">
                        {e.name} ({new Date(e.startDate).toLocaleDateString()} - {new Date(e.endDate).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                  {events.length === 0 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      No events found. Please create an event first.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRatesheetType('TIMING_BASED')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      ratesheetType === 'TIMING_BASED'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400 bg-white'
                    }`}
                  >
                    <Clock className="mx-auto mb-2 text-gray-700" size={24} />
                    <div className="font-semibold text-gray-900">Time-Based</div>
                    <div className="text-xs text-gray-600">Different rates by time</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRatesheetType('DURATION_BASED')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      ratesheetType === 'DURATION_BASED'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-300 hover:border-gray-400 bg-white'
                    }`}
                  >
                    <Calendar className="mx-auto mb-2 text-gray-700" size={24} />
                    <div className="font-semibold text-gray-900">Package-Based</div>
                    <div className="text-xs text-gray-600">Fixed packages</div>
                  </button>
                </div>
              </div>

              {config && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Priority * ({config.minPriority} - {config.maxPriority})
                  </label>
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    min={config.minPriority}
                    max={config.maxPriority}
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 text-gray-900 placeholder-gray-400 bg-white"
                    placeholder={`Enter priority (${config.minPriority}-${config.maxPriority})`}
                  />
                  <p className="text-sm text-gray-600 mt-2">
                    {config.description}
                  </p>
                </div>
              )}

              <TimezoneSelector
                value={timezone}
                onChange={setTimezone}
                entityType={applyTo}
                entityId={getEntityIdForTimezone()}
                label="Timezone *"
                showInheritedFrom={true}
              />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Conflict Resolution
                </label>
                <select
                  value={conflictResolution}
                  onChange={(e) => setConflictResolution(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 text-gray-900 bg-white"
                >
                  <option value="PRIORITY">Use Priority</option>
                  <option value="HIGHEST_PRICE">Highest Price</option>
                  <option value="LOWEST_PRICE">Lowest Price</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 2: Schedule - NOW WITH DATETIME-LOCAL */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Effective From * (Date & Time in {timezone || 'selected timezone'})
                </label>
                <input
                  type="datetime-local"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 text-gray-900 bg-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  📅 Select both date and time when this ratesheet becomes active
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Effective To (Optional - Date & Time)
                </label>
                <input
                  type="datetime-local"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 text-gray-900 bg-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  📅 Leave blank for indefinite duration. If same day as start, pick a later time.
                </p>
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
            </div>
          )}

          {/* STEP 3: Pricing Configuration */}
          {step === 3 && (
            <div className="space-y-6">
              {ratesheetType === 'TIMING_BASED' ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Time Windows</h3>
                    <button
                      onClick={addTimeWindow}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus size={18} />
                      Add Window
                    </button>
                  </div>

                  {timeWindows.map((tw, index) => {
                    const windowType = tw.windowType || 'ABSOLUTE_TIME';
                    return (
                      <div key={index} className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">Window {index + 1}</h4>
                          {timeWindows.length > 1 && (
                            <button
                              onClick={() => removeTimeWindow(index)}
                              className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>

                        {/* Window Type Toggle */}
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-700 mb-2">
                            Window Type
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...timeWindows];
                                updated[index] = {
                                  windowType: 'ABSOLUTE_TIME',
                                  startTime: '09:00',
                                  endTime: '17:00',
                                  pricePerHour: tw.pricePerHour
                                };
                                setTimeWindows(updated);
                              }}
                              className={`px-3 py-2 rounded border-2 text-sm font-medium transition-all ${
                                windowType === 'ABSOLUTE_TIME'
                                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                              }`}
                            >
                              Clock Time
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...timeWindows];
                                updated[index] = {
                                  windowType: 'DURATION_BASED',
                                  startMinute: 0,
                                  endMinute: 120,
                                  pricePerHour: tw.pricePerHour
                                };
                                setTimeWindows(updated);
                              }}
                              className={`px-3 py-2 rounded border-2 text-sm font-medium transition-all ${
                                windowType === 'DURATION_BASED'
                                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                              }`}
                            >
                              Duration (Minutes)
                            </button>
                          </div>
                        </div>

                        {/* Inputs based on window type */}
                        {windowType === 'ABSOLUTE_TIME' ? (
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Start Time
                              </label>
                              <input
                                type="time"
                                value={tw.startTime || ''}
                                onChange={(e) => updateTimeWindow(index, 'startTime', e.target.value)}
                                className="w-full px-3 py-2 rounded border border-gray-300 text-gray-900 bg-white"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                End Time
                              </label>
                              <input
                                type="time"
                                value={tw.endTime || ''}
                                onChange={(e) => updateTimeWindow(index, 'endTime', e.target.value)}
                                className="w-full px-3 py-2 rounded border border-gray-300 text-gray-900 bg-white"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Price/Hour ($)
                              </label>
                              <input
                                type="number"
                                value={tw.pricePerHour}
                                onChange={(e) => updateTimeWindow(index, 'pricePerHour', parseFloat(e.target.value))}
                                className="w-full px-3 py-2 rounded border border-gray-300 text-gray-900 bg-white"
                                min="0"
                                step="0.01"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Start Minute
                              </label>
                              <input
                                type="number"
                                value={tw.startMinute ?? 0}
                                onChange={(e) => updateTimeWindow(index, 'startMinute', parseInt(e.target.value))}
                                className="w-full px-3 py-2 rounded border border-gray-300 text-gray-900 bg-white"
                                min="0"
                                step="1"
                              />
                              <p className="text-xs text-gray-500 mt-1">From booking start</p>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                End Minute
                              </label>
                              <input
                                type="number"
                                value={tw.endMinute ?? 120}
                                onChange={(e) => updateTimeWindow(index, 'endMinute', parseInt(e.target.value))}
                                className="w-full px-3 py-2 rounded border border-gray-300 text-gray-900 bg-white"
                                min="0"
                                step="1"
                              />
                              <p className="text-xs text-gray-500 mt-1">From booking start</p>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Price/Hour ($)
                              </label>
                              <input
                                type="number"
                                value={tw.pricePerHour}
                                onChange={(e) => updateTimeWindow(index, 'pricePerHour', parseFloat(e.target.value))}
                                className="w-full px-3 py-2 rounded border border-gray-300 text-gray-900 bg-white"
                                min="0"
                                step="0.01"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Duration Packages</h3>
                    <button
                      onClick={addDurationRule}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      <Plus size={18} />
                      Add Package
                    </button>
                  </div>

                  {durationRules.map((dr, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">Package {index + 1}</h4>
                        {durationRules.length > 1 && (
                          <button
                            onClick={() => removeDurationRule(index)}
                            className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Duration (Hours)
                          </label>
                          <input
                            type="number"
                            value={dr.durationHours}
                            onChange={(e) => updateDurationRule(index, 'durationHours', parseFloat(e.target.value))}
                            className="w-full px-3 py-2 rounded border border-gray-300 text-gray-900 bg-white"
                            min="0"
                            step="0.5"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Total Price ($)
                          </label>
                          <input
                            type="number"
                            value={dr.totalPrice}
                            onChange={(e) => updateDurationRule(index, 'totalPrice', parseFloat(e.target.value))}
                            className="w-full px-3 py-2 rounded border border-gray-300 text-gray-900 bg-white"
                            min="0"
                            step="0.01"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            value={dr.description}
                            onChange={(e) => updateDurationRule(index, 'description', e.target.value)}
                            className="w-full px-3 py-2 rounded border border-gray-300 text-gray-900 placeholder-gray-400 bg-white"
                            placeholder="e.g., Half-day"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* STEP 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-6 border-2 border-blue-200">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">Review Your Ratesheet</h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-semibold text-gray-900">{name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-semibold text-gray-900">{ratesheetType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Apply To:</span>
                    <span className="font-semibold text-gray-900">{applyTo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Priority:</span>
                    <span className="font-semibold text-gray-900">{priority}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Timezone:</span>
                    <span className="font-semibold text-gray-900">{timezone}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-600">Effective Period:</span>
                    <span className="font-semibold text-gray-900">
                      📅 {new Date(effectiveFrom).toLocaleString()}
                    </span>
                    {effectiveTo && (
                      <span className="font-semibold text-gray-900">
                        to 📅 {new Date(effectiveTo).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      {ratesheetType === 'TIMING_BASED' ? 'Time Windows:' : 'Packages:'}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {ratesheetType === 'TIMING_BASED' ? timeWindows.length : durationRules.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t-2 border-gray-200 flex justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
            >
              Back
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
            >
              Cancel
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Ratesheet'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
