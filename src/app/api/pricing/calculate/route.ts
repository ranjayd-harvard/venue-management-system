import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { PricingEngine } from '@/lib/pricing-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subLocationId, startDateTime, endDateTime } = body;

    // Validation
    if (!subLocationId || !startDateTime || !endDateTime) {
      return NextResponse.json(
        { error: 'Missing required fields: subLocationId, startDateTime, endDateTime' },
        { status: 400 }
      );
    }

    // Calculate pricing
    const result = await PricingEngine.calculatePrice({
      subLocationId: new ObjectId(subLocationId),
      startDateTime: new Date(startDateTime),
      endDateTime: new Date(endDateTime)
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Pricing calculation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate pricing' },
      { status: 500 }
    );
  }
}
