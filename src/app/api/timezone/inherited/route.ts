// src/app/api/timezone/inherited/route.ts
// GET: Fetch inherited timezone for entity with source information

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    
    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'Missing entityType or entityId' },
        { status: 400 }
      );
    }
    
    const db = await getDb();
    const result = await findInheritedTimezone(db, entityType, entityId);
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inherited timezone' },
      { status: 500 }
    );
  }
}

async function findInheritedTimezone(
  db: any,
  entityType: string,
  entityId: string
): Promise<{ timezone: string; source: string }> {
  // Check if entity has its own timezone setting
  const entitySetting = await db.collection('timezone_settings').findOne({
    entityType,
    entityId: new ObjectId(entityId)
  });
  
  if (entitySetting) {
    return {
      timezone: entitySetting.timezone,
      source: `${entityType} (Direct)`
    };
  }
  
  // Fallback hierarchy
  if (entityType === 'SUBLOCATION') {
    const sublocation = await db.collection('sublocations').findOne({
      _id: new ObjectId(entityId)
    });
    
    if (sublocation?.locationId) {
      const result = await findInheritedTimezone(
        db,
        'LOCATION',
        sublocation.locationId.toString()
      );
      
      return {
        ...result,
        source: `Location (${result.source})`
      };
    }
  }
  
  if (entityType === 'LOCATION') {
    const location = await db.collection('locations').findOne({
      _id: new ObjectId(entityId)
    });
    
    if (location?.customerId) {
      const result = await findInheritedTimezone(
        db,
        'CUSTOMER',
        location.customerId.toString()
      );
      
      return {
        ...result,
        source: `Customer (${result.source})`
      };
    }
  }
  
  // System-level fallback
  const systemSetting = await db.collection('timezone_settings').findOne({
    entityType: 'SYSTEM'
  });
  
  if (systemSetting) {
    return {
      timezone: systemSetting.timezone,
      source: 'System Default'
    };
  }
  
  // Ultimate fallback
  return {
    timezone: 'America/Detroit',
    source: 'Hardcoded Default'
  };
}