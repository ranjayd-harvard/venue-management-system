import { NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';

// Store active generator processes in memory
// In production, use Redis or similar for multi-instance deployments
const activeGenerators = new Map<string, ChildProcess>();

/**
 * POST /api/kafka/generator
 * Start synthetic data generator
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { scenario, subLocationId, locationId, rate, count } = body;

    if (!subLocationId) {
      return NextResponse.json(
        { error: 'subLocationId is required' },
        { status: 400 }
      );
    }

    // Must provide either scenario or both rate+count
    if (!scenario && !(rate && count)) {
      return NextResponse.json(
        { error: 'Must provide either scenario or both rate and count' },
        { status: 400 }
      );
    }

    // Check if generator is already running for this sublocation
    if (activeGenerators.has(subLocationId)) {
      return NextResponse.json(
        { error: 'Generator already running for this sublocation' },
        { status: 409 }
      );
    }

    // Build command arguments
    const args = [
      'scripts/generate-booking-load.ts',
      '--sublocation', subLocationId
    ];

    if (locationId) {
      args.push('--location', locationId);
    }

    // Use custom rate/count or predefined scenario
    if (rate && count) {
      args.push('--rate', String(rate), '--count', String(count));
    } else {
      args.push('--scenario', scenario);
    }

    // Spawn the generator process
    const generator = spawn('npx', ['tsx', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    let output = '';

    generator.stdout?.on('data', (data) => {
      output += data.toString();
      console.log(`[Generator ${subLocationId}] ${data.toString()}`);
    });

    generator.stderr?.on('data', (data) => {
      console.error(`[Generator ${subLocationId}] ERROR: ${data.toString()}`);
    });

    generator.on('close', (code) => {
      console.log(`[Generator ${subLocationId}] Finished with code ${code}`);
      activeGenerators.delete(subLocationId);
    });

    // Store the process
    activeGenerators.set(subLocationId, generator);

    return NextResponse.json({
      success: true,
      message: 'Generator started',
      subLocationId,
      scenario,
      pid: generator.pid
    });

  } catch (error) {
    console.error('Error starting generator:', error);
    return NextResponse.json(
      { error: 'Failed to start generator' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/kafka/generator?subLocationId=<id>
 * Stop synthetic data generator
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subLocationId = searchParams.get('subLocationId');

    if (!subLocationId) {
      return NextResponse.json(
        { error: 'subLocationId is required' },
        { status: 400 }
      );
    }

    const generator = activeGenerators.get(subLocationId);
    if (!generator) {
      return NextResponse.json(
        { error: 'No generator running for this sublocation' },
        { status: 404 }
      );
    }

    // Kill the process
    generator.kill('SIGTERM');
    activeGenerators.delete(subLocationId);

    return NextResponse.json({
      success: true,
      message: 'Generator stopped',
      subLocationId
    });

  } catch (error) {
    console.error('Error stopping generator:', error);
    return NextResponse.json(
      { error: 'Failed to stop generator' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/kafka/generator
 * Get status of running generators
 */
export async function GET() {
  try {
    const status = Array.from(activeGenerators.entries()).map(([subLocationId, process]) => ({
      subLocationId,
      pid: process.pid,
      running: !process.killed
    }));

    return NextResponse.json({
      active: status,
      count: status.length
    });

  } catch (error) {
    console.error('Error getting generator status:', error);
    return NextResponse.json(
      { error: 'Failed to get generator status' },
      { status: 500 }
    );
  }
}
