import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getMaterializedRatesheet, archiveSurgeRatesheet } from '@/lib/surge-materialization';

/**
 * GET /api/surge-pricing/configs/[id]/ratesheet
 *
 * Get the materialized ratesheet for a surge config
 *
 * Response:
 * {
 *   ratesheet: Ratesheet | null,
 *   status: 'none' | 'draft' | 'pending' | 'approved' | 'rejected'
 * }
 */
export async function GET(
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

    console.log('📥 Getting materialized ratesheet for surge config:', id);

    const result = await getMaterializedRatesheet(id);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error getting materialized ratesheet:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to get materialized ratesheet',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/surge-pricing/configs/[id]/ratesheet
 *
 * Archive/deactivate the materialized surge ratesheet
 * Soft-delete: Sets isActive = false
 *
 * Response:
 * {
 *   success: boolean
 * }
 */
export async function DELETE(
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

    console.log('🗑️ Archiving materialized ratesheet for surge config:', id);

    const success = await archiveSurgeRatesheet(id);

    return NextResponse.json({ success });

  } catch (error) {
    console.error('❌ Error archiving materialized ratesheet:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to archive materialized ratesheet',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
