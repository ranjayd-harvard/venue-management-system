import Link from 'next/link';
import { LocationRepository } from '@/models/Location';
import { CustomerRepository } from '@/models/Customer';
import { VenueRepository } from '@/models/Venue';

export const dynamic = 'force-dynamic';

export default async function LocationsPage() {
  const locations = await LocationRepository.findAll();

  // Get customer and venue data for each location
  const locationsWithDetails = await Promise.all(
    locations.map(async (location) => {
      const customer = await CustomerRepository.findById(location.customerId);
      const venues = await VenueRepository.findByLocationId(location._id!);
      return {
        ...location,
        customer,
        venueCount: venues.length,
      };
    })
  );

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Locations</h1>
          <div className="flex gap-4">
            <Link
              href="/locations/create"
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors"
            >
              + Create Location
            </Link>
            <Link
              href="/"
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {locationsWithDetails.map((location) => (
            <div
              key={location._id!.toString()}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-2xl font-semibold text-green-600">
                  {location.name}
                </h2>
                <Link
                  href={`/locations/${location._id}`}
                  className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                >
                  Manage
                </Link>
              </div>
              <div className="space-y-2 text-gray-700">
                <p>
                  <span className="font-medium">Customer:</span>{' '}
                  <Link
                    href={`/customers/${location.customerId.toString()}`}
                    className="text-blue-600 hover:underline"
                  >
                    {location.customer?.name || 'Unknown'}
                  </Link>
                </p>
                <p>
                  <span className="font-medium">Address:</span> {location.address}
                </p>
                <p>
                  <span className="font-medium">City:</span> {location.city}, {location.state} {location.zipCode}
                </p>
                <p>
                  <span className="font-medium">Country:</span> {location.country}
                </p>
                <p className="pt-2">
                  <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    {location.venueCount} {location.venueCount === 1 ? 'Venue' : 'Venues'}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {locations.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No locations found.</p>
            <p className="text-gray-500 mt-2">Run the seed script to populate the database.</p>
          </div>
        )}
      </div>
    </main>
  );
}
