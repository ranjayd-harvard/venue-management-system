import { NextResponse } from 'next/server';
import { SubLocationRepository } from '@/models/SubLocation';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sublocation = await SubLocationRepository.findById(params.id);
    if (!sublocation) {
      return NextResponse.json(
        { error: 'Sub-location not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(sublocation);
  } catch (error) {
    console.error('Error fetching sub-location:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sub-location' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const sublocation = await SubLocationRepository.update(params.id, body);
    if (!sublocation) {
      return NextResponse.json(
        { error: 'Sub-location not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(sublocation);
  } catch (error) {
    console.error('Error updating sub-location:', error);
    return NextResponse.json(
      { error: 'Failed to update sub-location' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await SubLocationRepository.delete(params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Sub-location not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sub-location:', error);
    return NextResponse.json(
      { error: 'Failed to delete sub-location' },
      { status: 500 }
    );
  }
}
