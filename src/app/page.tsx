import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-800">Venue Management System</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">Welcome</h2>
          <p className="text-gray-700 mb-4">
            This system helps you manage customers, their locations, sub-locations, and associated venues. 
            Each customer can have multiple locations, and locations can be associated with
            multiple venues (many-to-many relationship). Each location can also have sub-locations.
          </p>
        </div>

        <h2 className="text-2xl font-bold mb-4 text-gray-800">Main Sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Link 
            href="/hierarchy" 
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg p-6 transition-colors border-4 border-indigo-400"
          >
            <h3 className="text-xl font-semibold mb-2">🏗️ Hierarchy Manager</h3>
            <p className="text-indigo-100">Unified tree view - Manage everything in one place!</p>
          </Link>

          <Link 
            href="/customers" 
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg p-6 transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2">Customers</h3>
            <p className="text-blue-100">View and manage customers</p>
          </Link>

          <Link 
            href="/locations" 
            className="bg-green-500 hover:bg-green-600 text-white rounded-lg p-6 transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2">Locations</h3>
            <p className="text-green-100">View and manage locations</p>
          </Link>

          <Link 
            href="/venues" 
            className="bg-purple-500 hover:bg-purple-600 text-white rounded-lg p-6 transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2">Venues</h3>
            <p className="text-purple-100">View and manage venues</p>
          </Link>

          <Link 
            href="/relationships" 
            className="bg-pink-500 hover:bg-pink-600 text-white rounded-lg p-6 transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2">Relationships</h3>
            <p className="text-pink-100">Drag & drop manager</p>
          </Link>

          <Link 
            href="/graph" 
            className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg p-6 transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2">Graph View</h3>
            <p className="text-cyan-100">Visualize hierarchy</p>
          </Link>
        </div>

        <h2 className="text-2xl font-bold mb-4 text-gray-800">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link 
            href="/customers/create" 
            className="bg-white border-2 border-blue-500 hover:bg-blue-50 text-blue-600 rounded-lg p-4 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-2xl">+</span>
            <span>New Customer</span>
          </Link>

          <Link 
            href="/locations/create" 
            className="bg-white border-2 border-green-500 hover:bg-green-50 text-green-600 rounded-lg p-4 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-2xl">+</span>
            <span>New Location</span>
          </Link>

          <Link 
            href="/venues/create" 
            className="bg-white border-2 border-purple-500 hover:bg-purple-50 text-purple-600 rounded-lg p-4 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-2xl">+</span>
            <span>New Venue</span>
          </Link>

          <Link 
            href="/sublocations/create" 
            className="bg-white border-2 border-orange-500 hover:bg-orange-50 text-orange-600 rounded-lg p-4 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-2xl">+</span>
            <span>New Sub-Location</span>
          </Link>
          <Link 
            href="/admin/seed" 
            className="bg-white border-2 border-red-500 hover:bg-red-50 text-red-600 rounded-lg p-4 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-2xl">+</span>
            <span>Admin - Database Seeding</span>
          </Link>          
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2 text-yellow-800">Getting Started</h3>
          <ol className="list-decimal list-inside space-y-2 text-yellow-900">
            <li>Make sure MongoDB is running</li>
            <li>Run <code className="bg-yellow-100 px-2 py-1 rounded">npm install</code> to install dependencies</li>
            <li>Run <code className="bg-yellow-100 px-2 py-1 rounded">npm run seed</code> to populate the database</li>
            <li>Run <code className="bg-yellow-100 px-2 py-1 rounded">npm run dev</code> to start the development server</li>
          </ol>
        </div>
      </div>
    </main>
  );
}

