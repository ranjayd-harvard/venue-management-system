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

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">About the Graph</h3>
          <div className="text-blue-800 space-y-2">
            <p>
              <strong>Hierarchy:</strong> Customer → Location → Sub-Location → Venue
            </p>
            <p>
              <strong>Blue nodes:</strong> Customers (root entities)
            </p>
            <p>
              <strong>Green nodes:</strong> Locations with capacity breakdown:
            </p>
            <ul className="list-disc list-inside ml-4 text-sm">
              <li><strong>Total:</strong> Maximum capacity for the location</li>
              <li><strong>Allocated:</strong> Sum of all sub-location capacities</li>
              <li><strong>Available:</strong> Remaining unallocated capacity (shown in green if positive, red if over-allocated)</li>
            </ul>
            <p>
              <strong>Orange nodes:</strong> Sub-Locations showing:
            </p>
            <ul className="list-disc list-inside ml-4 text-sm">
              <li><strong>Allocated:</strong> Capacity assigned to this sub-location</li>
              <li><strong>Venues:</strong> Total capacity of all assigned venues</li>
              <li><strong>Left:</strong> Remaining capacity (✓ if within limit, ⚠️ if exceeded)</li>
            </ul>
            <p>
              <strong>Purple nodes:</strong> Venues with individual capacity shown
            </p>
            <p>
              <strong>Edge labels:</strong> Show capacity values being transferred through the hierarchy
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
