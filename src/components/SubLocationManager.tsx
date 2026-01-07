'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';

interface SubLocation {
  _id: string;
  label: string;
  description?: string;
  allocatedCapacity?: number;
}

interface SubLocationManagerProps {
  locationId: string;
  locationCapacity?: number;
  onRefresh?: () => void;
}

export default function SubLocationManager({
  locationId,
  locationCapacity,
  onRefresh,
}: SubLocationManagerProps) {
  const [sublocations, setSublocations] = useState<SubLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState({
    label: '',
    description: '',
    allocatedCapacity: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadSubLocations();
  }, [locationId]);

  const loadSubLocations = async () => {
    try {
      const response = await fetch(`/api/sublocations?locationId=${locationId}`);
      const data = await response.json();
      setSublocations(data);
    } catch (err) {
      console.error('Failed to load sublocations:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTotalAllocated = () => {
    return sublocations.reduce((sum, sl) => {
      if (editingId === sl._id) return sum;
      return sum + (sl.allocatedCapacity || 0);
    }, 0);
  };

  const validateCapacity = (newCapacity: number): boolean => {
    if (!locationCapacity) return true;
    
    const total = getTotalAllocated() + newCapacity;
    if (total > locationCapacity) {
      setError(`Total capacity (${total}) exceeds location capacity (${locationCapacity})`);
      return false;
    }
    setError('');
    return true;
  };

  const handleAdd = async () => {
    const capacity = parseInt(formData.allocatedCapacity) || 0;
    if (!validateCapacity(capacity)) return;

    try {
      const response = await fetch('/api/sublocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          label: formData.label,
          description: formData.description,
          allocatedCapacity: capacity,
        }),
      });

      if (!response.ok) throw new Error('Failed to create');

      setFormData({ label: '', description: '', allocatedCapacity: '' });
      setAdding(false);
      loadSubLocations();
      onRefresh?.();
    } catch (err) {
      setError('Failed to create sub-location');
    }
  };

  const handleUpdate = async (id: string) => {
    const capacity = parseInt(formData.allocatedCapacity) || 0;
    if (!validateCapacity(capacity)) return;

    try {
      const response = await fetch(`/api/sublocations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: formData.label,
          description: formData.description,
          allocatedCapacity: capacity,
        }),
      });

      if (!response.ok) throw new Error('Failed to update');

      setEditingId(null);
      setFormData({ label: '', description: '', allocatedCapacity: '' });
      loadSubLocations();
      onRefresh?.();
    } catch (err) {
      setError('Failed to update sub-location');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this sub-location?')) return;

    try {
      const response = await fetch(`/api/sublocations/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      loadSubLocations();
      onRefresh?.();
    } catch (err) {
      setError('Failed to delete sub-location');
    }
  };

  const startEdit = (sl: SubLocation) => {
    setEditingId(sl._id);
    setFormData({
      label: sl.label,
      description: sl.description || '',
      allocatedCapacity: sl.allocatedCapacity?.toString() || '',
    });
    setAdding(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAdding(false);
    setFormData({ label: '', description: '', allocatedCapacity: '' });
    setError('');
  };

  if (loading) {
    return <div className="text-gray-600">Loading sub-locations...</div>;
  }

  const totalAllocated = getTotalAllocated();
  const remainingCapacity = locationCapacity ? locationCapacity - totalAllocated : null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">
          Sub-Locations
        </h3>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          <Plus className="w-4 h-4" />
          Add Sub-Location
        </button>
      </div>

      {/* Capacity Summary */}
      {locationCapacity && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Location Capacity:</span>
            <span className="font-semibold text-gray-900">{locationCapacity}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Allocated:</span>
            <span className="font-semibold text-gray-900">{totalAllocated}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Remaining:</span>
            <span className={`font-semibold ${remainingCapacity! < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {remainingCapacity}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Add Form */}
      {adding && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-3">New Sub-Location</h4>
          <div className="space-y-3">
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Label (e.g., LOT A, Garage X)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
            <input
              type="number"
              value={formData.allocatedCapacity}
              onChange={(e) => setFormData({ ...formData, allocatedCapacity: e.target.value })}
              placeholder="Allocated Capacity"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SubLocations List */}
      <div className="space-y-2">
        {sublocations.map((sl) => (
          <div
            key={sl._id}
            className="border border-gray-200 rounded-lg p-3 bg-white"
          >
            {editingId === sl._id ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
                <input
                  type="number"
                  value={formData.allocatedCapacity}
                  onChange={(e) => setFormData({ ...formData, allocatedCapacity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(sl._id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    <Save className="w-4 h-4" />
                    Update
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-semibold text-orange-600">{sl.label}</h4>
                  {sl.description && (
                    <p className="text-sm text-gray-600">{sl.description}</p>
                  )}
                  {sl.allocatedCapacity !== undefined && (
                    <p className="text-sm text-gray-500">Capacity: {sl.allocatedCapacity}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(sl)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(sl._id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {sublocations.length === 0 && !adding && (
        <p className="text-gray-500 text-center py-4">No sub-locations yet</p>
      )}
    </div>
  );
}
