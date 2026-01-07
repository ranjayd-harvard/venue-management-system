import Link from 'next/link';
import { VenueRepository } from '@/models/Venue';
import { SubLocationVenueRepository } from '@/models/SubLocationVenue';

export const dynamic = 'force-dynamic';

export default async function VenuesPage() {
  const venues = await VenueRepository.findAll();

  // Get sublocation count for each venue
  const venuesWithCounts = await Promise.all(
    venues.map(async (venue) => {
      const subLocationVenues = await SubLocationVenueRepository.findByVenueId(venue._id!);
      return {
        ...venue,
        subLocationCount: subLocationVenues.length,
      };
    })
  );

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Venues</h1>
          <div className="flex gap-4">
            <Link
              href="/venues/create"
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded transition-colors"
            >
              + Create Venue
            </Link>
            <Link
              href="/"
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venuesWithCounts.map((venue) => (
            <div
              key={venue._id!.toString()}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-2xl font-semibold text-purple-600">
                  {venue.name}
                </h2>
                <Link
                  href={`/venues/${venue._id}/manage`}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Manage →
                </Link>
              </div>
              <div className="space-y-2 text-gray-700">
                {venue.description && (
                  <p className="text-gray-600 mb-3">{venue.description}</p>
                )}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                    {venue.venueType}
                  </span>
                  {venue.capacity && (
                    <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                      Capacity: {venue.capacity}
                    </span>
                  )}
                </div>
                <p className="pt-2">
                  <span className="inline-block bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                    Assigned to {venue.subLocationCount} {venue.subLocationCount === 1 ? 'Sub-Location' : 'Sub-Locations'}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {venues.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No venues found.</p>
            <p className="text-gray-500 mt-2">Run the seed script to populate the database.</p>
          </div>
        )}
      </div>
    </main>
  );
}
