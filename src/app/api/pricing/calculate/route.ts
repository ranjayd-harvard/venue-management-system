import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { calculatePricing } from '@/lib/pricing-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subLocationId, startDateTime, endDateTime, timezone } = body;

    console.log('[Pricing API] Request:', {
      subLocationId,
      startDateTime,
      endDateTime,
      timezone: timezone || 'America/New_York (default)'
    });

    // Validation
    if (!subLocationId || !startDateTime || !endDateTime) {
      return NextResponse.json(
        { error: 'Missing required fields: subLocationId, startDateTime, endDateTime' },
        { status: 400 }
      );
    }

    // Parse dates
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (start >= end) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Calculate pricing with timezone
    const result = await calculatePricing(
      new ObjectId(subLocationId),
      start,
      end,
      timezone || 'America/New_York' // Default to EST if not provided
    );

    console.log('[Pricing API] Calculated:', {
      total: result.totalPrice,
      breakdownItems: result.breakdown.length,
      ratesheetsUsed: result.ratesheetsSummary?.totalApplied || 0
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Pricing API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate pricing' },
      { status: 500 }
    );
  }
}
