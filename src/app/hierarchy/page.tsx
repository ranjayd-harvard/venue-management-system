import Link from 'next/link';
import HierarchyManager from '@/components/HierarchyManager';

export default function HierarchyPage() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">Hierarchy Manager</h1>
            <p className="text-gray-600 mt-2">
              Manage your entire organizational hierarchy in one place
            </p>
          </div>
          <Link
            href="/"
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Back to Home
          </Link>
        </div>

        <HierarchyManager />
      </div>
    </main>
  );
}
