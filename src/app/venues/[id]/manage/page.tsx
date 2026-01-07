import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VenueRepository } from '@/models/Venue';
import { SubLocationVenueRepository } from '@/models/SubLocationVenue';
import { SubLocationRepository } from '@/models/SubLocation';
import { LocationRepository } from '@/models/Location';
import AttributesManagerWrapper from '@/components/AttributesManagerWrapper';

export const dynamic = 'force-dynamic';

export default async function VenueManagePage({
  params,
}: {
  params: { id: string };
}) {
  const venue = await VenueRepository.findById(params.id);

  if (!venue) {
    notFound();
  }

  // Get all sublocations this venue is assigned to
  const relationships = await SubLocationVenueRepository.findByVenueId(venue._id!);
  const sublocations = await Promise.all(
    relationships.map(async (rel) => {
      const sublocation = await SubLocationRepository.findById(rel.subLocationId);
      if (!sublocation) return null;
      
      const location = await LocationRepository.findById(sublocation.locationId);
      return {
        sublocation,
        location,
      };
    })
  );

  const validSublocations = sublocations.filter(Boolean);

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">{venue.name}</h1>
            <p className="text-gray-600 mt-2">Venue Management</p>
          </div>
          <Link
            href="/venues"
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Back to Venues
          </Link>
        </div>

        {/* Venue Information */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Venue Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
            <div>
              <p className="text-gray-600">Name</p>
              <p className="font-medium text-gray-900">{venue.name}</p>
            </div>
            <div>
              <p className="text-gray-600">Type</p>
              <p className="font-medium text-gray-900">{venue.venueType}</p>
            </div>
            {venue.capacity !== undefined && (
              <div>
                <p className="text-gray-600">Capacity</p>
                <p className="font-medium text-gray-900">{venue.capacity}</p>
              </div>
            )}
            {venue.description && (
              <div className="md:col-span-2">
                <p className="text-gray-600">Description</p>
                <p className="font-medium text-gray-900">{venue.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Attributes Manager */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <AttributesManagerWrapper
            entityType="venue"
            entityId={venue._id!.toString()}
            entityName={venue.name}
          />
        </div>

        {/* Assigned Sub-Locations */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">
              Assigned to Sub-Locations ({validSublocations.length})
            </h2>
            <Link
              href="/relationships"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Manage Assignments →
            </Link>
          </div>

          {validSublocations.length > 0 ? (
            <div className="space-y-4">
              {validSublocations.map((item: any) => (
                <div
                  key={item.sublocation._id!.toString()}
                  className="border border-orange-200 rounded-lg p-4 bg-orange-50"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-orange-700 text-lg">
                        {item.sublocation.label}
                      </h3>
                      {item.location && (
                        <p className="text-sm text-gray-600 mt-1">
                          Location: <span className="font-medium">{item.location.name}</span>
                          {' - '}
                          {item.location.city}, {item.location.state}
                        </p>
                      )}
                      {item.sublocation.allocatedCapacity !== undefined && (
                        <p className="text-sm text-gray-600 mt-1">
                          Sub-Location Capacity: {item.sublocation.allocatedCapacity}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/sublocations/${item.sublocation._id}/manage`}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>This venue is not assigned to any sub-locations yet.</p>
              <Link
                href="/relationships"
                className="inline-block mt-4 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded transition-colors"
              >
                Assign to Sub-Location
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
