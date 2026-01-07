# Database Schema & Relationships

## Entity Relationship Diagram

```
┌─────────────────────────┐
│      CUSTOMERS          │
├─────────────────────────┤
│ _id: ObjectId (PK)      │
│ name: string            │
│ email: string           │
│ phone: string?          │
│ address: string?        │
│ createdAt: Date         │
│ updatedAt: Date         │
└───────────┬─────────────┘
            │
            │ 1:N (One Customer has Many Locations)
            │
            ▼
┌─────────────────────────┐
│      LOCATIONS          │
├─────────────────────────┤
│ _id: ObjectId (PK)      │
│ customerId: ObjectId(FK)│──┐
│ name: string            │  │ References customers._id
│ address: string         │  │
│ city: string            │◄─┘
│ state: string           │
│ zipCode: string         │
│ country: string         │
│ createdAt: Date         │
│ updatedAt: Date         │
└───────────┬─────────────┘
            │
            │ M:N (Many-to-Many through junction table)
            │
            ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│   LOCATION_VENUES       │         │       VENUES            │
│    (Junction Table)     │         ├─────────────────────────┤
├─────────────────────────┤         │ _id: ObjectId (PK)      │
│ _id: ObjectId (PK)      │         │ name: string            │
│ locationId: ObjectId(FK)│────┐    │ description: string?    │
│ venueId: ObjectId (FK)  │────┼───▶│ capacity: number?       │
│ createdAt: Date         │    │    │ venueType: string       │
└─────────────────────────┘    │    │ createdAt: Date         │
                               │    │ updatedAt: Date         │
                               │    └─────────────────────────┘
                               │
                               └──── References locations._id
                                     References venues._id
```

## Relationship Types Explained

### 1. One-to-Many: Customer → Location
- **Type**: One Customer can have Many Locations
- **Implementation**: `locations.customerId` references `customers._id`
- **Example**: 
  - Acme Corporation has NYC Headquarters and Brooklyn Office
  - TechStart Inc has SF Campus and Palo Alto Lab

### 2. Many-to-Many: Location ↔ Venue
- **Type**: Many Locations can have Many Venues
- **Implementation**: Junction table `location_venues` with:
  - `locationId` (references `locations._id`)
  - `venueId` (references `venues._id`)
- **Example**:
  - Grand Ballroom is available at 3 different locations
  - NYC Headquarters has Grand Ballroom, Conference Hall A, and Rooftop Garden
  - Multiple locations can share the same venue

## Data Flow Example

### Scenario: View Customer with all Locations and Venues

```
1. Query Customer
   └─> GET /api/customers/{id}

2. Query Locations for that Customer
   └─> WHERE customerId = {customer._id}

3. For each Location, query Venues
   └─> JOIN location_venues ON locationId = {location._id}
   └─> JOIN venues ON venue._id = location_venues.venueId

Result:
Customer: Acme Corporation
  ├─ Location: NYC Headquarters
  │   ├─ Venue: Grand Ballroom
  │   ├─ Venue: Conference Hall A
  │   └─ Venue: Rooftop Garden
  └─ Location: Brooklyn Office
      ├─ Venue: Conference Hall A (shared!)
      ├─ Venue: Theater Room
      └─ Venue: Meeting Room B
```

## Sample Data Relationships

### Venues Used Across Multiple Locations:

| Venue              | Used in Locations                          | Count |
|--------------------|---------------------------------------------|-------|
| Grand Ballroom     | NYC HQ, SF Campus, Chicago Center          | 3     |
| Conference Hall A  | NYC HQ, Brooklyn, Chicago Center           | 3     |
| Rooftop Garden     | NYC HQ, SF Campus, Austin Hub              | 3     |
| Theater Room       | Brooklyn, Palo Alto, Austin Hub            | 3     |
| Banquet Hall       | SF Campus, Palo Alto, Chicago Center       | 3     |
| Meeting Room B     | Brooklyn, Palo Alto                        | 2     |

### Benefits of Many-to-Many Relationship:

1. **Reusability**: Define a venue once, use it in multiple locations
2. **Consistency**: Same venue specifications across all locations
3. **Flexibility**: Easy to add/remove venues from locations
4. **Scalability**: New locations can choose from existing venues
5. **Data Integrity**: Venue updates reflect across all locations

## API Query Patterns

### Get all venues for a location:
```typescript
const venues = await VenueRepository.findByLocationId(locationId);
```

### Get all locations using a venue:
```typescript
const locationVenues = await LocationVenueRepository.findByVenueId(venueId);
const locationIds = locationVenues.map(lv => lv.locationId);
const locations = await LocationRepository.findByIds(locationIds);
```

### Add venue to location:
```typescript
await LocationVenueRepository.create(locationId, venueId);
```

### Remove venue from location:
```typescript
await LocationVenueRepository.delete(locationId, venueId);
```
