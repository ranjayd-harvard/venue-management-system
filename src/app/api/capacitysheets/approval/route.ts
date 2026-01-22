import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { CapacitySheetRepository } from '@/models/CapacitySheet';

// POST - Approval actions (submit, approve, reject)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, approvedBy, rejectionReason } = body;

    if (!id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: id, action' },
        { status: 400 }
      );
    }

    const capacitySheetId = new ObjectId(id);
    let success = false;

    switch (action) {
      case 'submit':
        success = await CapacitySheetRepository.submitForApproval(capacitySheetId);
        break;

      case 'approve':
        if (!approvedBy) {
          return NextResponse.json(
            { error: 'approvedBy is required for approval' },
            { status: 400 }
          );
        }
        success = await CapacitySheetRepository.approve(capacitySheetId, approvedBy);
        break;

      case 'reject':
        if (!rejectionReason) {
          return NextResponse.json(
            { error: 'rejectionReason is required for rejection' },
            { status: 400 }
          );
        }
        success = await CapacitySheetRepository.reject(capacitySheetId, rejectionReason);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: submit, approve, or reject' },
          { status: 400 }
        );
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to perform action' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in approval workflow:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process approval action' },
      { status: 500 }
    );
  }
}
