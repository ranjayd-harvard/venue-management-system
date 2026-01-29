'use client';

import { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Plus, Edit, Trash2, Power, DollarSign } from 'lucide-react';
import CreateEventModal from '@/components/CreateEventModal';
import EditEventModal from '@/components/EditEventModal';

interface Event {
  _id: string;
  name: string;
  description?: string;
  eventAssociatedTo?: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'VENUE';
  venueId?: string;
  subLocationId?: string;
  locationId?: string;
  customerId?: string;
  startDate: string;
  endDate: string;
  gracePeriodBefore?: number;
  gracePeriodAfter?: number;
  attendees?: number;
  defaultHourlyRate?: number;
  customPriority?: number;
  timezone?: string;
  isActive: boolean;
  customer?: { _id: string; name: string };
  location?: { _id: string; name: string; city: string };
  sublocation?: { _id: string; label: string };
  venue?: { _id: string; name: string; capacity?: number; venueType: string };
}

interface Customer {
  _id: string;
  name: string;
}

interface Location {
  _id: string;
  name: string;
  city: string;
}

interface SubLocation {
  _id: string;
  label: string;
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [ratesheetIds, setRatesheetIds] = useState<Record<string, string>>({});

  // Filter states
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'upcoming'>('all');

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load events based on filter
      let eventsUrl = '/api/events';
      if (filterStatus === 'active') {
        eventsUrl = '/api/events?filter=active';
      } else if (filterStatus === 'upcoming') {
        eventsUrl = '/api/events?filter=upcoming';
      }

      const [eventsRes, customersRes] = await Promise.all([
        fetch(eventsUrl),
        fetch('/api/customers'),
      ]);

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        const firstEvent = eventsData[0];
        console.log('[Events] First event keys:', Object.keys(firstEvent));
        console.log('[Events] Has venue?', 'venue' in firstEvent, firstEvent.venue);
        console.log('[Events] Has customer?', 'customer' in firstEvent, firstEvent.customer);
        console.log('[Events] Has venueId?', 'venueId' in firstEvent, firstEvent.venueId);
        setEvents(eventsData);

        // Load ratesheet IDs for all events
        const ratesheetMap: Record<string, string> = {};
        await Promise.all(
          eventsData.map(async (event: Event) => {
            try {
              const res = await fetch(`/api/events/${event._id}/ratesheet`);
              if (res.ok) {
                const ratesheet = await res.json();
                ratesheetMap[event._id] = ratesheet._id;
              }
            } catch (err) {
              // Ignore errors for individual ratesheet fetches
            }
          })
        );
        setRatesheetIds(ratesheetMap);
      }

      if (customersRes.ok) {
        const customersData = await customersRes.json();
        setCustomers(customersData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (eventId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) throw new Error('Failed to toggle status');
      await loadData();
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('Failed to toggle event status');
    }
  };

  const deleteEvent = async (eventId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`)) return;

    try {
      const response = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete event');
      await loadData();
      alert('Event deleted successfully');
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  };

  const getStatusBadge = (event: Event) => {
    const now = new Date();
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);

    if (!event.isActive) {
      return { text: 'Inactive', color: 'bg-gray-100 text-gray-800 border-gray-300' };
    }

    if (now >= start && now <= end) {
      return { text: 'Active', color: 'bg-green-100 text-green-800 border-green-300' };
    }

    if (now < start) {
      return { text: 'Upcoming', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    }

    return { text: 'Completed', color: 'bg-purple-100 text-purple-800 border-purple-300' };
  };

  const getAssociationBadge = (eventAssociatedTo?: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'VENUE') => {
    const badges = {
      CUSTOMER: { text: '👤 Customer', color: 'bg-blue-50 text-blue-700 border-blue-200' },
      LOCATION: { text: '📍 Location', color: 'bg-green-50 text-green-700 border-green-200' },
      SUBLOCATION: { text: '🏢 Sublocation', color: 'bg-orange-50 text-orange-700 border-orange-200' },
      VENUE: { text: '🏛️ Venue', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    };
    return eventAssociatedTo ? badges[eventAssociatedTo] : null;
  };

  const getCounts = () => ({
    all: events.length,
    active: events.filter(e => {
      const now = new Date();
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      return e.isActive && now >= start && now <= end;
    }).length,
    upcoming: events.filter(e => {
      const now = new Date();
      const start = new Date(e.startDate);
      return e.isActive && now < start;
    }).length,
  });

  const counts = getCounts();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">Event Management</h1>
              <p className="text-pink-100 text-lg">Manage events and their pricing configurations</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-white text-pink-600 px-6 py-3 rounded-xl font-semibold hover:bg-pink-50 transition-all shadow-lg flex items-center gap-2"
            >
              <Plus size={20} />
              Create Event
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-2 mb-6 flex gap-2">
          {[
            { key: 'all', label: 'All Events', count: counts.all },
            { key: 'active', label: 'Active Now', count: counts.active },
            { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key as any)}
              className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
                filterStatus === tab.key
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white bg-opacity-20">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Events List */}
        {events.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Events Found</h3>
            <p className="text-gray-600 mb-6">
              {filterStatus === 'all'
                ? 'Create your first event to get started'
                : `No ${filterStatus} events found`}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-pink-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-700 hover:to-purple-700 transition-all"
            >
              Create Event
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {events.map((event) => {
              const statusBadge = getStatusBadge(event);
              const associationBadge = getAssociationBadge(event.eventAssociatedTo);

              return (
                <div
                  key={event._id}
                  className={`bg-white rounded-xl shadow-lg overflow-hidden border-l-4 border-pink-500 transition-all hover:shadow-xl ${
                    !event.isActive ? 'opacity-60' : ''
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{event.name}</h3>
                        {event.description && (
                          <p className="text-sm text-gray-600">{event.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${statusBadge.color}`}>
                          {statusBadge.text}
                        </div>
                        {associationBadge && (
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${associationBadge.color}`}>
                            {associationBadge.text}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Entity Hierarchy */}
                    {(event.customer || event.location || event.sublocation) && (
                      <div className="text-sm text-gray-600 mb-3 flex items-center gap-2">
                        <MapPin size={14} className="text-gray-400" />
                        {event.customer && (
                          <span className="font-medium text-blue-600">{event.customer.name}</span>
                        )}
                        {event.location && (
                          <>
                            <span className="text-gray-400">→</span>
                            <span className="font-medium text-green-600">
                              {event.location.name} ({event.location.city})
                            </span>
                          </>
                        )}
                        {event.sublocation && (
                          <>
                            <span className="text-gray-400">→</span>
                            <span className="font-medium text-orange-600">{event.sublocation.label}</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Venue Information */}
                    {event.venue && (
                      <div className="text-sm text-gray-600 mb-3 flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg">
                        <span className="text-purple-600">🏛️</span>
                        <span className="font-semibold text-purple-800">{event.venue.name}</span>
                        {event.venue.capacity && (
                          <span className="text-purple-600 text-xs">• {event.venue.capacity} capacity</span>
                        )}
                        <span className="text-purple-600 text-xs">• {event.venue.venueType}</span>
                      </div>
                    )}

                    {/* Event Details Grid */}
                    <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-100 pt-4">
                      <div>
                        <span className="text-gray-500 flex items-center gap-1">
                          <Calendar size={14} />
                          Start Date:
                        </span>
                        <p className="font-semibold text-gray-900">
                          {new Date(event.startDate).toLocaleDateString()} {new Date(event.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 flex items-center gap-1">
                          <Calendar size={14} />
                          End Date:
                        </span>
                        <p className="font-semibold text-gray-900">
                          {new Date(event.endDate).toLocaleDateString()} {new Date(event.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {event.attendees && (
                        <div>
                          <span className="text-gray-500 flex items-center gap-1">
                            <Users size={14} />
                            Attendees:
                          </span>
                          <p className="font-semibold text-gray-900">{event.attendees}</p>
                        </div>
                      )}
                      {event.defaultHourlyRate && (
                        <div>
                          <span className="text-gray-500">Default Rate:</span>
                          <p className="font-semibold text-gray-900">${event.defaultHourlyRate}/hr</p>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Priority:</span>
                        <div className="flex items-center gap-2">
                          <p className={`font-semibold ${event.customPriority ? 'text-purple-700' : 'text-gray-600'}`}>
                            {event.customPriority || 4900}
                          </p>
                          {event.customPriority && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                              Custom
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Grace Periods - Always show */}
                    <div className="border-t border-gray-100 pt-4 mt-4">
                      <span className="text-xs text-gray-500 font-semibold">Grace Periods:</span>
                      <div className="flex gap-4 mt-2">
                        <div className={`px-3 py-1 rounded-lg ${event.gracePeriodBefore ? 'bg-purple-50' : 'bg-gray-50'}`}>
                          <span className={`text-xs ${event.gracePeriodBefore ? 'text-purple-700' : 'text-gray-500'}`}>
                            Before: <span className="font-bold">{event.gracePeriodBefore || 0} min</span>
                          </span>
                        </div>
                        <div className={`px-3 py-1 rounded-lg ${event.gracePeriodAfter ? 'bg-pink-50' : 'bg-gray-50'}`}>
                          <span className={`text-xs ${event.gracePeriodAfter ? 'text-pink-700' : 'text-gray-500'}`}>
                            After: <span className="font-bold">{event.gracePeriodAfter || 0} min</span>
                          </span>
                        </div>
                      </div>

                      {/* Total Time with Grace Periods */}
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gradient-to-br from-purple-50 to-pink-50 px-3 py-2 rounded-lg">
                            <span className="text-xs text-purple-600 font-semibold">When you come:</span>
                            <p className="text-sm font-bold text-purple-900 mt-1">
                              {(() => {
                                const comeTime = new Date(event.startDate);
                                comeTime.setMinutes(comeTime.getMinutes() - (event.gracePeriodBefore || 0));
                                return comeTime.toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                });
                              })()}
                            </p>
                          </div>
                          <div className="bg-gradient-to-br from-pink-50 to-purple-50 px-3 py-2 rounded-lg">
                            <span className="text-xs text-pink-600 font-semibold">When you go:</span>
                            <p className="text-sm font-bold text-pink-900 mt-1">
                              {(() => {
                                const goTime = new Date(event.endDate);
                                goTime.setMinutes(goTime.getMinutes() + (event.gracePeriodAfter || 0));
                                return goTime.toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                });
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(event._id, event.isActive)}
                        className={`p-2 rounded-lg transition-all ${
                          event.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                        }`}
                        title={event.isActive ? 'Disable' : 'Enable'}
                      >
                        <Power size={18} />
                      </button>
                      <span className={`text-xs font-semibold ${
                        event.isActive ? 'text-green-700' : 'text-gray-500'
                      }`}>
                        {event.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {ratesheetIds[event._id] && (
                        <a
                          href={`/admin/pricing?ratesheet=${ratesheetIds[event._id]}`}
                          className="px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-lg hover:from-purple-200 hover:to-pink-200 transition-all font-medium flex items-center gap-2"
                          title="View Auto-Ratesheet"
                        >
                          <DollarSign size={16} />
                          Ratesheet
                        </a>
                      )}
                      <button
                        onClick={() => setEditingEvent(event)}
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all font-medium flex items-center gap-2"
                      >
                        <Edit size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => deleteEvent(event._id, event.name)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all font-medium flex items-center gap-2"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Event Modals */}
      <CreateEventModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          loadData();
          setShowCreateModal(false);
        }}
      />

      <EditEventModal
        isOpen={!!editingEvent}
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
        onSuccess={() => {
          loadData();
          setEditingEvent(null);
        }}
      />
    </div>
  );
}
