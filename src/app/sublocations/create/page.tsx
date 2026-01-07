import Link from 'next/link';
import SubLocationForm from '@/components/SubLocationForm';

export default function CreateSubLocationPage() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Create Sub-Location</h1>
          <Link
            href="/"
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            Back to Home
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <SubLocationForm />
        </div>
      </div>
    </main>
  );
}
