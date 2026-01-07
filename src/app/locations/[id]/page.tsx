import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LocationRepository } from '@/models/Location';
import { CustomerRepository } from '@/models/Customer';
import SubLocationManager from '@/components/SubLocationManager';
import AttributesManagerWrapper from '@/components/AttributesManagerWrapper';

export const dynamic = 'force-dynamic';

export default async function LocationManagePage({
  params,
}: {
  params: { id: string };
}) {
  const location = await LocationRepository.findById(params.id);

  if (!location) {
    notFound();
  }

  const customer = await CustomerRepository.findById(location.customerId);

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">{location.name}</h1>
          <Link
            href="/locations"
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Back to Locations
          </Link>
        </div>

        {/* Location Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Location Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700">
            <div>
              <p className="text-gray-600">Customer</p>
              <p className="font-medium text-gray-900">
                <Link href={`/customers/${customer?._id}`} className="text-blue-600 hover:underline">
                  {customer?.name || 'Unknown'}
                </Link>
              </p>
            </div>
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
            <div>
              <p className="text-gray-600">Country</p>
              <p className="font-medium text-gray-900">{location.country}</p>
            </div>
            {location.totalCapacity && (
              <div>
                <p className="text-gray-600">Total Capacity</p>
                <p className="font-medium text-gray-900">{location.totalCapacity}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sub-Locations Manager */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <SubLocationManager 
            locationId={location._id!.toString()} 
            locationCapacity={location.totalCapacity}
          />
        </div>

        {/* Attributes Manager */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <AttributesManagerWrapper
            entityType="location"
            entityId={location._id!.toString()}
            entityName={location.name}
          />
        </div>
      </div>
    </main>
  );
}
