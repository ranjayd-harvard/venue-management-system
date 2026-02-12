'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DEFAULT_SEED_CONFIG } from '@/models/SeedConfig';

export default function AdminSeedPage() {
  const [config, setConfig] = useState(DEFAULT_SEED_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [seedLog, setSeedLog] = useState<string[]>([]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setConfig((prev) => ({
      ...prev,
      [field]: typeof value === 'boolean' ? value : parseInt(value) || prev[field as keyof typeof prev],
    }));
  };

  const handlePrefixChange = (field: string, value: string) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const calculateTotals = () => {
    const totalLocations = config.customers * config.locationsPerCustomer;
    const totalSubLocations = totalLocations * config.subLocationsPerLocation;
    const totalLocationVenueRelations = totalLocations * config.venuesPerLocation;
    const totalSubLocationVenueRelations = totalSubLocations * config.venuesPerSubLocation;
    const totalEvents = config.createEvents ? totalSubLocations * config.eventsPerSubLocation : 0;
    const totalRatesheets = config.createRatesheets ? (totalLocations * 2 + totalSubLocations) : 0;
    const totalEventRatesheets = (config.createEvents && config.createEventRatesheets) ? totalEvents : 0;
    const totalPriorityConfigs = config.createPriorityConfigs ? 4 : 0;
    const totalCapacitySheets = config.createCapacitySheets ? (config.customers + totalLocations + totalSubLocations + 1) : 0; // +1 for pending sheet
    const totalSurgeConfigs = config.createSurgeConfigs ? 3 : 0;

    return {
      totalLocations,
      totalSubLocations,
      totalLocationVenueRelations,
      totalSubLocationVenueRelations,
      totalEvents,
      totalRatesheets,
      totalEventRatesheets,
      totalPriorityConfigs,
      totalCapacitySheets,
      totalSurgeConfigs,
      totalRecords: config.customers + totalLocations + totalSubLocations + config.venues + totalLocationVenueRelations + totalSubLocationVenueRelations + totalEvents + totalRatesheets + totalEventRatesheets + totalPriorityConfigs + totalCapacitySheets + totalSurgeConfigs,
    };
  };

  const handleSeed = async () => {
    setIsLoading(true);
    setMessage(null);
    setSeedLog([]);

    try {
      const response = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Database seeded successfully!' });
        setSeedLog(data.log || []);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to seed database' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred while seeding the database' });
      console.error('Seed error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">Admin - Database Seeding</h1>
            <p className="text-gray-600 mt-2">Configure and generate sample data</p>
          </div>
          <Link
            href="/"
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Back to Home
          </Link>
        </div>

        {/* Configuration Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Seed Configuration</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Entity Quantities */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">Entity Quantities</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Customers
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={config.customers}
                  onChange={(e) => handleInputChange('customers', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Locations per Customer
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={config.locationsPerCustomer}
                  onChange={(e) => handleInputChange('locationsPerCustomer', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sub-Locations per Location
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={config.subLocationsPerLocation}
                  onChange={(e) => handleInputChange('subLocationsPerLocation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Number of Venues
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={config.venues}
                  onChange={(e) => handleInputChange('venues', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Venues per Location
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={config.venuesPerLocation}
                  onChange={(e) => handleInputChange('venuesPerLocation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Venues per Sub-Location
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={config.venuesPerSubLocation}
                  onChange={(e) => handleInputChange('venuesPerSubLocation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Events per Sub-Location
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={config.eventsPerSubLocation}
                  onChange={(e) => handleInputChange('eventsPerSubLocation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  disabled={!config.createEvents}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {config.createEvents ? 'Number of sample events per sub-location' : 'Enable event creation below'}
                </p>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700">Event Date Range</h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start (days from now)
                  </label>
                  <input
                    type="number"
                    min="-365"
                    max="365"
                    value={config.eventDateRangeStart}
                    onChange={(e) => handleInputChange('eventDateRangeStart', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    disabled={!config.createEvents}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Negative = past (e.g., -7 = 7 days ago)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End (days from now)
                  </label>
                  <input
                    type="number"
                    min="-365"
                    max="365"
                    value={config.eventDateRangeEnd}
                    onChange={(e) => handleInputChange('eventDateRangeEnd', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    disabled={!config.createEvents}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Positive = future (e.g., 7 = 7 days from now)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    % Active Events
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.percentActiveEvents}
                    onChange={(e) => handleInputChange('percentActiveEvents', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    disabled={!config.createEvents}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Percentage of events currently happening (0-100)
                  </p>
                </div>
              </div>
            </div>

            {/* Naming Prefixes */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">Naming Prefixes</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Prefix
                </label>
                <input
                  type="text"
                  value={config.customerPrefix}
                  onChange={(e) => handlePrefixChange('customerPrefix', e.target.value)}
                  placeholder="e.g., Customer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">Example: {config.customerPrefix}-1</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location Prefix
                </label>
                <input
                  type="text"
                  value={config.locationPrefix}
                  onChange={(e) => handlePrefixChange('locationPrefix', e.target.value)}
                  placeholder="e.g., Location"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">Example: {config.locationPrefix}-1</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sub-Location Prefix
                </label>
                <input
                  type="text"
                  value={config.subLocationPrefix}
                  onChange={(e) => handlePrefixChange('subLocationPrefix', e.target.value)}
                  placeholder="e.g., SubLocation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">Example: {config.subLocationPrefix}-1</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Venue Prefix
                </label>
                <input
                  type="text"
                  value={config.venuePrefix}
                  onChange={(e) => handlePrefixChange('venuePrefix', e.target.value)}
                  placeholder="e.g., Venue"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">Example: {config.venuePrefix}-1</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Prefix
                </label>
                <input
                  type="text"
                  value={config.eventPrefix}
                  onChange={(e) => handlePrefixChange('eventPrefix', e.target.value)}
                  placeholder="e.g., Event"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  disabled={!config.createEvents}
                />
                <p className="text-xs text-gray-500 mt-1">Example: {config.eventPrefix}-1</p>
              </div>

              <div className="pt-4 space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.useUSPSLocations}
                    onChange={(e) => handleInputChange('useUSPSLocations', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Use Real USPS Postal Locations with Geo-Coordinates
                  </span>
                </label>
                <p className="text-xs text-gray-500 ml-6">
                  When enabled, locations will use real USPS addresses and coordinates
                </p>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.createRatesheets}
                    onChange={(e) => handleInputChange('createRatesheets', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Create Sample RateSheets
                  </span>
                </label>
                <p className="text-xs text-gray-500 ml-6">
                  Generate ratesheets with overlapping time windows and busy hour premiums
                </p>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.createEvents}
                    onChange={(e) => handleInputChange('createEvents', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Create Sample Events
                  </span>
                </label>
                <p className="text-xs text-gray-500 ml-6">
                  Generate sample events distributed across sub-locations
                </p>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.createEventRatesheets}
                    onChange={(e) => handleInputChange('createEventRatesheets', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    disabled={!config.createEvents}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Create Event-Specific RateSheets
                  </span>
                </label>
                <p className="text-xs text-gray-500 ml-6">
                  Generate ratesheets covering each event&apos;s exact time window (highest priority)
                </p>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.createPriorityConfigs}
                    onChange={(e) => handleInputChange('createPriorityConfigs', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Create Priority Configs
                  </span>
                </label>
                <p className="text-xs text-gray-500 ml-6">
                  Seed priority ranges: Customer (1000-1999), Location (2000-2999), SubLocation (3000-3999), Event (4000-4999)
                </p>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.createCapacitySheets}
                    onChange={(e) => handleInputChange('createCapacitySheets', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Create Capacity Sheets
                  </span>
                </label>
                <p className="text-xs text-gray-500 ml-6">
                  Generate capacity sheets at customer, location, and sublocation levels with time windows
                </p>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.createSurgeConfigs}
                    onChange={(e) => handleInputChange('createSurgeConfigs', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Create Surge Configs
                  </span>
                </label>
                <p className="text-xs text-gray-500 ml-6">
                  Generate surge pricing configurations with demand/supply parameters
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Calculated Totals */}
        <div className="bg-blue-50 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-blue-800">Calculated Totals</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-gray-700">
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-600">Customers</p>
              <p className="text-2xl font-bold text-blue-600">{config.customers}</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-600">Locations</p>
              <p className="text-2xl font-bold text-green-600">{totals.totalLocations}</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-600">Sub-Locations</p>
              <p className="text-2xl font-bold text-orange-600">{totals.totalSubLocations}</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-600">Venues</p>
              <p className="text-2xl font-bold text-purple-600">{config.venues}</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-600">Location-Venue Relations</p>
              <p className="text-2xl font-bold text-indigo-600">{totals.totalLocationVenueRelations}</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-600">SubLocation-Venue Relations</p>
              <p className="text-2xl font-bold text-pink-600">{totals.totalSubLocationVenueRelations}</p>
            </div>
            {config.createEvents && (
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600">Events</p>
                <p className="text-2xl font-bold text-cyan-600">{totals.totalEvents}</p>
              </div>
            )}
            {config.createRatesheets && (
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600">Rate Sheets</p>
                <p className="text-2xl font-bold text-teal-600">{totals.totalRatesheets}</p>
              </div>
            )}
            {config.createEvents && config.createEventRatesheets && (
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600">Event Rate Sheets</p>
                <p className="text-2xl font-bold text-amber-600">{totals.totalEventRatesheets}</p>
              </div>
            )}
            {config.createPriorityConfigs && (
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600">Priority Configs</p>
                <p className="text-2xl font-bold text-rose-600">{totals.totalPriorityConfigs}</p>
              </div>
            )}
            {config.createCapacitySheets && (
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600">Capacity Sheets</p>
                <p className="text-2xl font-bold text-emerald-600">{totals.totalCapacitySheets}</p>
              </div>
            )}
            {config.createSurgeConfigs && (
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm text-gray-600">Surge Configs</p>
                <p className="text-2xl font-bold text-violet-600">{totals.totalSurgeConfigs}</p>
              </div>
            )}
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-4 rounded-lg lg:col-span-4">
              <p className="text-sm text-white">Total Records</p>
              <p className="text-3xl font-bold text-white">{totals.totalRecords}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex gap-4">
            <button
              onClick={handleSeed}
              disabled={isLoading}
              className={`flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? 'Seeding Database...' : 'Generate Sample Data'}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2 text-center">
            Warning: This will clear all existing data and generate new sample data
          </p>
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={`rounded-lg p-4 mb-6 ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}
          >
            <p className="font-semibold">{message.text}</p>
          </div>
        )}

        {/* Seed Log */}
        {seedLog.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Seed Log</h2>
            <div className="bg-gray-50 rounded p-4 max-h-96 overflow-y-auto font-mono text-sm">
              {seedLog.map((log, index) => (
                <div key={index} className="mb-1 text-gray-700">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
