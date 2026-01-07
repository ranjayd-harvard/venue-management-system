'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SubLocationFormProps {
  locationId?: string;
  initialData?: {
    _id?: string;
    locationId: string;
    label: string;
    description?: string;
  };
  onSuccess?: () => void;
}

export default function SubLocationForm({ locationId, initialData, onSuccess }: SubLocationFormProps) {
  const router = useRouter();
  const [locations, setLocations] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    locationId: initialData?.locationId || locationId || '',
    label: initialData?.label || '',
    description: initialData?.description || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/locations')
      .then(res => res.json())
      .then(data => setLocations(data))
      .catch(err => console.error('Failed to load locations:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = initialData?._id 
        ? `/api/sublocations/${initialData._id}` 
        : '/api/sublocations';
      
      const method = initialData?._id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save sub-location');
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/locations/${formData.locationId}`);
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
        <label htmlFor="locationId" className="block text-sm font-medium text-gray-700 mb-2">
          Location *
        </label>
        <select
          id="locationId"
          required
          value={formData.locationId}
          onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
          disabled={!!locationId}
        >
          <option value="">Select a location</option>
          {locations.map((location) => (
            <option key={location._id} value={location._id}>
              {location.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="label" className="block text-sm font-medium text-gray-700 mb-2">
          Label * (e.g., "LOT A", "Garage X")
        </label>
        <input
          type="text"
          id="label"
          required
          placeholder="LOT A, Garage X, Section B, etc."
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          placeholder="Additional details about this sub-location..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
        />
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : initialData?._id ? 'Update Sub-Location' : 'Create Sub-Location'}
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
