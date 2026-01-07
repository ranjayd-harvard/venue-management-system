'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface VenueFormProps {
  initialData?: {
    _id?: string;
    name: string;
    description?: string;
    capacity?: number;
    venueType: string;
  };
  onSuccess?: () => void;
}

export default function VenueForm({ initialData, onSuccess }: VenueFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    capacity: initialData?.capacity?.toString() || '',
    venueType: initialData?.venueType || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const venueTypes = [
    'Ballroom',
    'Conference',
    'Meeting Room',
    'Theater',
    'Banquet',
    'Outdoor',
    'Auditorium',
    'Exhibition Hall',
    'Other'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = initialData?._id 
        ? `/api/venues/${initialData._id}` 
        : '/api/venues';
      
      const method = initialData?._id ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save venue');
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/venues');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          Venue Name *
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
        />
      </div>

      <div>
        <label htmlFor="venueType" className="block text-sm font-medium text-gray-700 mb-2">
          Venue Type *
        </label>
        <select
          id="venueType"
          required
          value={formData.venueType}
          onChange={(e) => setFormData({ ...formData, venueType: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
        >
          <option value="">Select a type</option>
          {venueTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-2">
          Capacity
        </label>
        <input
          type="number"
          id="capacity"
          min="0"
          value={formData.capacity}
          onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
        />
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : initialData?._id ? 'Update Venue' : 'Create Venue'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
