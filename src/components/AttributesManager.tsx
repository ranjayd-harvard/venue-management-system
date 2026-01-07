'use client';

import { useState } from 'react';
import { Plus, X, Save } from 'lucide-react';

interface Attribute {
  key: string;
  value: string;
}

interface AttributesManagerProps {
  attributes: Attribute[];
  inheritedAttributes?: Attribute[];
  onSave: (attributes: Attribute[]) => Promise<void>;
  entityName: string;
}

export default function AttributesManager({
  attributes,
  inheritedAttributes = [],
  onSave,
  entityName,
}: AttributesManagerProps) {
  const [localAttributes, setLocalAttributes] = useState<Attribute[]>(attributes);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const addAttribute = () => {
    if (!newKey.trim() || !newValue.trim()) return;

    const updated = [...localAttributes, { key: newKey.trim(), value: newValue.trim() }];
    setLocalAttributes(updated);
    setNewKey('');
    setNewValue('');
  };

  const removeAttribute = (index: number) => {
    const updated = localAttributes.filter((_, i) => i !== index);
    setLocalAttributes(updated);
  };

  const updateAttribute = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...localAttributes];
    updated[index][field] = value;
    setLocalAttributes(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(localAttributes);
    } finally {
      setSaving(false);
    }
  };

  const isOverriding = (key: string) => {
    return inheritedAttributes.some(attr => attr.key === key);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">
          Attributes for {entityName}
        </h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Attributes'}
        </button>
      </div>

      {/* Inherited Attributes (Read-only) */}
      {inheritedAttributes.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">
            Inherited from Parent
          </h4>
          <div className="space-y-2">
            {inheritedAttributes.map((attr, index) => (
              <div
                key={index}
                className="flex gap-2 items-center text-sm"
              >
                <input
                  type="text"
                  value={attr.key}
                  disabled
                  className="flex-1 px-3 py-1 border border-blue-300 rounded bg-blue-100 text-gray-600"
                />
                <span className="text-gray-400">=</span>
                <input
                  type="text"
                  value={attr.value}
                  disabled
                  className="flex-1 px-3 py-1 border border-blue-300 rounded bg-blue-100 text-gray-600"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Own Attributes */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-800">Own Attributes</h4>
        {localAttributes.length === 0 ? (
          <p className="text-sm text-gray-500">No custom attributes defined</p>
        ) : (
          localAttributes.map((attr, index) => (
            <div
              key={index}
              className={`flex gap-2 items-center ${
                isOverriding(attr.key) ? 'bg-yellow-50 border border-yellow-300 rounded-lg p-2' : ''
              }`}
            >
              {isOverriding(attr.key) && (
                <span className="text-xs text-yellow-700 font-medium">Override:</span>
              )}
              <input
                type="text"
                value={attr.key}
                onChange={(e) => updateAttribute(index, 'key', e.target.value)}
                placeholder="Key"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400">=</span>
              <input
                type="text"
                value={attr.value}
                onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                placeholder="Value"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => removeAttribute(index)}
                className="p-2 text-red-600 hover:bg-red-50 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add New Attribute */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">Add New Attribute</h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Key (e.g., timezone, access_level)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500"
            onKeyPress={(e) => e.key === 'Enter' && addAttribute()}
          />
          <span className="text-gray-400 self-center">=</span>
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Value (e.g., EST, Public)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500"
            onKeyPress={(e) => e.key === 'Enter' && addAttribute()}
          />
          <button
            onClick={addAttribute}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
