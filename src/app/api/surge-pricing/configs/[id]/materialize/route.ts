import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { materializeSurgeConfig } from '@/lib/surge-materialization';

/**
 * POST /api/surge-pricing/configs/[id]/materialize
 *
 * Materialize a surge config into a physical surge ratesheet
 * Creates a DRAFT ratesheet that must be approved before going live
 *
 * Request body (optional):
 * {
 *   userId?: string // User ID for audit trail
 * }
 *
 * Response:
 * {
 *   success: true,
 *   ratesheet: Ratesheet,
 *   multiplier: number
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

    // Parse request body (optional)
    let userId: string | undefined;
    try {
      const body = await request.json();
      userId = body.userId;
    } catch {
      // No body is fine
    }

    console.log('📥 Materializing surge config:', { id, userId });

    // Materialize the surge config
    const ratesheet = await materializeSurgeConfig(id, userId);

    return NextResponse.json({
      success: true,
      ratesheet,
      multiplier: ratesheet.surgeMultiplierSnapshot
    });

  } catch (error) {
    console.error('❌ Error materializing surge config:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to materialize surge config',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
