'use client';

import { useState, useEffect } from 'react';
import { X, Filter, ChevronDown, Building2, MapPin, Layers, Home, RefreshCw } from 'lucide-react';

interface GraphFilterPanelProps {
  allData: {
    customers: any[];
    locations: any[];
    sublocations: any[];
    venues: any[];
    slvRelations?: any[];
  };
  currentFilters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClose: () => void;
  isOpen: boolean;
}

export interface FilterState {
  customer: string;
  location: string;
  sublocation: string;
  venue: string;
}

export default function GraphFilterPanel({ 
  allData, 
  currentFilters,
  onFilterChange, 
  onClose,
  isOpen 
}: GraphFilterPanelProps) {
  const [filters, setFilters] = useState<FilterState>(currentFilters);

  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    setFilters(currentFilters);
  }, [currentFilters]);

  // Calculate active filter count
  useEffect(() => {
    const count = Object.values(filters).filter(v => v !== 'all').length;
    setActiveCount(count);
  }, [filters]);

  // // Notify parent component of filter changes
  // useEffect(() => {
  //   onFilterChange(filters);
  // }, [filters, onFilterChange]);

  // Get filtered data for cascading dropdowns
  const getFilteredLocations = () => {
    if (filters.customer === 'all') return allData.locations;
    return allData.locations.filter(l => l.customerId === filters.customer);
  };

  const getFilteredSublocations = () => {
    if (filters.location === 'all') return allData.sublocations;
    return allData.sublocations.filter(sl => sl.locationId === filters.location);
  };

  const getFilteredVenues = () => {
    if (filters.sublocation === 'all') return allData.venues;
    
    // Find all venue IDs associated with the selected sublocation
    const slvRelations = allData.slvRelations || [];
    const venueIds = slvRelations
      .filter(rel => rel.subLocationId === filters.sublocation)
      .map(rel => rel.venueId);
    
    return allData.venues.filter(v => venueIds.includes(v._id));
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    console.log('Filter change:', key, value); // ← Add this
    const newFilters = { ...filters, [key]: value };
    
    // Reset dependent filters when parent changes
    if (key === 'customer') {
      newFilters.location = 'all';
      newFilters.sublocation = 'all';
      newFilters.venue = 'all';
    } else if (key === 'location') {
      newFilters.sublocation = 'all';
      newFilters.venue = 'all';
    } else if (key === 'sublocation') {
      newFilters.venue = 'all';
    }
    
    setFilters(newFilters);
    onFilterChange(newFilters)
  };

  const handleReset = () => {
    const resetFilters = {
      customer: 'all',
      location: 'all',
      sublocation: 'all',
      venue: 'all',
    };
    setFilters(resetFilters);
    // Force immediate notification to parent
    onFilterChange(resetFilters);
  };

  if (!isOpen) return null;

  // Determine if dropdowns should be disabled
  const isLocationDisabled = filters.customer === 'all';
  const isSublocationDisabled = filters.location === 'all';
  const isVenueDisabled = filters.sublocation === 'all';

  const filteredLocations = getFilteredLocations();
  const filteredSublocations = getFilteredSublocations();
  const filteredVenues = getFilteredVenues();

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Filter Panel */}
      <div className="fixed top-20 right-6 z-40 w-96 transform transition-all duration-300 ease-out">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50">
          {/* Header with Gradient */}
          <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-5">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Filter className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg tracking-tight">
                    Filter Graph
                  </h3>
                  {activeCount > 0 && (
                    <p className="text-blue-100 text-xs mt-0.5">
                      {activeCount} {activeCount === 1 ? 'filter' : 'filters'} active
                    </p>
                  )}
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200 group"
              >
                <X className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="p-6 space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto">
            {/* Customer Filter */}
            <div className="space-y-2 animate-slide-in" style={{ animationDelay: '0ms' }}>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Building2 className="w-4 h-4 text-blue-400" />
                Customer
              </label>
              <div className="relative">
                <select
                  value={filters.customer}
                  onChange={(e) => handleFilterChange('customer', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                           appearance-none cursor-pointer transition-all duration-200 hover:bg-slate-800/70
                           backdrop-blur-sm"
                >
                  <option value="all" className="bg-slate-800">All Customers</option>
                  {allData.customers.map((c: any) => (
                    <option key={c._id} value={c._id} className="bg-slate-800">
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Location Filter */}
            <div 
              className={`space-y-2 animate-slide-in transition-opacity duration-300 ${
                isLocationDisabled ? 'opacity-50' : 'opacity-100'
              }`}
              style={{ animationDelay: '100ms' }}
            >
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <MapPin className="w-4 h-4 text-green-400" />
                Location
                {isLocationDisabled && (
                  <span className="text-xs text-slate-500">(select customer first)</span>
                )}
              </label>
              <div className="relative">
                <select
                  value={filters.location}
                  onChange={(e) => handleFilterChange('location', e.target.value)}
                  disabled={isLocationDisabled}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white 
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent 
                           appearance-none cursor-pointer transition-all duration-200 hover:bg-slate-800/70
                           disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur-sm"
                >
                  <option value="all" className="bg-slate-800">All Locations</option>
                  {filteredLocations.map((l: any) => (
                    <option key={l._id} value={l._id} className="bg-slate-800">
                      {l.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
              {!isLocationDisabled && filteredLocations.length === 0 && (
                <p className="text-xs text-yellow-400 flex items-center gap-1">
                  ⚠️ No locations found for this customer
                </p>
              )}
            </div>

            {/* SubLocation Filter */}
            <div 
              className={`space-y-2 animate-slide-in transition-opacity duration-300 ${
                isSublocationDisabled ? 'opacity-50' : 'opacity-100'
              }`}
              style={{ animationDelay: '200ms' }}
            >
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Layers className="w-4 h-4 text-orange-400" />
                Sub-Location
                {isSublocationDisabled && (
                  <span className="text-xs text-slate-500">(select location first)</span>
                )}
              </label>
              <div className="relative">
                <select
                  value={filters.sublocation}
                  onChange={(e) => handleFilterChange('sublocation', e.target.value)}
                  disabled={isSublocationDisabled}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white 
                           focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent 
                           appearance-none cursor-pointer transition-all duration-200 hover:bg-slate-800/70
                           disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur-sm"
                >
                  <option value="all" className="bg-slate-800">All Sub-Locations</option>
                  {filteredSublocations.map((sl: any) => (
                    <option key={sl._id} value={sl._id} className="bg-slate-800">
                      {sl.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
              {!isSublocationDisabled && filteredSublocations.length === 0 && (
                <p className="text-xs text-yellow-400 flex items-center gap-1">
                  ⚠️ No sub-locations found for this location
                </p>
              )}
            </div>

            {/* Venue Filter */}
            <div 
              className={`space-y-2 animate-slide-in transition-opacity duration-300 ${
                isVenueDisabled ? 'opacity-50' : 'opacity-100'
              }`}
              style={{ animationDelay: '300ms' }}
            >
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Home className="w-4 h-4 text-purple-400" />
                Venue
                {isVenueDisabled && (
                  <span className="text-xs text-slate-500">(select sub-location first)</span>
                )}
              </label>
              <div className="relative">
                <select
                  value={filters.venue}
                  onChange={(e) => handleFilterChange('venue', e.target.value)}
                  disabled={isVenueDisabled}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white 
                           focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                           appearance-none cursor-pointer transition-all duration-200 hover:bg-slate-800/70
                           disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur-sm"
                >
                  <option value="all" className="bg-slate-800">All Venues</option>
                  {filteredVenues.map((v: any) => (
                    <option key={v._id} value={v._id} className="bg-slate-800">
                      {v.name} ({v.venueType})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
              {!isVenueDisabled && filteredVenues.length === 0 && (
                <p className="text-xs text-yellow-400 flex items-center gap-1">
                  ⚠️ No venues found for this sub-location
                </p>
              )}
            </div>

            {/* Active Filters Summary */}
            {activeCount > 0 && (
              <div className="mt-6 p-4 bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl border border-blue-700/30 animate-fade-in">
                <h4 className="text-xs font-semibold text-blue-300 mb-2">Active Filters:</h4>
                <div className="space-y-1.5">
                  {filters.customer !== 'all' && (
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      <span>Customer: {allData.customers.find(c => c._id === filters.customer)?.name || filters.customer}</span>
                    </div>
                  )}
                  {filters.location !== 'all' && (
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      <span>Location: {allData.locations.find(l => l._id === filters.location)?.name || filters.location}</span>
                    </div>
                  )}
                  {filters.sublocation !== 'all' && (
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                      <span>Sub-Location: {allData.sublocations.find(sl => sl._id === filters.sublocation)?.label || filters.sublocation}</span>
                    </div>
                  )}
                  {filters.venue !== 'all' && (
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                      <span>Venue: {allData.venues.find(v => v._id === filters.venue)?.name || filters.venue}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-900/50 border-t border-slate-700/50 flex gap-3">
            <button
              onClick={handleReset}
              disabled={activeCount === 0}
              className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl 
                       transition-all duration-200 font-medium text-sm disabled:opacity-50 
                       disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              Reset All
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 
                       hover:from-blue-700 hover:to-purple-700 text-white rounded-xl 
                       transition-all duration-200 font-medium text-sm shadow-lg 
                       hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-slide-in {
          animation: slide-in 0.4s ease-out forwards;
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }

        /* Custom scrollbar */
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }

        .overflow-y-auto::-webkit-scrollbar-track {
          background: rgba(51, 65, 85, 0.3);
          border-radius: 10px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.5);
          border-radius: 10px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.7);
        }
      `}</style>
    </>
  );
}
