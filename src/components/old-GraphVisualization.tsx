'use client';

import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeMouseHandler,
  EdgeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { RefreshCw, Filter, X, Info } from 'lucide-react';

export default function GraphVisualization() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Highlighting states
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());
  const [allData, setAllData] = useState<{
    customers: any[];
    locations: any[];
    sublocations: any[];
    venues: any[];
    slvRelations: any[];
  }>({ customers: [], locations: [], sublocations: [], venues: [], slvRelations: [] });
  
  // Filter states
  const [selectedVenue, setSelectedVenue] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    nodeId?: string;
    edgeId?: string;
  }>({ visible: false, x: 0, y: 0 });

  // Get entity from node ID
  const getEntityData = useCallback((nodeId: string) => {
    const [entityType, entityId] = nodeId.split('-');
    
    if (entityType === 'customer') {
      return allData.customers.find((c: any) => c._id === entityId);
    } else if (entityType === 'location') {
      return allData.locations.find((l: any) => l._id === entityId);
    } else if (entityType === 'sublocation') {
      return allData.sublocations.find((sl: any) => sl._id === entityId);
    } else if (entityType === 'venue') {
      return allData.venues.find((v: any) => v._id === entityId);
    }
    return null;
  }, [allData]);

  // Calculate inherited attributes
  const getAttributeBreakdown = useCallback((entity: any, entityType: string) => {
    const inherited: any[] = [];
    const own: any[] = [];
    const overridden: any[] = [];
    
    if (!entity || entityType === 'customer') {
      // Customers don't inherit
      return { inherited: [], own: entity?.attributes || [], overridden: [] };
    }
    
    const attributeMap = new Map<string, { value: string; source: string }>();
    
    // Build inheritance chain
    if (entityType === 'location') {
      const customer = allData.customers.find((c: any) => c._id === entity.customerId);
      if (customer?.attributes) {
        customer.attributes.forEach((attr: any) => {
          attributeMap.set(attr.key, { value: attr.value, source: customer.name || 'Customer' });
        });
      }
    } else if (entityType === 'sublocation') {
      const location = allData.locations.find((l: any) => l._id === entity.locationId);
      if (location) {
        const customer = allData.customers.find((c: any) => c._id === location.customerId);
        if (customer?.attributes) {
          customer.attributes.forEach((attr: any) => {
            attributeMap.set(attr.key, { value: attr.value, source: customer.name || 'Customer' });
          });
        }
        if (location.attributes) {
          location.attributes.forEach((attr: any) => {
            attributeMap.set(attr.key, { value: attr.value, source: location.name || 'Location' });
          });
        }
      }
    }
    
    const ownAttrs = entity.attributes || [];
    const ownKeys = new Set(ownAttrs.map((a: any) => a.key));
    
    ownAttrs.forEach((attr: any) => {
      if (attributeMap.has(attr.key)) {
        overridden.push(attr);
      } else {
        own.push(attr);
      }
    });
    
    attributeMap.forEach((data, key) => {
      if (!ownKeys.has(key)) {
        inherited.push({ key, value: data.value, source: data.source });
      }
    });
    
    return { inherited, own, overridden };
  }, [allData]);

  // Find all paths from a node to root
  const findAllPathsToRoot = useCallback((nodeId: string): string[][] => {
    const paths: string[][] = [];
    const [entityType, entityId] = nodeId.split('-');
    
    if (entityType === 'customer') {
      return [[nodeId]];
    }
    
    if (entityType === 'venue') {
      const rels = allData.slvRelations.filter((r: any) => r.venueId === entityId);
      rels.forEach((rel: any) => {
        const sublocationId = `sublocation-${rel.subLocationId}`;
        const sublocPaths = findAllPathsToRoot(sublocationId);
        sublocPaths.forEach(path => {
          paths.push([nodeId, ...path]);
        });
      });
    } else if (entityType === 'sublocation') {
      const sublocation = allData.sublocations.find((sl: any) => sl._id === entityId);
      if (sublocation) {
        const locationId = `location-${sublocation.locationId}`;
        const locationPaths = findAllPathsToRoot(locationId);
        locationPaths.forEach(path => {
          paths.push([nodeId, ...path]);
        });
      }
    } else if (entityType === 'location') {
      const location = allData.locations.find((l: any) => l._id === entityId);
      if (location) {
        paths.push([nodeId, `customer-${location.customerId}`]);
      }
    }
    
    return paths;
  }, [allData]);

  // Handle node click - only highlight paths
  const handleNodeClick: NodeMouseHandler = useCallback((event, node) => {
    // Highlight paths only
    const allPaths = findAllPathsToRoot(node.id);
    const allNodesSet = new Set<string>();
    const allEdgesSet = new Set<string>();
    
    allPaths.forEach(path => {
      path.forEach(nodeId => allNodesSet.add(nodeId));
      
      for (let i = 0; i < path.length - 1; i++) {
        const edge = edges.find((e: Edge) => 
          (e.source === path[i] && e.target === path[i + 1]) ||
          (e.source === path[i + 1] && e.target === path[i])
        );
        if (edge) allEdgesSet.add(edge.id);
      }
    });
    
    setHighlightedNodes(allNodesSet);
    setHighlightedEdges(allEdgesSet);
  }, [edges, findAllPathsToRoot]);

  // Handle node right-click - show context menu
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: any) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
    });
  }, []);

  // Handle edge click
  const handleEdgeClick: EdgeMouseHandler = useCallback((event, edge) => {
    const sourcePaths = findAllPathsToRoot(edge.source);
    const targetPaths = findAllPathsToRoot(edge.target);
    const allNodesSet = new Set<string>();
    const allEdgesSet = new Set<string>([edge.id]);
    
    [...sourcePaths, ...targetPaths].forEach(path => {
      path.forEach(nodeId => allNodesSet.add(nodeId));
      
      for (let i = 0; i < path.length - 1; i++) {
        const e = edges.find((ed: Edge) => 
          (ed.source === path[i] && ed.target === path[i + 1]) ||
          (ed.source === path[i + 1] && ed.target === path[i])
        );
        if (e) allEdgesSet.add(e.id);
      }
    });
    
    setHighlightedNodes(allNodesSet);
    setHighlightedEdges(allEdgesSet);
  }, [edges, findAllPathsToRoot]);

  // Handle edge context menu
  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: any) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      edgeId: edge.id,
    });
  }, []);

  // Handle pane click - clear highlighting and close context menu
  const handlePaneClick = useCallback(() => {
    setHighlightedNodes(new Set());
    setHighlightedEdges(new Set());
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  // Context menu actions
  const handleViewAttributes = useCallback(() => {
    if (contextMenu.nodeId) {
      const entity = getEntityData(contextMenu.nodeId);
      const entityType = contextMenu.nodeId.split('-')[0];
      if (entity) {
        setSelectedEntity(entity);
        setSelectedEntityType(entityType);
        setShowAttributeModal(true);
      }
    }
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, [contextMenu, getEntityData]);

  const handleHighlightPath = useCallback(() => {
    if (contextMenu.nodeId) {
      const allPaths = findAllPathsToRoot(contextMenu.nodeId);
      const allNodesSet = new Set<string>();
      const allEdgesSet = new Set<string>();
      
      allPaths.forEach(path => {
        path.forEach(nodeId => allNodesSet.add(nodeId));
        
        for (let i = 0; i < path.length - 1; i++) {
          const edge = edges.find((e: Edge) => 
            (e.source === path[i] && e.target === path[i + 1]) ||
            (e.source === path[i + 1] && e.target === path[i])
          );
          if (edge) allEdgesSet.add(edge.id);
        }
      });
      
      setHighlightedNodes(allNodesSet);
      setHighlightedEdges(allEdgesSet);
    }
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, [contextMenu, findAllPathsToRoot, edges]);

  const handleClearHighlight = useCallback(() => {
    setHighlightedNodes(new Set());
    setHighlightedEdges(new Set());
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  const loadGraphData = useCallback(async () => {
    setLoading(true);
    try {
      const [customers, locations, sublocations, venues, slvRelations] = await Promise.all([
        fetch('/api/customers').then(r => r.json()),
        fetch('/api/locations').then(r => r.json()),
        fetch('/api/sublocations').then(r => r.json()),
        fetch('/api/venues').then(r => r.json()),
        fetch('/api/sublocation-venues').then(r => r.json()),
      ]);

      // Store data for path finding and filtering
      setAllData({ customers, locations, sublocations, venues, slvRelations });

      // Apply venue filter if selected
      let filteredVenues = venues;
      let filteredSlvRelations = slvRelations;
      
      if (selectedVenue !== 'all') {
        filteredVenues = venues.filter((v: any) => v._id === selectedVenue);
        filteredSlvRelations = slvRelations.filter((rel: any) => rel.venueId === selectedVenue);
      }

      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      let yOffset = 0;
      const xSpacing = 350; // Increased from 300 to reduce edge overlap
      const ySpacing = 150;
      
      // Track venue Y positions globally to avoid overlap
      const usedVenueYPositions = new Map<string, number>(); // venueId -> Y position

      // Create customer nodes
      customers.forEach((customer: any, cIndex: number) => {
        const customerId = `customer-${customer._id}`;
        const isHighlighted = highlightedNodes.has(customerId);
        
        newNodes.push({
          id: customerId,
          type: 'default',
          data: { 
            label: (
              <div className="text-center">
                <div className={`font-bold ${isHighlighted ? 'text-white' : 'text-blue-700'}`}>
                  {customer.name}
                </div>
                <div className={`text-xs ${isHighlighted ? 'text-blue-100' : 'text-gray-600'}`}>
                  {customer.email}
                </div>
              </div>
            )
          },
          position: { x: 0, y: cIndex * 700 },
          style: { 
            background: isHighlighted ? '#1E40AF' : '#DBEAFE',
            border: `3px solid ${isHighlighted ? '#1E3A8A' : '#3B82F6'}`,
            borderRadius: '8px',
            padding: '10px',
            width: 220,
            cursor: 'pointer',
          },
        });

        // Get locations for this customer
        const customerLocations = locations.filter((l: any) => l.customerId === customer._id);
        
        customerLocations.forEach((location: any, lIndex: number) => {
          const locationId = `location-${location._id}`;
          const isLocHighlighted = highlightedNodes.has(locationId);
          const locationY = cIndex * 700 + lIndex * 300;
          
          // Calculate total allocated capacity from sublocations
          const locationSublocations = sublocations.filter((sl: any) => sl.locationId === location._id);
          const totalAllocated = locationSublocations.reduce((sum: number, sl: any) => sum + (sl.allocatedCapacity || 0), 0);
          const remainingCapacity = location.totalCapacity ? location.totalCapacity - totalAllocated : null;
          
          newNodes.push({
            id: locationId,
            type: 'default',
            data: { 
              label: (
                <div className="text-center">
                  <div className={`font-bold ${isLocHighlighted ? 'text-white' : 'text-green-700'}`}>
                    {location.name}
                  </div>
                  <div className={`text-xs ${isLocHighlighted ? 'text-green-100' : 'text-gray-600'}`}>
                    {location.city}
                  </div>
                  {location.totalCapacity && (
                    <div className="mt-1 space-y-0.5">
                      <div className={`text-xs font-semibold ${isLocHighlighted ? 'text-white' : 'text-green-800'}`}>
                        Total: {location.totalCapacity}
                      </div>
                      <div className={`text-xs ${isLocHighlighted ? 'text-green-100' : 'text-gray-600'}`}>
                        Allocated: {totalAllocated}
                      </div>
                      {remainingCapacity !== null && (
                        <div className={`text-xs font-medium ${
                          isLocHighlighted ? 'text-white' :
                          remainingCapacity >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          Available: {remainingCapacity}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            },
            position: { x: xSpacing, y: locationY },
            style: { 
              background: isLocHighlighted ? '#047857' : '#D1FAE5',
              border: `3px solid ${isLocHighlighted ? '#065F46' : '#10B981'}`,
              borderRadius: '8px',
              padding: '12px',
              width: 200,
              cursor: 'pointer',
            },
          });

          // Edge from customer to location
          const edgeId1 = `e-${customer._id}-${location._id}`;
          newEdges.push({
            id: edgeId1,
            source: customerId,
            target: locationId,
            type: 'smoothstep',
            animated: highlightedEdges.has(edgeId1),
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { 
              stroke: '#10B981',
              strokeWidth: highlightedEdges.has(edgeId1) ? 4 : 2,
            },
          });

          // Get sublocations for this location
          
          locationSublocations.forEach((sublocation: any, slIndex: number) => {
            const sublocationId = `sublocation-${sublocation._id}`;
            const isSlHighlighted = highlightedNodes.has(sublocationId);
            const sublocationY = locationY - 120 + slIndex * 160; // Increased from 140 for better spacing
            
            // Calculate total venue capacity for this sublocation
            const sublocationVenueRels = filteredSlvRelations.filter((rel: any) => rel.subLocationId === sublocation._id);
            const sublocationVenues = sublocationVenueRels
              .map((rel: any) => filteredVenues.find((v: any) => v._id === rel.venueId))
              .filter(Boolean);
            const totalVenueCapacity = sublocationVenues.reduce((sum: number, v: any) => sum + (v.capacity || 0), 0);
            
            newNodes.push({
              id: sublocationId,
              type: 'default',
              data: { 
                label: (
                  <div className="text-center">
                    <div className={`font-bold ${isSlHighlighted ? 'text-white' : 'text-orange-700'}`}>
                      {sublocation.label}
                    </div>
                    {sublocation.allocatedCapacity !== undefined && (
                      <div className="mt-1 space-y-0.5">
                        <div className={`text-xs font-semibold ${isSlHighlighted ? 'text-white' : 'text-orange-800'}`}>
                          Allocated: {sublocation.allocatedCapacity}
                        </div>
                        <div className={`text-xs ${isSlHighlighted ? 'text-orange-100' : 'text-gray-600'}`}>
                          Venues: {totalVenueCapacity}
                        </div>
                        {sublocation.allocatedCapacity > 0 && (
                          <div className={`text-xs font-medium ${
                            isSlHighlighted ? 'text-white' :
                            totalVenueCapacity <= sublocation.allocatedCapacity ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {totalVenueCapacity <= sublocation.allocatedCapacity ? '✓' : '⚠️'} {sublocation.allocatedCapacity - totalVenueCapacity} left
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              },
              position: { x: xSpacing * 2, y: sublocationY },
              style: { 
                background: isSlHighlighted ? '#C2410C' : '#FED7AA',
                border: `3px solid ${isSlHighlighted ? '#9A3412' : '#F97316'}`,
                borderRadius: '8px',
                padding: '10px',
                width: 160,
                cursor: 'pointer',
              },
            });

            // Edge from location to sublocation
            const edgeId2 = `e-${location._id}-${sublocation._id}`;
            newEdges.push({
              id: edgeId2,
              source: locationId,
              target: sublocationId,
              type: 'smoothstep',
              animated: highlightedEdges.has(edgeId2),
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { 
                stroke: '#F97316',
                strokeWidth: highlightedEdges.has(edgeId2) ? 4 : 2,
              },
              label: sublocation.allocatedCapacity ? `${sublocation.allocatedCapacity}` : '',
              labelStyle: { 
                fill: '#EA580C', 
                fontWeight: 700,
                fontSize: 12,
                backgroundColor: 'white',
                padding: '2px 4px',
              },
              labelBgStyle: { 
                fill: 'white',
                fillOpacity: 0.9,
              },
            });

            // Get venues for this sublocation
            sublocationVenueRels.forEach((rel: any, vIndex: number) => {
              const venue = filteredVenues.find((v: any) => v._id === rel.venueId);
              if (!venue) return;

              const venueId = `venue-${venue._id}`;
              const isVHighlighted = highlightedNodes.has(venueId);
              
              // Check if venue node already exists
              if (!newNodes.find(n => n.id === venueId)) {
                let venueY: number;
                
                // Check if this venue already has a position (shared across sublocations)
                if (usedVenueYPositions.has(venueId)) {
                  venueY = usedVenueYPositions.get(venueId)!;
                } else {
                  // Calculate initial position based on sublocation
                  let proposedY = sublocationY - 60 + vIndex * 130;
                  
                  // Find next available position without conflicts
                  const minDistance = 130; // Minimum vertical distance between venue nodes
                  const allUsedPositions = Array.from(usedVenueYPositions.values()).sort((a, b) => a - b);
                  
                  // Keep checking and adjusting until we find a free spot
                  let foundFreeSpot = false;
                  while (!foundFreeSpot) {
                    foundFreeSpot = true;
                    
                    // Check if proposed position conflicts with any existing venue
                    for (const usedY of allUsedPositions) {
                      if (Math.abs(usedY - proposedY) < minDistance) {
                        // Conflict found - try next position below the conflicting venue
                        proposedY = usedY + minDistance;
                        foundFreeSpot = false;
                        break;
                      }
                    }
                  }
                  
                  venueY = proposedY;
                  usedVenueYPositions.set(venueId, venueY);
                }
                
                newNodes.push({
                  id: venueId,
                  type: 'default',
                  data: { 
                    label: (
                      <div className="text-center">
                        <div className={`font-bold text-sm ${isVHighlighted ? 'text-white' : 'text-purple-700'}`}>
                          {venue.name}
                        </div>
                        <div className={`text-xs ${isVHighlighted ? 'text-purple-100' : 'text-gray-600'}`}>
                          {venue.venueType}
                        </div>
                        {venue.capacity !== undefined && (
                          <div className={`text-xs font-semibold mt-1 ${isVHighlighted ? 'text-white' : 'text-purple-600'}`}>
                            Cap: {venue.capacity}
                          </div>
                        )}
                      </div>
                    )
                  },
                  position: { x: xSpacing * 3 + 50, y: venueY }, // Added +50 offset for better spacing
                  style: { 
                    background: isVHighlighted ? '#7E22CE' : '#E9D5FF',
                    border: `3px solid ${isVHighlighted ? '#6B21A8' : '#A855F7'}`,
                    borderRadius: '8px',
                    padding: '8px',
                    width: 130,
                    cursor: 'pointer',
                  },
                });
              } else {
                // Venue already exists, just store its position if not already stored
                const existingNode = newNodes.find(n => n.id === venueId);
                if (existingNode && !usedVenueYPositions.has(venueId)) {
                  usedVenueYPositions.set(venueId, existingNode.position.y);
                }
              }

              // Edge from sublocation to venue with capacity label
              const edgeId3 = `e-${sublocation._id}-${venue._id}`;
              if (!newEdges.find(e => e.id === edgeId3)) {
                newEdges.push({
                  id: edgeId3,
                  source: sublocationId,
                  target: venueId,
                  type: 'smoothstep',
                  animated: highlightedEdges.has(edgeId3),
                  markerEnd: { type: MarkerType.ArrowClosed },
                  style: { 
                    stroke: '#A855F7',
                    strokeWidth: highlightedEdges.has(edgeId3) ? 4 : 2,
                  },
                  label: venue.capacity ? `${venue.capacity}` : '',
                  labelStyle: { 
                    fill: '#9333EA', 
                    fontWeight: 700,
                    fontSize: 12,
                  },
                  labelBgStyle: { 
                    fill: 'white',
                    fillOpacity: 0.9,
                  },
                });
              }
            });
          });
        });
      });

      setNodes(newNodes);
      setEdges(newEdges);
    } catch (error) {
      console.error('Failed to load graph data:', error);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges, highlightedNodes, highlightedEdges, selectedVenue]);

  const syncToNeo4j = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/graph/sync', { method: 'POST' });
      if (response.ok) {
        alert('Successfully synced to Neo4j!');
      } else {
        alert('Failed to sync to Neo4j. Make sure Neo4j is running.');
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Failed to sync to Neo4j. Make sure Neo4j is running.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-xl text-gray-600">Loading graph...</div>
      </div>
    );
  }

  const { inherited, own, overridden } = selectedEntity 
    ? getAttributeBreakdown(selectedEntity, selectedEntityType)
    : { inherited: [], own: [], overridden: [] };

  return (
    <div className="relative">
      {/* Attribute Modal */}
      {showAttributeModal && selectedEntity && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowAttributeModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {selectedEntity.name || selectedEntity.label}
                </h3>
                <p className="text-sm text-gray-600 capitalize">{selectedEntityType}</p>
              </div>
              <button
                onClick={() => setShowAttributeModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Entity Details */}
            <div className="mb-4 bg-gray-50 rounded p-4">
              <h4 className="font-semibold text-gray-800 mb-2">Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {selectedEntity.email && (
                  <div><span className="text-gray-600">Email:</span> <span className="text-gray-900">{selectedEntity.email}</span></div>
                )}
                {selectedEntity.city && (
                  <div><span className="text-gray-600">City:</span> <span className="text-gray-900">{selectedEntity.city}</span></div>
                )}
                {selectedEntity.venueType && (
                  <div><span className="text-gray-600">Type:</span> <span className="text-gray-900">{selectedEntity.venueType}</span></div>
                )}
                {selectedEntity.totalCapacity !== undefined && (
                  <div><span className="text-gray-600">Total Capacity:</span> <span className="text-gray-900">{selectedEntity.totalCapacity}</span></div>
                )}
                {selectedEntity.allocatedCapacity !== undefined && (
                  <div><span className="text-gray-600">Allocated:</span> <span className="text-gray-900">{selectedEntity.allocatedCapacity}</span></div>
                )}
                {selectedEntity.capacity !== undefined && (
                  <div><span className="text-gray-600">Capacity:</span> <span className="text-gray-900">{selectedEntity.capacity}</span></div>
                )}
              </div>
            </div>

            {/* Attributes */}
            <div className="space-y-4">
              {inherited.length > 0 && (
                <div>
                  <h4 className="font-semibold text-blue-700 mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" /> Inherited Attributes
                  </h4>
                  <div className="space-y-1">
                    {inherited.map((attr: any, i: number) => (
                      <div key={i} className="bg-blue-50 border border-blue-200 rounded p-2 text-sm">
                        <span className="font-medium text-gray-700">{attr.key}:</span>{' '}
                        <span className="text-gray-900">{attr.value}</span>
                        {attr.source && <span className="text-xs text-blue-600 ml-2">← {attr.source}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {own.length > 0 && (
                <div>
                  <h4 className="font-semibold text-green-700 mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" /> Own Attributes
                  </h4>
                  <div className="space-y-1">
                    {own.map((attr: any, i: number) => (
                      <div key={i} className="bg-white border border-gray-300 rounded p-2 text-sm">
                        <span className="font-medium text-gray-700">{attr.key}:</span>{' '}
                        <span className="text-gray-900">{attr.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {overridden.length > 0 && (
                <div>
                  <h4 className="font-semibold text-yellow-700 mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" /> Overridden Attributes
                  </h4>
                  <div className="space-y-1">
                    {overridden.map((attr: any, i: number) => (
                      <div key={i} className="bg-yellow-50 border border-yellow-300 rounded p-2 text-sm">
                        <span className="font-medium text-gray-700">⚠️ {attr.key}:</span>{' '}
                        <span className="text-gray-900">{attr.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inherited.length === 0 && own.length === 0 && overridden.length === 0 && (
                <p className="text-gray-500 text-center py-4">No attributes defined</p>
              )}
            </div>

            <button
              onClick={() => setShowAttributeModal(false)}
              className="mt-6 w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed bg-white rounded-lg shadow-2xl border border-gray-200 py-1 z-50"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.nodeId && (
            <>
              <button
                onClick={handleViewAttributes}
                className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-sm"
              >
                <Info className="w-4 h-4 text-blue-600" />
                <span className='text-gray-600'>View Attributes</span>
              </button>
              <button
                onClick={handleHighlightPath}
                className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-sm"
              >
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className='text-gray-600'>Highlight Path</span>
              </button>
              <div className="border-t border-gray-200 my-1"></div>
            </>
          )}
          <button
            onClick={handleClearHighlight}
            className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-sm"
          >
            <X className="w-4 h-4 text-gray-600" />
            <span className='text-gray-600'>Clear Highlight</span>
          </button>
        </div>
      )}

      {/* Top Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2 ${showFilters ? 'bg-blue-600' : 'bg-blue-500'} text-white rounded-lg hover:bg-blue-600 flex items-center gap-2`}
        >
          <Filter className="w-4 h-4" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
        <button
          onClick={() => {
            setHighlightedNodes(new Set());
            setHighlightedEdges(new Set());
            loadGraphData();
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
        <button
          onClick={syncToNeo4j}
          disabled={syncing}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400"
        >
          {syncing ? 'Syncing...' : 'Sync to Neo4j'}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="absolute top-20 right-4 z-10 bg-white rounded-lg shadow-xl p-4 w-80 border-2 border-blue-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-800">Filter Graph</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
              <select
                value={selectedVenue}
                onChange={(e) => {
                  setSelectedVenue(e.target.value);
                  setHighlightedNodes(new Set());
                  setHighlightedEdges(new Set());
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
              >
                <option value="all">All Venues</option>
                {allData.venues.map((v: any) => (
                  <option key={v._id} value={v._id}>
                    {v.name} ({v.venueType})
                  </option>
                ))}
              </select>
            </div>

            {selectedVenue !== 'all' && (
              <button
                onClick={() => {
                  setSelectedVenue('all');
                  setHighlightedNodes(new Set());
                  setHighlightedEdges(new Set());
                }}
                className="w-full px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ height: '800px', width: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeClick={handleEdgeClick}
          onEdgeContextMenu={handleEdgeContextMenu}
          onPaneClick={handlePaneClick}
          fitView
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap 
            nodeColor={(node) => {
              if (highlightedNodes.has(node.id)) {
                if (node.id.startsWith('customer')) return '#1E40AF';
                if (node.id.startsWith('location')) return '#047857';
                if (node.id.startsWith('sublocation')) return '#C2410C';
                return '#7E22CE';
              }
              if (node.id.startsWith('customer')) return '#3B82F6';
              if (node.id.startsWith('location')) return '#10B981';
              if (node.id.startsWith('sublocation')) return '#F97316';
              return '#A855F7';
            }}
          />
        </ReactFlow>
      </div>

      <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-2">Legend</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-200 border-2 border-blue-500 rounded"></div>
            <span className="text-sm text-gray-700">Customer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-200 border-2 border-green-500 rounded"></div>
            <span className="text-sm text-gray-700">Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-200 border-2 border-orange-500 rounded"></div>
            <span className="text-sm text-gray-700">Sub-Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-200 border-2 border-purple-500 rounded"></div>
            <span className="text-sm text-gray-700">Venue</span>
          </div>
        </div>
        <div className="mt-3 text-sm text-gray-600 space-y-1">
          <p>💡 <strong>Left-click node</strong> to highlight path</p>
          <p>💡 <strong>Right-click node</strong> to open context menu (View Attributes, Highlight Path)</p>
          <p>💡 <strong>Click empty space</strong> to clear highlighting</p>
          <p>💡 <strong>Modal shows:</strong> Inherited (blue), Own (white), Overridden (yellow) attributes</p>
          <p>💡 <strong>Filter by Venue:</strong> Click "Show Filters" to filter graph by specific venue</p>
          <p>💡 <strong>Improved spacing:</strong> 350px horizontal, 160px vertical for clearer visualization</p>
        </div>
      </div>
    </div>
  );
}
