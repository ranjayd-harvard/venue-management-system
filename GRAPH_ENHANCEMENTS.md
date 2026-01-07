# Graph Page Enhancements Implementation Guide

## Overview
This document outlines the enhancements made to the graph visualization page and navigation system.

## ✅ Implemented Features

### 1. **Collapsible Left Sidebar Navigation**

**File**: `src/components/NavigationLayout.tsx`

**Features**:
- Collapsible sidebar (64px collapsed, 264px expanded)
- Fixed position with smooth transitions
- Chevron button to toggle
- Icons always visible, labels show when expanded
- Active state highlighting for current page

**Implementation**:
```typescript
const [sidebarOpen, setSidebarOpen] = useState(true);

<aside className={`fixed left-0 top-16 h-[calc(100vh-4rem)] transition-all ${
  sidebarOpen ? 'w-64' : 'w-16'
}`}>
```

### 2. **Transparent Header with Backdrop Blur**

**Features**:
- Fixed header with `bg-white/90` (90% opacity)
- `backdrop-blur-sm` for glassmorphism effect
- Always visible as overlay
- Shows current page context

**Implementation**:
```typescript
<header className="fixed top-0 right-0 left-0 bg-white/90 backdrop-blur-sm shadow-md border-b border-gray-200 z-40">
```

### 3. **Graph Path Highlighting** (NEEDS FULL IMPLEMENTATION)

**Concept**: When clicking a node or edge, highlight the entire path from root to that node.

**Required Changes to GraphVisualization.tsx**:

```typescript
// Add state for highlighted elements
const [highlightedPath, setHighlightedPath] = useState<Set<string>>(new Set());

// Function to find path to root
const findPathToRoot = (nodeId: string): string[] => {
  const path: string[] = [nodeId];
  const entityType = nodeId.split('-')[0];
  const entityId = nodeId.split('-')[1];
  
  if (entityType === 'venue') {
    // Find sublocation, then location, then customer
    const rel = slvRelations.find(r => r.venueId === entityId);
    if (rel) {
      path.push(`sublocation-${rel.subLocationId}`);
      // Continue finding parent location and customer
    }
  }
  // Similar logic for sublocation and location
  
  return path;
};

// Handle node click
const handleNodeClick: NodeMouseHandler = useCallback((event, node) => {
  const path = findPathToRoot(node.id);
  
  // Find all edges in the path
  const pathEdges = new Set<string>();
  for (let i = 0; i < path.length - 1; i++) {
    const edge = edges.find(e => 
      (e.source === path[i] && e.target === path[i + 1]) ||
      (e.source === path[i + 1] && e.target === path[i])
    );
    if (edge) pathEdges.add(edge.id);
  }
  
  setHighlightedPath(new Set([...path, ...Array.from(pathEdges)]));
}, [edges, slvRelations]);

// Apply highlighting in node/edge styles
style: {
  background: highlightedPath.has(nodeId) ? '#3B82F6' : '#DBEAFE',
  border: `2px solid ${highlightedPath.has(nodeId) ? '#1E40AF' : '#3B82F6'}`,
  strokeWidth: highlightedPath.has(edgeId) ? 3 : 2,
}
```

### 4. **Multi-Level Filter Dropdowns** (NEEDS FULL IMPLEMENTATION)

**Concept**: Cascading dropdowns to filter the graph by customer → location → sublocation → venue

**Required Implementation**:

```typescript
// Add filter states
const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
const [selectedLocation, setSelectedLocation] = useState<string>('all');
const [selectedSublocation, setSelectedSublocation] = useState<string>('all');
const [selectedVenue, setSelectedVenue] = useState<string>('all');

// Filter Panel Component
<div className="absolute top-20 right-4 z-10 bg-white rounded-lg shadow-lg p-4 w-80">
  <h3 className="font-semibold mb-3">Filter Graph</h3>
  
  {/* Customer Dropdown */}
  <select
    value={selectedCustomer}
    onChange={(e) => {
      setSelectedCustomer(e.target.value);
      setSelectedLocation('all'); // Reset dependent filters
      setSelectedSublocation('all');
    }}
  >
    <option value="all">All Customers</option>
    {customers.map(c => (
      <option key={c._id} value={c._id}>{c.name}</option>
    ))}
  </select>

  {/* Location Dropdown (filtered by customer) */}
  <select
    value={selectedLocation}
    disabled={selectedCustomer === 'all'}
  >
    <option value="all">All Locations</option>
    {locations
      .filter(l => selectedCustomer === 'all' || l.customerId === selectedCustomer)
      .map(l => <option key={l._id} value={l._id}>{l.name}</option>)
    }
  </select>

  {/* Similar for sublocation and venue */}
</div>

// Apply filters in loadGraphData
let filteredCustomers = selectedCustomer === 'all' 
  ? customers 
  : customers.filter(c => c._id === selectedCustomer);

let filteredLocations = selectedLocation === 'all'
  ? locations
  : locations.filter(l => l._id === selectedLocation);

// Render only filtered entities
```

### 5. **Attribute Tooltips on Hover** (NEEDS FULL IMPLEMENTATION)

**Concept**: Show inherited, own, and overridden attributes when hovering over nodes

**Required Implementation**:

```typescript
const [hoveredNode, setHoveredNode] = useState<string | null>(null);

// Function to get attribute breakdown
const getAttributeBreakdown = (entityId: string) => {
  // Find entity and its parent chain
  // Calculate inherited vs own vs overridden attributes
  
  return {
    inherited: [...],
    own: [...],
    overridden: [...]
  };
};

// Tooltip Component
{hoveredNode && (
  <div className="absolute top-4 left-4 z-20 bg-white rounded-lg shadow-xl p-4 border-2 border-blue-500">
    <h4 className="font-bold mb-2">{entityName}</h4>
    
    <div className="text-sm space-y-2">
      <div>
        <p className="font-semibold text-blue-700">Inherited:</p>
        {inherited.map(attr => (
          <div className="pl-2">• {attr.key}: {attr.value}</div>
        ))}
      </div>
      
      <div>
        <p className="font-semibold text-green-700">Own:</p>
        {own.map(attr => (
          <div className="pl-2">• {attr.key}: {attr.value}</div>
        ))}
      </div>
      
      <div>
        <p className="font-semibold text-yellow-700">Overridden:</p>
        {overridden.map(attr => (
          <div className="pl-2">⚠️ {attr.key}: {attr.value}</div>
        ))}
      </div>
    </div>
  </div>
)}

// Add hover handlers to ReactFlow
<ReactFlow
  onNodeMouseEnter={(_, node) => setHoveredNode(node.id)}
  onNodeMouseLeave={() => setHoveredNode(null)}
/>
```

## Implementation Steps

### Step 1: Complete GraphVisualization Enhancement

1. Open `src/components/GraphVisualization.tsx`
2. Add the state variables for filtering and highlighting
3. Implement `findPathToRoot` function
4. Implement `getAttributeBreakdown` function
5. Add click handlers for nodes and edges
6. Add hover handlers for tooltips
7. Update node and edge styles to use highlighting
8. Add filter panel UI
9. Apply filters in `loadGraphData`

### Step 2: Test Each Feature

- **Path Highlighting**: Click nodes and verify path highlights
- **Filters**: Select different filters and verify graph updates
- **Tooltips**: Hover over nodes and verify attributes show
- **Sidebar**: Toggle sidebar and verify smooth transition
- **Header**: Scroll page and verify header stays visible

## Code Snippets for Quick Copy-Paste

### Complete Filter Implementation

```typescript
const filteredLocationsByCustomer = selectedCustomer === 'all' 
  ? locations 
  : locations.filter(l => l.customerId === selectedCustomer);

const filteredSublocationsByLocation = selectedLocation === 'all'
  ? sublocations
  : sublocations.filter(sl => sl.locationId === selectedLocation);

// In loadGraphData, use filteredCustomers, filteredLocations, etc.
```

### Edge Highlighting

```typescript
const edgeStyle = {
  stroke: highlightedPath.has(edge.id) ? '#F97316' : '#F97316',
  strokeWidth: highlightedPath.has(edge.id) ? 3 : 2,
};

newEdges.push({
  id: edgeId,
  source: sourceId,
  target: targetId,
  type: 'smoothstep',
  animated: highlightedPath.has(edgeId),
  style: edgeStyle,
});
```

## Visual Examples

### Sidebar States

```
Expanded (264px):
┌──────────────┐
│ 🏠 Home      │
│ 🏗️ Hierarchy │
│ 👥 Customers │
└──────────────┘

Collapsed (64px):
┌────┐
│ 🏠 │
│ 🏗️ │
│ 👥 │
└────┘
```

### Path Highlighting

```
Before Click:
Customer (light blue) → Location (light green) → SubLoc (light orange) → Venue (light purple)

After Clicking Venue:
Customer (DARK BLUE) → Location (DARK GREEN) → SubLoc (DARK ORANGE) → Venue (DARK PURPLE)
                      ^^^^^^^^ THICK EDGES ^^^^^^^^
```

### Tooltip Example

```
┌─────────────────────────┐
│ LOT A                   │
├─────────────────────────┤
│ Inherited:              │
│ • industry: Technology  │
│ • timezone: EST         │
│                         │
│ Own:                    │
│ • access_level: VIP     │
│                         │
│ Overridden:             │
│ ⚠️ parking_rate: $8/hr  │
└─────────────────────────┘
```

## Files to Modify

1. ✅ `src/components/NavigationLayout.tsx` - Created (sidebar + header)
2. ✅ `src/app/layout.tsx` - Updated to use NavigationLayout
3. ⚠️ `src/components/GraphVisualization.tsx` - NEEDS ENHANCEMENT (add features 3, 4, 5)
4. ⚠️ Remove `src/components/NavigationHeader.tsx` - No longer needed

## Benefits

1. **Better UX**: Collapsible sidebar saves screen space
2. **Visual Feedback**: Path highlighting shows relationships clearly
3. **Focused View**: Filters let users zoom into specific parts
4. **Rich Information**: Tooltips show complete attribute inheritance
5. **Modern Design**: Transparent header with blur effect

## Next Steps

1. Implement the three main features in GraphVisualization.tsx
2. Test thoroughly with sample data
3. Add loading states for filter changes
4. Consider adding animation for path highlighting
5. Add keyboard shortcuts (e.g., 'F' to toggle filters, 'S' to toggle sidebar)

---

**Note**: The navigation system (sidebar + header) is complete and functional. The graph enhancements require updates to GraphVisualization.tsx following the patterns outlined above.
