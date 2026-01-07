import Link from 'next/link';
import { CustomerRepository } from '@/models/Customer';
import { LocationRepository } from '@/models/Location';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const customers = await CustomerRepository.findAll();

  // Get location counts for each customer
  const customersWithCounts = await Promise.all(
    customers.map(async (customer) => {
      const locations = await LocationRepository.findByCustomerId(customer._id!);
      return {
        ...customer,
        locationCount: locations.length,
      };
    })
  );

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Customers</h1>
          <div className="flex gap-4">
            <Link
              href="/customers/create"
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
            >
              + Create Customer
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
          {customersWithCounts.map((customer) => (
            <div
              key={customer._id!.toString()}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-2xl font-semibold text-blue-600">
                  {customer.name}
                </h2>
                <Link
                  href={`/customers/${customer._id}/manage`}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                >
                  Manage
                </Link>
              </div>
              <div className="space-y-2 text-gray-700">
                <p>
                  <span className="font-medium">Email:</span> {customer.email}
                </p>
                {customer.phone && (
                  <p>
                    <span className="font-medium">Phone:</span> {customer.phone}
                  </p>
                )}
                {customer.address && (
                  <p>
                    <span className="font-medium">Address:</span> {customer.address}
                  </p>
                )}
                <p className="pt-2">
                  <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    {customer.locationCount} {customer.locationCount === 1 ? 'Location' : 'Locations'}
                  </span>
                </p>
              </div>
              <Link
                href={`/customers/${customer._id!.toString()}`}
                className="mt-4 block text-center bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
              >
                View Details
              </Link>
            </div>
          ))}
        </div>

        {customers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No customers found.</p>
            <p className="text-gray-500 mt-2">Run the seed script to populate the database.</p>
          </div>
        )}
      </div>
    </main>
  );
}
