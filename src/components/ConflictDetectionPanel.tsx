'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

interface ConflictingEvent {
  id: string;
  name: string;
  priority: number;
  rate: number;
  isCustomPriority: boolean;
  effectiveStart: string;
  effectiveEnd: string;
}

interface TimeSlot {
  hour: number;
  startTime: string;
  endTime: string;
  winningEvent: {
    id: string;
    name: string;
    priority: number;
    rate: number;
    isCustomPriority: boolean;
  } | null;
  conflictingEvents: ConflictingEvent[];
  hasConflict: boolean;
}

interface ConflictDetectionResult {
  subLocationId: string;
  sublocationName: string;
  checkWindow: {
    startDate: string;
    endDate: string;
  };
  totalHours: number;
  conflictHours: number;
  noConflictHours: number;
  timeSlots: TimeSlot[];
  summary: {
    totalEvents: number;
    eventsWithCustomPriority: number;
    eventsWithDefaultPriority: number;
    conflictsByPriority: { [key: number]: number };
  };
}

interface ConflictDetectionPanelProps {
  subLocationId: string;
  startDate: string;
  endDate: string;
  excludeEventId?: string;
  currentEventName?: string;
  currentPriority?: number;
  onPriorityRecommendation?: (suggestedPriority: number) => void;
}

export default function ConflictDetectionPanel({
  subLocationId,
  startDate,
  endDate,
  excludeEventId,
  currentEventName = 'This Event',
  currentPriority,
  onPriorityRecommendation,
}: ConflictDetectionPanelProps) {
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictDetectionResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (subLocationId && startDate && endDate) {
      checkConflicts();
    }
  }, [subLocationId, startDate, endDate, excludeEventId]);

  const checkConflicts = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        subLocationId,
        startDate,
        endDate,
      });

      if (excludeEventId) {
        params.append('excludeEventId', excludeEventId);
      }

      const response = await fetch(`/api/events/conflicts?${params}`);
      if (!response.ok) {
        throw new Error('Failed to check conflicts');
      }

      const data = await response.json();
      setConflicts(data);

      // Auto-suggest priority if there are conflicts
      if (data.conflictHours > 0 && onPriorityRecommendation) {
        const maxPriority = Math.max(
          ...data.timeSlots
            .flatMap((slot: TimeSlot) => slot.conflictingEvents)
            .map((event: ConflictingEvent) => event.priority)
        );
        onPriorityRecommendation(maxPriority + 50);
      }
    } catch (err) {
      setError('Failed to check for conflicts');
      console.error('Conflict check error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="animate-spin" size={18} />
          <span>Checking for conflicts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    );
  }

  if (!conflicts) {
    return null;
  }

  const hasConflicts = conflicts.conflictHours > 0;
  const maxConflictingPriority = hasConflicts
    ? Math.max(
        ...conflicts.timeSlots
          .flatMap(slot => slot.conflictingEvents)
          .map(event => event.priority)
      )
    : 0;

  const recommendedPriority = maxConflictingPriority + 50;
  const willWin = currentPriority ? currentPriority > maxConflictingPriority : false;
  const willLose = currentPriority ? currentPriority < maxConflictingPriority : false;

  return (
    <div
      className={`border-2 rounded-lg p-4 ${
        hasConflicts
          ? 'bg-amber-50 border-amber-300'
          : 'bg-green-50 border-green-300'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {hasConflicts ? (
            <AlertTriangle className="text-amber-600" size={20} />
          ) : (
            <CheckCircle className="text-green-600" size={20} />
          )}
          <h3 className="font-semibold text-gray-900">
            {hasConflicts ? 'Overlapping Events Detected' : 'No Conflicts'}
          </h3>
        </div>
        <div className="text-sm text-gray-600">
          {conflicts.totalHours} hour{conflicts.totalHours !== 1 ? 's' : ''} checked
        </div>
      </div>

      {/* Summary Stats */}
      {hasConflicts && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3 border border-amber-200">
            <div className="text-xs text-gray-600 mb-1">Conflicts</div>
            <div className="text-2xl font-bold text-amber-700">
              {conflicts.conflictHours}
            </div>
            <div className="text-xs text-gray-500">
              of {conflicts.totalHours} hours
            </div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-amber-200">
            <div className="text-xs text-gray-600 mb-1">Total Events</div>
            <div className="text-2xl font-bold text-amber-700">
              {conflicts.summary.totalEvents}
            </div>
            <div className="text-xs text-gray-500">overlapping</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-amber-200">
            <div className="text-xs text-gray-600 mb-1">Max Priority</div>
            <div className="text-2xl font-bold text-amber-700">
              {maxConflictingPriority}
            </div>
            <div className="text-xs text-gray-500">highest found</div>
          </div>
        </div>
      )}

      {/* Priority Recommendation */}
      {hasConflicts && currentPriority && (
        <div
          className={`mb-4 p-3 rounded-lg border-2 ${
            willWin
              ? 'bg-green-100 border-green-400'
              : willLose
              ? 'bg-red-100 border-red-400'
              : 'bg-blue-100 border-blue-400'
          }`}
        >
          <div className="flex items-start gap-3">
            <TrendingUp
              size={18}
              className={willWin ? 'text-green-600' : 'text-red-600'}
            />
            <div className="flex-1">
              {willWin ? (
                <div>
                  <p className="font-semibold text-green-900 mb-1">
                    ✅ Your priority ({currentPriority}) will win all conflicts
                  </p>
                  <p className="text-sm text-green-700">
                    {currentEventName} will take precedence over all overlapping events.
                  </p>
                </div>
              ) : willLose ? (
                <div>
                  <p className="font-semibold text-red-900 mb-1">
                    ⚠️ Your priority ({currentPriority}) will lose conflicts
                  </p>
                  <p className="text-sm text-red-700 mb-2">
                    Other events with priority {maxConflictingPriority} will take precedence.
                  </p>
                  {onPriorityRecommendation && (
                    <button
                      onClick={() => onPriorityRecommendation(recommendedPriority)}
                      className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
                    >
                      Set priority to {recommendedPriority} (recommended)
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-blue-900 mb-1">
                    ℹ️ Priority tied with other events
                  </p>
                  <p className="text-sm text-blue-700">
                    Insertion order will determine which event wins.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conflicting Events List */}
      {hasConflicts && (
        <div className="bg-white rounded-lg border border-amber-200 p-3">
          <h4 className="font-semibold text-gray-900 mb-2 text-sm">
            Conflicting Events:
          </h4>
          <div className="space-y-2">
            {Array.from(
              new Set(
                conflicts.timeSlots.flatMap(slot =>
                  slot.conflictingEvents.map(e => e.id)
                )
              )
            ).map(eventId => {
              const event = conflicts.timeSlots
                .flatMap(slot => slot.conflictingEvents)
                .find(e => e.id === eventId);

              if (!event) return null;

              return (
                <div
                  key={eventId}
                  className="flex items-center justify-between p-2 bg-amber-50 rounded border border-amber-200"
                >
                  <div>
                    <div className="font-medium text-gray-900 text-sm">
                      {event.name}
                    </div>
                    <div className="text-xs text-gray-600">
                      Priority: {event.priority}{' '}
                      {event.isCustomPriority && (
                        <span className="text-purple-600">(Custom)</span>
                      )}
                      {' • '}${event.rate}/hr
                    </div>
                  </div>
                  {currentPriority && (
                    <div className="text-xs font-semibold">
                      {currentPriority > event.priority ? (
                        <span className="text-green-600">You win</span>
                      ) : currentPriority < event.priority ? (
                        <span className="text-red-600">They win</span>
                      ) : (
                        <span className="text-amber-600">Tied</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Conflicts Message */}
      {!hasConflicts && (
        <p className="text-sm text-green-700">
          No overlapping events found in this time window. You're all set!
        </p>
      )}
    </div>
  );
}
