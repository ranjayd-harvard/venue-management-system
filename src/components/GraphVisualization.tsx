'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  RefreshCw, 
  Filter, 
  X, 
  Info, 
  Sparkles,
  ChevronDown,
  Search,
  Layers,
  GitBranch,
  Database,
  Zap,
  Edit2
} from 'lucide-react';

// Types
interface Attribute {
  key: string;
  value: string;
}

interface FilterState {
  customer: string;
  location: string;
  sublocation: string;
  venue: string;
}

interface AllData {
  customers: any[];
  locations: any[];
  sublocations: any[];
  venues: any[];
  slvRelations: any[];
}

interface CapacityMetrics {
  minCapacity: number;
  maxCapacity: number;
  defaultCapacity: number;
  allocatedCapacity: number;
}

interface GraphCapacityMetrics {
  date: string;
  customers: Record<string, CapacityMetrics>;
  locations: Record<string, CapacityMetrics>;
  sublocations: Record<string, CapacityMetrics>;
}

interface TooltipData {
  name: string;
  type: string;
  entity: any;
  x: number;
  y: number;
}

export default function GraphVisualization() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // State management
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());
  const [allData, setAllData] = useState<AllData>({
    customers: [],
    locations: [],
    sublocations: [],
    venues: [],
    slvRelations: []
  });
  const [capacityMetrics, setCapacityMetrics] = useState<GraphCapacityMetrics | null>(null);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState>({
    customer: 'all',
    location: 'all',
    sublocation: 'all',
    venue: 'all',
  });
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  
  // Tooltip state
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  
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

  // Find all paths from a node to root
  const findAllPathsToRoot = useCallback((nodeId: string): string[][] => {
    const paths: string[][] = [];
    const [entityType, entityId] = nodeId.split('-');
    
    if (entityType === 'customer') {
      return [[nodeId]];
    }
    
    if (entityType === 'location') {
      const location = allData.locations.find((l: any) => l._id === entityId);
      if (location) {
        const customerNodeId = `customer-${location.customerId}`;
        return [[nodeId, customerNodeId]];
      }
    }
    
    if (entityType === 'sublocation') {
      const sublocation = allData.sublocations.find((sl: any) => sl._id === entityId);
      if (sublocation) {
        const location = allData.locations.find((l: any) => l._id === sublocation.locationId);
        if (location) {
          const locationNodeId = `location-${sublocation.locationId}`;
          const customerNodeId = `customer-${location.customerId}`;
          return [[nodeId, locationNodeId, customerNodeId]];
        }
      }
    }
    
    if (entityType === 'venue') {
      const relations = allData.slvRelations.filter((r: any) => r.venueId === entityId);
      relations.forEach((rel: any) => {
        const sublocation = allData.sublocations.find((sl: any) => sl._id === rel.subLocationId);
        if (sublocation) {
          const location = allData.locations.find((l: any) => l._id === sublocation.locationId);
          if (location) {
            const sublocationNodeId = `sublocation-${rel.subLocationId}`;
            const locationNodeId = `location-${sublocation.locationId}`;
            const customerNodeId = `customer-${location.customerId}`;
            paths.push([nodeId, sublocationNodeId, locationNodeId, customerNodeId]);
          }
        }
      });
    }
    
    return paths;
  }, [allData]);

  // Handle node click for path highlighting
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
    
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
    
    // Update state
    setHighlightedNodes(allNodesSet);
    setHighlightedEdges(allEdgesSet);
    
    // Update nodes with lighter text when highlighted
    setNodes((nds) => 
      nds.map((n) => {
        const isHighlighted = allNodesSet.has(n.id);
        const [entityType] = n.id.split('-');
        
        // Get entity data for this node
        const entity = getEntityData(n.id);
        if (!entity) return n;
        
        let bgGradient, borderColor, textColorPrimary, textColorSecondary, badgeColor;
        
        if (entityType === 'customer') {
          bgGradient = isHighlighted 
            ? 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' 
            : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
          borderColor = isHighlighted ? '#1e3a8a' : '#3b82f6';
          textColorPrimary = isHighlighted ? 'text-white' : 'text-blue-900';
          textColorSecondary = isHighlighted ? 'text-blue-100' : 'text-blue-600';
          badgeColor = isHighlighted ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700';
        } else if (entityType === 'location') {
          bgGradient = isHighlighted 
            ? 'linear-gradient(135deg, #047857 0%, #10b981 100%)' 
            : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
          borderColor = isHighlighted ? '#065f46' : '#10b981';
          textColorPrimary = isHighlighted ? 'text-white' : 'text-emerald-900';
          textColorSecondary = isHighlighted ? 'text-emerald-100' : 'text-emerald-600';
          badgeColor = isHighlighted ? 'text-white' : 'text-emerald-700';
        } else if (entityType === 'sublocation') {
          bgGradient = isHighlighted 
            ? 'linear-gradient(135deg, #c2410c 0%, #f97316 100%)' 
            : 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)';
          borderColor = isHighlighted ? '#9a3412' : '#f97316';
          textColorPrimary = isHighlighted ? 'text-white' : 'text-orange-900';
          textColorSecondary = isHighlighted ? 'text-orange-100' : 'text-orange-700';
          badgeColor = isHighlighted ? 'text-orange-100' : 'text-orange-700';
        } else { // venue
          bgGradient = isHighlighted 
            ? 'linear-gradient(135deg, #6b21a8 0%, #a855f7 100%)' 
            : 'linear-gradient(135deg, #e9d5ff 0%, #d8b4fe 100%)';
          borderColor = isHighlighted ? '#581c87' : '#a855f7';
          textColorPrimary = isHighlighted ? 'text-white' : 'text-purple-900';
          textColorSecondary = isHighlighted ? 'text-purple-100' : 'text-purple-700';
          badgeColor = isHighlighted ? 'text-purple-100' : 'text-purple-700';
        }
        
        // Rebuild label with updated colors
        let label;
        if (entityType === 'customer') {
          const metrics = capacityMetrics?.customers[entity._id];
          label = (
            <div className="text-center px-4 py-3">
              <div className={`font-bold text-lg mb-1 ${textColorPrimary}`}>
                {entity.name}
              </div>
              <div className={`text-xs ${textColorSecondary}`}>
                {entity.email}
              </div>
              {metrics && (
                <div className={`text-xs mt-2 space-y-1 ${badgeColor}`}>
                  <div className="flex justify-between gap-3">
                    <span className="text-left">Min:</span>
                    <span className="font-semibold">{metrics.minCapacity}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-left">Max:</span>
                    <span className="font-semibold">{metrics.maxCapacity}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-left">Default:</span>
                    <span className="font-semibold">{metrics.defaultCapacity}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-left">Allocated:</span>
                    <span className="font-semibold">{metrics.allocatedCapacity}</span>
                  </div>
                </div>
              )}
              {entity.attributes && entity.attributes.length > 0 && (
                <div className="mt-2 flex justify-center">
                  <span className={`text-xs px-2 py-1 rounded-full ${badgeColor}`}>
                    {entity.attributes.length} attributes
                  </span>
                </div>
              )}
            </div>
          );
        } else if (entityType === 'location') {
          const locMetrics = capacityMetrics?.locations[entity._id];
          const locationSublocations = allData.sublocations.filter((sl: any) => sl.locationId === entity._id);
          const totalAllocated = locationSublocations.reduce((sum: number, sl: any) => sum + (sl.allocatedCapacity || 0), 0);
          const remainingCapacity = entity.totalCapacity ? entity.totalCapacity - totalAllocated : null;

          label = (
            <div className="text-center px-4 py-3">
              <div className={`font-bold text-base mb-1 ${textColorPrimary}`}>
                {entity.name}
              </div>
              <div className={`text-xs mb-2 ${textColorSecondary}`}>
                {entity.city}, {entity.state}
              </div>
              {locMetrics && (
                <div className={`text-xs space-y-1 ${badgeColor}`}>
                  <div className="flex justify-between gap-2">
                    <span>Min:</span>
                    <span className="font-semibold">{locMetrics.minCapacity}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Max:</span>
                    <span className="font-semibold">{locMetrics.maxCapacity}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Default:</span>
                    <span className="font-semibold">{locMetrics.defaultCapacity}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Allocated:</span>
                    <span className="font-semibold">{locMetrics.allocatedCapacity}</span>
                  </div>
                </div>
              )}
              {!locMetrics && entity.totalCapacity && (
                <div className={`text-xs space-y-1 ${badgeColor}`}>
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-semibold">{entity.totalCapacity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Allocated:</span>
                    <span className="font-semibold">{totalAllocated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Available:</span>
                    <span className={`font-semibold ${
                      remainingCapacity && remainingCapacity < 0
                        ? 'text-red-500'
                        : isHighlighted ? 'text-emerald-100' : 'text-emerald-600'
                    }`}>
                      {remainingCapacity}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        } else if (entityType === 'sublocation') {
          const slMetrics = capacityMetrics?.sublocations[entity._id];
          const sublocationVenues = allData.slvRelations
            .filter((r: any) => r.subLocationId === entity._id)
            .map((r: any) => allData.venues.find((v: any) => v._id === r.venueId))
            .filter(Boolean);
          const totalVenueCapacity = sublocationVenues.reduce((sum: number, v: any) => sum + (v.capacity || 0), 0);

          label = (
            <div className="text-center px-4 py-3">
              <div className={`font-bold text-sm mb-1 ${textColorPrimary}`}>
                {entity.name}
              </div>
              {slMetrics && (
                <div className={`text-xs space-y-1 ${badgeColor}`}>
                  <div className="flex justify-between gap-2">
                    <span>Min:</span>
                    <span className="font-semibold">{slMetrics.minCapacity}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Max:</span>
                    <span className="font-semibold">{slMetrics.maxCapacity}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Default:</span>
                    <span className="font-semibold">{slMetrics.defaultCapacity}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Allocated:</span>
                    <span className="font-semibold">{slMetrics.allocatedCapacity}</span>
                  </div>
                </div>
              )}
              {!slMetrics && (
                <div className={`text-xs space-y-1 ${badgeColor}`}>
                  {entity.allocatedCapacity && (
                    <div className="flex justify-between">
                      <span>Allocated:</span>
                      <span className="font-semibold">{entity.allocatedCapacity}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Venues:</span>
                    <span className="font-semibold">{sublocationVenues.length}</span>
                  </div>
                  {totalVenueCapacity > 0 && (
                    <div className="flex justify-between">
                      <span>Total Cap:</span>
                      <span className="font-semibold">{totalVenueCapacity}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        } else { // venue
          label = (
            <div className="text-center px-4 py-3">
              <div className={`font-bold text-sm mb-1 ${textColorPrimary}`}>
                {entity.name}
              </div>
              <div className={`text-xs space-y-1 ${badgeColor}`}>
                <div>{entity.venueType}</div>
                {entity.capacity && (
                  <div className="flex justify-between">
                    <span>Capacity:</span>
                    <span className="font-semibold">{entity.capacity}</span>
                  </div>
                )}
              </div>
            </div>
          );
        }
        
        return {
          ...n,
          data: { ...n.data, label },
          style: {
            ...n.style,
            background: bgGradient,
            border: `3px solid ${borderColor}`,
            boxShadow: isHighlighted 
              ? `0 20px 50px ${borderColor}66` 
              : `0 8px 24px ${borderColor}33`,
          },
        };
      })
    );
    
    // Update edges with new styles
    setEdges((eds) =>
      eds.map((e) => {
        const isHighlighted = allEdgesSet.has(e.id);
        const [sourceType] = e.source.split('-');
        
        let color;
        if (sourceType === 'customer') color = '#3b82f6';
        else if (sourceType === 'location') color = '#10b981';
        else if (sourceType === 'sublocation') color = '#f97316';
        else color = '#94a3b8';
        
        return {
          ...e,
          animated: isHighlighted,
          style: {
            ...e.style,
            stroke: isHighlighted ? color : '#94a3b8',
            strokeWidth: isHighlighted ? 3 : 1.5,
          },
          markerEnd: {
            ...e.markerEnd,
            color: isHighlighted ? color : '#94a3b8',
          },
          labelStyle: {
            ...e.labelStyle,
            fill: isHighlighted ? color : '#64748b',
          },
        };
      })
    );
  }, [edges, findAllPathsToRoot, setNodes, setEdges, allData, getEntityData, capacityMetrics]);

  // Handle node right-click for context menu
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
    });
  }, []);

  // Handle node hover for tooltip
  const handleNodeMouseEnter = useCallback((event: React.MouseEvent, node: Node) => {
    const entity = getEntityData(node.id);
    const [entityType] = node.id.split('-');
    
    if (entity) {
      setTooltip({
        name: entity.name || entity.label || 'Unknown',
        type: entityType,
        entity: entity,
        x: event.clientX,
        y: event.clientY,
      });
    }
  }, [getEntityData]);

  const handleNodeMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // Calculate inherited attributes
  const getAttributeBreakdown = useCallback((entity: any, entityType: string) => {
    const inherited: Attribute[] = [];
    const own: Attribute[] = [];
    const overridden: Attribute[] = [];
    
    if (!entity || entityType === 'customer') {
      return { inherited: [], own: entity?.attributes || [], overridden: [] };
    }
    
    const attributeMap = new Map<string, { value: string; source: string }>();
    
    if (entityType === 'location') {
      const customer = allData.customers.find((c: any) => c._id === entity.customerId);
      if (customer?.attributes) {
        customer.attributes.forEach((attr: Attribute) => {
          attributeMap.set(attr.key, { value: attr.value, source: 'Customer' });
        });
      }
    } else if (entityType === 'sublocation') {
      const location = allData.locations.find((l: any) => l._id === entity.locationId);
      if (location) {
        const customer = allData.customers.find((c: any) => c._id === location.customerId);
        if (customer?.attributes) {
          customer.attributes.forEach((attr: Attribute) => {
            attributeMap.set(attr.key, { value: attr.value, source: 'Customer' });
          });
        }
        if (location.attributes) {
          location.attributes.forEach((attr: Attribute) => {
            attributeMap.set(attr.key, { value: attr.value, source: 'Location' });
          });
        }
      }
    }
    
    const ownAttrs = entity.attributes || [];
    const ownKeys = new Set(ownAttrs.map((a: Attribute) => a.key));
    
    ownAttrs.forEach((attr: Attribute) => {
      if (attributeMap.has(attr.key) && attributeMap.get(attr.key)!.value !== attr.value) {
        overridden.push({ ...attr, source: attributeMap.get(attr.key)!.source } as any);
      } else {
        own.push(attr);
      }
    });
    
    attributeMap.forEach((data, key) => {
      if (!ownKeys.has(key)) {
        inherited.push({ key, value: data.value, source: data.source } as any);
      }
    });
    
    return { inherited, own, overridden };
  }, [allData]);

  // Get filtered data for visualization
  const getFilteredDataForVisualization = useCallback(() => {
    const hasActiveFilters = activeFilters.customer !== 'all' || 
                            activeFilters.location !== 'all' || 
                            activeFilters.sublocation !== 'all' || 
                            activeFilters.venue !== 'all';

    if (!hasActiveFilters) {
      return allData;
    }

    let filteredCustomers = allData.customers;
    let filteredLocations = allData.locations;
    let filteredSublocations = allData.sublocations;
    let filteredVenues = allData.venues;
    let filteredSlvRelations = allData.slvRelations;

    if (activeFilters.customer !== 'all') {
      filteredCustomers = allData.customers.filter(c => c._id === activeFilters.customer);
      filteredLocations = allData.locations.filter(l => l.customerId === activeFilters.customer);
      const locationIds = filteredLocations.map(l => l._id);
      filteredSublocations = allData.sublocations.filter(sl => locationIds.includes(sl.locationId));
    }

    if (activeFilters.location !== 'all') {
      filteredLocations = filteredLocations.filter(l => l._id === activeFilters.location);
      filteredSublocations = allData.sublocations.filter(sl => sl.locationId === activeFilters.location);
    }

    if (activeFilters.sublocation !== 'all') {
      filteredSublocations = filteredSublocations.filter(sl => sl._id === activeFilters.sublocation);
    }

    if (activeFilters.venue !== 'all') {
      filteredVenues = allData.venues.filter(v => v._id === activeFilters.venue);
      filteredSlvRelations = allData.slvRelations.filter(r => r.venueId === activeFilters.venue);
    }

    const sublocationIds = filteredSublocations.map(sl => sl._id);
    filteredSlvRelations = filteredSlvRelations.filter(r => sublocationIds.includes(r.subLocationId));

    return {
      customers: filteredCustomers,
      locations: filteredLocations,
      sublocations: filteredSublocations,
      venues: filteredVenues,
      slvRelations: filteredSlvRelations,
    };
  }, [allData, activeFilters]);

  // Search functionality
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      if (highlightedNodes.size > 0) {
        setHighlightedNodes(new Set());
        setHighlightedEdges(new Set());
      }
      return;
    }

    const results: string[] = [];
    const term = searchTerm.toLowerCase();

    allData.customers.forEach(c => {
      if (c.name?.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term)) {
        results.push(`customer-${c._id}`);
      }
    });

    allData.locations.forEach(l => {
      if (l.name?.toLowerCase().includes(term) || l.city?.toLowerCase().includes(term)) {
        results.push(`location-${l._id}`);
      }
    });

    allData.sublocations.forEach(sl => {
      if (sl.name?.toLowerCase().includes(term)) {
        results.push(`sublocation-${sl._id}`);
      }
    });

    allData.venues.forEach(v => {
      if (v.name?.toLowerCase().includes(term) || v.venueType?.toLowerCase().includes(term)) {
        results.push(`venue-${v._id}`);
      }
    });

    setSearchResults(results);
    
    // Highlight search results
    const allNodesSet = new Set<string>(results);
    const allEdgesSet = new Set<string>();
    
    results.forEach(nodeId => {
      const paths = findAllPathsToRoot(nodeId);
      paths.forEach(path => {
        path.forEach(n => allNodesSet.add(n));
        for (let i = 0; i < path.length - 1; i++) {
          const edge = edges.find((e: Edge) => 
            (e.source === path[i] && e.target === path[i + 1]) ||
            (e.source === path[i + 1] && e.target === path[i])
          );
          if (edge) allEdgesSet.add(edge.id);
        }
      });
    });
    
    setHighlightedNodes(allNodesSet);
    setHighlightedEdges(allEdgesSet);
  }, [searchTerm, allData, edges, findAllPathsToRoot]);

  // Load graph data
  const loadGraphData = useCallback(async () => {
    setLoading(true);
    try {
      const [customers, locations, sublocations, venues, slvRelations, metrics] = await Promise.all([
        fetch('/api/customers').then(r => r.json()),
        fetch('/api/locations').then(r => r.json()),
        fetch('/api/sublocations').then(r => r.json()),
        fetch('/api/venues').then(r => r.json()),
        fetch('/api/sublocation-venues').then(r => r.json()),
        fetch('/api/capacity/graph-metrics').then(r => r.json()),
      ]);

      setAllData({ customers, locations, sublocations, venues, slvRelations });
      setCapacityMetrics(metrics);

      // Determine data to visualize
      const dataToVisualize = activeFilters.customer === 'all' && 
                              activeFilters.location === 'all' && 
                              activeFilters.sublocation === 'all' && 
                              activeFilters.venue === 'all'
        ? { customers, locations, sublocations, venues, slvRelations }
        : getFilteredDataForVisualization();

      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      const xSpacing = 400;
      const ySpacing = 200;
      const venueYPositions = new Map<string, number>();

      // Create customer nodes
      dataToVisualize.customers.forEach((customer: any, cIndex: number) => {
        const customerId = `customer-${customer._id}`;
        const isHighlighted = highlightedNodes.has(customerId);
        const metrics = capacityMetrics?.customers[customer._id];

        newNodes.push({
          id: customerId,
          type: 'default',
          data: {
            label: (
              <div className="text-center px-4 py-3">
                <div className={`font-bold text-lg mb-1 ${isHighlighted ? 'text-white' : 'text-blue-900'}`}>
                  {customer.name}
                </div>
                <div className={`text-xs ${isHighlighted ? 'text-blue-100' : 'text-blue-600'}`}>
                  {customer.email}
                </div>
                {metrics && (
                  <div className={`text-xs mt-2 space-y-1 ${isHighlighted ? 'text-white' : 'text-blue-700'}`}>
                    <div className="flex justify-between gap-3">
                      <span className="text-left">Min:</span>
                      <span className="font-semibold">{metrics.minCapacity}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-left">Max:</span>
                      <span className="font-semibold">{metrics.maxCapacity}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-left">Default:</span>
                      <span className="font-semibold">{metrics.defaultCapacity}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-left">Allocated:</span>
                      <span className="font-semibold">{metrics.allocatedCapacity}</span>
                    </div>
                  </div>
                )}
                {customer.attributes && customer.attributes.length > 0 && (
                  <div className="mt-2 flex justify-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isHighlighted ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {customer.attributes.length} attributes
                    </span>
                  </div>
                )}
              </div>
            )
          },
          position: { x: 0, y: cIndex * 800 },
          draggable: true,
          style: { 
            background: isHighlighted 
              ? 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' 
              : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            border: `3px solid ${isHighlighted ? '#1e3a8a' : '#3b82f6'}`,
            borderRadius: '16px',
            padding: '0',
            minWidth: 280,
            boxShadow: isHighlighted 
              ? '0 20px 50px rgba(59, 130, 246, 0.4)' 
              : '0 8px 24px rgba(59, 130, 246, 0.2)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          },
        });

        const customerLocations = dataToVisualize.locations.filter((l: any) => l.customerId === customer._id);
        
        customerLocations.forEach((location: any, lIndex: number) => {
          const locationY = cIndex * 800 + lIndex * 350;
          const locationId = `location-${location._id}`;
          const isLocHighlighted = highlightedNodes.has(locationId);
          const locMetrics = capacityMetrics?.locations[location._id];

          const locationSublocations = dataToVisualize.sublocations.filter((sl: any) => sl.locationId === location._id);
          const totalAllocated = locationSublocations.reduce((sum: number, sl: any) => sum + (sl.allocatedCapacity || 0), 0);
          const remainingCapacity = location.totalCapacity ? location.totalCapacity - totalAllocated : null;

          newNodes.push({
            id: locationId,
            type: 'default',
            data: {
              label: (
                <div className="text-center px-4 py-3">
                  <div className={`font-bold text-base mb-1 ${isLocHighlighted ? 'text-white' : 'text-emerald-900'}`}>
                    {location.name}
                  </div>
                  <div className={`text-xs mb-2 ${isLocHighlighted ? 'text-emerald-100' : 'text-emerald-600'}`}>
                    {location.city}, {location.state}
                  </div>
                  {locMetrics && (
                    <div className={`text-xs space-y-1 ${isLocHighlighted ? 'text-white' : 'text-emerald-700'}`}>
                      <div className="flex justify-between gap-2">
                        <span>Min:</span>
                        <span className="font-semibold">{locMetrics.minCapacity}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>Max:</span>
                        <span className="font-semibold">{locMetrics.maxCapacity}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>Default:</span>
                        <span className="font-semibold">{locMetrics.defaultCapacity}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span>Allocated:</span>
                        <span className="font-semibold">{locMetrics.allocatedCapacity}</span>
                      </div>
                    </div>
                  )}
                  {!locMetrics && location.totalCapacity && (
                    <div className={`text-xs space-y-1 ${isLocHighlighted ? 'text-white' : 'text-emerald-700'}`}>
                      <div className="flex justify-between">
                        <span>Total:</span>
                        <span className="font-semibold">{location.totalCapacity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Allocated:</span>
                        <span className="font-semibold">{totalAllocated}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Available:</span>
                        <span className={`font-semibold ${
                          remainingCapacity && remainingCapacity < 0
                            ? 'text-red-500'
                            : isLocHighlighted ? 'text-emerald-100' : 'text-emerald-600'
                        }`}>
                          {remainingCapacity}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            },
            position: { x: xSpacing, y: locationY },
            draggable: true,
            style: { 
              background: isLocHighlighted 
                ? 'linear-gradient(135deg, #047857 0%, #10b981 100%)' 
                : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
              border: `3px solid ${isLocHighlighted ? '#065f46' : '#10b981'}`,
              borderRadius: '16px',
              padding: '0',
              minWidth: 260,
              boxShadow: isLocHighlighted 
                ? '0 20px 50px rgba(16, 185, 129, 0.4)' 
                : '0 8px 24px rgba(16, 185, 129, 0.2)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            },
          });

          // FIXED: Straight edge with label
          const edgeId = `${customerId}-${locationId}`;
          newEdges.push({
            id: edgeId,
            source: customerId,
            target: locationId,
            type: 'smoothstep',
            animated: isHighlighted && isLocHighlighted,
            label: location.totalCapacity ? `${location.totalCapacity}` : undefined,
            labelStyle: { 
              fill: highlightedEdges.has(edgeId) ? '#3b82f6' : '#64748b',
              fontWeight: 600,
              fontSize: 11,
            },
            labelBgStyle: { 
              fill: 'white',
              fillOpacity: 0.95,
            },
            labelBgPadding: [3, 6] as [number, number],
            labelBgBorderRadius: 3,
            style: { 
              stroke: highlightedEdges.has(edgeId) ? '#3b82f6' : '#cbd5e1',
              strokeWidth: highlightedEdges.has(edgeId) ? 3 : 1.5,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 15,
              height: 15,
              color: highlightedEdges.has(edgeId) ? '#3b82f6' : '#cbd5e1',
            },
          });

          locationSublocations.forEach((sublocation: any, slIndex: number) => {
            const sublocationY = locationY + slIndex * 200;
            const sublocationId = `sublocation-${sublocation._id}`;
            const isSlHighlighted = highlightedNodes.has(sublocationId);
            const slMetrics = capacityMetrics?.sublocations[sublocation._id];

            const sublocationVenues = dataToVisualize.slvRelations
              .filter((r: any) => r.subLocationId === sublocation._id)
              .map((r: any) => dataToVisualize.venues.find((v: any) => v._id === r.venueId))
              .filter(Boolean);

            const totalVenueCapacity = sublocationVenues.reduce((sum: number, v: any) => sum + (v.capacity || 0), 0);

            newNodes.push({
              id: sublocationId,
              type: 'default',
              data: {
                label: (
                  <div className="text-center px-4 py-3">
                    <div className={`font-bold text-sm mb-1 ${isSlHighlighted ? 'text-white' : 'text-orange-900'}`}>
                      {sublocation.label}
                    </div>
                    {slMetrics && (
                      <div className={`text-xs space-y-1 ${isSlHighlighted ? 'text-orange-100' : 'text-orange-700'}`}>
                        <div className="flex justify-between gap-2">
                          <span>Min:</span>
                          <span className="font-semibold">{slMetrics.minCapacity}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span>Max:</span>
                          <span className="font-semibold">{slMetrics.maxCapacity}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span>Default:</span>
                          <span className="font-semibold">{slMetrics.defaultCapacity}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span>Allocated:</span>
                          <span className="font-semibold">{slMetrics.allocatedCapacity}</span>
                        </div>
                      </div>
                    )}
                    {!slMetrics && (
                      <div className={`text-xs space-y-1 ${isSlHighlighted ? 'text-orange-100' : 'text-orange-700'}`}>
                        {sublocation.allocatedCapacity && (
                          <div className="flex justify-between">
                            <span>Allocated:</span>
                            <span className="font-semibold">{sublocation.allocatedCapacity}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Venues:</span>
                          <span className="font-semibold">{sublocationVenues.length}</span>
                        </div>
                        {totalVenueCapacity > 0 && (
                          <div className="flex justify-between">
                            <span>Total Cap:</span>
                            <span className="font-semibold">{totalVenueCapacity}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              },
              position: { x: xSpacing * 2, y: sublocationY },
              draggable: true,
              style: { 
                background: isSlHighlighted 
                  ? 'linear-gradient(135deg, #c2410c 0%, #f97316 100%)' 
                  : 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)',
                border: `3px solid ${isSlHighlighted ? '#9a3412' : '#f97316'}`,
                borderRadius: '16px',
                padding: '0',
                minWidth: 220,
                boxShadow: isSlHighlighted 
                  ? '0 20px 50px rgba(249, 115, 22, 0.4)' 
                  : '0 8px 24px rgba(249, 115, 22, 0.2)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              },
            });

            // FIXED: Straight edge with capacity label
            const locSlEdgeId = `${locationId}-${sublocationId}`;
            newEdges.push({
              id: locSlEdgeId,
              source: locationId,
              target: sublocationId,
              type: 'smoothstep',
              animated: isLocHighlighted && isSlHighlighted,
              label: sublocation.allocatedCapacity ? `${sublocation.allocatedCapacity}` : undefined,
              labelStyle: { 
                fill: highlightedEdges.has(locSlEdgeId) ? '#10b981' : '#64748b',
                fontWeight: 600,
                fontSize: 11,
              },
              labelBgStyle: { 
                fill: 'white',
                fillOpacity: 0.95,
              },
              labelBgPadding: [3, 6] as [number, number],
              labelBgBorderRadius: 3,
              style: { 
                stroke: highlightedEdges.has(locSlEdgeId) ? '#10b981' : '#cbd5e1',
                strokeWidth: highlightedEdges.has(locSlEdgeId) ? 3 : 1.5,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 15,
                height: 15,
                color: highlightedEdges.has(locSlEdgeId) ? '#10b981' : '#cbd5e1',
              },
            });

            sublocationVenues.forEach((venue: any) => {
              if (!venue) return;
              
              const venueId = `venue-${venue._id}`;
              const isVenueHighlighted = highlightedNodes.has(venueId);
              
              if (!venueYPositions.has(venue._id)) {
                const existingY = Array.from(venueYPositions.values());
                let newY = sublocationY;
                
                while (existingY.some(y => Math.abs(y - newY) < 150)) {
                  newY += 180;
                }
                
                venueYPositions.set(venue._id, newY);
              }

              const venueY = venueYPositions.get(venue._id)!;

              if (!newNodes.find(n => n.id === venueId)) {
                newNodes.push({
                  id: venueId,
                  type: 'default',
                  data: { 
                    label: (
                      <div className="text-center px-4 py-3">
                        <div className={`font-bold text-sm mb-1 ${isVenueHighlighted ? 'text-white' : 'text-purple-900'}`}>
                          {venue.name}
                        </div>
                        <div className={`text-xs space-y-1 ${isVenueHighlighted ? 'text-purple-100' : 'text-purple-700'}`}>
                          <div>{venue.venueType}</div>
                          {venue.capacity && (
                            <div className="flex justify-between">
                              <span>Capacity:</span>
                              <span className="font-semibold">{venue.capacity}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  },
                  position: { x: xSpacing * 3, y: venueY },
                  draggable: true,
                  style: { 
                    background: isVenueHighlighted 
                      ? 'linear-gradient(135deg, #6b21a8 0%, #a855f7 100%)' 
                      : 'linear-gradient(135deg, #e9d5ff 0%, #d8b4fe 100%)',
                    border: `3px solid ${isVenueHighlighted ? '#581c87' : '#a855f7'}`,
                    borderRadius: '16px',
                    padding: '0',
                    minWidth: 200,
                    boxShadow: isVenueHighlighted 
                      ? '0 20px 50px rgba(168, 85, 247, 0.4)' 
                      : '0 8px 24px rgba(168, 85, 247, 0.2)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  },
                });
              }

              // FIXED: Straight edge with venue capacity label
              const slVenueEdgeId = `${sublocationId}-${venueId}`;
              if (!newEdges.find(e => e.id === slVenueEdgeId)) {
                newEdges.push({
                  id: slVenueEdgeId,
                  source: sublocationId,
                  target: venueId,
                  type: 'smoothstep',
                  animated: isSlHighlighted && isVenueHighlighted,
                  label: venue.capacity ? `${venue.capacity}` : undefined,
                  labelStyle: { 
                    fill: highlightedEdges.has(slVenueEdgeId) ? '#f97316' : '#64748b',
                    fontWeight: 600,
                    fontSize: 11,
                  },
                  labelBgStyle: { 
                    fill: 'white',
                    fillOpacity: 0.95,
                  },
                  labelBgPadding: [3, 6] as [number, number],
                  labelBgBorderRadius: 3,
                  style: { 
                    stroke: highlightedEdges.has(slVenueEdgeId) ? '#f97316' : '#cbd5e1',
                    strokeWidth: highlightedEdges.has(slVenueEdgeId) ? 3 : 1.5,
                  },
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 15,
                    height: 15,
                    color: highlightedEdges.has(slVenueEdgeId) ? '#f97316' : '#cbd5e1',
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
  }, [activeFilters, highlightedNodes, highlightedEdges, getFilteredDataForVisualization, setNodes, setEdges, capacityMetrics]);

  // Sync to Neo4j
  const syncToNeo4j = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/graph/sync', { method: 'POST' });
      const result = await response.json();
      
      if (response.ok) {
        alert('Successfully synced to Neo4j!');
      } else {
        alert('Failed to sync: ' + result.error);
      }
    } catch (error) {
      alert('Failed to sync to Neo4j');
    } finally {
      setSyncing(false);
    }
  };

  // Initial load - only once
  useEffect(() => {
    loadGraphData();
  }, []);

  // Reload when filters change
  useEffect(() => {
    if (allData.customers.length > 0) {
      loadGraphData();
    }
  }, [activeFilters]);

  // Handle filter changes
  const handleFilterChange = (filterType: keyof FilterState, value: string) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev, [filterType]: value };
      
      // Reset dependent filters
      if (filterType === 'customer') {
        newFilters.location = 'all';
        newFilters.sublocation = 'all';
      } else if (filterType === 'location') {
        newFilters.sublocation = 'all';
      }
      
      return newFilters;
    });
  };

  // Clear all highlights
  const clearHighlights = () => {
    setHighlightedNodes(new Set());
    setHighlightedEdges(new Set());
    setSearchTerm('');
    loadGraphData(); // Reload to clear visual highlights
  };

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

  const activeFilterCount = Object.values(activeFilters).filter(v => v !== 'all').length;
  const hasHighlights = highlightedNodes.size > 0 || highlightedEdges.size > 0;

  // Get filtered options for cascading dropdowns
  const availableLocations = useMemo(() => {
    if (activeFilters.customer === 'all') return allData.locations;
    return allData.locations.filter(l => l.customerId === activeFilters.customer);
  }, [allData.locations, activeFilters.customer]);

  const availableSublocations = useMemo(() => {
    if (activeFilters.location === 'all') return allData.sublocations;
    return allData.sublocations.filter(sl => sl.locationId === activeFilters.location);
  }, [allData.sublocations, activeFilters.location]);

  if (loading) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
          <p className="text-slate-600 font-medium text-lg">Loading graph data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[600px] rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Top Control Bar */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={loadGraphData}
          className="group px-4 py-2.5 bg-white/90 backdrop-blur-sm text-slate-700 rounded-xl hover:bg-white border border-slate-200 hover:border-blue-300 flex items-center gap-2 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          <span className="font-medium">Refresh</span>
        </button>

        {hasHighlights && (
          <button
            onClick={clearHighlights}
            className="group px-4 py-2.5 bg-white/90 backdrop-blur-sm text-slate-700 rounded-xl hover:bg-red-50 border border-slate-200 hover:border-red-300 flex items-center gap-2 shadow-lg transition-all hover:scale-105"
          >
            <X className="w-4 h-4 text-red-500" />
            <span className="font-medium">Clear</span>
          </button>
        )}
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`group px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all hover:scale-105 font-medium ${
            showFilters 
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700' 
              : 'bg-white/90 backdrop-blur-sm text-slate-700 hover:bg-white border border-slate-200 hover:border-purple-300'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-white/30 rounded-full text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          onClick={syncToNeo4j}
          disabled={syncing}
          className="group px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:from-slate-400 disabled:to-slate-500 flex items-center gap-2 shadow-lg transition-all hover:scale-105 disabled:hover:scale-100 font-medium"
        >
          <Database className="w-4 h-4" />
          {syncing ? 'Syncing...' : 'Sync to Neo4j'}
        </button>
      </div>

      {/* Filter Panel - FIXED: Proper height calculation */}
      {showFilters && (
        <div className="fixed top-20 right-4 z-20 w-80 bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 text-white sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                <h3 className="font-bold text-lg">Filter Graph</h3>
              </div>
              <button
                onClick={() => setShowFilters(false)}
                className="hover:bg-white/20 rounded-lg p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {/* Search */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Search className="w-4 h-4" />
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, city..."
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-sm bg-white text-slate-900 placeholder:text-slate-400"
              />
              {searchResults.length > 0 && (
                <p className="mt-2 text-xs text-slate-600">
                  Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Customer Filter */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600"></div>
                Customer
              </label>
              <select
                value={activeFilters.customer}
                onChange={(e) => handleFilterChange('customer', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm bg-white text-slate-900 cursor-pointer"
              >
                <option value="all" className="text-slate-900">All Customers</option>
                {allData.customers.map(c => (
                  <option key={c._id} value={c._id} className="text-slate-900">{c.name}</option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600"></div>
                Location
              </label>
              <select
                value={activeFilters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                disabled={activeFilters.customer === 'all' && availableLocations.length === allData.locations.length}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm bg-white text-slate-900 cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
              >
                <option value="all" className="text-slate-900">All Locations</option>
                {availableLocations.map(l => (
                  <option key={l._id} value={l._id} className="text-slate-900">{l.name}</option>
                ))}
              </select>
            </div>

            {/* SubLocation Filter */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-orange-400 to-orange-600"></div>
                Sub-Location
              </label>
              <select
                value={activeFilters.sublocation}
                onChange={(e) => handleFilterChange('sublocation', e.target.value)}
                disabled={activeFilters.location === 'all' && availableSublocations.length === allData.sublocations.length}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all text-sm bg-white text-slate-900 cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
              >
                <option value="all" className="text-slate-900">All Sub-Locations</option>
                {availableSublocations.map(sl => (
                  <option key={sl._id} value={sl._id} className="text-slate-900">{sl.name}</option>
                ))}
              </select>
            </div>

            {/* Venue Filter */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-purple-400 to-purple-600"></div>
                Venue
              </label>
              <select
                value={activeFilters.venue}
                onChange={(e) => handleFilterChange('venue', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-sm bg-white text-slate-900 cursor-pointer"
              >
                <option value="all" className="text-slate-900">All Venues</option>
                {allData.venues.map(v => (
                  <option key={v._id} value={v._id} className="text-slate-900">{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reset Filters - FIXED: Always visible at bottom */}
          {activeFilterCount > 0 && (
            <div className="p-4 bg-white/95 backdrop-blur-sm border-t border-slate-200">
              <button
                onClick={() => setActiveFilters({ customer: 'all', location: 'all', sublocation: 'all', venue: 'all' })}
                className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors font-medium text-sm flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Reset All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 min-w-[200px]"
          style={{ 
            top: contextMenu.y, 
            left: contextMenu.x,
          }}
          onMouseLeave={() => setContextMenu({ visible: false, x: 0, y: 0 })}
        >
          <button
            onClick={handleViewAttributes}
            className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 text-sm text-slate-700 transition-colors"
          >
            <Edit2 className="w-4 h-4 text-blue-600" />
            <span className="font-medium">Manage Attributes</span>
          </button>
          <div className="border-t border-slate-200 my-1"></div>
          <button
            onClick={() => setContextMenu({ visible: false, x: 0, y: 0 })}
            className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 text-sm text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltip.x + 20,
            top: tooltip.y + 20,
          }}
        >
          <div className="bg-slate-900/95 backdrop-blur-sm text-white rounded-xl shadow-2xl p-4 max-w-xs border border-slate-700">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                tooltip.type === 'customer' ? 'bg-blue-500' :
                tooltip.type === 'location' ? 'bg-emerald-500' :
                tooltip.type === 'sublocation' ? 'bg-orange-500' :
                'bg-purple-500'
              }`}>
                {tooltip.type === 'customer' ? <Database className="w-5 h-5" /> :
                 tooltip.type === 'location' ? <Layers className="w-5 h-5" /> :
                 tooltip.type === 'sublocation' ? <GitBranch className="w-5 h-5" /> :
                 <Zap className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm mb-1">{tooltip.name}</h4>
                <p className="text-xs text-slate-300 capitalize mb-2">{tooltip.type}</p>
                
                {tooltip.entity.attributes && tooltip.entity.attributes.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-700">
                    <p className="text-xs text-slate-400 mb-1">Attributes:</p>
                    <div className="space-y-1">
                      {tooltip.entity.attributes.slice(0, 3).map((attr: Attribute) => (
                        <div key={attr.key} className="text-xs flex justify-between gap-2">
                          <span className="text-slate-400">{attr.key}:</span>
                          <span className="text-white font-medium">{attr.value}</span>
                        </div>
                      ))}
                      {tooltip.entity.attributes.length > 3 && (
                        <p className="text-xs text-slate-500 italic">
                          +{tooltip.entity.attributes.length - 3} more...
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-slate-400 mt-2 italic">Click to highlight • Right-click for options</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attribute Modal */}
      {showAttributeModal && selectedEntity && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold mb-1">{selectedEntity.name || 'Entity'}</h2>
                  <p className="text-blue-100 capitalize">{selectedEntityType}</p>
                </div>
                <button
                  onClick={() => setShowAttributeModal(false)}
                  className="hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {(() => {
                const { inherited, own, overridden } = getAttributeBreakdown(selectedEntity, selectedEntityType);
                
                return (
                  <div className="space-y-6">
                    {/* Own Attributes */}
                    {own.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-emerald-700 mb-3 flex items-center gap-2">
                          <Sparkles className="w-5 h-5" />
                          Own Attributes
                        </h3>
                        <div className="space-y-2">
                          {own.map((attr: Attribute, i: number) => (
                            <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex justify-between items-center">
                              <span className="font-semibold text-emerald-900">{attr.key}</span>
                              <span className="text-emerald-700">{attr.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inherited Attributes */}
                    {inherited.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-blue-700 mb-3 flex items-center gap-2">
                          <GitBranch className="w-5 h-5" />
                          Inherited Attributes
                        </h3>
                        <div className="space-y-2">
                          {inherited.map((attr: any, i: number) => (
                            <div key={i} className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-blue-900">{attr.key}</span>
                                <span className="text-blue-700">{attr.value}</span>
                              </div>
                              <p className="text-xs text-blue-600">From: {attr.source}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Overridden Attributes */}
                    {overridden.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-amber-700 mb-3 flex items-center gap-2">
                          <Info className="w-5 h-5" />
                          Overridden Attributes
                        </h3>
                        <div className="space-y-2">
                          {overridden.map((attr: any, i: number) => (
                            <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-amber-900">{attr.key}</span>
                                <span className="text-amber-700">{attr.value}</span>
                              </div>
                              <p className="text-xs text-amber-600">Overrides: {attr.source}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {own.length === 0 && inherited.length === 0 && overridden.length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No attributes defined for this entity</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-slate-200">
        <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Entity Types
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-blue-700"></div>
            <span className="text-slate-700 font-medium">Customer</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-emerald-400 to-emerald-600 border-2 border-emerald-700"></div>
            <span className="text-slate-700 font-medium">Location</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-orange-400 to-orange-600 border-2 border-orange-700"></div>
            <span className="text-slate-700 font-medium">Sub-Location</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-purple-700"></div>
            <span className="text-slate-700 font-medium">Venue</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-600 italic">Click: Highlight • Right-click: Options</p>
        </div>
      </div>

      {/* React Flow - FIXED: Nodes are draggable individually */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onPaneClick={clearHighlights}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={1.5}
        panOnDrag={[1, 2]}
        nodesDraggable={true}
        elementsSelectable={true}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={16} 
          size={1}
          color="#cbd5e1"
        />
        <Controls 
          className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200"
        />
        <MiniMap 
          nodeColor={(node) => {
            if (node.id.startsWith('customer-')) return '#3b82f6';
            if (node.id.startsWith('location-')) return '#10b981';
            if (node.id.startsWith('sublocation-')) return '#f97316';
            return '#a855f7';
          }}
          className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200"
          maskColor="rgba(0, 0, 0, 0.1)"
          pannable={true}
          zoomable={true}
        />
      </ReactFlow>
    </div>
  );
}
