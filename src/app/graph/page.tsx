import Link from 'next/link';
import GraphVisualization from '@/components/GraphVisualization';

export default function GraphPage() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">Graph Visualization</h1>
            <p className="text-gray-600 mt-2">
              Visual representation of customer hierarchies and relationships
            </p>
          </div>
          <Link
            href="/"
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Back to Home
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <GraphVisualization />
        </div>

        {/* Capacity Allocation Categories Legend */}
        <div className="mt-6 bg-gradient-to-r from-teal-50 to-amber-50 border border-teal-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-teal-900 mb-4">Capacity Allocation Categories</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Transient */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#14B8A6' }}></div>
              <div>
                <div className="text-sm font-medium text-gray-900">Transient</div>
                <div className="text-xs text-gray-600">Walk-ins</div>
              </div>
            </div>
            {/* Events */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#EC4899' }}></div>
              <div>
                <div className="text-sm font-medium text-gray-900">Events</div>
                <div className="text-xs text-gray-600">Booked events</div>
              </div>
            </div>
            {/* Reserved */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#8B5CF6' }}></div>
              <div>
                <div className="text-sm font-medium text-gray-900">Reserved</div>
                <div className="text-xs text-gray-600">Pre-set</div>
              </div>
            </div>
            {/* Unavailable */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#9CA3AF' }}></div>
              <div>
                <div className="text-sm font-medium text-gray-900">Unavailable</div>
                <div className="text-xs text-gray-600">Closed/Blackout</div>
              </div>
            </div>
            {/* Ready To Use */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#F59E0B' }}></div>
              <div>
                <div className="text-sm font-medium text-gray-900">Ready To Use</div>
                <div className="text-xs text-gray-600">Available</div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm text-teal-700 italic">
            Each node shows an allocation bar when capacity categories are configured for that entity.
          </p>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">About the Graph</h3>
          <div className="text-blue-800 space-y-2">
            <p>
              <strong>Hierarchy:</strong> Customer → Location → Sub-Location → Venue
            </p>
            <p className="mt-2">
              <strong>Events:</strong> Events connect to their associated entity (Customer, Location, Sub-Location, or Venue)
            </p>
            <p className="mt-3">
              <strong>Capacity Attributes Shown:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 text-sm">
              <li><strong>Min:</strong> Minimum capacity threshold</li>
              <li><strong>Max:</strong> Maximum capacity limit</li>
              <li><strong>Default:</strong> Default operating capacity</li>
              <li><strong>Allocated:</strong> Currently allocated capacity (not shown for events)</li>
              <li><strong>Allocation Bar:</strong> Visual breakdown by category (T=Transient, E=Events, R=Reserved)</li>
            </ul>
            <p className="mt-3">
              <strong>Blue nodes:</strong> Customers (aggregated from all child locations)
            </p>
            <p>
              <strong>Green nodes:</strong> Locations (aggregated from all child sub-locations + own config)
            </p>
            <p>
              <strong>Orange nodes:</strong> Sub-Locations (own capacity configuration)
            </p>
            <p>
              <strong>Purple nodes:</strong> Venues with individual capacity shown
            </p>
            <p>
              <strong>Rose/Pink nodes:</strong> Events with their own capacity configuration
            </p>
            <p>
              <strong>Edge labels:</strong> Show capacity values being transferred through the hierarchy
            </p>
            <p className="mt-3 text-sm italic">
              <strong>Note:</strong> Capacity values aggregate upward through the hierarchy: SubLocation → Location → Customer
            </p>
            <p className="mt-4 font-semibold">
              Capacity Flow Example:
            </p>
            <div className="bg-white rounded p-3 text-sm font-mono">
              Location (Total: 1000)<br/>
              ├─ SubLoc A (Allocated: 600)<br/>
              │  ├─ Venue 1 (Cap: 300)<br/>
              │  └─ Venue 2 (Cap: 250) → 50 remaining<br/>
              ├─ SubLoc B (Allocated: 300)<br/>
              │  └─ Venue 3 (Cap: 300) → 0 remaining<br/>
              └─ Available: 100 unallocated
            </div>
            <p className="mt-4">
              <strong>Neo4j Integration:</strong> Click "Sync to Neo4j" to replicate this data to a Neo4j graph database.
              Make sure Neo4j is running on bolt://localhost:7687 with credentials (neo4j/password).
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
