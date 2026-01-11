import { ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle, Trophy, Target } from 'lucide-react';
import { useState } from 'react';

interface DecisionAuditProps {
  decisionLog: any[];
  ratesheetsSummary: any;
}

export default function DecisionAuditPanel({ decisionLog, ratesheetsSummary }: DecisionAuditProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  if (!decisionLog || decisionLog.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 mt-8">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-bold text-gray-900">Pricing Decision Audit Trail</h3>
          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
            {ratesheetsSummary.totalConsidered} Ratesheets Evaluated
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-600" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">Ratesheets Considered</span>
                <AlertCircle className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-blue-900">
                {ratesheetsSummary.totalConsidered}
              </div>
              <p className="text-xs text-blue-700 mt-1">
                Found {ratesheetsSummary.totalConsidered} eligible ratesheet{ratesheetsSummary.totalConsidered !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-900">Ratesheets Applied</span>
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-green-900">
                {ratesheetsSummary.totalApplied}
              </div>
              <p className="text-xs text-green-700 mt-1">
                Actually used in final pricing
              </p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-900">Time Slots</span>
                <Trophy className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-3xl font-bold text-purple-900">
                {decisionLog.length}
              </div>
              <p className="text-xs text-purple-700 mt-1">
                Individual pricing decisions made
              </p>
            </div>
          </div>

          {/* Ratesheets Summary */}
          {ratesheetsSummary.ratesheets.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                Ratesheets Used
              </h4>
              <div className="space-y-2">
                {ratesheetsSummary.ratesheets.map((rs: any, idx: number) => (
                  <div
                    key={rs.id}
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{rs.name}</div>
                        <div className="text-xs text-gray-600">
                          Priority: {rs.priority} • Applied {rs.timesApplied} time{rs.timesApplied !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        ${rs.totalRevenue.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">Revenue</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Decision Timeline */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-600" />
              Decision Timeline
            </h4>
            <div className="space-y-2">
              {decisionLog.map((log: any, idx: number) => (
                <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Timeline Item Header */}
                  <button
                    onClick={() => setSelectedSlot(selectedSlot === idx ? null : idx)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(log.timeSlot.start).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                          {' → '}
                          {new Date(log.timeSlot.end).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </div>
                        <div className="text-xs text-gray-600">
                          Winner: <span className="font-medium text-green-600">{log.winner.name}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">
                        ${log.winner.price}/hr
                      </span>
                      {selectedSlot === idx ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {selectedSlot === idx && (
                    <div className="px-4 py-4 bg-gray-50 border-t border-gray-200">
                      {/* Candidates */}
                      {log.candidateRatesheets.length > 0 && (
                        <div className="mb-4">
                          <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                            Candidate Ratesheets
                          </div>
                          <div className="space-y-2">
                            {log.candidateRatesheets.map((candidate: any) => (
                              <div
                                key={candidate.id}
                                className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                                  candidate.id === log.winner.id
                                    ? 'bg-green-50 border-green-300'
                                    : 'bg-white border-gray-200'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {candidate.id === log.winner.id ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <div className="w-4 h-4" />
                                  )}
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {candidate.name}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      Priority: {candidate.priority} • 
                                      Strategy: {candidate.conflictResolution}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-bold ${
                                    candidate.id === log.winner.id ? 'text-green-700' : 'text-gray-700'
                                  }`}>
                                    ${candidate.price}/hr
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Winner Reason */}
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-semibold text-green-900 mb-1">
                              Why {log.winner.name} Was Selected
                            </div>
                            <div className="text-sm text-green-800">
                              {log.winner.reason}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Rejected */}
                      {log.rejectedRatesheets.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                            Rejected Ratesheets
                          </div>
                          <div className="space-y-2">
                            {log.rejectedRatesheets.map((rejected: any) => (
                              <div
                                key={rejected.id}
                                className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                              >
                                <div className="flex items-center gap-2">
                                  <XCircle className="w-4 h-4 text-red-500" />
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {rejected.name}
                                    </div>
                                    <div className="text-xs text-red-700">
                                      {rejected.reason}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm font-bold text-gray-600">
                                  ${rejected.price}/hr
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-gray-700 mb-3">LEGEND</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-600" />
                <span className="text-gray-700">Selected ratesheet</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-3 h-3 text-red-500" />
                <span className="text-gray-700">Rejected ratesheet</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-3 h-3 text-yellow-500" />
                <span className="text-gray-700">Applied to pricing</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
