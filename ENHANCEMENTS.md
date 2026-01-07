# Enhanced Features Documentation

## New Features Added

### 1. **Port Configuration**
- Application now runs on port **3021** by default
- Configure in `package.json` scripts

### 2. **Sub-Location Capacity Management**
- Locations can have a `totalCapacity` field
- Sub-locations have `allocatedCapacity` 
- **Validation**: Sum of all sub-location capacities cannot exceed location's total capacity
- Real-time capacity tracking in the UI

### 3. **Venue-SubLocation Relationships** (Changed from Location-Venue)
- Venues are now assigned to **SubLocations** instead of Locations
- Many-to-many relationship through `sublocation_venues` collection
- New drag-and-drop manager for sub-location-venue relationships (coming soon)

### 4. **Custom Attributes System**
- Add unlimited key-value pairs to:
  - Customers
  - Locations  
  - Sub-Locations
  - Venues
- **Attribute Inheritance**:
  - Locations inherit from Customers
  - SubLocations inherit from Locations (which inherit from Customers)
  - Children can override parent attributes
- Visual indicators show inherited vs. overridden attributes

### 5. **Sub-Location Management Screen**
- Full CRUD for sub-locations
- Inline editing
- Capacity validation
- Located at `/locations/[id]`

### 6. **Graph Visualization** 
- Interactive graph view using **React Flow**
- Visualizes entire hierarchy:
  - Customer (Blue) → Location (Green) → SubLocation (Orange) → Venue (Purple)
- Features:
  - Zoom, pan, minimap
  - Auto-layout
  - Real-time data
  - Located at `/graph`

### 7. **Neo4j Integration**
- Sync data to Neo4j graph database
- One-click sync from graph visualization page
- Maintains relationships in graph format
- Perfect for graph queries and analysis

## API Endpoints

### New Endpoints

**Sub-Location Venues:**
- `GET /api/sublocation-venues` - Get all relationships
- `POST /api/sublocation-venues` - Create relationship
- `DELETE /api/sublocation-venues` - Delete relationship

**Attributes:**
- `GET /api/attributes/inherited?entityType=location&entityId=xxx` - Get inherited attributes

**Graph:**
- `POST /api/graph/sync` - Sync data to Neo4j

**SubLocations (Enhanced):**
- `GET /api/sublocations?locationId=xxx` - Filter by location

## Database Schema Changes

### New Fields

**Location:**
```typescript
{
  totalCapacity?: number;  // NEW
  attributes?: Attribute[]; // NEW
}
```

**SubLocation:**
```typescript
{
  allocatedCapacity?: number; // NEW
  attributes?: Attribute[];    // NEW
}
```

**Customer:**
```typescript
{
  attributes?: Attribute[]; // NEW
}
```

**Venue:**
```typescript
{
  attributes?: Attribute[]; // NEW
}
```

### New Collection
```typescript
sublocation_venues {
  subLocationId: ObjectId;
  venueId: ObjectId;
  createdAt: Date;
}
```

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

New packages added:
- `reactflow` - Graph visualization
- `neo4j-driver` - Neo4j database driver
- `lucide-react` - Icons

### 2. Start Neo4j (Optional)
```bash
docker-compose up -d
```

Access Neo4j Browser at: http://localhost:7474
- Username: `neo4j`
- Password: `password`

### 3. Configure Environment
```bash
cp .env.example .env.local
```

Add Neo4j configuration:
```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
```

### 4. Run Seed Script
```bash
npm run seed
```

### 5. Start Application
```bash
npm run dev
```

Access at: **http://localhost:3021**

## Usage Guide

### Managing Sub-Locations

1. Go to Locations page
2. Click on a location
3. Use the "Sub-Locations" section to:
   - Add new sub-locations
   - Edit existing ones
   - Set allocated capacity
   - Delete sub-locations

**Capacity Validation Example:**
- Location has totalCapacity: 1000
- SubLocation A: 400
- SubLocation B: 600
- ✅ Total: 1000 (Valid)
- ❌ SubLocation C: 100 would fail (exceeds total)

### Managing Attributes

1. Navigate to any entity detail page
2. Scroll to "Attributes" section
3. Add key-value pairs
4. View inherited attributes (read-only, highlighted)
5. Override parent attributes (highlighted in yellow)

**Example Hierarchy:**
```
Customer {industry: "Tech", region: "North"}
  └─ Location {region: "South"}  ← Overrides "region"
      └─ SubLocation inherits {industry: "Tech", region: "South"}
```

### Graph Visualization

1. Navigate to `/graph`
2. View interactive hierarchy
3. Click "Sync to Neo4j" to replicate to graph database
4. Use zoom, pan, and minimap to navigate

### Assigning Venues to Sub-Locations

1. Navigate to a sub-location (via location detail page)
2. Use the venue assignment interface
3. Drag venues to assign them to the sub-location

## Neo4j Queries

After syncing, you can run Cypher queries in Neo4j Browser:

```cypher
// Get all customers with their locations
MATCH (c:Customer)-[:HAS_LOCATION]->(l:Location)
RETURN c, l

// Find all venues in a sub-location
MATCH (sl:SubLocation)-[:HAS_VENUE]->(v:Venue)
WHERE sl.label = "LOT A"
RETURN v

// Get full hierarchy for a customer
MATCH path = (c:Customer)-[:HAS_LOCATION]->(l:Location)
              -[:HAS_SUBLOCATION]->(sl:SubLocation)
              -[:HAS_VENUE]->(v:Venue)
WHERE c.name = "Acme Corporation"
RETURN path
```

## Component Reference

### New Components

**SubLocationManager**
- Props: `locationId`, `locationCapacity`, `onRefresh`
- Handles CRUD for sub-locations
- Validates capacity constraints

**AttributesManager**
- Props: `attributes`, `inheritedAttributes`, `onSave`, `entityName`
- Manages key-value attributes
- Shows inheritance and overrides

**AttributesManagerWrapper**
- Client wrapper for AttributesManager
- Fetches data and inherited attributes

**GraphVisualization**
- Interactive React Flow graph
- Auto-layout algorithm
- Sync to Neo4j button

## Troubleshooting

### Neo4j Connection Issues
```bash
# Check if Neo4j is running
docker ps | grep neo4j

# View Neo4j logs
docker logs venue-neo4j

# Restart Neo4j
docker-compose restart neo4j
```

### Capacity Validation Errors
- Check location's `totalCapacity` is set
- Sum all existing sub-location capacities
- Ensure new capacity + existing doesn't exceed total

### Attributes Not Showing
- Refresh the page
- Check if parent entities have attributes
- Verify API response in browser DevTools

## Performance Considerations

- Graph visualization may be slow with 100+ entities
- Consider pagination for large datasets
- Neo4j sync is async - wait for confirmation

## Future Enhancements

- [ ] Real-time updates using WebSockets
- [ ] Export graph as image
- [ ] Advanced Neo4j query builder
- [ ] Attribute templates/presets
- [ ] Bulk sub-location import
- [ ] Historical capacity tracking

## Migration Notes

If you have existing data, venues assigned to locations (old way) will need to be reassigned to sub-locations (new way). The old `location_venues` collection is deprecated but kept for backward compatibility.

Run this migration script (to be created) to move relationships:
```bash
npm run migrate:venues-to-sublocations
```

---

**Version:** 2.0.0  
**Last Updated:** January 2026
