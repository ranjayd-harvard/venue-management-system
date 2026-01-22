import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { CustomerRepository } from '@/models/Customer';
import { LocationRepository } from '@/models/Location';
import { SubLocationRepository } from '@/models/SubLocation';
import { EventRepository } from '@/models/Event';
import { getRevenueGoalsForDate } from '@/lib/capacity-utils';

/**
 * GET /api/revenue-goals
 * Get revenue goals for a specific entity and date
 *
 * Query params:
 * - entityType: 'customer' | 'location' | 'sublocation' | 'event'
 * - entityId: string (ObjectId)
 * - date?: string (YYYY-MM-DD) - get goals for specific date
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const date = searchParams.get('date');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId are required' },
        { status: 400 }
      );
    }

    // Fetch entity based on type
    let entity;
    let config;

    switch (entityType.toLowerCase()) {
      case 'customer':
        entity = await CustomerRepository.findById(entityId);
        config = entity?.capacityConfig;
        break;
      case 'location':
        entity = await LocationRepository.findById(entityId);
        config = entity?.capacityConfig;
        break;
      case 'sublocation':
        entity = await SubLocationRepository.findById(new ObjectId(entityId));
        config = entity?.capacityConfig;
        break;
      case 'event':
        entity = await EventRepository.findById(entityId);
        config = entity?.capacityConfig;
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid entityType' },
          { status: 400 }
        );
    }

    if (!entity) {
      return NextResponse.json(
        { error: 'Entity not found' },
        { status: 404 }
      );
    }

    // If date specified, return goals for that date
    if (date) {
      const goals = getRevenueGoalsForDate(config, date);
      return NextResponse.json({
        date,
        goals: goals || null,
      });
    }

    // Return all revenue goals
    return NextResponse.json({
      revenueGoals: config?.revenueGoals || [],
    });

  } catch (error) {
    console.error('Error fetching revenue goals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue goals' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/revenue-goals
 * Set revenue goals for a specific entity
 *
 * Body:
 * {
 *   entityType: 'customer' | 'location' | 'sublocation' | 'event',
 *   entityId: string,
 *   startDate: string (YYYY-MM-DD),
 *   endDate: string (YYYY-MM-DD),
 *   dailyGoal: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      entityType,
      entityId,
      startDate,
      endDate,
      dailyGoal,
      revenueGoalType,
    } = body;

    if (!entityType || !entityId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'entityType, entityId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    // Daily goal is required
    if (dailyGoal === undefined || dailyGoal <= 0) {
      return NextResponse.json(
        { error: 'dailyGoal is required and must be greater than 0' },
        { status: 400 }
      );
    }

    let result;

    switch (entityType.toLowerCase()) {
      case 'customer':
        result = await CustomerRepository.setRevenueGoal(
          entityId,
          startDate,
          endDate,
          dailyGoal,
          undefined,
          undefined,
          revenueGoalType
        );
        break;
      case 'location':
        result = await LocationRepository.setRevenueGoal(
          entityId,
          startDate,
          endDate,
          dailyGoal,
          undefined,
          undefined,
          revenueGoalType
        );
        break;
      case 'sublocation':
        result = await SubLocationRepository.setRevenueGoal(
          new ObjectId(entityId),
          startDate,
          endDate,
          dailyGoal,
          undefined,
          undefined,
          revenueGoalType
        );
        break;
      case 'event':
        result = await EventRepository.setRevenueGoal(
          entityId,
          startDate,
          endDate,
          dailyGoal,
          undefined,
          undefined,
          revenueGoalType
        );
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid entityType' },
          { status: 400 }
        );
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to set revenue goals' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Revenue goals set successfully',
      data: result,
    });

  } catch (error: any) {
    console.error('Error setting revenue goals:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to set revenue goals' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/revenue-goals
 * Remove revenue goals for a specific date range
 *
 * Query params:
 * - entityType: 'customer' | 'location' | 'sublocation' | 'event'
 * - entityId: string
 * - startDate: string (YYYY-MM-DD)
 * - endDate: string (YYYY-MM-DD)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!entityType || !entityId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'entityType, entityId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    let result;

    switch (entityType.toLowerCase()) {
      case 'customer':
        result = await CustomerRepository.removeRevenueGoal(entityId, startDate, endDate);
        break;
      case 'location':
        result = await LocationRepository.removeRevenueGoal(entityId, startDate, endDate);
        break;
      case 'sublocation':
        result = await SubLocationRepository.removeRevenueGoal(new ObjectId(entityId), startDate, endDate);
        break;
      case 'event':
        result = await EventRepository.removeRevenueGoal(entityId, startDate, endDate);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid entityType' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: 'Revenue goals removed successfully',
      data: result,
    });

  } catch (error) {
    console.error('Error removing revenue goals:', error);
    return NextResponse.json(
      { error: 'Failed to remove revenue goals' },
      { status: 500 }
    );
  }
}
