import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * GET /api/kafka/messages?topic=<topic>&limit=<limit>
 * Read recent messages from a Kafka topic using kafka-console-consumer
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic') || 'venue.booking.events';
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    console.log(`📥 Reading messages from topic: ${topic}, limit: ${limit}`);

    // Use kafka-console-consumer to read messages
    // Note: Use kafka:29092 (internal Docker network) not localhost:9092
    // Note: Use --partition and --offset instead of --from-beginning to avoid consumer group issues
    const command = `docker exec venue-kafka kafka-console-consumer \
      --bootstrap-server kafka:29092 \
      --topic ${topic} \
      --partition 0 \
      --offset earliest \
      --max-messages ${limit} \
      --timeout-ms 3000 2>&1`;

    let stdout = '';
    try {
      const result = await execAsync(command, {
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 15000 // 15 second timeout (increased from 10s)
      });
      stdout = result.stdout;
    } catch (error: any) {
      // If killed by timeout but we got some output, use it
      if (error.killed && error.stdout) {
        stdout = error.stdout;
        console.log(`⚠️  Command timed out but collected ${error.stdout.split('\n').length} lines`);
      } else {
        throw error;
      }
    }

    // Parse output - each line is a JSON message
    // Filter out Kafka logs, error messages, and summary lines
    const lines = stdout
      .trim()
      .split('\n')
      .filter(line => {
        // Keep only lines that look like JSON messages
        const trimmed = line.trim();
        return (
          trimmed.length > 0 &&
          trimmed.startsWith('{') && // Must start with {
          !line.includes('Processed a total of') &&
          !line.startsWith('[') && // Filter out [timestamp] log lines
          !line.includes('org.apache.kafka') && // Filter out Java exceptions
          !line.includes('ERROR') && // Filter out ERROR logs
          !line.includes('WARN') // Filter out WARN logs
        );
      });

    const messages: any[] = [];
    let currentOffset = 0;

    for (const line of lines) {
      try {
        // Parse JSON message
        const value = JSON.parse(line);

        messages.push({
          partition: 0, // Default partition (can't determine without metadata)
          offset: String(currentOffset++), // Sequential offset
          timestamp: value.timestamp || new Date().toISOString(), // Use message timestamp
          key: value.subLocationId || '', // Use subLocationId as key
          value: value,
          headers: {}
        });
      } catch (error) {
        // Silently skip unparseable lines (already filtered above)
      }
    }

    console.log(`✅ Collected ${messages.length} messages from ${topic}`);

    return NextResponse.json({
      topic,
      messageCount: messages.length,
      messages: messages.slice(-limit) // Return most recent messages
    });

  } catch (error) {
    console.error('Error reading Kafka messages:', error);

    return NextResponse.json(
      { error: 'Failed to read messages', details: String(error) },
      { status: 500 }
    );
  }
}
