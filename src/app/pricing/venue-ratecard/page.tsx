'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VenueRatecardRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to digital ratecard with venue mode
    router.push('/pricing/digital-ratecard?mode=venue');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">Redirecting to Digital Ratecard...</p>
      </div>
    </div>
  );
}
