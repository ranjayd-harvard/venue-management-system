'use client';

import { useState, useEffect } from 'react';
import AttributesManager from './AttributesManager';
import { getInheritedAttributes } from '@/lib/attributes';

interface AttributesManagerWrapperProps {
  entityType: 'customer' | 'location' | 'sublocation' | 'venue';
  entityId: string;
  entityName: string;
}

export default function AttributesManagerWrapper({
  entityType,
  entityId,
  entityName,
}: AttributesManagerWrapperProps) {
  const [attributes, setAttributes] = useState<any[]>([]);
  const [inheritedAttributes, setInheritedAttributes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAttributes();
  }, [entityId]);

  const loadAttributes = async () => {
    try {
      // Load entity's own attributes
      const response = await fetch(`/api/${entityType}s/${entityId}`);
      const entity = await response.json();
      setAttributes(entity.attributes || []);

      // Load inherited attributes if not a customer
      if (entityType !== 'customer') {
        const inheritedResponse = await fetch(`/api/attributes/inherited?entityType=${entityType}&entityId=${entityId}`);
        const inherited = await inheritedResponse.json();
        setInheritedAttributes(inherited);
      }
    } catch (error) {
      console.error('Failed to load attributes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (newAttributes: any[]) => {
    try {
      const response = await fetch(`/api/${entityType}s/${entityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributes: newAttributes }),
      });

      if (!response.ok) throw new Error('Failed to save');

      setAttributes(newAttributes);
      alert('Attributes saved successfully!');
    } catch (error) {
      alert('Failed to save attributes');
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading attributes...</div>;
  }

  return (
    <AttributesManager
      attributes={attributes}
      inheritedAttributes={inheritedAttributes}
      onSave={handleSave}
      entityName={entityName}
    />
  );
}
