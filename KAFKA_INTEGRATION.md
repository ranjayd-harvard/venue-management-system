# Kafka Integration for Dynamic Demand/Supply Calculation

## Overview

This system enables real-time, event-driven demand calculation for surge pricing. When venue bookings are created, updated, or deleted, events flow through Kafka to automatically update surge pricing configurations and materialize new ratesheets.

## Architecture

```
Event API (create/update/delete)
  ↓ emits events
Kafka Topic: venue.booking.events (raw events)
  ↓ consumed by
Consumer 1: demand-aggregator
  ↓ calculates hourly metrics
Kafka Topic: venue.demand.hourly (aggregated)
  ↓ consumed by
Consumer 2: surge-updater
  ↓ updates configs + materializes
SurgeConfig (demandSupplyParams updated)
  ↓ auto-materializes
New DRAFT Ratesheet (requires approval)
```

## Quick Start

### 1. Start Kafka Infrastructure

```bash
# Start Zookeeper and Kafka
docker-compose up -d zookeeper kafka

# Verify services are healthy
docker ps | grep venue
```

### 2. Start Consumer Service

```bash
# Option A: Run locally (development)
cd services/kafka-consumer
npm run dev

# Option B: Run in Docker (production-like)
# Uncomment kafka-consumer service in docker-compose.yml
docker-compose up -d kafka-consumer
```

### 3. Test the Integration

```bash
# Generate synthetic booking load
npx tsx scripts/generate-booking-load.ts --scenario PEAK_HOUR --sublocation <your-sublocation-id>
```

## Components

### Producer (Main App)

**Files:**
- `src/lib/kafka.ts` - Kafka client singleton
- `src/lib/kafka-producer.ts` - Event emission wrapper
- `src/models/Event.ts` - Emits events on create/update/delete

**Events Emitted:**
- `CREATED` - New booking created
- `UPDATED` - Booking modified (includes delta)
- `DELETED` - Booking removed

### Consumer Service

**Files:**
- `services/kafka-consumer/src/index.ts` - Entry point
- `services/kafka-consumer/src/consumers/demand-aggregator.ts` - Aggregates bookings
- `services/kafka-consumer/src/consumers/surge-updater.ts` - Updates surge configs
- `services/kafka-consumer/src/services/demand-calculator.ts` - Business logic
- `services/kafka-consumer/src/services/surge-service.ts` - Materialization logic

**Consumer Groups:**
1. `demand-aggregator` - Processes raw booking events
2. `surge-updater` - Processes hourly demand metrics

## Topics

### `venue.booking.events`

**Purpose:** Raw booking lifecycle events

**Schema:**
```typescript
{
  eventId: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED';
  timestamp: string;
  subLocationId: string;
  locationId?: string;
  eventName: string;
  startDate: string;
  endDate: string;
  attendees?: number;
  capacityDelta?: number;
  previousAttendees?: number;
}
```

**Retention:** 7 days

### `venue.demand.hourly`

**Purpose:** Aggregated hourly demand metrics

**Schema:**
```typescript
{
  subLocationId: string;
  hour: string;
  bookingsCount: number;
  totalAttendees: number;
  capacityUtilization: number;
  availableCapacity: number;
  demandPressure: number;
  historicalAvgPressure: number;
  pressureDelta: number;
  timestamp: string;
}
```

**Retention:** 30 days

## MongoDB Collections

### `demand_history`

Stores hourly demand metrics for calculating historical averages.

```typescript
{
  subLocationId: string;
  dayOfWeek: number;      // 0-6
  hour: number;           // 0-23
  bookingsCount: number;
  demandPressure: number;
  timestamp: Date;
  createdAt: Date;        // TTL index: 30 days
}
```

### `surge_configs`

Updated automatically with:
- `demandSupplyParams.currentDemand` - From hourly aggregation
- `demandSupplyParams.historicalAvgPressure` - From 30-day rolling average
- `demandSupplyParams.currentSupply` - **MANUAL** (not auto-calculated)

### `ratesheets`

New DRAFT ratesheets created with:
- `type: 'SURGE_MULTIPLIER'`
- `approvalStatus: 'DRAFT'`
- `surgeMultiplierSnapshot` - Calculated multiplier
- `demandSupplySnapshot` - Demand/supply at creation time

## Testing

### 1. Check Kafka Topics

```bash
# List topics
docker exec venue-kafka kafka-topics --bootstrap-server localhost:9092 --list

# Consume booking events
docker exec venue-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic venue.booking.events \
  --from-beginning

# Consume demand metrics
docker exec venue-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic venue.demand.hourly \
  --from-beginning
```

### 2. Monitor Consumer Lag

```bash
# Check consumer group status
docker exec venue-kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --describe \
  --group demand-aggregator

docker exec venue-kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --describe \
  --group surge-updater
```

### 3. Verify Database Updates

```javascript
// Connect to MongoDB
use venue_management

// Check demand history
db.demand_history.find().sort({ timestamp: -1 }).limit(10)

// Check updated surge configs
db.surge_configs.find({ isActive: true }).forEach(c => {
  print(`${c.name}: demand=${c.demandSupplyParams.currentDemand}, supply=${c.demandSupplyParams.currentSupply}`)
})

// Check new ratesheets
db.ratesheets.find({
  type: 'SURGE_MULTIPLIER',
  approvalStatus: 'DRAFT'
}).sort({ createdAt: -1 }).limit(5)
```

### 4. Synthetic Load Testing

```bash
# Scenario: Peak hour (20 bookings/hour for 1 hour)
npx tsx scripts/generate-booking-load.ts \
  --scenario PEAK_HOUR \
  --sublocation 65a9876543210fedcba98765 \
  --location 65a1111111111111111111111

# Scenario: Normal load (5 bookings/hour for 2 hours)
npx tsx scripts/generate-booking-load.ts \
  --scenario NORMAL \
  --sublocation 65a9876543210fedcba98765

# Scenario: Low load (2 bookings/hour for 1 hour)
npx tsx scripts/generate-booking-load.ts \
  --scenario LOW \
  --sublocation 65a9876543210fedcba98765
```

## Demand Calculation Formula

```
currentDemand = bookingsCount (in last hour)
demandPressure = bookingsCount / (availableCapacity / 100)
historicalAvgPressure = AVG(demandPressure) for same day-of-week + hour over last 30 days

surgeFactor = 1 + alpha * log(demandPressure / historicalAvgPressure)
surgeFactor = clamp(surgeFactor, minMultiplier, maxMultiplier)
```

**Example:**
- 15 bookings in the hour
- Capacity: 100
- Historical average pressure: 1.2
- Alpha: 0.3, Min: 0.75, Max: 1.8

Result:
1. Pressure = 15 / (100/100) = 15
2. Normalized = 15 / 1.2 = 12.5
3. Raw factor = 1 + 0.3 * ln(12.5) = 1.77
4. Final multiplier = clamp(1.77, 0.75, 1.8) = **1.77**

## Operational Notes

### Starting Services

```bash
# Development (separate terminals)
Terminal 1: npm run dev                          # Main app
Terminal 2: cd services/kafka-consumer && npm run dev  # Consumer

# Production (Docker)
docker-compose up -d zookeeper kafka kafka-consumer
```

### Stopping Services

```bash
# Stop Kafka services
docker-compose stop kafka zookeeper kafka-consumer

# Stop and remove volumes (DESTRUCTIVE)
docker-compose down -v
```

### Logs

```bash
# Kafka logs
docker logs -f venue-kafka

# Consumer logs
docker logs -f venue-kafka-consumer

# Zookeeper logs
docker logs -f venue-zookeeper
```

### Troubleshooting

**Problem:** Consumer not receiving messages

```bash
# Check if consumer is connected
docker exec venue-kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --list

# Check if topics exist
docker exec venue-kafka kafka-topics \
  --bootstrap-server localhost:9092 \
  --list
```

**Problem:** MongoDB connection errors

```bash
# Check MongoDB is accessible from consumer
docker exec venue-kafka-consumer ping -c 3 mongodb
```

**Problem:** No surge ratesheets created

1. Verify surge config exists and is active
2. Check demandSupplyParams are valid (supply > 0)
3. Check consumer logs for errors
4. Verify MongoDB ratesheets collection

## Environment Variables

**Main App (.env.local):**
```bash
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=venue-management-app
KAFKA_TOPIC_BOOKING_EVENTS=venue.booking.events
KAFKA_TOPIC_DEMAND_HOURLY=venue.demand.hourly
```

**Consumer Service (docker-compose.yml):**
```yaml
KAFKA_BROKERS=kafka:29092
KAFKA_GROUP_ID_AGGREGATOR=demand-aggregator
KAFKA_GROUP_ID_UPDATER=surge-updater
MONGODB_URI=mongodb://admin:password123@mongodb:27017/venue_management?authSource=admin
```

## Future Enhancements

- Dead-letter queue for failed messages
- Idempotency with processed_events collection
- Manual offset commits for exactly-once semantics
- Grafana dashboard for monitoring
- Alerting on consumer lag
- Schema registry for message versioning
