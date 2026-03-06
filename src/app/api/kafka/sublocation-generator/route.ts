import { NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';

// Store active generator processes keyed by "subLocationId:domain"
const activeGenerators = new Map<string, ChildProcess>();

/**
 * POST /api/kafka/sublocation-generator
 * Start a ticket state transition generator (COMMERCIAL or PHYSICAL)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      subLocationId,
      domain = 'COMMERCIAL',
      scenario,
      tickets = 5,
      rate = 1,
    } = body;

    if (!subLocationId) {
      return NextResponse.json(
        { error: 'subLocationId is required' },
        { status: 400 }
      );
    }

    if (!['COMMERCIAL', 'PHYSICAL'].includes(domain)) {
      return NextResponse.json(
        { error: 'domain must be COMMERCIAL or PHYSICAL' },
        { status: 400 }
      );
    }

    if (!scenario) {
      return NextResponse.json(
        { error: 'scenario is required' },
        { status: 400 }
      );
    }

    const generatorKey = `${subLocationId}:${domain}`;

    if (activeGenerators.has(generatorKey)) {
      return NextResponse.json(
        { error: `${domain} generator already running for this sublocation` },
        { status: 409 }
      );
    }

    // Route to appropriate script based on domain
    const script = domain === 'PHYSICAL'
      ? 'scripts/generate-physical-events.ts'
      : 'scripts/generate-sublocation-events.ts';

    const args = [
      script,
      '--sublocation', subLocationId,
      '--scenario', scenario,
      '--tickets', String(tickets),
      '--rate', String(rate),
    ];

    const generator = spawn('npx', ['tsx', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    generator.stdout?.on('data', (data) => {
      console.log(`[${domain} ${subLocationId}] ${data.toString()}`);
    });

    generator.stderr?.on('data', (data) => {
      console.error(`[${domain} ${subLocationId}] ERROR: ${data.toString()}`);
    });

    generator.on('close', (code) => {
      console.log(`[${domain} ${subLocationId}] Finished with code ${code}`);
      activeGenerators.delete(generatorKey);
    });

    activeGenerators.set(generatorKey, generator);

    return NextResponse.json({
      success: true,
      message: `${domain} ticket generator started`,
      subLocationId,
      domain,
      scenario,
      tickets,
      rate,
      pid: generator.pid,
    });
  } catch (error) {
    console.error('Error starting sublocation generator:', error);
    return NextResponse.json(
      { error: 'Failed to start generator' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/kafka/sublocation-generator?subLocationId=<id>&domain=<COMMERCIAL|PHYSICAL>
 * Stop a ticket generator. If domain is omitted, stops all generators for the sublocation.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subLocationId = searchParams.get('subLocationId');
    const domain = searchParams.get('domain');

    if (!subLocationId) {
      return NextResponse.json(
        { error: 'subLocationId is required' },
        { status: 400 }
      );
    }

    const stopped: string[] = [];

    if (domain) {
      // Stop specific domain generator
      const key = `${subLocationId}:${domain}`;
      const generator = activeGenerators.get(key);
      if (generator) {
        generator.kill('SIGTERM');
        activeGenerators.delete(key);
        stopped.push(domain);
      }
    } else {
      // Stop all generators for this sublocation
      for (const d of ['COMMERCIAL', 'PHYSICAL']) {
        const key = `${subLocationId}:${d}`;
        const generator = activeGenerators.get(key);
        if (generator) {
          generator.kill('SIGTERM');
          activeGenerators.delete(key);
          stopped.push(d);
        }
      }
    }

    if (stopped.length === 0) {
      return NextResponse.json(
        { error: 'No generator running for this sublocation' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Generator(s) stopped: ${stopped.join(', ')}`,
      subLocationId,
      stopped,
    });
  } catch (error) {
    console.error('Error stopping sublocation generator:', error);
    return NextResponse.json(
      { error: 'Failed to stop generator' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/kafka/sublocation-generator
 * Get status of running ticket generators
 */
export async function GET() {
  try {
    const status = Array.from(activeGenerators.entries()).map(([key, proc]) => {
      const [subLocationId, domain] = key.split(':');
      return {
        subLocationId,
        domain,
        pid: proc.pid,
        running: !proc.killed,
      };
    });

    return NextResponse.json({
      active: status,
      count: status.length,
    });
  } catch (error) {
    console.error('Error getting sublocation generator status:', error);
    return NextResponse.json(
      { error: 'Failed to get generator status' },
      { status: 500 }
    );
  }
}
