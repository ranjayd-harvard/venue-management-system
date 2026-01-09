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

import { RefreshCw, Filter, X, Info, Edit2 } from 'lucide-react'; 
import GraphFilterPanel, { FilterState } from './GraphFilterPanel';
import AttributeEditor from './AttributeEditor';

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
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState>({
    customer: 'all',
    location: 'all',
    sublocation: 'all',
    venue: 'all',
  });
  
  // Modal states
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [positionsDirty, setPositionsDirty] = useState(false);
  
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
      return { inherited: [], own: entity?.attributes || [], overridden: [] };
    }
    
    const attributeMap = new Map<string, { value: string; source: string }>();
    
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

  const handleNodeClick: NodeMouseHandler = useCallback((event, node) => {
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
    //setFilterVersion(v => v + 1);
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
    // Close context menu
    setContextMenu({ visible: false, x: 0, y: 0 });
    
    // Clear highlights if any exist
    if (highlightedNodes.size > 0 || highlightedEdges.size > 0) {
      console.log('🧹 Clearing highlights');
      setHighlightedNodes(new Set());
      setHighlightedEdges(new Set());
      setFilterVersion(v => v + 1); // Trigger reload to show cleared state
    }
  }, [highlightedNodes, highlightedEdges]);

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

  // Load graph data with filtering
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

      setAllData({ customers, locations, sublocations, venues, slvRelations });

      // Apply filters
      let filteredCustomers = customers;
      let filteredLocations = locations;
      let filteredSublocations = sublocations;
      let filteredVenues = venues;
      let filteredSlvRelations = slvRelations;

      if (activeFilters.customer !== 'all') {
        filteredCustomers = customers.filter((c: any) => c._id === activeFilters.customer);
        filteredLocations = locations.filter((l: any) => l.customerId === activeFilters.customer);
        // Filter sublocations for this customer's locations
        const customerLocationIds = filteredLocations.map((l: any) => l._id);
        filteredSublocations = sublocations.filter((sl: any) => customerLocationIds.includes(sl.locationId));
        // Filter relations for these sublocations
        const customerSublocationIds = filteredSublocations.map((sl: any) => sl._id);
        filteredSlvRelations = slvRelations.filter((rel: any) => customerSublocationIds.includes(rel.subLocationId));
      }

      if (activeFilters.location !== 'all') {
        filteredLocations = filteredLocations.filter((l: any) => l._id === activeFilters.location);
        filteredSublocations = sublocations.filter((sl: any) => sl.locationId === activeFilters.location);
        // Filter relations for this location's sublocations
        const locationSublocationIds = filteredSublocations.map((sl: any) => sl._id);
        filteredSlvRelations = slvRelations.filter((rel: any) => locationSublocationIds.includes(rel.subLocationId));
      }

      if (activeFilters.sublocation !== 'all') {
        filteredSublocations = filteredSublocations.filter((sl: any) => sl._id === activeFilters.sublocation);
        // Filter relations for this specific sublocation
        filteredSlvRelations = slvRelations.filter((rel: any) => rel.subLocationId === activeFilters.sublocation);
      }

      if (activeFilters.venue !== 'all') {
        filteredVenues = venues.filter((v: any) => v._id === activeFilters.venue);
        // Filter relations for this specific venue
        filteredSlvRelations = filteredSlvRelations.filter((rel: any) => rel.venueId === activeFilters.venue);
      }

      console.log('Active filters:', activeFilters);
      console.log('Filtered counts:', {
        customers: filteredCustomers.length,
        locations: filteredLocations.length,
      });

      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      const xSpacing = 350;
      const ySpacing = 160;

      // Create customer nodes
      filteredCustomers.forEach((customer: any, cIndex: number) => {
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
          position: nodePositions[customerId] || { x: 0, y: cIndex * 700 },
          style: { 
            background: isHighlighted ? '#3B82F6' : '#DBEAFE',
            border: `2px solid ${isHighlighted ? '#1E40AF' : '#3B82F6'}`,
            borderRadius: '8px',
            padding: '10px',
            width: 220,
            boxShadow: isHighlighted ? '0 0 20px rgba(59, 130, 246, 0.5)' : undefined,
          },
        });

        const customerLocations = filteredLocations.filter((l: any) => l.customerId === customer._id);
        
        customerLocations.forEach((location: any, lIndex: number) => {
          const locationId = `location-${location._id}`;
          const locationY = cIndex * 700 + lIndex * 300;
          const isLocationHighlighted = highlightedNodes.has(locationId);
          
          const locationSublocations = filteredSublocations.filter((sl: any) => sl.locationId === location._id);
          const totalAllocated = locationSublocations.reduce((sum: number, sl: any) => sum + (sl.allocatedCapacity || 0), 0);
          const remainingCapacity = location.totalCapacity ? location.totalCapacity - totalAllocated : null;
          
          newNodes.push({
            id: locationId,
            type: 'default',
            data: { 
              label: (
                <div className="text-center">
                  <div className="font-bold"
                    style={{ color: isHighlighted ? '#ffffff' : '#1d4ed8' }}>{location.name}</div>
                  <div className="text-xs"
                    style={{ color: isHighlighted ? '#dbeafe' : '#4b5563' }}>{location.address}</div>
                  {location.totalCapacity && (
                    <div className="text-xs mt-1 font-semibold">
                      Total: {location.totalCapacity}
                      {remainingCapacity !== null && (
                        <div className={`text-xs ${remainingCapacity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {remainingCapacity >= 0 ? '✓' : '⚠️'} {remainingCapacity} left
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            },
            position: nodePositions[locationId] || { x: xSpacing, y: locationY },
            style: { 
              background: isLocationHighlighted ? '#10B981' : '#D1FAE5',
              border: `2px solid ${isLocationHighlighted ? '#047857' : '#10B981'}`,
              borderRadius: '8px',
              padding: '10px',
              width: 180,
              boxShadow: isLocationHighlighted ? '0 0 20px rgba(16, 185, 129, 0.5)' : undefined,
            },
          });

          const edgeId = `e-${customer._id}-${location._id}`;
          const isEdgeHighlighted = highlightedEdges.has(edgeId);
          
          newEdges.push({
            id: edgeId,
            source: customerId,
            target: locationId,
            type: 'smoothstep',
            animated: isEdgeHighlighted,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { 
              stroke: isEdgeHighlighted ? '#1E40AF' : '#3B82F6',
              strokeWidth: isEdgeHighlighted ? 4 : 2,
            },
          });

          locationSublocations.forEach((sublocation: any, slIndex: number) => {
            const sublocationId = `sublocation-${sublocation._id}`;
            const sublocationY = locationY - 100 + slIndex * 140;
            const isSublocationHighlighted = highlightedNodes.has(sublocationId);
            
            const sublocationVenueRels = filteredSlvRelations.filter((r: any) => r.subLocationId === sublocation._id);
            const totalVenueCapacity = sublocationVenueRels.reduce((sum: number, rel: any) => {
              const venue = filteredVenues.find((v: any) => v._id === rel.venueId);
              return sum + (venue?.capacity || 0);
            }, 0);
            
            newNodes.push({
              id: sublocationId,
              type: 'default',
              data: { 
                label: (
                  <div className="text-center">
                    <div className={`font-bold ${isHighlighted ? 'text-white' : 'text-orange-700'}`}>{sublocation.label}</div>
                    {sublocation.allocatedCapacity && (
                      <div className="text-xs mt-1">
                        Allocated: {sublocation.allocatedCapacity}
                        {totalVenueCapacity > 0 && (
                          <div className={`text-xs font-semibold ${totalVenueCapacity <= sublocation.allocatedCapacity ? 'text-green-600' : 'text-red-600'}`}>
                            {totalVenueCapacity <= sublocation.allocatedCapacity ? '✓' : '⚠️'} {sublocation.allocatedCapacity - totalVenueCapacity} left
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              },
              position: nodePositions[sublocationId] || { x: xSpacing * 2, y: sublocationY },
              style: { 
                background: isSublocationHighlighted ? '#F97316' : '#FED7AA',
                border: `2px solid ${isSublocationHighlighted ? '#C2410C' : '#F97316'}`,
                borderRadius: '8px',
                padding: '10px',
                width: 160,
                boxShadow: isSublocationHighlighted ? '0 0 20px rgba(249, 115, 22, 0.5)' : undefined,
              },
            });

            const slEdgeId = `e-${location._id}-${sublocation._id}`;
            const isSlEdgeHighlighted = highlightedEdges.has(slEdgeId);
            
            newEdges.push({
              id: slEdgeId,
              source: locationId,
              target: sublocationId,
              type: 'smoothstep',
              animated: isSlEdgeHighlighted,
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { 
                stroke: isSlEdgeHighlighted ? '#C2410C' : '#F97316',
                strokeWidth: isSlEdgeHighlighted ? 4 : 2,
              },
              label: sublocation.allocatedCapacity ? `${sublocation.allocatedCapacity}` : '',
            });

            sublocationVenueRels.forEach((rel: any, vIndex: number) => {
              const venue = filteredVenues.find((v: any) => v._id === rel.venueId);
              if (!venue) return;

              const venueId = `venue-${venue._id}`;
              const isVenueHighlighted = highlightedNodes.has(venueId);
              
              if (!newNodes.find(n => n.id === venueId)) {
                const venueY = sublocationY - 60 + vIndex * 100;
                
                newNodes.push({
                  id: venueId,
                  type: 'default',
                  data: { 
                    label: (
                      <div className="text-center">
                        <div className="font-bold"
                          style={{ color: isHighlighted ? '#ffffff' : '#9203caff' }}>{venue.name}</div>
                        <div className="text-xs"
                          style={{ color: isHighlighted ? '#edbaf2ff' : '#4b5563' }}>{venue.venueType}</div>
                        {venue.capacity !== undefined && (
                          <div className="text-xs font-semibold text-purple-600 mt-1">
                            Cap: {venue.capacity}
                          </div>
                        )}
                      </div>
                    )
                  },
                  position: nodePositions[venueId] || { x: xSpacing * 3, y: venueY },
                  style: { 
                    background: isVenueHighlighted ? '#A855F7' : '#E9D5FF',
                    border: `2px solid ${isVenueHighlighted ? '#7E22CE' : '#A855F7'}`,
                    borderRadius: '8px',
                    padding: '8px',
                    width: 130,
                    boxShadow: isVenueHighlighted ? '0 0 20px rgba(168, 85, 247, 0.5)' : undefined,
                  },
                });
              }

              const venueEdgeId = `e-${sublocation._id}-${venue._id}`;
              const isVenueEdgeHighlighted = highlightedEdges.has(venueEdgeId);
              
              newEdges.push({
                id: venueEdgeId,
                source: sublocationId,
                target: venueId,
                type: 'smoothstep',
                animated: isVenueEdgeHighlighted,
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { 
                  stroke: isVenueEdgeHighlighted ? '#7E22CE' : '#A855F7',
                  strokeWidth: isVenueEdgeHighlighted ? 4 : 2,
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
  }, [setNodes, setEdges, activeFilters, highlightedNodes, highlightedEdges]);

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

  // Add a refresh trigger
  const [filterVersion, setFilterVersion] = useState(0);

  const handleFilterChange = (filters: FilterState) => {
    console.log('🔄 Received filters:', filters);
    setActiveFilters(filters);
    setFilterVersion(v => v + 1); // Trigger refresh
  };

  const handleSaveAttributes = async (updatedAttributes: any[]) => {
    if (!selectedEntity || !selectedEntityType) return;

    try {
      const endpoint = `/api/${selectedEntityType}s/${selectedEntity._id}`;
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributes: updatedAttributes }),
      });

      if (response.ok) {
        // Update local state
        setSelectedEntity({ ...selectedEntity, attributes: updatedAttributes });
        // Reload graph to reflect changes
        setFilterVersion(v => v + 1);
        alert('Attributes updated successfully!');
      } else {
        alert('Failed to update attributes');
      }
    } catch (error) {
      console.error('Error updating attributes:', error);
      alert('Error updating attributes');
    }
  };

  const handleDeleteAttribute = async (index: number) => {
    if (!selectedEntity) return;

    const updatedAttributes = [...(selectedEntity.attributes || [])];
    updatedAttributes.splice(index, 1);
    
    await handleSaveAttributes(updatedAttributes);
  };  

  // Load positions from localStorage
  const loadNodePositions = useCallback(() => {
    try {
      const saved = localStorage.getItem('graph_node_positions');
      if (saved) {
        setNodePositions(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load positions from localStorage:', error);
    }
  }, []);

  // Save positions to localStorage
  const saveNodePositions = useCallback((positions: Record<string, { x: number; y: number }>) => {
    try {
      localStorage.setItem('graph_node_positions', JSON.stringify(positions));
      setPositionsDirty(false);
    } catch (error) {
      console.error('Failed to save positions to localStorage:', error);
    }
  }, []);
  
  // ADD THIS HANDLER:
  const handleNodeDragStop = useCallback((event: any, node: any) => {
    console.log('Node dragged:', node.id, node.position);
    setNodePositions(prev => ({
      ...prev,
      [node.id]: node.position
    }));
    setPositionsDirty(true);
  }, []);

  // ADD THIS AUTO-SAVE EFFECT:
  useEffect(() => {
    if (!positionsDirty) return;
    
    console.log('Auto-saving positions...');
    const timer = setTimeout(() => {
      saveNodePositions(nodePositions);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [positionsDirty, nodePositions, saveNodePositions]);  

  // Load positions only on initial mount
  useEffect(() => {
    console.log('🚀 Initial mount - loading positions');
    loadNodePositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload graph when filters change
  useEffect(() => {
    console.log('♻️ Loading data for filters:', activeFilters);
    loadGraphData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterVersion]);

  // Trigger reload when highlights change
  useEffect(() => {
    if (highlightedNodes.size > 0 || highlightedEdges.size > 0) {
      loadNodePositions();
      loadGraphData();
    }
  }, [highlightedNodes, highlightedEdges])

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

  const activeFilterCount = Object.values(activeFilters).filter(v => v !== 'all').length;

  return (
    <div className="relative">
      {/* Top Control Bar */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={loadGraphData}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 shadow-lg transition-all hover:scale-105"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>

        {/* ADD THIS BUTTON: */}
        {(highlightedNodes.size > 0 || highlightedEdges.size > 0) && (
          <button
            onClick={() => {
              setHighlightedNodes(new Set());
              setHighlightedEdges(new Set());
              setFilterVersion(v => v + 1);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
            Clear Highlight
          </button>
        )}        
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg transition-all hover:scale-105 ${
            showFilters 
              ? 'bg-purple-600 text-white hover:bg-purple-700' 
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
        <button
          onClick={syncToNeo4j}
          disabled={syncing}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-400 shadow-lg transition-all hover:scale-105"
        >
          {syncing ? 'Syncing...' : 'Sync to Neo4j'}
        </button>
      </div>

      {/* Enhanced Filter Panel */}
      <GraphFilterPanel
        allData={allData}
        currentFilters={activeFilters} 
        onFilterChange={handleFilterChange}
        onClose={() => setShowFilters(false)}
        isOpen={showFilters}
      />

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 py-2 min-w-[180px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.nodeId && (
            <>
              <button
                onClick={handleViewAttributes}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm text-gray-700"
              >
                <Edit2 className="w-4 h-4" />
                Manage Attributes
              </button>
              <button
                onClick={handleHighlightPath}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm text-gray-700"
              >
                <Filter className="w-4 h-4" />
                Highlight Path
              </button>
            </>
          )}
          <button
            onClick={() => setContextMenu({ visible: false, x: 0, y: 0 })}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm text-gray-500 border-t border-gray-200"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </div>
      )}

      {/* Attribute Modal */}
      {showAttributeModal && selectedEntity && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{selectedEntity.name || selectedEntity.label}</h2>
                  <p className="text-blue-100 text-sm mt-1 capitalize">{selectedEntityType}</p>
                </div>
                <button
                  onClick={() => setShowAttributeModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {/* Inherited Attributes */}
              {inherited.length > 0 && (
                <AttributeEditor
                  attributes={inherited}
                  type="inherited"
                  canEdit={false}
                />
              )}

              {/* Own Attributes - Editable */}
              <AttributeEditor
                attributes={own.length > 0 ? own : []}
                type="own"
                canEdit={true}
                onSave={handleSaveAttributes}
                onDelete={handleDeleteAttribute}
              />

              {/* Overridden Attributes */}
              {overridden.length > 0 && (
                <AttributeEditor
                  attributes={overridden}
                  type="overridden"
                  canEdit={false}
                />
              )}

              {/* Empty State */}
              {inherited.length === 0 && own.length === 0 && overridden.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Info className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="mb-4">No attributes defined for this entity</p>
                  <p className="text-sm text-gray-400">
                    Click the button below to add your first attribute
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* React Flow Graph */}
      <div style={{ height: '800px', width: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDragStop={handleNodeDragStop} 
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

      {/* Legend */}
      <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200 shadow-lg">
        <h3 className="font-semibold text-gray-800 mb-2">Legend & Controls</h3>
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
          <p>💡 <strong>Left-click node</strong> to highlight inheritance path</p>
          <p>💡 <strong>Right-click node</strong> to view attributes or highlight path</p>
          <p>💡 <strong>Click empty space</strong> to clear highlighting</p>
          <p>💡 <strong>Use Filters</strong> to focus on specific entities in the hierarchy</p>
        </div>
      </div>
    </div>
  );
}
