import Link from 'next/link';
import VenueForm from '@/components/VenueForm';

export default function CreateVenuePage() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Create Venue</h1>
          <Link
            href="/venues"
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Back to Venues
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <VenueForm />
        </div>
      </div>
    </main>
  );
}
