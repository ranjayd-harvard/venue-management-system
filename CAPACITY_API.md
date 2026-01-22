# Capacity & Revenue Goals API Reference

This document describes the API endpoints for managing capacity and revenue goals across entities (Customer, Location, SubLocation, Event).

## Base Concepts

- **Entity Types**: `customer`, `location`, `sublocation`, `event`
- **Date Format**: ISO 8601 date strings (YYYY-MM-DD)
- **Capacity Bounds**: Each entity has `minCapacity` (default: 0) and `maxCapacity` (default: 100)
- **Daily Capacity**: Explicit capacity values for specific dates. Falls back to `maxCapacity` if not set.
- **Revenue Goals**: Time-varying goals with `dailyGoal`, `weeklyGoal`, and `monthlyGoal` for date ranges

---

## Capacity Management

### GET /api/capacity

Get capacity for a specific entity.

**Query Parameters:**
- `entityType` (required): `customer` | `location` | `sublocation` | `event`
- `entityId` (required): ObjectId string
- `date` (optional): Single date (YYYY-MM-DD)
- `startDate` & `endDate` (optional): Date range (YYYY-MM-DD)

**Examples:**

```bash
# Get capacity for a specific date
GET /api/capacity?entityType=location&entityId=507f1f77bcf86cd799439011&date=2024-03-15

# Get capacities for a date range
GET /api/capacity?entityType=customer&entityId=507f1f77bcf86cd799439011&startDate=2024-03-01&endDate=2024-03-31

# Get full capacity config
GET /api/capacity?entityType=sublocation&entityId=507f1f77bcf86cd799439011
```

**Response (single date):**
```json
{
  "date": "2024-03-15",
  "capacity": 85,
  "bounds": {
    "minCapacity": 0,
    "maxCapacity": 100
  }
}
```

**Response (date range):**
```json
{
  "startDate": "2024-03-01",
  "endDate": "2024-03-31",
  "capacities": [
    { "date": "2024-03-01", "capacity": 100 },
    { "date": "2024-03-02", "capacity": 85 },
    ...
  ],
  "bounds": {
    "minCapacity": 0,
    "maxCapacity": 100
  }
}
```

---

### POST /api/capacity

Set capacity for a specific entity.

**Request Body:**
```json
{
  "entityType": "location",
  "entityId": "507f1f77bcf86cd799439011",
  "date": "2024-03-15",
  "capacity": 85
}
```

**OR for date ranges:**
```json
{
  "entityType": "location",
  "entityId": "507f1f77bcf86cd799439011",
  "startDate": "2024-03-15",
  "endDate": "2024-03-20",
  "capacity": 85
}
```

**Response:**
```json
{
  "success": true,
  "message": "Capacity updated successfully",
  "data": { /* Updated entity */ }
}
```

---

### DELETE /api/capacity

Remove capacity override for a specific date (reverts to maxCapacity).

**Query Parameters:**
- `entityType` (required): `customer` | `location` | `sublocation` | `event`
- `entityId` (required): ObjectId string
- `date` (required): Date (YYYY-MM-DD)

**Example:**
```bash
DELETE /api/capacity?entityType=location&entityId=507f1f77bcf86cd799439011&date=2024-03-15
```

---

### PUT /api/capacity/bounds

Update capacity bounds (min/max) for an entity.

**Request Body:**
```json
{
  "entityType": "customer",
  "entityId": "507f1f77bcf86cd799439011",
  "minCapacity": 0,
  "maxCapacity": 150
}
```

**Response:**
```json
{
  "success": true,
  "message": "Capacity bounds updated successfully",
  "data": { /* Updated entity */ }
}
```

---

### GET /api/capacity/aggregate

Get aggregated capacity across a hierarchy.

**Query Parameters:**
- `customerId` (optional): Aggregate all locations under customer
- `locationId` (optional): Aggregate all sublocations under location
- `sublocationId` (optional): Aggregate all events under sublocation
- `date` (required): Date for aggregation (YYYY-MM-DD)

**Example:**
```bash
# Aggregate all locations under a customer
GET /api/capacity/aggregate?customerId=507f1f77bcf86cd799439011&date=2024-03-15
```

**Response:**
```json
{
  "entityType": "customer",
  "entityId": "507f1f77bcf86cd799439011",
  "date": "2024-03-15",
  "totalCapacity": 450,
  "totalGoals": {
    "dailyGoal": 5000,
    "weeklyGoal": 35000,
    "monthlyGoal": 150000
  },
  "breakdown": {
    "customer": {
      "name": "ACME Corp",
      "capacity": 100
    },
    "locations": [
      { "id": "...", "name": "Location A", "capacity": 200 },
      { "id": "...", "name": "Location B", "capacity": 150 }
    ]
  }
}
```

---

## Revenue Goals Management

### GET /api/revenue-goals

Get revenue goals for a specific entity.

**Query Parameters:**
- `entityType` (required): `customer` | `location` | `sublocation` | `event`
- `entityId` (required): ObjectId string
- `date` (optional): Get goals for specific date (YYYY-MM-DD)

**Example:**
```bash
# Get goals for a specific date
GET /api/revenue-goals?entityType=location&entityId=507f1f77bcf86cd799439011&date=2024-03-15

# Get all revenue goals
GET /api/revenue-goals?entityType=location&entityId=507f1f77bcf86cd799439011
```

**Response (specific date):**
```json
{
  "date": "2024-03-15",
  "goals": {
    "startDate": "2024-03-01",
    "endDate": "2024-03-31",
    "dailyGoal": 1000,
    "weeklyGoal": 7000,
    "monthlyGoal": 30000
  }
}
```

**Response (all goals):**
```json
{
  "revenueGoals": [
    {
      "startDate": "2024-03-01",
      "endDate": "2024-03-31",
      "dailyGoal": 1000,
      "weeklyGoal": 7000,
      "monthlyGoal": 30000
    },
    ...
  ]
}
```

---

### POST /api/revenue-goals

Set revenue goals for a specific entity.

**Request Body:**
```json
{
  "entityType": "location",
  "entityId": "507f1f77bcf86cd799439011",
  "startDate": "2024-03-01",
  "endDate": "2024-03-31",
  "dailyGoal": 1000,
  "weeklyGoal": 7000,
  "monthlyGoal": 30000
}
```

**Note:** At least one goal (`dailyGoal`, `weeklyGoal`, or `monthlyGoal`) must be provided.

**Response:**
```json
{
  "success": true,
  "message": "Revenue goals set successfully",
  "data": { /* Updated entity */ }
}
```

---

### DELETE /api/revenue-goals

Remove revenue goals for a specific date range.

**Query Parameters:**
- `entityType` (required): `customer` | `location` | `sublocation` | `event`
- `entityId` (required): ObjectId string
- `startDate` (required): Start date (YYYY-MM-DD)
- `endDate` (required): End date (YYYY-MM-DD)

**Example:**
```bash
DELETE /api/revenue-goals?entityType=location&entityId=507f1f77bcf86cd799439011&startDate=2024-03-01&endDate=2024-03-31
```

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400`: Bad Request (invalid parameters)
- `404`: Entity not found
- `500`: Internal Server Error

---

## Usage Examples

### Setting Up Capacity for a Location

```javascript
// 1. Set capacity bounds
await fetch('/api/capacity/bounds', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'location',
    entityId: 'abc123',
    minCapacity: 50,
    maxCapacity: 200
  })
});

// 2. Set specific daily capacity
await fetch('/api/capacity', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'location',
    entityId: 'abc123',
    date: '2024-03-15',
    capacity: 150
  })
});

// 3. Set revenue goals for the month
await fetch('/api/revenue-goals', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'location',
    entityId: 'abc123',
    startDate: '2024-03-01',
    endDate: '2024-03-31',
    dailyGoal: 2000,
    weeklyGoal: 14000,
    monthlyGoal: 60000
  })
});
```

### Getting Aggregated Data

```javascript
// Get total capacity across all locations for a customer
const response = await fetch(
  '/api/capacity/aggregate?customerId=abc123&date=2024-03-15'
);
const data = await response.json();

console.log(`Total capacity: ${data.totalCapacity}`);
console.log(`Daily goal: ${data.totalGoals.dailyGoal}`);
```
