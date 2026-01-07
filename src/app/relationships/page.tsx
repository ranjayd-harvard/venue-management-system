import Link from 'next/link';
import RelationshipManager from '@/components/RelationshipManager';

export default function RelationshipsPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Manage Relationships</h1>
          <Link
            href="/"
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Back to Home
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Sub-Location to Venue Assignment</h2>
          <p className="text-gray-700 mb-4">
            Drag and drop venues between the "Assigned" and "Available" columns to manage which venues
            are associated with each sub-location. Select a location, then a sub-location to begin.
          </p>
          <p className="text-gray-600 text-sm">
            Note: Venues are now assigned to <strong>sub-locations</strong> rather than locations directly.
            This allows for more granular capacity management.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <RelationshipManager />
        </div>
      </div>
    </main>
  );
}
