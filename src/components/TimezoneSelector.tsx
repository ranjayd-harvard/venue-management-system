// src/components/TimezoneSelector.tsx
'use client';

import { useState, useEffect } from 'react';
import { Globe, MapPin } from 'lucide-react';
import { COMMON_TIMEZONES } from '@/lib/timezone-utils';

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
  entityType?: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
  entityId?: string;
  label?: string;
  showInheritedFrom?: boolean;
}

export default function TimezoneSelector({
  value,
  onChange,
  entityType,
  entityId,
  label = 'Timezone',
  showInheritedFrom = true
}: TimezoneSelectorProps) {
  const [inheritedTimezone, setInheritedTimezone] = useState<{
    timezone: string;
    source: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch inherited timezone
  useEffect(() => {
    if (showInheritedFrom && entityType && entityId) {
      fetchInheritedTimezone();
    }
  }, [entityType, entityId]);

  const fetchInheritedTimezone = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/timezone/inherited?entityType=${entityType}&entityId=${entityId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setInheritedTimezone({
          timezone: data.timezone,
          source: data.source
        });
        
        // If no value set, use inherited
        if (!value) {
          onChange(data.timezone);
        }
      }
    } catch (error) {
      console.error('Failed to fetch inherited timezone:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTimezone = COMMON_TIMEZONES.find(tz => tz.value === value);
  const currentTime = new Date().toLocaleTimeString('en-US', {
    timeZone: value || 'America/Detroit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">
        <Globe className="inline-block mr-2" size={16} />
        {label}
      </label>
      
      {/* Inherited Timezone Info */}
      {showInheritedFrom && inheritedTimezone && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 mb-2">
          <div className="flex items-center gap-2 text-sm text-blue-900">
            <MapPin size={14} />
            <span>
              <strong>Inherited:</strong> {inheritedTimezone.timezone}
            </span>
            <span className="text-blue-600">({inheritedTimezone.source})</span>
          </div>
        </div>
      )}
      
      {/* Timezone Selector */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900"
        disabled={isLoading}
      >
        <option value="">Select timezone...</option>
        {COMMON_TIMEZONES.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label}
          </option>
        ))}
      </select>
      
      {/* Current Time Display */}
      {value && (
        <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
          <span>Current time in {selectedTimezone?.label}:</span>
          <span className="font-mono font-bold text-gray-900">{currentTime}</span>
        </div>
      )}
      
      {/* Helper Text */}
      <p className="text-xs text-gray-500">
        All dates and times for this ratesheet will be interpreted in this timezone.
      </p>
    </div>
  );
}
