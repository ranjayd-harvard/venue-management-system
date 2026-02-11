import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * PATCH /api/kafka/ratesheets/[id]/status
 * Update surge ratesheet approval status and active state
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { approvalStatus, isActive } = body;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid ratesheet ID' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Build update object
    const update: any = {
      updatedAt: new Date()
    };

    if (approvalStatus !== undefined) {
      update.approvalStatus = approvalStatus;

      // Auto-set isActive based on approval status
      if (approvalStatus === 'APPROVED') {
        update.isActive = true;
      } else if (approvalStatus === 'REJECTED' || approvalStatus === 'ARCHIVED' || approvalStatus === 'SUPERSEDED') {
        update.isActive = false;
      }
    }

    if (isActive !== undefined) {
      update.isActive = isActive;
    }

    // Update the ratesheet
    const result = await db.collection('ratesheets').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Ratesheet not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Updated ratesheet ${id}:`, update);

    return NextResponse.json({
      success: true,
      ratesheet: result
    });

  } catch (error) {
    console.error('Error updating ratesheet status:', error);
    return NextResponse.json(
      { error: 'Failed to update ratesheet status', details: String(error) },
      { status: 500 }
    );
  }
}
