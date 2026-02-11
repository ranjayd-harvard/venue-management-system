import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET: Fetch all ratesheets with optional filters
 * 
 * Supports two modes:
 * 1. Direct query: Pass customerId, locationId, or subLocationId to get ratesheets at that specific level
 * 2. Hierarchy query: Pass subLocationId with resolveHierarchy=true to get ALL applicable ratesheets
 *    (Customer + Location + SubLocation levels)
 * 
 * Query Parameters:
 * - subLocationId: Filter by sublocation (and optionally resolve full hierarchy)
 * - locationId: Filter by location
 * - customerId: Filter by customer
 * - resolveHierarchy: If 'true' and subLocationId provided, fetches ratesheets from entire hierarchy
 * - startDate: Filter ratesheets effective on or before this date (ISO string or YYYY-MM-DD)
 * - endDate: Filter ratesheets effective until this date (ISO string or YYYY-MM-DD)
 * - includeInactive: Include inactive ratesheets (default: false)
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

    const db = await getDb();
    const collection = db.collection('ratesheets');

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

      // Query ratesheets at ALL levels of the hierarchy (including EVENT if provided)
      // Support both old schema and new appliesTo structure
      const orConditions: any[] = [
        // Old schema
        { customerId: new ObjectId(location.customerId) },
        { locationId: new ObjectId(location._id) },
        { subLocationId: new ObjectId(subLocationId) },
        // New schema
        { 'appliesTo.level': 'CUSTOMER', 'appliesTo.entityId': new ObjectId(location.customerId) },
        { 'appliesTo.level': 'LOCATION', 'appliesTo.entityId': new ObjectId(location._id) },
        { 'appliesTo.level': 'SUBLOCATION', 'appliesTo.entityId': new ObjectId(subLocationId) },
      ];

      // Add EVENT level if eventId is provided
      if (eventId) {
        orConditions.push({ eventId: new ObjectId(eventId) });
        orConditions.push({ 'appliesTo.level': 'EVENT', 'appliesTo.entityId': new ObjectId(eventId) });
        hierarchyInfo.eventId = eventId;
      }

      query.$or = orConditions;
    } else {
      // Direct query mode - filter by specific entity only
      // Support both old schema and new appliesTo structure
      const orConditions: any[] = [];

      if (eventId) {
        orConditions.push({ eventId: new ObjectId(eventId) });
        orConditions.push({ 'appliesTo.level': 'EVENT', 'appliesTo.entityId': new ObjectId(eventId) });
      }
      if (subLocationId) {
        orConditions.push({ subLocationId: new ObjectId(subLocationId) });
        orConditions.push({ 'appliesTo.level': 'SUBLOCATION', 'appliesTo.entityId': new ObjectId(subLocationId) });
      }
      if (locationId) {
        orConditions.push({ locationId: new ObjectId(locationId) });
        orConditions.push({ 'appliesTo.level': 'LOCATION', 'appliesTo.entityId': new ObjectId(locationId) });
      }
      if (customerId) {
        orConditions.push({ customerId: new ObjectId(customerId) });
        orConditions.push({ 'appliesTo.level': 'CUSTOMER', 'appliesTo.entityId': new ObjectId(customerId) });
      }

      if (orConditions.length > 0) {
        query.$or = orConditions;
      }
    }

    // Filter by active status
    if (!includeInactive) {
      query.isActive = true;
    }

    // Filter by date range - check if ratesheet is effective during the requested period
    if (startDate || endDate) {
      const dateFilters: any[] = [];

      if (startDate) {
        // Ratesheet must have started by the end of the requested period
        // effectiveFrom <= endDate (or startDate if no endDate)
        const queryEndDate = endDate ? new Date(endDate) : new Date(startDate);
        // Set to end of day
        queryEndDate.setHours(23, 59, 59, 999);
        dateFilters.push({
          effectiveFrom: { $lte: queryEndDate }
        });
      }

      if (endDate) {
        // Ratesheet must not have ended before the requested period starts
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

    // Fetch ratesheets sorted by priority (highest first)
    let ratesheets = await collection
      .find(query)
      .sort({ priority: -1, createdAt: -1 })
      .toArray();

    // Populate related entities and determine type
    const customersCollection = db.collection('customers');
    const locationsCollection = db.collection('locations');
    const sublocationsCollection = db.collection('sublocations');
    const eventsCollection = db.collection('events');

    // Process each ratesheet to enrich with entity info
    const enrichedRatesheets = await Promise.all(
      ratesheets.map(async (ratesheet) => {
        const enriched: any = { ...ratesheet };

        // Determine the "applyTo" level based on new appliesTo structure OR legacy ID fields
        const level = ratesheet.appliesTo?.level ||
                      (ratesheet.eventId ? 'EVENT' :
                       ratesheet.subLocationId ? 'SUBLOCATION' :
                       ratesheet.locationId ? 'LOCATION' : 'CUSTOMER');

        const entityId = ratesheet.appliesTo?.entityId ||
                        ratesheet.eventId ||
                        ratesheet.subLocationId ||
                        ratesheet.locationId ||
                        ratesheet.customerId;

        enriched.applyTo = level;
        enriched.ratesheetType = level;

        // Populate based on level
        if (level === 'EVENT') {
          // Populate event
          const event = await eventsCollection.findOne({
            _id: new ObjectId(entityId),
          });
          if (event) {
            enriched.event = {
              _id: event._id.toString(),
              name: event.name,
            };
          }
        } else if (level === 'SUBLOCATION') {
          // Populate sublocation
          const sublocation = await sublocationsCollection.findOne({
            _id: new ObjectId(entityId),
          });
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
          // Populate location
          const location = await locationsCollection.findOne({
            _id: new ObjectId(entityId),
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
        } else if (level === 'CUSTOMER') {
          // Populate customer
          const customer = await customersCollection.findOne({
            _id: new ObjectId(entityId),
          });
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
    const response: any = enrichedRatesheets;

    // If we resolved hierarchy, we can include metadata
    if (hierarchyInfo && searchParams.get('includeMeta') === 'true') {
      return NextResponse.json({
        ratesheets: enrichedRatesheets,
        hierarchy: hierarchyInfo,
        query: {
          startDate,
          endDate,
          includeInactive,
          resolveHierarchy,
        },
      });
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching ratesheets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ratesheets', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create new ratesheet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      subLocationId,
      locationId,
      customerId,
      eventId,
      name,
      description,
      type,
      priority,
      conflictResolution,
      isActive,
      effectiveFrom,
      effectiveTo,
      timeWindows,
      durationRules,
    } = body;

    // Validation
    if (!name || !type || priority === undefined || !effectiveFrom) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, priority, effectiveFrom' },
        { status: 400 }
      );
    }

    // Must have at least one ID
    if (!subLocationId && !locationId && !customerId && !eventId) {
      return NextResponse.json(
        { error: 'Must specify eventId, subLocationId, locationId, or customerId' },
        { status: 400 }
      );
    }

    // Validate priority range based on type
    const db = await getDb();
    const configCollection = db.collection('priority_configs');

    let ratesheetType: 'CUSTOMER' | 'LOCATION' | 'SUBLOCATION' | 'EVENT';
    if (eventId) {
      ratesheetType = 'EVENT';
    } else if (subLocationId) {
      ratesheetType = 'SUBLOCATION';
    } else if (locationId) {
      ratesheetType = 'LOCATION';
    } else {
      ratesheetType = 'CUSTOMER';
    }

    const priorityConfig = await configCollection.findOne({ type: ratesheetType });

    if (priorityConfig) {
      if (priority < priorityConfig.minPriority || priority > priorityConfig.maxPriority) {
        return NextResponse.json(
          {
            error: `Priority must be between ${priorityConfig.minPriority} and ${priorityConfig.maxPriority} for ${ratesheetType} level ratesheets`,
          },
          { status: 400 }
        );
      }
    }

    // Validate time windows or duration rules
    if (type === 'TIMING_BASED') {
      if (!timeWindows || timeWindows.length === 0) {
        return NextResponse.json(
          { error: 'Timing-based ratesheets must have at least one time window' },
          { status: 400 }
        );
      }
    } else if (type === 'DURATION_BASED') {
      if (!durationRules || durationRules.length === 0) {
        return NextResponse.json(
          { error: 'Duration-based ratesheets must have at least one duration rule' },
          { status: 400 }
        );
      }
    }

    const collection = db.collection('ratesheets');

    const newRatesheet = {
      subLocationId: subLocationId ? new ObjectId(subLocationId) : undefined,
      locationId: locationId ? new ObjectId(locationId) : undefined,
      customerId: customerId ? new ObjectId(customerId) : undefined,
      eventId: eventId ? new ObjectId(eventId) : undefined,
      name,
      description: description || '',
      type,
      priority: parseInt(priority),
      conflictResolution: conflictResolution || 'PRIORITY',
      isActive: isActive !== false,
      effectiveFrom: new Date(effectiveFrom),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
      timeWindows: type === 'TIMING_BASED' ? timeWindows : undefined,
      durationRules: type === 'DURATION_BASED' ? durationRules : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await collection.insertOne(newRatesheet);

    const created = await collection.findOne({ _id: result.insertedId });
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('Error creating ratesheet:', error);
    return NextResponse.json(
      { error: 'Failed to create ratesheet', details: error.message },
      { status: 500 }
    );
  }
}
