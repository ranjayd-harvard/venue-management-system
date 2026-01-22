# Capacity Management System - Quick Start Guide

## TL;DR

We're building a **CapacitySheet** system that mirrors the existing **Ratesheet** pricing system. Same architecture, same patterns, parallel implementation.

---

## Core Concept

```
PRICING SYSTEM          →    CAPACITY SYSTEM
────────────────────────────────────────────────
Ratesheet               →    CapacitySheet
pricePerHour            →    min/max/default/allocated Capacity
Price Calculation       →    Capacity Calculation
/admin/pricing          →    /admin/capacity-sheets
/pricing/view           →    /capacity/calculator
```

---

## Quick Architecture Overview

### Hierarchy (Both Systems)
```
Event (Highest Priority)
  ↓
SubLocation
  ↓
Location
  ↓
Customer (Lowest Priority)
```

### CapacitySheet Structure
```typescript
{
  name: "Weekend Peak Capacity",
  type: "TIME_BASED",  // or DATE_BASED, EVENT_BASED
  appliesTo: {
    level: "SUBLOCATION",
    entityId: "64abc123..."
  },
  priority: 100,
  timeWindows: [{
    startTime: "09:00",
    endTime: "21:00",
    minCapacity: 100,
    maxCapacity: 400,
    defaultCapacity: 250,
    allocatedCapacity: 200
  }],
  approvalStatus: "APPROVED",
  isActive: true
}
```

---

## Implementation Checklist

### Models (Week 1)
- [ ] `src/models/CapacitySheet.ts` - Repository & types
- [ ] `src/lib/capacity-engine-hourly.ts` - Calculation engine
- [ ] Update `src/models/types.ts` - Export capacity types

### API (Week 2)
- [ ] `src/app/api/capacitysheets/route.ts` - List/Create
- [ ] `src/app/api/capacitysheets/[id]/route.ts` - CRUD
- [ ] `src/app/api/capacitysheets/[id]/approve/route.ts` - Approval
- [ ] `src/app/api/capacity/calculate/route.ts` - Calculator

### UI (Week 3-4)
- [ ] `src/app/admin/capacity-sheets/page.tsx` - Management
- [ ] `src/components/CapacitySheetForm.tsx` - Form
- [ ] `src/app/capacity/calculator/page.tsx` - Calculator
- [ ] `src/app/capacity/timeline/page.tsx` - Timeline
- [ ] Update navigation menu

### Migration (Week 5)
- [ ] `scripts/migrate-capacity-to-sheets.js` - Data migration
- [ ] Update seed script with sample capacity sheets
- [ ] Documentation

---

## Key Files Reference

### Models to Copy Pattern From
- `src/models/Ratesheet.ts` → Use as template for CapacitySheet
- `src/lib/price-engine-hourly.ts` → Use as template for capacity-engine-hourly

### UI to Copy Pattern From
- `src/app/admin/pricing/page.tsx` → Use as template for capacity-sheets page
- `src/app/pricing/view/page.tsx` → Use as template for capacity calculator

---

## Sample Code Snippets

### Creating a CapacitySheet
```typescript
const capacitySheet = await CapacitySheetRepository.create({
  name: "Weekend Peak Hours",
  type: "TIME_BASED",
  appliesTo: {
    level: "SUBLOCATION",
    entityId: subLocationId
  },
  priority: 100,
  conflictResolution: "PRIORITY",
  effectiveFrom: new Date("2024-01-01"),
  effectiveTo: null,
  timeWindows: [{
    startTime: "09:00",
    endTime: "21:00",
    minCapacity: 100,
    maxCapacity: 400,
    defaultCapacity: 250,
    allocatedCapacity: 200
  }],
  isActive: true,
  approvalStatus: "DRAFT"
});
```

### Calculating Capacity
```typescript
const engine = new HourlyCapacityEngine();
const result = engine.calculateCapacity({
  bookingStart: new Date("2024-01-15T10:00:00Z"),
  bookingEnd: new Date("2024-01-15T18:00:00Z"),
  timezone: "America/New_York",
  customerId,
  locationId,
  subLocationId,
  eventId,
  customerCapacitySheets: [...],
  locationCapacitySheets: [...],
  sublocationCapacitySheets: [...],
  eventCapacitySheets: [...],
  customerDefaultCapacity: 100,
  locationDefaultCapacity: 150,
  sublocationDefaultCapacity: 200,
  capacityConfig: { ... }
});

// result.segments = hourly breakdown
// result.summary = aggregated stats
// result.decisionLog = which sheet applied when
```

### API Call
```bash
# Calculate capacity
curl -X POST http://localhost:3000/api/capacity/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "subLocationId": "64abc...",
    "locationId": "64def...",
    "customerId": "64ghi...",
    "startDateTime": "2024-01-15T10:00:00Z",
    "endDateTime": "2024-01-15T18:00:00Z",
    "timezone": "America/New_York"
  }'
```

---

## Navigation Updates

Add to Capacity menu in `NavigationLayout.tsx`:

```typescript
const capacitySubItems = [
  {
    href: '/capacity/manage',
    icon: TrendingUp,
    label: 'Manage Capacity',
    description: 'View and manage capacity'
  },
  {
    href: '/capacity/calculator',  // NEW
    icon: Calculator,
    label: 'Capacity Calculator',
    description: 'Calculate booking capacity'
  },
  {
    href: '/capacity/timeline',  // NEW
    icon: Timer,
    label: 'Capacity Timeline',
    description: 'Visual capacity timeline'
  },
  {
    href: '/admin/capacity-sheets',  // NEW
    icon: FileText,
    label: 'Manage CapacitySheets',
    description: 'Configure capacity rules'
  },
  {
    href: '/admin/capacity-settings',
    icon: Settings,
    label: 'Capacity Settings',
    description: 'Configure capacity constraints'
  },
];
```

---

## Database Collections

### New Collection: `capacitysheets`
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  type: "TIME_BASED" | "DATE_BASED" | "EVENT_BASED",
  appliesTo: {
    level: "CUSTOMER" | "LOCATION" | "SUBLOCATION" | "EVENT",
    entityId: ObjectId
  },
  priority: Number,
  // ... (see CAPACITY_SYSTEM_DESIGN.md for full schema)
}
```

### Indexes to Create
```javascript
db.capacitysheets.createIndex({ "appliesTo.entityId": 1, effectiveFrom: 1 });
db.capacitysheets.createIndex({ "appliesTo.level": 1, isActive: 1 });
db.capacitysheets.createIndex({ priority: -1 });
```

---

## Testing Commands

```bash
# Run migration
node scripts/migrate-capacity-to-sheets.js

# Verify capacity sheets created
mongo venue-management
> db.capacitysheets.find({}).pretty()

# Test API endpoints
npm run test:api -- capacitysheets

# Test calculation engine
npm run test:unit -- capacity-engine-hourly
```

---

## Common Patterns

### Repository Pattern
```typescript
export class CapacitySheetRepository {
  static async findAll(): Promise<CapacitySheet[]> { }
  static async findById(id: ObjectId): Promise<CapacitySheet | null> { }
  static async create(sheet: Omit<CapacitySheet, '_id'>): Promise<ObjectId> { }
  static async update(id: ObjectId, updates: Partial<CapacitySheet>): Promise<boolean> { }
  static async delete(id: ObjectId): Promise<boolean> { }
  static async approve(id: ObjectId, approvedBy: string): Promise<boolean> { }
  static async reject(id: ObjectId, reason: string): Promise<boolean> { }
}
```

### Approval Workflow
```typescript
// Create as draft
const id = await CapacitySheetRepository.create({
  ...data,
  approvalStatus: 'DRAFT'
});

// Submit for approval
await CapacitySheetRepository.update(id, {
  approvalStatus: 'PENDING_APPROVAL'
});

// Approve
await CapacitySheetRepository.approve(id, 'admin@example.com');

// Or reject
await CapacitySheetRepository.reject(id, 'Capacity values too high');
```

---

## Priority Resolution Example

Given multiple capacity sheets:

```typescript
// Event-level (Priority: 50)
{
  level: "EVENT",
  timeWindow: { min: 200, max: 1000, default: 600 }
}

// SubLocation-level (Priority: 100)
{
  level: "SUBLOCATION",
  timeWindow: { min: 50, max: 300, default: 150 }
}

// Location-level (Priority: 80)
{
  level: "LOCATION",
  timeWindow: { min: 100, max: 500, default: 250 }
}
```

**Result**: Event-level wins (regardless of priority number, Event always wins)

If no event:
**Result**: SubLocation-level wins (priority 100 > 80)

---

## Gotchas & Best Practices

### Gotchas
1. **Don't forget approval** - Capacity sheets must be APPROVED to be active
2. **Check date ranges** - effectiveFrom/To must overlap booking period
3. **Validate capacity values** - allocated must be between min and max
4. **String comparison for ObjectIds** - Use `String(id1) === String(id2)`

### Best Practices
1. **Name descriptively** - "Weekend Peak Hours" not "Sheet 1"
2. **Set reasonable priorities** - Use multiples of 10 (10, 20, 30...)
3. **Use recurrence** - Don't create 52 sheets for weekly patterns
4. **Document conflict resolution** - Explain why HIGHEST_CAPACITY vs PRIORITY
5. **Test with real data** - Validate calculations match expectations

---

## Support & Resources

### Documentation
- `CAPACITY_SYSTEM_DESIGN.md` - Full technical design
- `CAPACITY_IMPLEMENTATION_PLAN.md` - Detailed implementation plan
- `CLAUDE.md` - Project guidelines (updated with capacity system)

### Similar Code to Reference
- Ratesheet system (`src/models/Ratesheet.ts`)
- Pricing engine (`src/lib/price-engine-hourly.ts`)
- Pricing admin UI (`src/app/admin/pricing/page.tsx`)

### Need Help?
1. Check existing pricing system implementation
2. Review design docs in this directory
3. Ask specific questions with context

---

**Last Updated**: 2026-01-20
**Status**: Design Complete, Ready for Implementation
