'use client';

import React, { useState, useEffect } from 'react';
import CalendarTimeline from '@/components/CalendarTimeline';
import RatesheetLayerVisualizer from '@/components/RatesheetLayerVisualizer';
import { Ratesheet } from '@/models/Ratesheet';

type ViewMode = 'day' | 'week' | 'month';

export default function AdminPricingPage() {
  const [ratesheets, setRatesheets] = useState<Ratesheet[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch ratesheets
  useEffect(() => {
    fetchRatesheets();
  }, [selectedSubLocation]);

  const fetchRatesheets = async () => {
    try {
      setLoading(true);
      const url = selectedSubLocation 
        ? `/api/ratesheets?entityId=${selectedSubLocation}`
        : '/api/ratesheets';
      
      const response = await fetch(url);
      const data = await response.json();
      setRatesheets(data);
    } catch (error) {
      console.error('Failed to fetch ratesheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const handleRatesheetClick = (ratesheet: Ratesheet) => {
    console.log('Ratesheet clicked:', ratesheet);
    // TODO: Open edit modal
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    
    switch (viewMode) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }
    
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pricing Management</h1>
              <p className="text-sm text-gray-600 mt-1">
                Configure multi-layered pricing ratesheets for your locations
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="
                bg-gradient-to-r from-blue-600 to-purple-600 
                text-white px-6 py-2.5 rounded-lg 
                hover:from-blue-700 hover:to-purple-700 
                transition-all duration-200 shadow-md hover:shadow-lg
                font-medium
              "
            >
              + Create Ratesheet
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Calendar Timeline */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* Calendar Controls */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigateDate('prev')}
                      className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={goToToday}
                      className="px-4 py-2 hover:bg-white/20 rounded-lg transition-colors font-medium"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => navigateDate('next')}
                      className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* View Mode Switcher */}
                  <div className="flex bg-white/20 rounded-lg p-1">
                    {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
                      <button
                        key={mode}
                        onClick={() => handleViewModeChange(mode)}
                        className={`
                          px-4 py-1.5 rounded-md font-medium transition-all capitalize
                          ${viewMode === mode 
                            ? 'bg-white text-blue-600 shadow-md' 
                            : 'text-white hover:bg-white/10'
                          }
                        `}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Display */}
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {selectedDate.toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric',
                      year: 'numeric' 
                    })}
                  </div>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="h-[600px] overflow-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <div className="text-gray-600">Loading ratesheets...</div>
                    </div>
                  </div>
                ) : (
                  <CalendarTimeline
                    ratesheets={ratesheets}
                    selectedDate={selectedDate}
                    onDateChange={handleDateChange}
                    onRatesheetClick={handleRatesheetClick}
                    viewMode={viewMode}
                  />
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-600">Total Ratesheets</div>
                <div className="text-2xl font-bold text-blue-600">{ratesheets.length}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-600">Active</div>
                <div className="text-2xl font-bold text-green-600">
                  {ratesheets.filter(r => r.isActive).length}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-600">Pending Approval</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {ratesheets.filter(r => r.approvalStatus === 'PENDING_APPROVAL').length}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Layer Visualizer */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
              <RatesheetLayerVisualizer
                ratesheets={ratesheets.filter(r => r.isActive)}
                onLayerClick={handleRatesheetClick}
              />

              {/* Quick Actions */}
              <div className="mt-6 pt-6 border-t space-y-2">
                <button className="w-full bg-blue-50 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium">
                  📊 View Pricing Analytics
                </button>
                <button className="w-full bg-purple-50 text-purple-700 px-4 py-2 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium">
                  🔍 Simulate Pricing
                </button>
                <button className="w-full bg-green-50 text-green-700 px-4 py-2 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium">
                  📥 Export Ratesheets
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Ratesheet Modal - Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Create New Ratesheet</h2>
            <p className="text-gray-600 mb-4">
              Ratesheet creation form will be implemented here...
            </p>
            <button
              onClick={() => setShowCreateModal(false)}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
