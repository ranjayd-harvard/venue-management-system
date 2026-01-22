import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET: Fetch all capacity sheets with optional filters
 *
 * Supports two modes:
 * 1. Direct query: Pass customerId, locationId, or subLocationId to get capacity sheets at that specific level
 * 2. Hierarchy query: Pass subLocationId with resolveHierarchy=true to get ALL applicable capacity sheets
 *    (Customer + Location + SubLocation levels)
 *
 * Query Parameters:
 * - subLocationId: Filter by sublocation (and optionally resolve full hierarchy)
 * - locationId: Filter by location
 * - customerId: Filter by customer
 * - eventId: Filter by event
 * - resolveHierarchy: If 'true' and subLocationId provided, fetches capacity sheets from entire hierarchy
 * - startDate: Filter capacity sheets effective on or before this date (ISO string or YYYY-MM-DD)
 * - endDate: Filter capacity sheets effective until this date (ISO string or YYYY-MM-DD)
 * - includeInactive: Include inactive capacity sheets (default: false)
 * - approvalStatus: Filter by approval status (DRAFT, PENDING_APPROVAL, APPROVED, REJECTED)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subLocationId = searchParams.get('subLocationId');
    const locationId = searchParams.get('locationId');
    const customerId = searchParams.get('customerId');
    const eventId = searchParams.get('eventId');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const resolveHierarchy = searchParams.get('resolveHierarchy') !== 'false'; // Default to true
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const approvalStatus = searchParams.get('approvalStatus');

    const db = await getDb();
    const collection = db.collection('capacitysheets');

    // Build query
    let query: any = {};
    let hierarchyInfo: any = null;

    // If subLocationId provided with hierarchy resolution, lookup the full hierarchy
    if (subLocationId && resolveHierarchy) {
      // Get sublocation to find its location
      const sublocation = await db.collection('sublocations').findOne({
        _id: new ObjectId(subLocationId),
      });

      if (!sublocation) {
        return NextResponse.json(
          { error: 'SubLocation not found' },
          { status: 404 }
        );
      }

      // Get location to find its customer
      const location = await db.collection('locations').findOne({
        _id: new ObjectId(sublocation.locationId),
      });

      if (!location) {
        return NextResponse.json(
          { error: 'Location not found' },
          { status: 404 }
        );
      }

      // Store hierarchy info for response enrichment
      hierarchyInfo = {
        customerId: location.customerId.toString(),
        locationId: location._id.toString(),
        subLocationId: sublocation._id.toString(),
      };

      // Query capacity sheets at ALL levels of the hierarchy (including EVENT if provided)
      const orConditions: any[] = [
        { 'appliesTo.level': 'CUSTOMER', 'appliesTo.entityId': new ObjectId(location.customerId) },
        { 'appliesTo.level': 'LOCATION', 'appliesTo.entityId': new ObjectId(location._id) },
        { 'appliesTo.level': 'SUBLOCATION', 'appliesTo.entityId': new ObjectId(subLocationId) },
      ];

      // Add EVENT level if eventId is provided
      if (eventId) {
        orConditions.push({ 'appliesTo.level': 'EVENT', 'appliesTo.entityId': new ObjectId(eventId) });
        hierarchyInfo.eventId = eventId;
      }

      query.$or = orConditions;
    } else {
      // Direct query mode - filter by specific entity only
      if (eventId) {
        query['appliesTo.level'] = 'EVENT';
        query['appliesTo.entityId'] = new ObjectId(eventId);
      } else if (subLocationId) {
        query['appliesTo.level'] = 'SUBLOCATION';
        query['appliesTo.entityId'] = new ObjectId(subLocationId);
      } else if (locationId) {
        query['appliesTo.level'] = 'LOCATION';
        query['appliesTo.entityId'] = new ObjectId(locationId);
      } else if (customerId) {
        query['appliesTo.level'] = 'CUSTOMER';
        query['appliesTo.entityId'] = new ObjectId(customerId);
      }
    }

    // Filter by active status
    if (!includeInactive) {
      query.isActive = true;
    }

    // Filter by approval status
    if (approvalStatus) {
      query.approvalStatus = approvalStatus;
    }

    // Filter by date range - check if capacity sheet is effective during the requested period
    if (startDate || endDate) {
      const dateFilters: any[] = [];

      if (startDate) {
        // Capacity sheet must have started by the end of the requested period
        // effectiveFrom <= endDate (or startDate if no endDate)
        const queryEndDate = endDate ? new Date(endDate) : new Date(startDate);
        // Set to end of day
        queryEndDate.setHours(23, 59, 59, 999);
        dateFilters.push({
          effectiveFrom: { $lte: queryEndDate }
        });
      }

      if (endDate) {
        // Capacity sheet must not have ended before the requested period starts
        // effectiveTo is null OR effectiveTo >= startDate
        const queryStartDate = startDate ? new Date(startDate) : new Date(endDate);
        // Set to start of day
        queryStartDate.setHours(0, 0, 0, 0);
        dateFilters.push({
          $or: [
            { effectiveTo: null },
            { effectiveTo: { $exists: false } },
            { effectiveTo: { $gte: queryStartDate } }
          ]
        });
      }

      if (dateFilters.length > 0) {
        query.$and = query.$and ? [...query.$and, ...dateFilters] : dateFilters;
      }
    }

    // Fetch capacity sheets sorted by priority (highest first)
    let capacitySheets = await collection
      .find(query)
      .sort({ priority: -1, createdAt: -1 })
      .toArray();

    // Populate related entities
    const customersCollection = db.collection('customers');
    const locationsCollection = db.collection('locations');
    const sublocationsCollection = db.collection('sublocations');
    const eventsCollection = db.collection('events');

    // Process each capacity sheet to enrich with entity info
    const enrichedCapacitySheets = await Promise.all(
      capacitySheets.map(async (sheet) => {
        const enriched: any = { ...sheet };
        const entityId = sheet.appliesTo.entityId;
        const level = sheet.appliesTo.level;

        // Populate based on level
        if (level === 'EVENT') {
          const event = await eventsCollection.findOne({ _id: new ObjectId(entityId) });
          if (event) {
            enriched.event = {
              _id: event._id.toString(),
              name: event.name,
            };
          }
        } else if (level === 'SUBLOCATION') {
          const sublocation = await sublocationsCollection.findOne({ _id: new ObjectId(entityId) });
          if (sublocation) {
            enriched.sublocation = {
              _id: sublocation._id.toString(),
              label: sublocation.label,
            };

            // Populate location
            if (sublocation.locationId) {
              const location = await locationsCollection.findOne({
                _id: new ObjectId(sublocation.locationId),
              });
              if (location) {
                enriched.location = {
                  _id: location._id.toString(),
                  name: location.name,
                };

                // Populate customer
                if (location.customerId) {
                  const customer = await customersCollection.findOne({
                    _id: new ObjectId(location.customerId),
                  });
                  if (customer) {
                    enriched.customer = {
                      _id: customer._id.toString(),
                      name: customer.name,
                    };
                  }
                }
              }
            }
          }
        } else if (level === 'LOCATION') {
          const location = await locationsCollection.findOne({ _id: new ObjectId(entityId) });
          if (location) {
            enriched.location = {
              _id: location._id.toString(),
              name: location.name,
            };

            // Populate customer
            if (location.customerId) {
              const customer = await customersCollection.findOne({
                _id: new ObjectId(location.customerId),
              });
              if (customer) {
                enriched.customer = {
                  _id: customer._id.toString(),
                  name: customer.name,
                };
              }
            }
          }
        } else if (level === 'CUSTOMER') {
          const customer = await customersCollection.findOne({ _id: new ObjectId(entityId) });
          if (customer) {
            enriched.customer = {
              _id: customer._id.toString(),
              name: customer.name,
            };
          }
        }

        return enriched;
      })
    );

    // Return response with optional hierarchy metadata
    if (hierarchyInfo && searchParams.get('includeMeta') === 'true') {
      return NextResponse.json({
        capacitySheets: enrichedCapacitySheets,
        hierarchy: hierarchyInfo,
        query: {
          startDate,
          endDate,
          includeInactive,
          resolveHierarchy,
          approvalStatus,
        },
      });
    }

    return NextResponse.json(enrichedCapacitySheets);
  } catch (error: any) {
    console.error('Error fetching capacity sheets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch capacity sheets', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create new capacity sheet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      description,
      type,
      appliesTo,
      priority,
      conflictResolution,
      effectiveFrom,
      effectiveTo,
      recurrence,
      timeWindows,
      dateRanges,
      eventCapacity,
      isActive,
      createdBy,
    } = body;

    // Validation
    if (!name || !type || priority === undefined || !effectiveFrom || !appliesTo) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, priority, effectiveFrom, appliesTo' },
        { status: 400 }
      );
    }

    // Validate appliesTo structure
    if (!appliesTo.level || !appliesTo.entityId) {
      return NextResponse.json(
        { error: 'appliesTo must have level and entityId' },
        { status: 400 }
      );
    }

    // Validate level
    if (!['CUSTOMER', 'LOCATION', 'SUBLOCATION', 'EVENT'].includes(appliesTo.level)) {
      return NextResponse.json(
        { error: 'appliesTo.level must be CUSTOMER, LOCATION, SUBLOCATION, or EVENT' },
        { status: 400 }
      );
    }

    // Validate priority range based on level
    const db = await getDb();
    const configCollection = db.collection('priority_configs');

    const priorityConfig = await configCollection.findOne({ type: appliesTo.level });

    if (priorityConfig) {
      if (priority < priorityConfig.minPriority || priority > priorityConfig.maxPriority) {
        return NextResponse.json(
          {
            error: `Priority must be between ${priorityConfig.minPriority} and ${priorityConfig.maxPriority} for ${appliesTo.level} level capacity sheets`,
          },
          { status: 400 }
        );
      }
    }

    // Validate capacity rules based on type
    if (type === 'TIME_BASED') {
      if (!timeWindows || timeWindows.length === 0) {
        return NextResponse.json(
          { error: 'Time-based capacity sheets must have at least one time window' },
          { status: 400 }
        );
      }
    } else if (type === 'DATE_BASED') {
      if (!dateRanges || dateRanges.length === 0) {
        return NextResponse.json(
          { error: 'Date-based capacity sheets must have at least one date range' },
          { status: 400 }
        );
      }
    } else if (type === 'EVENT_BASED') {
      if (!eventCapacity) {
        return NextResponse.json(
          { error: 'Event-based capacity sheets must have eventCapacity defined' },
          { status: 400 }
        );
      }
    }

    const collection = db.collection('capacitysheets');

    const newCapacitySheet = {
      name,
      description: description || '',
      type,
      appliesTo: {
        level: appliesTo.level,
        entityId: new ObjectId(appliesTo.entityId),
      },
      priority: parseInt(priority),
      conflictResolution: conflictResolution || 'PRIORITY',
      effectiveFrom: new Date(effectiveFrom),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
      recurrence: recurrence || undefined,
      timeWindows: type === 'TIME_BASED' ? timeWindows : undefined,
      dateRanges: type === 'DATE_BASED'
        ? dateRanges.map((dr: any) => ({
            ...dr,
            startDate: new Date(dr.startDate),
            endDate: new Date(dr.endDate),
          }))
        : undefined,
      eventCapacity: type === 'EVENT_BASED' ? eventCapacity : undefined,
      isActive: isActive !== false,
      approvalStatus: 'DRAFT',
      createdBy: createdBy || 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(newCapacitySheet);

    const created = await collection.findOne({ _id: result.insertedId });
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('Error creating capacity sheet:', error);
    return NextResponse.json(
      { error: 'Failed to create capacity sheet', details: error.message },
      { status: 500 }
    );
  }
}
