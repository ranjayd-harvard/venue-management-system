// src/components/DecisionAuditPanel.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, Trophy, Clock, DollarSign } from 'lucide-react';

interface HourlySegment {
  startTime: Date;
  endTime: Date;
  durationHours: number;
  pricePerHour: number;
  totalPrice: number;
  ratesheet?: {
    id: string;
    name: string;
    type: string;
    priority: number;
    level: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION';
  };
  source: 'RATESHEET' | 'DEFAULT_RATE';
  timeWindow?: {
    start: string;
    end: string;
  };
}

interface DecisionLogEntry {
  hour: number;
  timestamp: string;
  timeSlot: string;
  applicableRatesheets: number;
  selectedRatesheet?: string;
  pricePerHour: number;
  source: string;
}

interface DecisionAuditPanelProps {
  segments?: HourlySegment[];
  decisionLog?: DecisionLogEntry[];
  totalPrice?: number;
  totalHours?: number;
  breakdown?: {
    ratesheetSegments: number;
    defaultRateSegments: number;
  };
  timezone?: string;
  metadata?: {
    customer: string;
    location: string;
    sublocation: string;
    ratesheetSummary: {
      total: number;
      customer: number;
      location: number;
      sublocation: number;
    };
  };
}

export default function DecisionAuditPanel({
  segments = [],
  decisionLog = [],
  totalPrice = 0,
  totalHours = 0,
  breakdown,
  timezone,
  metadata
}: DecisionAuditPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSegments, setShowSegments] = useState(true);
  const [showLog, setShowLog] = useState(false);

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone || 'America/Detroit'
    });
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: timezone || 'America/Detroit'
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-purple-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Trophy className="text-purple-600" size={24} />
          <div className="text-left">
            <h3 className="text-lg font-bold text-gray-900">Pricing Breakdown & Audit Trail</h3>
            <p className="text-sm text-gray-600">
              {segments.length} hourly segments • {breakdown?.ratesheetSegments || 0} with ratesheets • {breakdown?.defaultRateSegments || 0} with defaults
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="text-gray-600" size={24} />
        ) : (
          <ChevronDown className="text-gray-600" size={24} />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
              <div className="text-3xl font-bold text-green-900">${totalPrice.toFixed(2)}</div>
              <div className="text-sm text-green-700 font-medium">Total Price</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
              <div className="text-3xl font-bold text-blue-900">{totalHours.toFixed(2)}</div>
              <div className="text-sm text-blue-700 font-medium">Total Hours</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
              <div className="text-3xl font-bold text-purple-900">{breakdown?.ratesheetSegments || 0}</div>
              <div className="text-sm text-purple-700 font-medium">Ratesheet Hours</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-200">
              <div className="text-3xl font-bold text-yellow-900">{breakdown?.defaultRateSegments || 0}</div>
              <div className="text-sm text-yellow-700 font-medium">Default Rate Hours</div>
            </div>
          </div>

          {/* Metadata */}
          {metadata && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Customer:</span>
                  <span className="ml-2 font-semibold text-gray-900">{metadata.customer}</span>
                </div>
                <div>
                  <span className="text-gray-600">Location:</span>
                  <span className="ml-2 font-semibold text-gray-900">{metadata.location}</span>
                </div>
                <div>
                  <span className="text-gray-600">SubLocation:</span>
                  <span className="ml-2 font-semibold text-gray-900">{metadata.sublocation}</span>
                </div>
                <div>
                  <span className="text-gray-600">Timezone:</span>
                  <span className="ml-2 font-semibold text-gray-900">{timezone || 'UTC'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Total Ratesheets:</span>
                  <span className="ml-2 font-semibold text-gray-900">
                    {metadata.ratesheetSummary.total} 
                    <span className="text-xs text-gray-600 ml-2">
                      ({metadata.ratesheetSummary.customer} customer, {metadata.ratesheetSummary.location} location, {metadata.ratesheetSummary.sublocation} sublocation)
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => {
                setShowSegments(true);
                setShowLog(false);
              }}
              className={`px-4 py-2 font-semibold transition-colors ${
                showSegments
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Hourly Segments ({segments.length})
            </button>
            <button
              onClick={() => {
                setShowSegments(false);
                setShowLog(true);
              }}
              className={`px-4 py-2 font-semibold transition-colors ${
                showLog
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Decision Log ({decisionLog.length})
            </button>
          </div>

          {/* Hourly Segments View */}
          {showSegments && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <Clock size={18} className="text-blue-600" />
                Hour-by-Hour Breakdown
              </h4>
              
              {segments.map((segment, index) => (
                <div
                  key={index}
                  className={`rounded-lg p-4 border-2 ${
                    segment.source === 'RATESHEET'
                      ? 'bg-green-50 border-green-300'
                      : 'bg-yellow-50 border-yellow-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    {/* Left: Time & Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={16} className={segment.source === 'RATESHEET' ? 'text-green-600' : 'text-yellow-600'} />
                        <span className="font-bold text-gray-900">
                          Hour {index + 1}: {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({formatDate(segment.startTime)})
                        </span>
                      </div>

                      {segment.ratesheet ? (
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-green-600" />
                            <span className="font-semibold text-green-900">
                              {segment.ratesheet.name}
                            </span>
                            <span className="px-2 py-0.5 bg-green-200 text-green-900 rounded text-xs font-semibold">
                              {segment.ratesheet.level}
                            </span>
                          </div>
                          <div className="text-gray-600 ml-5">
                            Priority: {segment.ratesheet.priority}
                          </div>
                          {segment.timeWindow && (
                            <div className="text-gray-600 ml-5">
                              Time Window: {segment.timeWindow.start} - {segment.timeWindow.end}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <AlertCircle size={14} className="text-yellow-600" />
                          <span className="font-semibold text-yellow-900">
                            Default Rate (No applicable ratesheet)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right: Pricing */}
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold text-green-600">
                        ${segment.totalPrice.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">
                        ${segment.pricePerHour}/hr × {segment.durationHours.toFixed(2)}h
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-lg p-4 border-2 border-green-300">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-lg font-bold text-gray-900">Total Booking Cost</div>
                    <div className="text-sm text-gray-600">
                      {totalHours.toFixed(2)} hours across {segments.length} segments
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-green-600">
                      ${totalPrice.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">
                      Avg: ${totalHours > 0 ? (totalPrice / totalHours).toFixed(2) : '0.00'}/hr
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Decision Log View */}
          {showLog && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                <AlertCircle size={18} className="text-purple-600" />
                Decision-Making Process
              </h4>

              {decisionLog.map((entry, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-2 ${
                    entry.source === 'RATESHEET'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {entry.source === 'RATESHEET' ? (
                      <CheckCircle className="text-green-600 mt-1" size={18} />
                    ) : (
                      <AlertCircle className="text-yellow-600 mt-1" size={18} />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">Hour {entry.hour}</span>
                        <span className="text-sm text-gray-600">{entry.timeSlot}</span>
                      </div>
                      
                      <div className="text-sm space-y-1">
                        <div>
                          <span className="text-gray-600">Applicable Ratesheets:</span>
                          <span className="ml-2 font-semibold">{entry.applicableRatesheets}</span>
                        </div>
                        
                        {entry.selectedRatesheet && (
                          <div>
                            <span className="text-gray-600">Selected:</span>
                            <span className="ml-2 font-semibold text-green-900">{entry.selectedRatesheet}</span>
                          </div>
                        )}
                        
                        <div>
                          <span className="text-gray-600">Price:</span>
                          <span className="ml-2 font-semibold text-green-600">${entry.pricePerHour}/hr</span>
                        </div>
                        
                        <div>
                          <span className="text-gray-600">Source:</span>
                          <span className={`ml-2 font-semibold ${
                            entry.source === 'RATESHEET' ? 'text-green-900' : 'text-yellow-900'
                          }`}>
                            {entry.source}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary Message */}
          <div className={`rounded-lg p-4 border-2 ${
            (breakdown?.ratesheetSegments || 0) > 0
              ? 'bg-gradient-to-r from-green-100 to-blue-100 border-green-300'
              : 'bg-gradient-to-r from-yellow-100 to-orange-100 border-yellow-300'
          }`}>
            <div className="flex items-center gap-3">
              {(breakdown?.ratesheetSegments || 0) > 0 ? (
                <CheckCircle className="text-green-600" size={24} />
              ) : (
                <AlertCircle className="text-yellow-600" size={24} />
              )}
              <div>
                <div className="font-semibold text-gray-900">
                  {(breakdown?.ratesheetSegments || 0) > 0
                    ? `✅ ${breakdown?.ratesheetSegments} hour(s) priced using ratesheets`
                    : '⚠️ All hours priced using default rates'}
                </div>
                <div className="text-sm text-gray-600">
                  {(breakdown?.ratesheetSegments || 0) > 0
                    ? `${breakdown?.defaultRateSegments || 0} hour(s) used default rates (no applicable ratesheet)`
                    : 'No ratesheets matched the booking criteria'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
