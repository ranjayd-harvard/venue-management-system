'use client';

import { useState, useEffect } from 'react';

interface KafkaMessage {
  partition: number;
  offset: string;
  timestamp: string;
  key: string;
  value: any;
  headers: any;
}

interface TopicMessages {
  topic: string;
  messageCount: number;
  messages: KafkaMessage[];
}

export default function KafkaTopicsPage() {
  const [selectedTopic, setSelectedTopic] = useState('venue.booking.events');
  const [messages, setMessages] = useState<TopicMessages | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [limit, setLimit] = useState(50);
  const [selectedMessage, setSelectedMessage] = useState<KafkaMessage | null>(null);
  const [clearing, setClearing] = useState(false);

  const topics = [
    { value: 'venue.booking.events', label: 'Booking Events', color: 'blue' },
    { value: 'venue.demand.hourly', label: 'Demand Hourly', color: 'purple' }
  ];

  const loadMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/kafka/messages?topic=${selectedTopic}&limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      } else {
        console.error('Failed to load messages');
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearTopic = async () => {
    const confirmed = confirm(
      `Are you sure you want to clear all messages from "${selectedTopic}"?\n\nThis will delete and recreate the topic. This action cannot be undone.`
    );

    if (!confirmed) return;

    setClearing(true);
    try {
      const res = await fetch(`/api/kafka/topics/clear?topic=${selectedTopic}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        alert(`Topic "${selectedTopic}" has been cleared successfully!`);
        setMessages(null);
        setSelectedMessage(null);
        await loadMessages(); // Reload to show empty state
      } else {
        const data = await res.json();
        alert(`Failed to clear topic: ${data.error}`);
      }
    } catch (error) {
      alert('Error clearing topic');
      console.error(error);
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [selectedTopic, limit]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(loadMessages, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, selectedTopic, limit]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(parseInt(timestamp)).toLocaleString();
  };

  const getColorClass = (topicValue: string) => {
    const topic = topics.find(t => t.value === topicValue);
    const colorMap: Record<string, string> = {
      blue: 'from-blue-500 to-blue-600',
      purple: 'from-purple-500 to-purple-600',
      green: 'from-green-500 to-green-600',
      orange: 'from-orange-500 to-orange-600'
    };
    return colorMap[topic?.color || 'blue'];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Kafka Topic Viewer
          </h1>
          <p className="text-slate-600">
            Real-time view of messages in Kafka topics
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Topic Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Topic
              </label>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              >
                {topics.map((topic) => (
                  <option key={topic.value} value={topic.value}>
                    {topic.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Message Limit */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Message Limit
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              >
                <option value={10}>10 messages</option>
                <option value={25}>25 messages</option>
                <option value={50}>50 messages</option>
                <option value={100}>100 messages</option>
              </select>
            </div>

            {/* Refresh Button */}
            <div className="flex items-end">
              <button
                onClick={loadMessages}
                disabled={loading}
                className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : '🔄 Refresh'}
              </button>
            </div>

            {/* Auto-refresh Toggle */}
            <div className="flex items-end">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                  autoRefresh
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-slate-300 text-slate-700 hover:bg-slate-400'
                }`}
              >
                {autoRefresh ? '⏸️ Stop Auto-refresh' : '▶️ Auto-refresh'}
              </button>
            </div>

            {/* Clear Topic Button */}
            <div className="flex items-end">
              <button
                onClick={clearTopic}
                disabled={clearing || loading}
                className="w-full px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearing ? '🗑️ Clearing...' : '🗑️ Clear Topic'}
              </button>
            </div>
          </div>

          {/* Message Count */}
          {messages && (
            <div className="mt-4 flex items-center gap-4">
              <div className="text-sm text-slate-600">
                Showing <span className="font-semibold text-slate-900">{messages.messageCount}</span> messages
                from topic <span className="font-mono font-semibold text-blue-600">{messages.topic}</span>
              </div>
              {messages.messageCount === 0 && (
                <div className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-lg">
                  No messages found. Start the generator to create events!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Messages List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Message Cards */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Messages</h2>

            <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
              {messages?.messages.map((msg, idx) => (
                <div
                  key={`${msg.partition}-${msg.offset}`}
                  onClick={() => setSelectedMessage(msg)}
                  className={`bg-white rounded-lg shadow p-4 border-2 cursor-pointer transition-all hover:shadow-md ${
                    selectedMessage?.offset === msg.offset && selectedMessage?.partition === msg.partition
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        Partition {msg.partition}
                      </span>
                      <span className="text-xs text-slate-500">
                        Offset: {msg.offset}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>

                  {/* Preview */}
                  <div className="text-sm text-slate-700">
                    {msg.value?.action && (
                      <div className="mb-1">
                        <span className="font-semibold">Action:</span>{' '}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          msg.value.action === 'CREATED' ? 'bg-green-100 text-green-800' :
                          msg.value.action === 'UPDATED' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {msg.value.action}
                        </span>
                      </div>
                    )}
                    {msg.value?.eventName && (
                      <div className="mb-1">
                        <span className="font-semibold">Event:</span> {msg.value.eventName}
                      </div>
                    )}
                    {msg.value?.subLocationId && (
                      <div className="text-xs text-slate-500 font-mono">
                        SubLocation: {msg.value.subLocationId.substring(0, 12)}...
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {!messages?.messages.length && !loading && (
                <div className="text-center py-12 text-slate-500">
                  <div className="text-4xl mb-4">📭</div>
                  <div className="text-lg font-medium">No messages yet</div>
                  <div className="text-sm mt-2">
                    Start the generator from the monitoring dashboard
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Message Detail */}
          <div className="sticky top-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Message Detail</h2>

            {selectedMessage ? (
              <div className="bg-white rounded-lg shadow-lg p-6 border border-slate-200">
                <div className="mb-4 flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded">
                    Partition {selectedMessage.partition}
                  </span>
                  <span className="text-sm text-slate-600">
                    Offset: {selectedMessage.offset}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-slate-600 mb-1">Timestamp</div>
                  <div className="text-sm font-mono text-slate-900">
                    {formatTimestamp(selectedMessage.timestamp)}
                  </div>
                </div>

                {selectedMessage.key && (
                  <div className="mb-4">
                    <div className="text-sm text-slate-600 mb-1">Key</div>
                    <div className="text-sm font-mono text-slate-900 bg-slate-50 p-2 rounded">
                      {selectedMessage.key}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <div className="text-sm text-slate-600 mb-2">Value (JSON)</div>
                  <pre className="text-xs font-mono text-slate-900 bg-slate-50 p-4 rounded overflow-x-auto border border-slate-200 max-h-[600px] overflow-y-auto">
                    {JSON.stringify(selectedMessage.value, null, 2)}
                  </pre>
                </div>

                {selectedMessage.headers && Object.keys(selectedMessage.headers).length > 0 && (
                  <div>
                    <div className="text-sm text-slate-600 mb-2">Headers</div>
                    <pre className="text-xs font-mono text-slate-900 bg-slate-50 p-4 rounded overflow-x-auto border border-slate-200">
                      {JSON.stringify(selectedMessage.headers, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-12 border border-slate-200 text-center">
                <div className="text-4xl mb-4">👈</div>
                <div className="text-slate-500">
                  Select a message to view details
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
