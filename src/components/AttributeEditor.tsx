'use client';

import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';

interface Attribute {
  key: string;
  value: string;
  source?: string;
}

interface AttributeEditorProps {
  attributes: Attribute[];
  type: 'inherited' | 'own' | 'overridden';
  canEdit: boolean;
  onSave?: (attributes: Attribute[]) => void;
  onDelete?: (index: number) => void;
}

export default function AttributeEditor({
  attributes,
  type,
  canEdit,
  onSave,
  onDelete
}: AttributeEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const startEdit = (index: number, attr: Attribute) => {
    setEditingIndex(index);
    setEditKey(attr.key);
    setEditValue(attr.value);
  };

  const saveEdit = () => {
    if (editingIndex !== null && onSave) {
      const updated = [...attributes];
      updated[editingIndex] = { key: editKey, value: editValue };
      onSave(updated);
      setEditingIndex(null);
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditKey('');
    setEditValue('');
  };

  const addAttribute = () => {
    if (newKey.trim() && newValue.trim() && onSave) {
      const updated = [...attributes, { key: newKey.trim(), value: newValue.trim() }];
      onSave(updated);
      setNewKey('');
      setNewValue('');
      setIsAdding(false);
    }
  };

  const deleteAttribute = (index: number) => {
    if (confirm('Are you sure you want to delete this attribute?')) {
      if (onDelete) {
        onDelete(index);
      }
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case 'inherited':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          title: 'text-blue-700',
          badge: 'bg-blue-100 text-blue-600',
          dot: 'bg-blue-500',
        };
      case 'own':
        return {
          bg: 'bg-white',
          border: 'border-gray-200',
          title: 'text-green-700',
          badge: 'bg-green-100 text-green-600',
          dot: 'bg-green-500',
        };
      case 'overridden':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-300',
          title: 'text-yellow-700',
          badge: 'bg-yellow-100 text-yellow-600',
          dot: 'bg-yellow-500',
        };
    }
  };

  const colors = getColorClasses();

  if (attributes.length === 0 && !isAdding) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className={`font-semibold ${colors.title} flex items-center gap-2`}>
          <div className={`w-3 h-3 rounded-full ${colors.dot}`}></div>
          {type === 'inherited' && 'Inherited Attributes'}
          {type === 'own' && 'Own Attributes'}
          {type === 'overridden' && 'Overridden Attributes'}
          ({attributes.length})
        </h3>
        {canEdit && type === 'own' && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        )}
      </div>

      <div className="space-y-2">
        {attributes.map((attr, idx) => (
          <div key={idx} className={`p-3 ${colors.bg} rounded-lg border ${colors.border} transition-all`}>
            {editingIndex === idx ? (
              // Edit mode - FIXED: Added text-gray-900 and bg-white
              <div className="space-y-2">
                <input
                  type="text"
                  value={editKey}
                  onChange={(e) => setEditKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Key"
                  autoFocus
                />
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  placeholder="Value"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={!editKey.trim() || !editValue.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Check className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm transition-all"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // View mode
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{attr.key}</span>
                    {attr.source && (
                      <span className={`text-xs ${colors.badge} px-2 py-1 rounded whitespace-nowrap`}>
                        from {attr.source}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 mt-1 break-words">{attr.value}</p>
                </div>
                {canEdit && type === 'own' && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(idx, attr)}
                      className="p-1.5 hover:bg-blue-100 rounded transition-colors"
                      title="Edit attribute"
                    >
                      <Edit2 className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      onClick={() => deleteAttribute(idx)}
                      className="p-1.5 hover:bg-red-100 rounded transition-colors"
                      title="Delete attribute"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add new attribute form - FIXED: Added text-gray-900 and bg-white */}
        {isAdding && canEdit && type === 'own' && (
          <div className="p-4 bg-green-50 rounded-lg border-2 border-green-300 animate-fade-in">
            <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add New Attribute
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., Industry, Region, Type"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                <textarea
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  placeholder="e.g., Technology, North America, Premium"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addAttribute}
                  disabled={!newKey.trim() || !newValue.trim()}
                  className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                >
                  <Check className="w-4 h-4" />
                  Add Attribute
                </button>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewKey('');
                    setNewValue('');
                  }}
                  className="flex items-center gap-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm font-medium transition-all"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
