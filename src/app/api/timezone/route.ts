// src/app/api/timezone/route.ts
// GET: Fetch timezone settings
// POST: Set timezone for entity

import { NextRequest, NextResponse } from 'next/server';
import { TimezoneSettingsRepository } from '@/models/TimezoneSettings';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    
    if (entityType && entityId) {
      // Get timezone for specific entity
      const timezone = await TimezoneSettingsRepository.getTimezoneForEntity(
        entityType as any,
        entityId
      );
      
      return NextResponse.json({ timezone });
    }
    
    // Get all timezone settings
    const settings = await TimezoneSettingsRepository.findAll();
    return NextResponse.json(settings);
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch timezone settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entityType, entityId, timezone, displayName } = body;
    
    if (!entityType || !timezone || !displayName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const result = await TimezoneSettingsRepository.setTimezone(
      entityType,
      timezone,
      displayName,
      entityId
    );
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to set timezone' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    
    if (!entityType) {
      return NextResponse.json(
        { error: 'Missing entityType' },
        { status: 400 }
      );
    }
    
    const deleted = await TimezoneSettingsRepository.delete(
      entityType,
      entityId || undefined
    );
    
    return NextResponse.json({ deleted });
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete timezone setting' },
      { status: 500 }
    );
  }
}