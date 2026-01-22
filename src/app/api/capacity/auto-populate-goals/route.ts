import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { SubLocationRepository } from '@/models/SubLocation';
import { calculateDefaultDailyGoal, getCapacityForDate } from '@/lib/capacity-utils';

/**
 * POST /api/capacity/auto-populate-goals
 * Auto-populates daily revenue goals for sublocations based on their defaultHourlyRate
 *
 * Body:
 * {
 *   sublocationId: string,
 *   startDate: string (YYYY-MM-DD),
 *   endDate: string (YYYY-MM-DD),
 *   hoursPerDay?: number (default: 24)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sublocationId, startDate, endDate, hoursPerDay = 24 } = body;

    if (!sublocationId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'sublocationId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    // Fetch the sublocation
    const sublocation = await SubLocationRepository.findById(new ObjectId(sublocationId));

    if (!sublocation) {
      return NextResponse.json(
        { error: 'SubLocation not found' },
        { status: 404 }
      );
    }

    if (!sublocation.defaultHourlyRate) {
      return NextResponse.json(
        { error: 'SubLocation does not have a defaultHourlyRate set' },
        { status: 400 }
      );
    }

    // Generate daily goals for the date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    const goalsCreated: any[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      // Get capacity for this date
      const capacity = getCapacityForDate(sublocation.capacityConfig, dateStr);

      // Calculate default goal
      const dailyGoal = calculateDefaultDailyGoal(
        sublocation.defaultHourlyRate,
        capacity,
        hoursPerDay
      );

      // Set the goal (this will override any existing goal for this date)
      await SubLocationRepository.setRevenueGoal(
        new ObjectId(sublocationId),
        dateStr,
        dateStr,
        dailyGoal
      );

      goalsCreated.push({
        date: dateStr,
        capacity,
        hourlyRate: sublocation.defaultHourlyRate,
        hoursPerDay,
        dailyGoal,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Auto-populated ${goalsCreated.length} daily goals`,
      goalsCreated,
    });

  } catch (error: any) {
    console.error('Error auto-populating goals:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-populate goals' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/capacity/auto-populate-goals
 * Recalculates and updates existing goals for a sublocation
 * Only updates dates that already have goals set
 *
 * Body:
 * {
 *   sublocationId: string,
 *   hoursPerDay?: number (default: 24)
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { sublocationId, hoursPerDay = 24 } = body;

    if (!sublocationId) {
      return NextResponse.json(
        { error: 'sublocationId is required' },
        { status: 400 }
      );
    }

    // Fetch the sublocation
    const sublocation = await SubLocationRepository.findById(new ObjectId(sublocationId));

    if (!sublocation) {
      return NextResponse.json(
        { error: 'SubLocation not found' },
        { status: 404 }
      );
    }

    if (!sublocation.defaultHourlyRate) {
      return NextResponse.json(
        { error: 'SubLocation does not have a defaultHourlyRate set' },
        { status: 400 }
      );
    }

    const revenueGoals = sublocation.capacityConfig?.revenueGoals || [];
    const goalsUpdated: any[] = [];

    // Recalculate all existing goals
    for (const goal of revenueGoals) {
      const start = new Date(goal.startDate);
      const end = new Date(goal.endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];

        // Get capacity for this date
        const capacity = getCapacityForDate(sublocation.capacityConfig, dateStr);

        // Calculate new goal
        const dailyGoal = calculateDefaultDailyGoal(
          sublocation.defaultHourlyRate,
          capacity,
          hoursPerDay
        );

        // Update the goal
        await SubLocationRepository.setRevenueGoal(
          new ObjectId(sublocationId),
          dateStr,
          dateStr,
          dailyGoal
        );

        goalsUpdated.push({
          date: dateStr,
          capacity,
          hourlyRate: sublocation.defaultHourlyRate,
          hoursPerDay,
          oldGoal: goal.dailyGoal,
          newGoal: dailyGoal,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Recalculated ${goalsUpdated.length} daily goals`,
      goalsUpdated,
    });

  } catch (error: any) {
    console.error('Error recalculating goals:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to recalculate goals' },
      { status: 500 }
    );
  }
}
