import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * DELETE /api/kafka/topics/clear?topic=<topic>
 * Clear all messages from a Kafka topic by deleting and recreating it
 */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');

  if (!topic) {
    return NextResponse.json(
      { error: 'Topic parameter is required' },
      { status: 400 }
    );
  }

  // Prevent clearing critical system topics
  if (topic === '__consumer_offsets' || topic.startsWith('_')) {
    return NextResponse.json(
      { error: 'Cannot clear system topics' },
      { status: 403 }
    );
  }

  try {
    console.log(`🗑️  Clearing topic: ${topic}`);

    // Step 1: Delete the topic
    const deleteCommand = `docker exec venue-kafka kafka-topics \
      --bootstrap-server kafka:29092 \
      --delete \
      --topic ${topic}`;

    await execAsync(deleteCommand, { timeout: 10000 });
    console.log(`✅ Deleted topic: ${topic}`);

    // Wait a moment for deletion to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Recreate the topic with default settings
    const createCommand = `docker exec venue-kafka kafka-topics \
      --bootstrap-server kafka:29092 \
      --create \
      --topic ${topic} \
      --partitions 1 \
      --replication-factor 1`;

    await execAsync(createCommand, { timeout: 10000 });
    console.log(`✅ Recreated topic: ${topic}`);

    return NextResponse.json({
      success: true,
      topic,
      message: `Topic ${topic} has been cleared`
    });

  } catch (error) {
    console.error('Error clearing topic:', error);

    return NextResponse.json(
      { error: 'Failed to clear topic', details: String(error) },
      { status: 500 }
    );
  }
}
