'use client';

import React, { useState, useEffect } from 'react';
import { PricingResult } from '@/models/Ratesheet';

export default function ViewPricingPage() {
  const [subLocationId, setSubLocationId] = useState('');
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Set default times (today 9 AM to 5 PM)
  useEffect(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(9, 0, 0, 0);
    const end = new Date(now);
    end.setHours(17, 0, 0, 0);

    setStartDateTime(start.toISOString().slice(0, 16));
    setEndDateTime(end.toISOString().slice(0, 16));
  }, []);

  const calculatePricing = async () => {
    if (!subLocationId || !startDateTime || !endDateTime) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    setPricingResult(null);

    try {
      const response = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subLocationId,
          startDateTime,
          endDateTime
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate pricing');
      }

      const data = await response.json();
      setPricingResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Pricing Calculator
          </h1>
          <p className="text-gray-600 mt-2">
            Calculate pricing for your selected location and time period
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 text-gray-900">
        {/* Input Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Calculate Your Price</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sub-Location ID
              </label>
              <input
                type="text"
                value={subLocationId}
                onChange={(e) => setSubLocationId(e.target.value)}
                placeholder="Enter sub-location ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Example: 507f1f77bcf86cd799439011
              </p>
            </div>
            <div className="h-divider"></div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={startDateTime}
                  onChange={(e) => setStartDateTime(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="datetime-local"
                  value={endDateTime}
                  onChange={(e) => setEndDateTime(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <button
            onClick={calculatePricing}
            disabled={loading}
            className={`
              w-full py-3 rounded-lg font-medium text-white
              transition-all duration-200 shadow-md hover:shadow-lg
              ${loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
              }
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Calculating...
              </span>
            ) : (
              '💰 Calculate Pricing'
            )}
          </button>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <span>{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Pricing Results */}
        {pricingResult && (
          <div className="space-y-6">
            {/* Total Price Card */}
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-xl p-8 text-white">
              <div className="text-center">
                <div className="text-sm font-medium opacity-90 mb-2">Total Price</div>
                <div className="text-5xl font-bold mb-4">
                  {formatCurrency(pricingResult.totalPrice)}
                </div>
                <div className="text-sm opacity-75">
                  for {pricingResult.breakdown.reduce((sum, b) => sum + b.hours, 0).toFixed(1)} hours
                </div>
              </div>

              {/* Quick Info */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/20">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {pricingResult.breakdown.length}
                  </div>
                  <div className="text-xs opacity-75">Rate Changes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatCurrency(
                      pricingResult.totalPrice / 
                      pricingResult.breakdown.reduce((sum, b) => sum + b.hours, 0)
                    )}
                  </div>
                  <div className="text-xs opacity-75">Avg per Hour</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {new Set(pricingResult.breakdown.map(b => b.ratesheetId.toString())).size}
                  </div>
                  <div className="text-xs opacity-75">Ratesheets Used</div>
                </div>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-gray-700 to-gray-900 text-white px-6 py-4">
                <h3 className="text-lg font-semibold">Pricing Breakdown</h3>
                <p className="text-sm opacity-75">Hour-by-hour pricing details</p>
              </div>

              <div className="divide-y">
                {pricingResult.breakdown.map((item, index) => (
                  <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-2xl">🕐</span>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {formatDateTime(item.startDateTime)} - {formatDateTime(item.endDateTime)}
                            </div>
                            <div className="text-sm text-gray-600">
                              {item.hours} hour{item.hours !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          {formatCurrency(item.subtotal)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatCurrency(item.pricePerHour)}/hr
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                        {item.ratesheetName}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-600">{item.appliedRule}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Footer */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Currency</div>
                  <div className="font-semibold text-gray-900">{pricingResult.currency}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600 mb-1">Generated</div>
                  <div className="font-semibold text-gray-900">
                    {new Date().toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        {!pricingResult && !loading && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900">How it works</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex gap-3">
                <span className="text-2xl">1️⃣</span>
                <div>
                  <div className="font-medium text-gray-900">Enter Location</div>
                  <div>Select your sub-location by entering its ID</div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-2xl">2️⃣</span>
                <div>
                  <div className="font-medium text-gray-900">Choose Time Period</div>
                  <div>Select your start and end date/time</div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-2xl">3️⃣</span>
                <div>
                  <div className="font-medium text-gray-900">Get Instant Quote</div>
                  <div>See detailed pricing with hour-by-hour breakdown</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
