import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { recalculateSurgeConfig } from '@/lib/surge-materialization';

/**
 * POST /api/surge-pricing/configs/[id]/recalculate
 *
 * Recalculate surge multiplier with latest demand/supply data
 * Creates a new DRAFT ratesheet with updated multiplier
 *
 * Response:
 * {
 *   success: true,
 *   oldMultiplier: number,
 *   newMultiplier: number,
 *   ratesheet: Ratesheet,
 *   changePercent: string
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid surge config ID' },
        { status: 400 }
      );
    }

    console.log('🔄 Recalculating surge config:', id);

    // Recalculate the surge config
    const result = await recalculateSurgeConfig(id);

    // Calculate change percentage
    const changePercent = ((result.newMultiplier - result.oldMultiplier) / result.oldMultiplier * 100).toFixed(1);

    return NextResponse.json({
      success: true,
      oldMultiplier: result.oldMultiplier,
      newMultiplier: result.newMultiplier,
      ratesheet: result.ratesheet,
      changePercent: changePercent + '%'
    });

  } catch (error) {
    console.error('❌ Error recalculating surge config:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to recalculate surge config',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
