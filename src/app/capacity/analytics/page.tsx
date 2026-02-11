'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, PieChart, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';

interface CapacitySheet {
  _id: string;
  name: string;
  type: string;
  priority: number;
  appliesTo: {
    level: string;
    entityId: string;
  };
  isActive: boolean;
  approvalStatus: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

interface Analytics {
  totalSheets: number;
  activeSheets: number;
  inactiveSheets: number;
  byLevel: {
    CUSTOMER: number;
    LOCATION: number;
    SUBLOCATION: number;
    EVENT: number;
  };
  byType: {
    TIME_BASED: number;
    DATE_BASED: number;
    EVENT_BASED: number;
  };
  byStatus: {
    DRAFT: number;
    PENDING_APPROVAL: number;
    APPROVED: number;
    REJECTED: number;
  };
  avgPriority: number;
  upcomingExpirations: number;
}

export default function CapacityAnalyticsPage() {
  const [capacitySheets, setCapacitySheets] = useState<CapacitySheet[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/capacitysheets?includeInactive=true');
      const data = await response.json();
      setCapacitySheets(data);
      calculateAnalytics(data);
    } catch (error) {
      console.error('Error loading capacity sheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (sheets: CapacitySheet[]) => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const analytics: Analytics = {
      totalSheets: sheets.length,
      activeSheets: sheets.filter(s => s.isActive).length,
      inactiveSheets: sheets.filter(s => !s.isActive).length,
      byLevel: {
        CUSTOMER: sheets.filter(s => s.appliesTo.level === 'CUSTOMER').length,
        LOCATION: sheets.filter(s => s.appliesTo.level === 'LOCATION').length,
        SUBLOCATION: sheets.filter(s => s.appliesTo.level === 'SUBLOCATION').length,
        EVENT: sheets.filter(s => s.appliesTo.level === 'EVENT').length,
      },
      byType: {
        TIME_BASED: sheets.filter(s => s.type === 'TIME_BASED').length,
        DATE_BASED: sheets.filter(s => s.type === 'DATE_BASED').length,
        EVENT_BASED: sheets.filter(s => s.type === 'EVENT_BASED').length,
      },
      byStatus: {
        DRAFT: sheets.filter(s => s.approvalStatus === 'DRAFT').length,
        PENDING_APPROVAL: sheets.filter(s => s.approvalStatus === 'PENDING_APPROVAL').length,
        APPROVED: sheets.filter(s => s.approvalStatus === 'APPROVED').length,
        REJECTED: sheets.filter(s => s.approvalStatus === 'REJECTED').length,
      },
      avgPriority: sheets.length > 0
        ? Math.round(sheets.reduce((sum, s) => sum + s.priority, 0) / sheets.length)
        : 0,
      upcomingExpirations: sheets.filter(s =>
        s.effectiveTo && new Date(s.effectiveTo) <= thirtyDaysFromNow && new Date(s.effectiveTo) >= now
      ).length,
    };

    setAnalytics(analytics);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-green-50 to-emerald-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-green-600 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-10 h-10" />
            <div>
              <h1 className="text-4xl font-bold mb-2">Capacity Analytics</h1>
              <p className="text-teal-100 text-lg">Insights and statistics for capacity management</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {analytics ? (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-teal-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Total Sheets</span>
                  <Users className="text-teal-600" size={24} />
                </div>
                <p className="text-4xl font-bold text-teal-900">{analytics.totalSheets}</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Active</span>
                  <CheckCircle className="text-green-600" size={24} />
                </div>
                <p className="text-4xl font-bold text-green-900">{analytics.activeSheets}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {analytics.totalSheets > 0
                    ? Math.round((analytics.activeSheets / analytics.totalSheets) * 100)
                    : 0}% of total
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Avg Priority</span>
                  <TrendingUp className="text-orange-600" size={24} />
                </div>
                <p className="text-4xl font-bold text-orange-900">{analytics.avgPriority}</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Expiring Soon</span>
                  <Clock className="text-red-600" size={24} />
                </div>
                <p className="text-4xl font-bold text-red-900">{analytics.upcomingExpirations}</p>
                <p className="text-xs text-gray-500 mt-1">Next 30 days</p>
              </div>
            </div>

            {/* Distribution Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* By Level */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <PieChart size={20} className="text-teal-600" />
                  By Level
                </h3>
                <div className="space-y-3">
                  {Object.entries(analytics.byLevel).map(([level, count]) => (
                    <div key={level}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">{level}</span>
                        <span className="text-sm font-bold text-gray-900">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            level === 'CUSTOMER' ? 'bg-blue-500' :
                            level === 'LOCATION' ? 'bg-green-500' :
                            level === 'SUBLOCATION' ? 'bg-orange-500' :
                            'bg-pink-500'
                          }`}
                          style={{ width: `${analytics.totalSheets > 0 ? (count / analytics.totalSheets) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Type */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar size={20} className="text-green-600" />
                  By Type
                </h3>
                <div className="space-y-3">
                  {Object.entries(analytics.byType).map(([type, count]) => (
                    <div key={type}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">{type.replace('_', ' ')}</span>
                        <span className="text-sm font-bold text-gray-900">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            type === 'TIME_BASED' ? 'bg-teal-500' :
                            type === 'DATE_BASED' ? 'bg-green-500' :
                            'bg-purple-500'
                          }`}
                          style={{ width: `${analytics.totalSheets > 0 ? (count / analytics.totalSheets) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Status */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle size={20} className="text-blue-600" />
                  By Status
                </h3>
                <div className="space-y-3">
                  {Object.entries(analytics.byStatus).map(([status, count]) => (
                    <div key={status}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">{status.replace('_', ' ')}</span>
                        <span className="text-sm font-bold text-gray-900">{count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            status === 'DRAFT' ? 'bg-gray-500' :
                            status === 'PENDING_APPROVAL' ? 'bg-yellow-500' :
                            status === 'APPROVED' ? 'bg-green-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${analytics.totalSheets > 0 ? (count / analytics.totalSheets) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Activity Summary */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Activity Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{analytics.byLevel.CUSTOMER}</div>
                  <div className="text-sm text-gray-600 mt-1">Customer Level</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{analytics.byLevel.LOCATION}</div>
                  <div className="text-sm text-gray-600 mt-1">Location Level</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600">{analytics.byLevel.SUBLOCATION}</div>
                  <div className="text-sm text-gray-600 mt-1">SubLocation Level</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-pink-600">{analytics.byLevel.EVENT}</div>
                  <div className="text-sm text-gray-600 mt-1">Event Level</div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Recommendations</h3>
              <div className="space-y-3">
                {analytics.byStatus.DRAFT > 0 && (
                  <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <div className="flex items-center gap-2">
                      <Clock className="text-yellow-600" size={20} />
                      <span className="font-semibold text-yellow-900">
                        {analytics.byStatus.DRAFT} draft sheet{analytics.byStatus.DRAFT > 1 ? 's' : ''} pending submission
                      </span>
                    </div>
                    <p className="text-sm text-yellow-700 mt-1">
                      Review and submit draft capacity sheets for approval.
                    </p>
                  </div>
                )}

                {analytics.byStatus.PENDING_APPROVAL > 0 && (
                  <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-blue-600" size={20} />
                      <span className="font-semibold text-blue-900">
                        {analytics.byStatus.PENDING_APPROVAL} sheet{analytics.byStatus.PENDING_APPROVAL > 1 ? 's' : ''} awaiting approval
                      </span>
                    </div>
                    <p className="text-sm text-blue-700 mt-1">
                      Approve or reject pending capacity sheets.
                    </p>
                  </div>
                )}

                {analytics.upcomingExpirations > 0 && (
                  <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded">
                    <div className="flex items-center gap-2">
                      <XCircle className="text-red-600" size={20} />
                      <span className="font-semibold text-red-900">
                        {analytics.upcomingExpirations} sheet{analytics.upcomingExpirations > 1 ? 's' : ''} expiring in 30 days
                      </span>
                    </div>
                    <p className="text-sm text-red-700 mt-1">
                      Review and extend or replace expiring capacity sheets.
                    </p>
                  </div>
                )}

                {analytics.inactiveSheets > analytics.activeSheets && (
                  <div className="p-4 bg-orange-50 border-l-4 border-orange-400 rounded">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="text-orange-600" size={20} />
                      <span className="font-semibold text-orange-900">
                        More inactive ({analytics.inactiveSheets}) than active ({analytics.activeSheets}) sheets
                      </span>
                    </div>
                    <p className="text-sm text-orange-700 mt-1">
                      Consider archiving or removing unused capacity sheets.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600">
              Create some capacity sheets to see analytics
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
