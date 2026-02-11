import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

/**
 * GET /api/kafka/metrics
 * Get Kafka and demand metrics for admin dashboard
 */
export async function GET() {
  try {
    const db = await getDb();

    // Get demand history statistics
    const demandHistoryCount = await db.collection('demand_history').countDocuments();

    // Get recent demand metrics (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const recentDemandMetrics = await db.collection('demand_history')
      .find({ timestamp: { $gte: oneDayAgo } })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    // Get surge configs with updated demand
    const surgeConfigs = await db.collection('surge_configs')
      .find({ isActive: true })
      .toArray();

    // Get recently materialized ratesheets
    const recentRatesheets = await db.collection('ratesheets')
      .find({ type: 'SURGE_MULTIPLIER' })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    // Calculate aggregate statistics
    const totalBookingsLast24h = recentDemandMetrics.reduce(
      (sum, m) => sum + (m.bookingsCount || 0),
      0
    );

    const avgPressureLast24h = recentDemandMetrics.length > 0
      ? recentDemandMetrics.reduce((sum, m) => sum + (m.demandPressure || 0), 0) / recentDemandMetrics.length
      : 0;

    // Group metrics by sublocation for top locations
    const metricsByLocation = new Map<string, { bookings: number; pressure: number; count: number }>();
    recentDemandMetrics.forEach(m => {
      const existing = metricsByLocation.get(m.subLocationId) || { bookings: 0, pressure: 0, count: 0 };
      existing.bookings += m.bookingsCount || 0;
      existing.pressure += m.demandPressure || 0;
      existing.count += 1;
      metricsByLocation.set(m.subLocationId, existing);
    });

    const topLocations = Array.from(metricsByLocation.entries())
      .map(([subLocationId, stats]) => ({
        subLocationId,
        totalBookings: stats.bookings,
        avgPressure: stats.pressure / stats.count,
        dataPoints: stats.count
      }))
      .sort((a, b) => b.totalBookings - a.totalBookings)
      .slice(0, 10);

    // Get processed events count (if processed_events collection exists)
    let processedEventsCount = 0;
    try {
      processedEventsCount = await db.collection('processed_events').countDocuments();
    } catch (e) {
      // Collection doesn't exist yet
    }

    return NextResponse.json({
      overview: {
        demandHistoryTotal: demandHistoryCount,
        metricsLast24h: recentDemandMetrics.length,
        totalBookingsLast24h,
        avgPressureLast24h: avgPressureLast24h.toFixed(2),
        activeSurgeConfigs: surgeConfigs.length,
        recentRatesheets: recentRatesheets.length,
        processedEvents: processedEventsCount
      },
      topLocations,
      recentMetrics: recentDemandMetrics.slice(0, 20).map(m => ({
        subLocationId: m.subLocationId,
        hour: m.hour || m.timestamp,
        bookingsCount: m.bookingsCount,
        demandPressure: m.demandPressure?.toFixed(2),
        historicalAvg: m.historicalAvgPressure?.toFixed(2),
        timestamp: m.timestamp
      })),
      surgeConfigs: surgeConfigs.map(c => ({
        id: c._id.toString(),
        name: c.name,
        level: c.appliesTo.level,
        entityId: c.appliesTo.entityId.toString(),
        currentDemand: c.demandSupplyParams?.currentDemand || 0,
        currentSupply: c.demandSupplyParams?.currentSupply || 0,
        historicalAvg: c.demandSupplyParams?.historicalAvgPressure || 1.0,
        lastMaterialized: c.lastMaterialized,
        materializedRatesheetId: c.materializedRatesheetId?.toString()
      })),
      recentRatesheets: recentRatesheets.map(r => ({
        id: r._id.toString(),
        name: r.name,
        priority: r.priority,
        multiplier: r.surgeMultiplierSnapshot?.toFixed(3),
        status: r.approvalStatus,
        isActive: r.isActive || false,
        demandSnapshot: r.demandSupplySnapshot?.demand,
        supplySnapshot: r.demandSupplySnapshot?.supply,
        createdAt: r.createdAt,
        createdBy: r.createdBy,
        effectiveFrom: r.effectiveFrom,
        effectiveTo: r.effectiveTo,
        timeWindows: r.timeWindows
      }))
    });

  } catch (error) {
    console.error('Error fetching Kafka metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
