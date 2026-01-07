import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CustomerRepository } from '@/models/Customer';
import { LocationRepository } from '@/models/Location';
import { VenueRepository } from '@/models/Venue';
import { SubLocationRepository } from '@/models/SubLocation';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const customer = await CustomerRepository.findById(params.id);

  if (!customer) {
    notFound();
  }

  const locations = await LocationRepository.findByCustomerId(customer._id!);

  // Get venues and sub-locations for each location
  const locationsWithDetails = await Promise.all(
    locations.map(async (location) => {
      const venues = await VenueRepository.findByLocationId(location._id!);
      const subLocations = await SubLocationRepository.findByLocationId(location._id!);
      return {
        ...location,
        venues,
        subLocations,
      };
    })
  );

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">{customer.name}</h1>
          <div className="flex gap-4">
            <Link
              href={`/customers/${customer._id}/manage`}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
            >
              Manage Customer
            </Link>
            <Link
              href="/customers"
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              Back to Customers
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Customer Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
            <div>
              <p className="text-gray-600">Email</p>
              <p className="font-medium text-gray-900">{customer.email}</p>
            </div>
            {customer.phone && (
              <div>
                <p className="text-gray-600">Phone</p>
                <p className="font-medium text-gray-900">{customer.phone}</p>
              </div>
            )}
            {customer.address && (
              <div className="md:col-span-2">
                <p className="text-gray-600">Address</p>
                <p className="font-medium text-gray-900">{customer.address}</p>
              </div>
            )}
          </div>
        </div>

        <h2 className="text-3xl font-bold mb-6 text-gray-800">Locations</h2>

        {locationsWithDetails.length > 0 ? (
          <div className="space-y-6">
            {locationsWithDetails.map((location) => (
              <div
                key={location._id!.toString()}
                className="bg-white rounded-lg shadow-md p-6"
              >
                <h3 className="text-2xl font-semibold mb-4 text-green-600">
                  {location.name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-gray-700">
                  <div>
                    <p className="text-gray-600">Address</p>
                    <p className="font-medium text-gray-900">{location.address}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">City, State</p>
                    <p className="font-medium text-gray-900">
                      {location.city}, {location.state} {location.zipCode}
                    </p>
                  </div>
                </div>

                {/* Sub-Locations Section */}
                {location.subLocations && location.subLocations.length > 0 && (
                  <div className="mt-6 mb-6">
                    <h4 className="text-lg font-semibold mb-3 text-gray-800">
                      Sub-Locations ({location.subLocations.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {location.subLocations.map((subLocation) => (
                        <div
                          key={subLocation._id!.toString()}
                          className="border border-orange-200 rounded-lg p-3 bg-orange-50"
                        >
                          <h5 className="font-semibold text-orange-600">
                            {subLocation.label}
                          </h5>
                          {subLocation.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {subLocation.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <h4 className="text-lg font-semibold mb-3 text-gray-800">
                    Associated Venues ({location.venues.length})
                  </h4>
                  {location.venues.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {location.venues.map((venue) => (
                        <div
                          key={venue._id!.toString()}
                          className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                        >
                          <h5 className="font-semibold text-purple-600 mb-2">
                            {venue.name}
                          </h5>
                          {venue.description && (
                            <p className="text-sm text-gray-600 mb-2">
                              {venue.description}
                            </p>
                          )}
                          <div className="flex gap-4 text-sm">
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              {venue.venueType}
                            </span>
                            {venue.capacity && (
                              <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                Capacity: {venue.capacity}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No venues associated with this location.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-gray-600 text-lg">No locations found for this customer.</p>
          </div>
        )}
      </div>
    </main>
  );
}
