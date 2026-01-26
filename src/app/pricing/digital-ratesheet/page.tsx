'use client';

import { useState, useEffect } from 'react';
import {
  DollarSign,
  RefreshCw,
  Building2,
  MapPin,
  User,
  Printer,
  Download
} from 'lucide-react';
import PricingFilters from '@/components/PricingFilters';

interface Location {
  _id: string;
  name: string;
  customerId: string;
  defaultHourlyRate?: number;
}

interface SubLocation {
  _id: string;
  label: string;
  locationId: string;
  defaultHourlyRate?: number;
}

interface Customer {
  _id: string;
  name: string;
  defaultHourlyRate?: number;
}

interface Event {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  subLocationId?: string;
  locationId?: string;
  customerId?: string;
}

interface HourlyBreakdown {
  hour: number;
  startTime: string;
  endTime: string;
  rate: number;
  ratesheetName?: string;
  source?: string;
}

interface PricingResult {
  totalPrice: number;
  totalHours: number;
  averageRate: number;
  hourlyBreakdown: HourlyBreakdown[];
  metadata?: {
    customer: string;
    location: string;
    sublocation: string;
    overlappingEvents?: any[];
  };
}

interface EventPricing {
  event: Event;
  shortTermRates: Array<{ duration: number; result: PricingResult }>;
}

export default function DigitalRatesheetPage() {
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [maxDays, setMaxDays] = useState<number>(3);

  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentSubLocation, setCurrentSubLocation] = useState<SubLocation | null>(null);

  const [shortTermRates, setShortTermRates] = useState<Array<{ duration: number; result: PricingResult | null; loading: boolean }>>([]);
  const [longTermRates, setLongTermRates] = useState<Array<{ duration: number; result: PricingResult | null; loading: boolean }>>([]);
  const [eventPricing, setEventPricing] = useState<EventPricing[]>([]);

  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const shortTermDurations = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // hours

  // Generate long term durations based on maxDays
  const getLongTermDurations = (): number[] => {
    const durations = [12, 18, 24]; // 12h, 18h, 24h

    // Add durations up to maxDays
    for (let day = 2; day <= maxDays; day++) {
      durations.push(day * 24); // Convert days to hours
    }

    return durations;
  };

  useEffect(() => {
    if (selectedLocation) {
      fetchLocationDetails(selectedLocation);
    } else {
      setSelectedSubLocation('');
      setCurrentLocation(null);
      setCurrentCustomer(null);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (selectedSubLocation) {
      fetchSubLocationDetails(selectedSubLocation);
    } else {
      setCurrentSubLocation(null);
      setShortTermRates([]);
      setLongTermRates([]);
      setEventPricing([]);
    }
  }, [selectedSubLocation]);

  // Calculate all rates when sublocation or maxDays changes
  useEffect(() => {
    if (currentSubLocation) {
      calculateAllRates();
    }
  }, [currentSubLocation, maxDays]);

  const fetchLocationDetails = async (locationId: string) => {
    try {
      const response = await fetch(`/api/locations/${locationId}`);
      const location = await response.json();
      setCurrentLocation(location);

      if (location.customerId) {
        const customerResponse = await fetch(`/api/customers/${location.customerId}`);
        const customer = await customerResponse.json();
        setCurrentCustomer(customer);
      }
    } catch (error) {
      console.error('Failed to fetch location details:', error);
    }
  };

  const fetchSubLocationDetails = async (subLocationId: string) => {
    try {
      const response = await fetch(`/api/sublocations/${subLocationId}`);
      const subloc = await response.json();
      setCurrentSubLocation(subloc);
    } catch (error) {
      console.error('Failed to fetch sublocation details:', error);
    }
  };

  const calculatePricing = async (durationHours: number): Promise<PricingResult | null> => {
    if (!currentSubLocation) return null;

    const now = new Date();
    const endTime = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    try {
      const response = await fetch('/api/pricing/calculate-hourly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subLocationId: currentSubLocation._id,
          startTime: now.toISOString(),
          endTime: endTime.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate pricing');
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to calculate pricing for ${durationHours}h:`, error);
      return null;
    }
  };

  const calculateAllRates = async () => {
    setLoading(true);
    const now = new Date();
    const maxEndDate = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);

    // Initialize short term rates
    const shortTermInit = shortTermDurations.map(d => ({ duration: d, result: null, loading: true }));
    setShortTermRates(shortTermInit);

    // Initialize long term rates
    const longTermDurations = getLongTermDurations();
    const longTermInit = longTermDurations.map(d => ({ duration: d, result: null, loading: true }));
    setLongTermRates(longTermInit);

    // Calculate short term rates
    const shortTermResults = await Promise.all(
      shortTermDurations.map(async (duration) => {
        const result = await calculatePricing(duration);
        return { duration, result, loading: false };
      })
    );
    setShortTermRates(shortTermResults);

    // Calculate long term rates
    const longTermResults = await Promise.all(
      longTermDurations.map(async (duration) => {
        const result = await calculatePricing(duration);
        return { duration, result, loading: false };
      })
    );
    setLongTermRates(longTermResults);

    // Fetch events overlapping with date range
    await fetchEventPricing(now, maxEndDate);

    setLastUpdated(new Date());
    setLoading(false);
  };

  const fetchEventPricing = async (startDate: Date, endDate: Date) => {
    if (!currentSubLocation) return;

    try {
      // Fetch all active events
      const eventsResponse = await fetch('/api/events');
      const allEvents = await eventsResponse.json();

      // Filter to active events overlapping with our date range
      const overlappingEvents = allEvents.filter((event: Event) => {
        if (!event.isActive) return false;
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);
        return eventEnd >= startDate && eventStart <= endDate;
      });

      // Calculate short-term pricing for each event
      const eventPricingData: EventPricing[] = [];

      for (const event of overlappingEvents) {
        const shortTermRates: Array<{ duration: number; result: PricingResult }> = [];

        // Calculate pricing for durations 1-11 hours for this event
        for (const duration of shortTermDurations) {
          const result = await calculatePricing(duration);
          if (result) {
            shortTermRates.push({ duration, result });
          }
        }

        eventPricingData.push({
          event,
          shortTermRates
        });
      }

      setEventPricing(eventPricingData);
    } catch (error) {
      console.error('Failed to fetch event pricing:', error);
    }
  };

  const formatDuration = (hours: number): string => {
    if (hours < 24) {
      return `${hours} Hour${hours > 1 ? 's' : ''}`;
    }
    const days = hours / 24;
    return `${days} Day${days > 1 ? 's' : ''}`;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-[1200px] mx-auto">
        {/* Header - Hide on print */}
        <div className="mb-6 print:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Digital Ratesheet
              </h1>
              <p className="text-gray-600">
                Complete pricing ratecard for parking locations
              </p>
            </div>

            {lastUpdated && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="text-sm font-medium text-gray-700">{formatDate(lastUpdated)}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={calculateAllRates}
                    disabled={loading || !currentSubLocation}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  <button
                    onClick={handlePrint}
                    disabled={!currentSubLocation}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filters - Hide on print */}
        <div className="print:hidden">
          <PricingFilters
            selectedLocation={selectedLocation}
            selectedSubLocation={selectedSubLocation}
            selectedEventId={selectedEventId}
            onLocationChange={setSelectedLocation}
            onSubLocationChange={setSelectedSubLocation}
            onEventChange={setSelectedEventId}
            selectedDuration={12}
            onDurationChange={() => {}}
          />

          {/* Max Days Selector */}
          {selectedSubLocation && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">
                  Long-term Duration Range:
                </label>
                <select
                  value={maxDays}
                  onChange={(e) => setMaxDays(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                >
                  <option value={1}>Up to 1 day</option>
                  <option value={2}>Up to 2 days</option>
                  <option value={3}>Up to 3 days (Default)</option>
                  <option value={5}>Up to 5 days</option>
                  <option value={7}>Up to 7 days</option>
                  <option value={10}>Up to 10 days</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {loading && !lastUpdated && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && selectedSubLocation && currentCustomer && currentLocation && currentSubLocation && (
          <>
            {/* Printable Ratesheet */}
            <div className="bg-white rounded-xl shadow-lg border-4 border-gray-300 p-12 print:shadow-none print:border-2">
              {/* Header with Location Logo/Name */}
              <div className="text-center mb-8">
                <div className="inline-block bg-gradient-to-br from-blue-600 to-purple-600 text-white px-8 py-4 rounded-2xl mb-4">
                  <h2 className="text-3xl font-bold">{currentLocation.name}</h2>
                  <p className="text-lg opacity-90">{currentSubLocation.label}</p>
                  <p className="text-sm opacity-75 mt-1">
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })} at {new Date().toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </p>
                </div>
                <p className="text-gray-600 text-lg mt-2">{currentCustomer.name}</p>
              </div>

              {/* Main Title */}
              <h1 className="text-5xl font-bold text-center mb-8 text-gray-900" style={{ fontFamily: 'system-ui' }}>
                Parking Lot Rates
              </h1>

              {/* Short-Term Rates Table */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 pb-2 border-b-4 border-gray-900">
                  Short-Term Rates
                </h2>
                <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                  <thead>
                    <tr className="border-b-4 border-gray-900">
                      <th className="text-3xl font-bold text-gray-800 pb-4 pr-8">Duration</th>
                      <th className="text-3xl font-bold text-gray-800 pb-4 text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shortTermRates.map(({ duration, result, loading: itemLoading }) => (
                      <tr key={duration} className="border-b border-gray-300">
                        <td className="text-4xl py-4 pr-8 text-gray-900" style={{ fontFamily: 'system-ui' }}>
                          {formatDuration(duration)}
                        </td>
                        <td className="text-4xl py-4 text-right font-bold text-gray-900" style={{ fontFamily: 'system-ui' }}>
                          {itemLoading ? (
                            <span className="text-gray-400">Loading...</span>
                          ) : result ? (
                            `$${result.totalPrice?.toFixed(2) ?? 'N/A'}`
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Long-Term Rates Table */}
              {longTermRates.length > 0 && (
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6 pb-2 border-b-4 border-gray-900">
                    Long-Term Rates
                  </h2>
                  <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                    <thead>
                      <tr className="border-b-4 border-gray-900">
                        <th className="text-3xl font-bold text-gray-800 pb-4 pr-8">Duration</th>
                        <th className="text-3xl font-bold text-gray-800 pb-4 text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {longTermRates.map(({ duration, result, loading: itemLoading }) => (
                        <tr key={duration} className="border-b border-gray-300">
                          <td className="text-4xl py-4 pr-8 text-gray-900" style={{ fontFamily: 'system-ui' }}>
                            {formatDuration(duration)}
                          </td>
                          <td className="text-4xl py-4 text-right font-bold text-gray-900" style={{ fontFamily: 'system-ui' }}>
                            {itemLoading ? (
                              <span className="text-gray-400">Loading...</span>
                            ) : result ? (
                              `$${result.totalPrice?.toFixed(2) ?? 'N/A'}`
                            ) : (
                              <span className="text-gray-400">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Event Pricing - Only if events exist */}
              {eventPricing.length > 0 && (
                <div className="mb-12 page-break-before">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6 pb-2 border-b-4 border-gray-900">
                    Event Pricing
                  </h2>
                  {eventPricing.map(({ event }) => (
                    <div key={event._id} className="mb-4">
                      <div className="bg-pink-50 border-2 border-pink-300 rounded-lg p-6">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{event.name}</h3>
                        <p className="text-gray-700 mb-2">{event.description}</p>
                        <p className="text-gray-600 text-sm">
                          {new Date(event.startDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                          {' - '}
                          {new Date(event.endDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="border-t-4 border-gray-900 pt-8 mt-12 text-center">
                <p className="text-gray-700 text-xl mb-2" style={{ fontFamily: 'system-ui' }}>
                  Pay at kiosk or using the Park Mobile app
                </p>
                <p className="text-gray-700 text-lg mb-4" style={{ fontFamily: 'system-ui' }}>
                  Questions or comments please call
                </p>
                <p className="text-gray-900 text-2xl font-bold" style={{ fontFamily: 'system-ui' }}>
                  (215) 247-6696
                </p>
                {lastUpdated && (
                  <p className="text-gray-500 text-sm mt-6 print:block hidden">
                    Rates effective as of {formatDate(lastUpdated)}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {!selectedSubLocation && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Select a Location to View Ratesheet
            </h3>
            <p className="text-gray-500">
              Choose a location and sublocation from the filters above to see the complete pricing ratecard.
            </p>
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-2 {
            border-width: 2px !important;
          }
          .page-break-before {
            page-break-before: always;
          }
          @page {
            margin: 0.5in;
          }
        }
      `}</style>
    </div>
  );
}
