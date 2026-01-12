'use client';

import React from 'react';
import { Ratesheet } from '@/models/Ratesheet';

interface RatesheetLayerVisualizerProps {
  ratesheets: Ratesheet[];
  onLayerClick?: (ratesheet: Ratesheet) => void;
  onReorderLayers?: (reorderedRatesheets: Ratesheet[]) => void;
}

export default function RatesheetLayerVisualizer({
  ratesheets,
  onLayerClick,
  onReorderLayers
}: RatesheetLayerVisualizerProps) {
  // Sort ratesheets by priority (highest first)
  const sortedRatesheets = [...ratesheets].sort((a, b) => b.priority - a.priority);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-800 border-green-300';
      case 'PENDING_APPROVAL': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'DRAFT': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'TIMING_BASED' ? '🕐' : '⏱️';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Ratesheet Layers</h3>
        <div className="text-sm text-gray-600">
          {sortedRatesheets.length} active layer{sortedRatesheets.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="text-xs font-medium text-blue-900 mb-2">Priority Order (Top to Bottom)</div>
        <div className="text-xs text-blue-700">
          Highest priority ratesheets appear first. When conflicts occur, higher priority wins.
        </div>
      </div>

      {/* Layer Stack */}
      <div className="relative space-y-2">
        {sortedRatesheets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">📋</div>
            <div className="text-sm">No ratesheets configured</div>
          </div>
        ) : (
          sortedRatesheets.map((ratesheet, index) => (
            <div
              key={ratesheet._id?.toString()}
              onClick={() => onLayerClick?.(ratesheet)}
              className="relative group cursor-pointer"
              style={{
                zIndex: sortedRatesheets.length - index
              }}
            >
              {/* Connecting line to show layering */}
              {index < sortedRatesheets.length - 1 && (
                <div className="absolute left-8 top-full h-2 w-0.5 bg-gray-300 z-0" />
              )}

              {/* Layer Card */}
              <div className={`
                relative bg-white rounded-lg shadow-md border-2 
                transition-all duration-200
                ${ratesheet.isActive ? 'border-blue-300' : 'border-gray-200 opacity-60'}
                group-hover:shadow-xl group-hover:scale-[1.02]
              `}>
                {/* Priority Badge */}
                <div className="absolute -left-3 top-1/2 -translate-y-1/2">
                  <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg">
                    <div className="text-center">
                      <div className="text-xs font-bold leading-none">{ratesheet.priority}</div>
                      <div className="text-[8px] leading-none">priority</div>
                    </div>
                  </div>
                </div>

                <div className="pl-12 pr-4 py-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{getTypeIcon(ratesheet.type)}</span>
                        <h4 className="text-lg font-semibold text-gray-900">
                          {ratesheet.name}
                        </h4>
                        {!ratesheet.isActive && (
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      {ratesheet.description && (
                        <p className="text-sm text-gray-600">{ratesheet.description}</p>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className={`
                      text-xs font-medium px-3 py-1 rounded-full border
                      ${getStatusColor(ratesheet.approvalStatus)}
                    `}>
                      {ratesheet.approvalStatus.replace(/_/g, ' ')}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm text-red-800">
                    <div>
                      <span className="text-gray-600">Type:</span>{' '}
                      <span className="font-medium">
                        {ratesheet.type === 'TIMING_BASED' ? 'Time Window' : 'Duration Based'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Resolution:</span>{' '}
                      <span className="font-medium">{ratesheet.conflictResolution}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Effective From:</span>{' '}
                      <span className="font-medium">
                        {new Date(ratesheet.effectiveFrom).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Effective To:</span>{' '}
                      <span className="font-medium">
                        {ratesheet.effectiveTo 
                          ? new Date(ratesheet.effectiveTo).toLocaleDateString()
                          : 'Indefinite'}
                      </span>
                    </div>
                  </div>

                  {/* Pricing Rules Preview */}
                  {ratesheet.type === 'TIMING_BASED' && ratesheet.timeWindows && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-gray-600 mb-2">Time Windows:</div>
                      <div className="flex flex-wrap gap-2">
                        {ratesheet.timeWindows.slice(0, 3).map((tw, idx) => (
                          <div 
                            key={idx}
                            className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
                          >
                            {tw.startTime} - {tw.endTime}: ${tw.pricePerHour}/hr
                          </div>
                        ))}
                        {ratesheet.timeWindows.length > 3 && (
                          <div className="text-xs text-gray-500">
                            +{ratesheet.timeWindows.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {ratesheet.type === 'DURATION_BASED' && ratesheet.durationRules && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-gray-600 mb-2">Duration Rules:</div>
                      <div className="flex flex-wrap gap-2">
                        {ratesheet.durationRules.slice(0, 3).map((dr, idx) => (
                          <div 
                            key={idx}
                            className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded"
                          >
                            {dr.durationHours}h: ${dr.totalPrice}
                          </div>
                        ))}
                        {ratesheet.durationRules.length > 3 && (
                          <div className="text-xs text-gray-500">
                            +{ratesheet.durationRules.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recurrence Info */}
                  {ratesheet.recurrence && ratesheet.recurrence.pattern !== 'NONE' && (
                    <div className="mt-2 text-xs">
                      <span className="text-gray-600">Recurrence:</span>{' '}
                      <span className="font-medium text-purple-700">
                        {ratesheet.recurrence.pattern}
                        {ratesheet.recurrence.daysOfWeek && 
                          ` (${ratesheet.recurrence.daysOfWeek.join(', ')})`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Hover Actions */}
                <div className="
                  absolute inset-0 bg-blue-500 bg-opacity-0 
                  group-hover:bg-opacity-5 rounded-lg 
                  transition-all duration-200
                  pointer-events-none
                " />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Conflict Resolution Info */}
      {sortedRatesheets.length > 1 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="text-xs font-medium text-amber-900 mb-1">
            ⚠️ Multiple Layers Active
          </div>
          <div className="text-xs text-amber-700">
            When time windows overlap, the system will use{' '}
            <span className="font-semibold">
              {sortedRatesheets[0].conflictResolution.toLowerCase().replace(/_/g, ' ')}
            </span>{' '}
            to resolve conflicts.
          </div>
        </div>
      )}
    </div>
  );
}
