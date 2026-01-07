import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CustomerRepository } from '@/models/Customer';
import { LocationRepository } from '@/models/Location';
import { VenueRepository } from '@/models/Venue';
import { SubLocationRepository } from '@/models/SubLocation';
import AttributesManagerWrapper from '@/components/AttributesManagerWrapper';

export const dynamic = 'force-dynamic';

export default async function CustomerManagePage({
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
              href={`/customers/${customer._id}/edit`}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
            >
              Edit Customer
            </Link>
            <Link
              href="/customers"
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              Back to Customers
            </Link>
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
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

        {/* Attributes Manager */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <AttributesManagerWrapper
            entityType="customer"
            entityId={customer._id!.toString()}
            entityName={customer.name}
          />
        </div>

        {/* Locations Section */}
        <h2 className="text-3xl font-bold mb-6 text-gray-800">Locations ({locationsWithDetails.length})</h2>

        {locationsWithDetails.length > 0 ? (
          <div className="space-y-6">
            {locationsWithDetails.map((location) => (
              <div
                key={location._id!.toString()}
                className="bg-white rounded-lg shadow-md p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-2xl font-semibold text-green-600">
                    {location.name}
                  </h3>
                  <Link
                    href={`/locations/${location._id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Manage Location →
                  </Link>
                </div>
                
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
                  {location.totalCapacity && (
                    <div>
                      <p className="text-gray-600">Total Capacity</p>
                      <p className="font-medium text-gray-900">{location.totalCapacity}</p>
                    </div>
                  )}
                </div>

                {/* Sub-Locations Section */}
                {location.subLocations && location.subLocations.length > 0 && (
                  <div className="mt-4">
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
                          {subLocation.allocatedCapacity !== undefined && (
                            <p className="text-sm text-gray-700 mt-1">
                              Capacity: {subLocation.allocatedCapacity}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-gray-600 text-lg mb-4">No locations found for this customer.</p>
            <Link
              href="/locations/create"
              className="inline-block bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded transition-colors"
            >
              Create First Location
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
