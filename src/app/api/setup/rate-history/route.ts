import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

/**
 * Setup Rate History Collection via API
 * 
 * Usage:
 *   Navigate to: http://localhost:3021/api/setup/rate-history
 *   or
 *   curl http://localhost:3021/api/setup/rate-history
 */
export async function GET() {
  try {
    const db = await getDb();
    
    console.log('🔧 Setting up rate_history collection...');

    // Check if collection exists
    const collections = await db.listCollections({ name: 'rate_history' }).toArray();
    
    let collectionCreated = false;
    if (collections.length === 0) {
      // Create collection with schema validation
      await db.createCollection('rate_history', {
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['entityType', 'entityId', 'newRate', 'changedAt'],
            properties: {
              entityType: {
                bsonType: 'string',
                enum: ['customer', 'location', 'sublocation'],
                description: 'Type of entity'
              },
              entityId: {
                bsonType: 'objectId',
                description: 'Reference to the entity'
              },
              entityName: {
                bsonType: 'string',
                description: 'Name of the entity'
              },
              oldRate: {
                bsonType: ['double', 'int', 'null'],
                description: 'Previous rate'
              },
              newRate: {
                bsonType: ['double', 'int'],
                minimum: 0,
                description: 'New rate'
              },
              changedBy: {
                bsonType: 'string',
                description: 'User who made the change'
              },
              changedAt: {
                bsonType: 'date',
                description: 'Timestamp'
              },
              reason: {
                bsonType: ['string', 'null'],
                description: 'Optional reason'
              }
            }
          }
        }
      });
      
      collectionCreated = true;
      console.log('✅ Collection created');
    }

    // Create indexes
    const collection = db.collection('rate_history');
    
    const indexes = [
      {
        key: { entityType: 1, entityId: 1, changedAt: -1 },
        name: 'entity_history_idx'
      },
      {
        key: { changedAt: -1 },
        name: 'recent_changes_idx'
      },
      {
        key: { changedBy: 1, changedAt: -1 },
        name: 'user_changes_idx'
      }
    ];

    const indexResults = [];
    for (const index of indexes) {
      try {
        await collection.createIndex(index.key, { name: index.name, background: true });
        indexResults.push({ name: index.name, status: 'created' });
      } catch (error: any) {
        if (error.code === 85 || error.codeName === 'IndexAlreadyExists') {
          indexResults.push({ name: index.name, status: 'already exists' });
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Indexes setup complete');

    // Get collection stats
    const stats = await db.command({ collStats: 'rate_history' });

    return NextResponse.json({
      success: true,
      message: 'Rate history collection setup complete',
      details: {
        collectionCreated,
        indexes: indexResults,
        stats: {
          documents: stats.count,
          storageSize: stats.size,
          indexCount: stats.nindexes
        }
      }
    });

  } catch (error: any) {
    console.error('Error setting up rate_history:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to setup rate_history collection',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
