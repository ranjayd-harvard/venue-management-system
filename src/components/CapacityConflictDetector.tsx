'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

interface CapacitySheet {
  _id: string;
  name: string;
  type: string;
  priority: number;
  appliesTo: {
    level: string;
    entityId: string;
  };
  effectiveFrom: string;
  effectiveTo?: string;
  timeWindows?: Array<{
    startTime: string;
    endTime: string;
  }>;
  isActive: boolean;
  approvalStatus: string;
}

interface Conflict {
  sheet1: CapacitySheet;
  sheet2: CapacitySheet;
  type: 'SAME_ENTITY_OVERLAP' | 'SAME_TIME_OVERLAP' | 'PRIORITY_CONFLICT';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
}

interface CapacityConflictDetectorProps {
  isOpen: boolean;
  onClose: () => void;
  subLocationId?: string;
}

export default function CapacityConflictDetector({ isOpen, onClose, subLocationId }: CapacityConflictDetectorProps) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [capacitySheets, setCapacitySheets] = useState<CapacitySheet[]>([]);

  useEffect(() => {
    if (isOpen) {
      detectConflicts();
    }
  }, [isOpen, subLocationId]);

  const detectConflicts = async () => {
    setLoading(true);
    try {
      // Fetch all active capacity sheets
      const url = subLocationId
        ? `/api/capacitysheets?subLocationId=${subLocationId}&resolveHierarchy=true&includeInactive=false`
        : '/api/capacitysheets?includeInactive=false';

      const response = await fetch(url);
      const sheets: CapacitySheet[] = await response.json();
      setCapacitySheets(sheets);

      // Detect conflicts
      const detectedConflicts: Conflict[] = [];

      for (let i = 0; i < sheets.length; i++) {
        for (let j = i + 1; j < sheets.length; j++) {
          const sheet1 = sheets[i];
          const sheet2 = sheets[j];

          // Check if same entity
          if (sheet1.appliesTo.entityId === sheet2.appliesTo.entityId &&
              sheet1.appliesTo.level === sheet2.appliesTo.level) {

            // Check date overlap
            const start1 = new Date(sheet1.effectiveFrom);
            const end1 = sheet1.effectiveTo ? new Date(sheet1.effectiveTo) : null;
            const start2 = new Date(sheet2.effectiveFrom);
            const end2 = sheet2.effectiveTo ? new Date(sheet2.effectiveTo) : null;

            const hasDateOverlap = (
              (start1 <= start2 && (!end1 || end1 >= start2)) ||
              (start2 <= start1 && (!end2 || end2 >= start1))
            );

            if (hasDateOverlap) {
              // Check time window overlap
              if (sheet1.type === 'TIME_BASED' && sheet2.type === 'TIME_BASED' &&
                  sheet1.timeWindows && sheet2.timeWindows) {

                for (const tw1 of sheet1.timeWindows) {
                  for (const tw2 of sheet2.timeWindows) {
                    const start1Min = parseInt(tw1.startTime.split(':')[0]) * 60 + parseInt(tw1.startTime.split(':')[1] || '0');
                    const end1Min = parseInt(tw1.endTime.split(':')[0]) * 60 + parseInt(tw1.endTime.split(':')[1] || '0');
                    const start2Min = parseInt(tw2.startTime.split(':')[0]) * 60 + parseInt(tw2.startTime.split(':')[1] || '0');
                    const end2Min = parseInt(tw2.endTime.split(':')[0]) * 60 + parseInt(tw2.endTime.split(':')[1] || '0');

                    const hasTimeOverlap = (
                      (start1Min < end2Min && end1Min > start2Min)
                    );

                    if (hasTimeOverlap) {
                      detectedConflicts.push({
                        sheet1,
                        sheet2,
                        type: 'SAME_TIME_OVERLAP',
                        severity: sheet1.priority === sheet2.priority ? 'HIGH' : 'MEDIUM',
                        message: `Time windows overlap: ${tw1.startTime}-${tw1.endTime} conflicts with ${tw2.startTime}-${tw2.endTime}`
                      });
                    }
                  }
                }
              }

              // Same entity, date overlap but different priorities
              if (sheet1.priority !== sheet2.priority) {
                detectedConflicts.push({
                  sheet1,
                  sheet2,
                  type: 'SAME_ENTITY_OVERLAP',
                  severity: 'LOW',
                  message: `Same entity with overlapping dates. Priority ${sheet1.priority} vs ${sheet2.priority} will resolve conflict.`
                });
              } else {
                // Same priority = HIGH severity conflict
                detectedConflicts.push({
                  sheet1,
                  sheet2,
                  type: 'PRIORITY_CONFLICT',
                  severity: 'HIGH',
                  message: `Same entity, same priority (${sheet1.priority}). Resolution is ambiguous.`
                });
              }
            }
          }
        }
      }

      setConflicts(detectedConflicts);
    } catch (error) {
      console.error('Error detecting conflicts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    if (severity === 'HIGH') return 'bg-red-100 border-red-300 text-red-800';
    if (severity === 'MEDIUM') return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    return 'bg-blue-100 border-blue-300 text-blue-800';
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'HIGH') return <AlertTriangle className="text-red-600" size={20} />;
    if (severity === 'MEDIUM') return <AlertTriangle className="text-yellow-600" size={20} />;
    return <CheckCircle className="text-blue-600" size={20} />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <AlertTriangle size={28} />
            <h2 className="text-2xl font-bold">Conflict Detector</h2>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-orange-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Analyzing capacity sheets for conflicts...</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{capacitySheets.length}</div>
                    <div className="text-sm text-gray-600">Total Sheets</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {conflicts.filter(c => c.severity === 'HIGH').length}
                    </div>
                    <div className="text-sm text-gray-600">High Severity</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {conflicts.filter(c => c.severity === 'MEDIUM').length}
                    </div>
                    <div className="text-sm text-gray-600">Medium Severity</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {conflicts.filter(c => c.severity === 'LOW').length}
                    </div>
                    <div className="text-sm text-gray-600">Low Severity</div>
                  </div>
                </div>
              </div>

              {/* Conflicts List */}
              {conflicts.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="text-green-600 mx-auto mb-4" size={48} />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No Conflicts Detected</h3>
                  <p className="text-gray-600">
                    All capacity sheets are properly configured with no overlapping conflicts.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    Detected Conflicts ({conflicts.length})
                  </h3>

                  {conflicts.map((conflict, index) => (
                    <div key={index} className={`p-4 rounded-lg border ${getSeverityColor(conflict.severity)}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getSeverityIcon(conflict.severity)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold">{conflict.type.replace(/_/g, ' ')}</h4>
                            <span className="px-2 py-1 bg-white rounded text-xs font-semibold">
                              {conflict.severity} SEVERITY
                            </span>
                          </div>
                          <p className="text-sm mb-3">{conflict.message}</p>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-white bg-opacity-50 p-3 rounded">
                              <div className="font-semibold mb-1">{conflict.sheet1.name}</div>
                              <div className="text-xs space-y-1">
                                <div>Priority: {conflict.sheet1.priority}</div>
                                <div>Level: {conflict.sheet1.appliesTo.level}</div>
                                <div>
                                  Effective: {new Date(conflict.sheet1.effectiveFrom).toLocaleDateString()} -
                                  {conflict.sheet1.effectiveTo
                                    ? new Date(conflict.sheet1.effectiveTo).toLocaleDateString()
                                    : ' Indefinite'}
                                </div>
                              </div>
                            </div>
                            <div className="bg-white bg-opacity-50 p-3 rounded">
                              <div className="font-semibold mb-1">{conflict.sheet2.name}</div>
                              <div className="text-xs space-y-1">
                                <div>Priority: {conflict.sheet2.priority}</div>
                                <div>Level: {conflict.sheet2.appliesTo.level}</div>
                                <div>
                                  Effective: {new Date(conflict.sheet2.effectiveFrom).toLocaleDateString()} -
                                  {conflict.sheet2.effectiveTo
                                    ? new Date(conflict.sheet2.effectiveTo).toLocaleDateString()
                                    : ' Indefinite'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {conflict.severity === 'HIGH' && (
                            <div className="mt-3 p-2 bg-white rounded text-xs">
                              <strong>⚠️ Action Required:</strong> Resolve this conflict by adjusting priorities,
                              date ranges, or time windows to avoid ambiguous capacity rules.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 pt-6 border-t">
                <button
                  onClick={onClose}
                  className="w-full px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg font-semibold hover:from-orange-700 hover:to-red-700 transition-all"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
