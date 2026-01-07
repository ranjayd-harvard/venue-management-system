import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubLocationRepository } from '@/models/SubLocation';
import { LocationRepository } from '@/models/Location';
import { CustomerRepository } from '@/models/Customer';
import { VenueRepository } from '@/models/Venue';
import AttributesManagerWrapper from '@/components/AttributesManagerWrapper';

export const dynamic = 'force-dynamic';

export default async function SubLocationManagePage({
  params,
}: {
  params: { id: string };
}) {
  const sublocation = await SubLocationRepository.findById(params.id);

  if (!sublocation) {
    notFound();
  }

  const location = await LocationRepository.findById(sublocation.locationId);
  const customer = location ? await CustomerRepository.findById(location.customerId) : null;
  const venues = await VenueRepository.findBySubLocationId(sublocation._id!);

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">{sublocation.label}</h1>
            <p className="text-gray-600 mt-2">Sub-Location Management</p>
          </div>
          <Link
            href={`/locations/${location?._id}`}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Back to Location
          </Link>
        </div>

        {/* Breadcrumb */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <nav className="flex text-sm text-gray-600">
            <Link href={`/customers/${customer?._id}`} className="hover:text-blue-600">
              {customer?.name}
            </Link>
            <span className="mx-2">→</span>
            <Link href={`/locations/${location?._id}`} className="hover:text-blue-600">
              {location?.name}
            </Link>
            <span className="mx-2">→</span>
            <span className="text-orange-600 font-medium">{sublocation.label}</span>
          </nav>
        </div>

        {/* SubLocation Information */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Sub-Location Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
            <div>
              <p className="text-gray-600">Label</p>
              <p className="font-medium text-gray-900">{sublocation.label}</p>
            </div>
            {sublocation.allocatedCapacity !== undefined && (
              <div>
                <p className="text-gray-600">Allocated Capacity</p>
                <p className="font-medium text-gray-900">{sublocation.allocatedCapacity}</p>
              </div>
            )}
            {sublocation.description && (
              <div className="md:col-span-2">
                <p className="text-gray-600">Description</p>
                <p className="font-medium text-gray-900">{sublocation.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Attributes Manager */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <AttributesManagerWrapper
            entityType="sublocation"
            entityId={sublocation._id!.toString()}
            entityName={sublocation.label}
          />
        </div>

        {/* Assigned Venues */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">
              Assigned Venues ({venues.length})
            </h2>
            <Link
              href="/relationships"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Manage Assignments →
            </Link>
          </div>

          {venues.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {venues.map((venue) => (
                <div
                  key={venue._id!.toString()}
                  className="border border-purple-200 rounded-lg p-4 bg-purple-50"
                >
                  <h3 className="font-semibold text-purple-700 mb-2">{venue.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{venue.venueType}</p>
                  {venue.capacity !== undefined && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Capacity:</span> {venue.capacity}
                    </p>
                  )}
                  {venue.description && (
                    <p className="text-sm text-gray-600 mt-2">{venue.description}</p>
                  )}
                  <Link
                    href={`/venues/${venue._id}/manage`}
                    className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
                  >
                    View Details →
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No venues assigned to this sub-location yet.</p>
              <Link
                href="/relationships"
                className="inline-block mt-4 bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded transition-colors"
              >
                Assign Venues
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
