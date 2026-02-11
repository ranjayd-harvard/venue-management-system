'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, Building2, MapPin, Layers, Save, X, ChevronUp } from 'lucide-react';
import AttributesManager from './AttributesManager';
import OperatingHoursManager from './OperatingHoursManager';
import {
  ResolvedDaySchedule,
  ResolvedBlackout,
  DayOfWeekKey,
  TimeSlot,
  Blackout,
} from '@/models/types';
import { DAYS_OF_WEEK } from '@/lib/operating-hours';

interface TreeNode {
  id: string;
  type: 'customer' | 'location' | 'sublocation';
  name: string;
  data: any;
  children?: TreeNode[];
  expanded?: boolean;
  parentId?: string;
}

interface AttributeWithSource {
  key: string;
  value: string;
  source: string;
  overridden: boolean;
}

export default function HierarchyManager() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [addingChild, setAddingChild] = useState<{ parentId: string; type: string } | null>(null);
  const [newChildName, setNewChildName] = useState('');
  const [guideExpanded, setGuideExpanded] = useState(false);

  useEffect(() => {
    loadHierarchy();
  }, []);

  const loadHierarchy = async () => {
    setLoading(true);
    try {
      const [customers, locations, sublocations] = await Promise.all([
        fetch('/api/customers').then(r => r.json()),
        fetch('/api/locations').then(r => r.json()),
        fetch('/api/sublocations').then(r => r.json()),
      ]);

      // Preserve expanded state from current tree
      const expandedIds = new Set<string>();
      const collectExpanded = (nodes: TreeNode[]) => {
        nodes.forEach(node => {
          if (node.expanded) expandedIds.add(node.id);
          if (node.children) collectExpanded(node.children);
        });
      };
      collectExpanded(tree);

      const treeData: TreeNode[] = customers.map((customer: any) => {
        const customerLocations = locations.filter((l: any) => l.customerId === customer._id);

        return {
          id: customer._id,
          type: 'customer' as const,
          name: customer.name,
          data: customer,
          expanded: expandedIds.has(customer._id),
          children: customerLocations.map((location: any) => {
            const locationSublocations = sublocations.filter((sl: any) => sl.locationId === location._id);

            return {
              id: location._id,
              type: 'location' as const,
              name: location.name,
              data: location,
              expanded: expandedIds.has(location._id),
              parentId: customer._id,
              children: locationSublocations.map((sublocation: any) => ({
                id: sublocation._id,
                type: 'sublocation' as const,
                name: sublocation.label,
                data: sublocation,
                children: [],
                parentId: location._id,
              })),
            };
          }),
        };
      });

      setTree(treeData);

      // Update selectedNode with fresh data if it exists
      if (selectedNode) {
        const findNode = (nodes: TreeNode[], id: string): TreeNode | null => {
          for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
              const found = findNode(node.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        const updatedNode = findNode(treeData, selectedNode.id);
        if (updatedNode) {
          setSelectedNode(updatedNode);
        }
      }
    } catch (error) {
      console.error('Failed to load hierarchy:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    const updateTree = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, expanded: !node.expanded };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };
    setTree(updateTree(tree));
  };

  const selectNode = (node: TreeNode) => {
    setSelectedNode(node);
    setEditingNode(null);
    setAddingChild(null);
  };

  const startEdit = (node: TreeNode) => {
    setEditingNode(node.id);
    setEditName(node.name);
  };

  const saveEdit = async () => {
    if (!editingNode || !selectedNode) return;

    try {
      const endpoint = `/api/${selectedNode.type}s/${editingNode}`;
      const updateField = selectedNode.type === 'sublocation' ? 'label' : 'name';
      
      await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [updateField]: editName }),
      });

      setEditingNode(null);
      loadHierarchy();
    } catch (error) {
      alert('Failed to update');
    }
  };

  const deleteNode = async (node: TreeNode) => {
    if (!confirm(`Delete ${node.name}? This will delete all children as well.`)) return;

    try {
      await fetch(`/api/${node.type}s/${node.id}`, { method: 'DELETE' });
      loadHierarchy();
      if (selectedNode?.id === node.id) {
        setSelectedNode(null);
      }
    } catch (error) {
      alert('Failed to delete');
    }
  };

  const startAddChild = (parentNode: TreeNode) => {
    const childType = parentNode.type === 'customer' ? 'location' : 'sublocation';
    setAddingChild({ parentId: parentNode.id, type: childType });
    setNewChildName('');
  };

  const saveNewChild = async () => {
    if (!addingChild || !newChildName.trim()) return;

    try {
      const { parentId, type } = addingChild;
      
      if (type === 'location') {
        const response = await fetch('/api/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: parentId,
            name: newChildName,
            address: 'TBD',
            city: 'TBD',
            state: 'TBD',
            zipCode: '00000',
            country: 'USA',
          }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          alert(error.error || 'Failed to create location');
          return;
        }
      } else {
        const response = await fetch('/api/sublocations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationId: parentId,
            label: newChildName,
          }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          alert(error.error || 'Failed to create sublocation');
          return;
        }
      }

      setAddingChild(null);
      loadHierarchy();
    } catch (error) {
      alert('Failed to create');
    }
  };

  const getBreadcrumb = (node: TreeNode): string[] => {
    const findPath = (nodes: TreeNode[], targetId: string, path: string[] = []): string[] | null => {
      for (const n of nodes) {
        if (n.id === targetId) {
          return [...path, n.name];
        }
        if (n.children) {
          const found = findPath(n.children, targetId, [...path, n.name]);
          if (found) return found;
        }
      }
      return null;
    };

    const fullPath = findPath(tree, node.id);
    return fullPath || [node.name];
  };

  const getAllInheritedAttributes = (node: TreeNode): AttributeWithSource[] => {
    const attributeMap = new Map<string, { value: string; source: string }>();
    
    // Find parent chain
    const findParentChain = (nodes: TreeNode[], targetId: string): TreeNode[] => {
      for (const n of nodes) {
        if (n.id === targetId) {
          return [n];
        }
        if (n.children) {
          const found = findParentChain(n.children, targetId);
          if (found.length > 0) {
            return [n, ...found];
          }
        }
      }
      return [];
    };

    const chain = findParentChain(tree, node.id);
    
    // Build attribute map from parent to child
    chain.forEach((ancestor) => {
      const attrs = ancestor.data.attributes || [];
      const sourceName = ancestor.name;
      
      attrs.forEach((attr: any) => {
        attributeMap.set(attr.key, {
          value: attr.value,
          source: sourceName,
        });
      });
    });

    // Convert to array with override information
    const nodeAttrs = node.data.attributes || [];
    const nodeAttrKeys = new Set(nodeAttrs.map((a: any) => a.key));

    return Array.from(attributeMap.entries()).map(([key, { value, source }]) => ({
      key,
      value,
      source,
      overridden: nodeAttrKeys.has(key) && source !== node.name,
    }));
  };

  // Get inherited operating hours for a node
  const getInheritedOperatingHours = (node: TreeNode): {
    schedule: ResolvedDaySchedule[];
    blackouts: ResolvedBlackout[];
  } => {
    // Find parent chain
    const findParentChain = (nodes: TreeNode[], targetId: string): TreeNode[] => {
      for (const n of nodes) {
        if (n.id === targetId) {
          return [n];
        }
        if (n.children) {
          const found = findParentChain(n.children, targetId);
          if (found.length > 0) {
            return [n, ...found];
          }
        }
      }
      return [];
    };

    const chain = findParentChain(tree, node.id);

    // Track which entity defined each day's schedule
    const daySourceMap = new Map<DayOfWeekKey, { slots: TimeSlot[]; source: string }>();

    // Build merged schedule tracking sources
    for (const entity of chain) {
      const schedule = entity.data.operatingHours?.schedule;
      if (!schedule) continue;

      for (const day of DAYS_OF_WEEK) {
        if (schedule[day] !== undefined) {
          daySourceMap.set(day, {
            slots: schedule[day] || [],
            source: entity.name,
          });
        }
      }
    }

    // Get the target entity's own schedule
    const targetSchedule = node.data.operatingHours?.schedule || {};

    // Build resolved day schedules
    const resolvedSchedule: ResolvedDaySchedule[] = DAYS_OF_WEEK.map((day) => {
      const resolved = daySourceMap.get(day);
      const isOwn = targetSchedule[day] !== undefined;
      const hasParentDefinition = resolved && resolved.source !== node.name;

      return {
        day,
        slots: resolved?.slots || [],
        source: resolved?.source || '',
        isInherited: !isOwn && !!resolved,
        isOverride: isOwn && !!hasParentDefinition,
        isClosed: !resolved || resolved.slots.length === 0,
      };
    });

    // Build merged blackouts with source tracking
    const blackoutSourceMap = new Map<string, { blackout: Blackout; source: string }>();

    for (const entity of chain) {
      const blackouts = entity.data.operatingHours?.blackouts || [];
      for (const blackout of blackouts) {
        blackoutSourceMap.set(blackout.id, { blackout, source: entity.name });
      }
    }

    const targetBlackouts = new Set(
      (node.data.operatingHours?.blackouts || []).map((b: Blackout) => b.id)
    );

    const resolvedBlackouts: ResolvedBlackout[] = Array.from(blackoutSourceMap.values())
      .filter(({ blackout }) => !blackout.cancelled)
      .map(({ blackout, source }) => ({
        ...blackout,
        source,
        isInherited: !targetBlackouts.has(blackout.id),
      }));

    return { schedule: resolvedSchedule, blackouts: resolvedBlackouts };
  };

  const renderTree = (nodes: TreeNode[], level = 0) => {
    return nodes.map(node => (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer rounded ${
            selectedNode?.id === node.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
        >
          {node.children && node.children.length > 0 && (
            <button 
              onClick={() => toggleNode(node.id)} 
              className="p-1 hover:bg-gray-300 rounded flex-shrink-0"
            >
              {node.expanded ? 
                <ChevronDown className="w-4 h-4 text-gray-700" /> : 
                <ChevronRight className="w-4 h-4 text-gray-700" />
              }
            </button>
          )}
          
          {!node.children?.length && <div className="w-6" />}
          
          {node.type === 'customer' && <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />}
          {node.type === 'location' && <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />}
          {node.type === 'sublocation' && <Layers className="w-4 h-4 text-orange-600 flex-shrink-0" />}
          
          <span onClick={() => selectNode(node)} className="flex-1 text-sm text-gray-800 truncate">
            {node.name}
          </span>

          <div className="flex gap-1 flex-shrink-0">
            {node.type !== 'sublocation' && (
              <button
                onClick={(e) => { e.stopPropagation(); startAddChild(node); }}
                className="p-1 hover:bg-green-100 rounded"
                title="Add child"
              >
                <Plus className="w-3 h-3 text-green-600" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); selectNode(node); startEdit(node); }}
              className="p-1 hover:bg-blue-100 rounded"
              title="Rename"
            >
              <Edit2 className="w-3 h-3 text-blue-600" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deleteNode(node); }}
              className="p-1 hover:bg-red-100 rounded"
              title="Delete"
            >
              <Trash2 className="w-3 h-3 text-red-600" />
            </button>
          </div>
        </div>

        {addingChild?.parentId === node.id && (
          <div className="flex items-center gap-2 p-2 bg-green-50 rounded ml-8 mt-1">
            <input
              type="text"
              value={newChildName}
              onChange={(e) => setNewChildName(e.target.value)}
              placeholder={`New ${addingChild.type} name`}
              className="flex-1 px-2 py-1 border rounded text-sm text-gray-900"
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && saveNewChild()}
            />
            <button onClick={saveNewChild} className="p-1 bg-green-500 text-white rounded">
              <Save className="w-4 h-4" />
            </button>
            <button onClick={() => setAddingChild(null)} className="p-1 bg-gray-500 text-white rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {node.expanded && node.children && renderTree(node.children, level + 1)}
      </div>
    ));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  const allAttributes = selectedNode ? getAllInheritedAttributes(selectedNode) : [];
  const inheritedAttributes = allAttributes.filter(a => a.source !== selectedNode?.name);
  const ownAttributes = selectedNode?.data.attributes || [];

  return (
    <div className="space-y-4">
      {/* Collapsible Quick Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg">
        <button
          onClick={() => setGuideExpanded(!guideExpanded)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <h3 className="font-semibold text-blue-900">Quick Guide</h3>
          {guideExpanded ? 
            <ChevronUp className="w-5 h-5 text-blue-700" /> : 
            <ChevronDown className="w-5 h-5 text-blue-700" />
          }
        </button>
        {guideExpanded && (
          <div className="px-4 pb-4">
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• <strong>Left Panel:</strong> Browse and navigate the hierarchy tree</li>
              <li>• <strong>Right Panel:</strong> View and edit details for the selected item</li>
              <li>• <strong>Add Child:</strong> Click the + icon to add locations under customers or sub-locations under locations</li>
              <li>• <strong>Rename:</strong> Click the edit icon or click the name in the detail panel</li>
              <li>• <strong>Delete:</strong> Click the trash icon (will delete all children)</li>
              <li>• <strong>Attributes:</strong> Automatically inherit from parents, override as needed</li>
              <li>• <strong>Unique Names:</strong> Each child must have a unique name within its parent</li>
            </ul>
          </div>
        )}
      </div>

      <div className="flex gap-6 h-[calc(100vh-16rem)]">
        {/* Left Panel - Tree */}
        <div className="w-1/3 bg-white rounded-lg shadow-md p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Hierarchy</h2>
            <button
              onClick={() => window.location.href = '/customers/create'}
              className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              title="Add Customer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {tree.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No data yet</p>
              <button
                onClick={() => window.location.href = '/customers/create'}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
              >
                Create First Customer
              </button>
            </div>
          ) : (
            renderTree(tree)
          )}
        </div>

        {/* Right Panel - Details */}
        <div className="flex-1 bg-white rounded-lg shadow-md p-6 overflow-y-auto">
          {!selectedNode ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">Select a node from the hierarchy to view details</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Breadcrumb */}
              <nav className="flex items-center text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded">
                {getBreadcrumb(selectedNode).map((crumb, index, arr) => (
                  <span key={index} className="flex items-center">
                    <span className={index === arr.length - 1 ? 'font-semibold text-gray-900' : ''}>
                      {crumb}
                    </span>
                    {index < arr.length - 1 && <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />}
                  </span>
                ))}
              </nav>

              {/* Header with Edit */}
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {editingNode === selectedNode.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-3xl font-bold border-b-2 border-blue-500 text-gray-800 outline-none"
                        autoFocus
                        onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                      />
                      <button onClick={saveEdit} className="p-2 bg-green-500 text-white rounded">
                        <Save className="w-5 h-5" />
                      </button>
                      <button onClick={() => setEditingNode(null)} className="p-2 bg-gray-500 text-white rounded">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {selectedNode.type === 'customer' && <Building2 className="w-8 h-8 text-blue-600" />}
                      {selectedNode.type === 'location' && <MapPin className="w-8 h-8 text-green-600" />}
                      {selectedNode.type === 'sublocation' && <Layers className="w-8 h-8 text-orange-600" />}
                      <h1 className="text-3xl font-bold text-gray-800">{selectedNode.name}</h1>
                    </div>
                  )}
                  <p className="text-gray-600 mt-1 capitalize">{selectedNode.type}</p>
                </div>
              </div>

              {/* Entity Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedNode.type === 'customer' && (
                    <>
                      <div><span className="text-gray-600">Email:</span> <span className="text-gray-900">{selectedNode.data.email}</span></div>
                      {selectedNode.data.phone && <div><span className="text-gray-600">Phone:</span> <span className="text-gray-900">{selectedNode.data.phone}</span></div>}
                    </>
                  )}
                  {selectedNode.type === 'location' && (
                    <>
                      <div><span className="text-gray-600">City:</span> <span className="text-gray-900">{selectedNode.data.city}</span></div>
                      <div><span className="text-gray-600">State:</span> <span className="text-gray-900">{selectedNode.data.state}</span></div>
                      {selectedNode.data.totalCapacity && (
                        <div><span className="text-gray-600">Total Capacity:</span> <span className="text-gray-900">{selectedNode.data.totalCapacity}</span></div>
                      )}
                    </>
                  )}
                  {selectedNode.type === 'sublocation' && (
                    <>
                      {selectedNode.data.allocatedCapacity !== undefined && (
                        <div><span className="text-gray-600">Allocated Capacity:</span> <span className="text-gray-900">{selectedNode.data.allocatedCapacity}</span></div>
                      )}
                      {selectedNode.data.description && (
                        <div className="col-span-2"><span className="text-gray-600">Description:</span> <span className="text-gray-900">{selectedNode.data.description}</span></div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* All Attributes Display */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">All Attributes (Including Inherited)</h3>
                {allAttributes.length === 0 ? (
                  <p className="text-sm text-gray-500">No attributes defined</p>
                ) : (
                  <div className="space-y-2">
                    {allAttributes.map((attr, index) => {
                      const isOwn = attr.source === selectedNode.name;
                      return (
                        <div
                          key={index}
                          className={`flex items-center gap-2 p-2 rounded text-sm ${
                            attr.overridden 
                              ? 'bg-yellow-100 border border-yellow-300'
                              : isOwn
                              ? 'bg-white border border-gray-300'
                              : 'bg-blue-50 border border-blue-200'
                          }`}
                        >
                          <span className="font-medium text-gray-700 min-w-[120px]">{attr.key}:</span>
                          <span className="text-gray-900">{attr.value}</span>
                          <span className={`ml-auto text-xs px-2 py-1 rounded ${
                            attr.overridden
                              ? 'bg-yellow-200 text-yellow-800'
                              : isOwn
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {attr.overridden ? '⚠️ Overridden' : isOwn ? '✓ Own' : `← ${attr.source}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Attributes Editor */}
              <div>
                <AttributesManager
                  attributes={ownAttributes}
                  inheritedAttributes={inheritedAttributes.map(a => ({ key: a.key, value: a.value }))}
                  onSave={async (newAttributes) => {
                    await fetch(`/api/${selectedNode.type}s/${selectedNode.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ attributes: newAttributes }),
                    });
                    loadHierarchy();
                  }}
                  entityName={selectedNode.name}
                />
              </div>

              {/* Operating Hours Editor */}
              <div className="mt-6">
                {(() => {
                  const { schedule: inheritedSchedule, blackouts: inheritedBlackouts } =
                    getInheritedOperatingHours(selectedNode);

                  // Get capacity data for sublocations
                  const isSublocation = selectedNode.type === 'sublocation';
                  const sublocationData = selectedNode.data;
                  const totalCapacity = isSublocation
                    ? (sublocationData.maxCapacity || sublocationData.allocatedCapacity || 100)
                    : 100;

                  // Calculate capacity breakdown for sublocations
                  // Using defaults based on sublocation capacity config
                  const capacityBreakdown = isSublocation ? {
                    transient: Math.round(totalCapacity * 0.5), // 50% for transient
                    events: Math.round(totalCapacity * 0.2),    // 20% for events
                    unavailable: 0,                              // 0% unavailable (when open)
                    reserved: Math.round(totalCapacity * 0.3),  // 30% reserved buffer
                  } : undefined;

                  return (
                    <OperatingHoursManager
                      operatingHours={selectedNode.data.operatingHours}
                      inheritedSchedule={inheritedSchedule}
                      inheritedBlackouts={inheritedBlackouts.filter(b => b.isInherited)}
                      onSave={async (hours) => {
                        await fetch(`/api/${selectedNode.type}s/${selectedNode.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ operatingHours: hours }),
                        });
                        loadHierarchy();
                      }}
                      entityName={selectedNode.name}
                      capacityBreakdown={capacityBreakdown}
                      totalCapacity={totalCapacity}
                      showCapacity={isSublocation}
                    />
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
