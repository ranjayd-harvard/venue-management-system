import { NextResponse } from 'next/server';
import { getInheritedAttributes } from '@/lib/attributes';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType') as 'location' | 'sublocation';
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId are required' },
        { status: 400 }
      );
    }

    const inheritedAttributes = await getInheritedAttributes(entityType, entityId);
    return NextResponse.json(inheritedAttributes);
  } catch (error) {
    console.error('Error getting inherited attributes:', error);
    return NextResponse.json(
      { error: 'Failed to get inherited attributes' },
      { status: 500 }
    );
  }
}
