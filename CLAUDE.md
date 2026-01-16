## ⚠️ AI Usage Contract

This repository is production-grade.

AI-assisted changes must be:
- Small
- Intentional
- Reviewable
- Reversible

---

# Claude Code Guidelines – Venue Management System

## Project Overview
This is a Next.js 14 App Router application for venue management with a dual-database architecture (MongoDB + Neo4j).
Exercise extreme caution when modifying core data flows.

---

## ⛔ READ-ONLY ZONES (Do Not Modify)

These files and folders are critical infrastructure.
Any changes require explicit human approval and thorough testing.

### Database Connection Layer
- `src/lib/mongodb.ts` – MongoDB singleton connection
- `src/lib/neo4j.ts` – Neo4j driver and sync logic

### Core Data Models
- `src/models/types.ts` – Central type definitions (ALL entities depend on this)
- `src/models/Customer.ts` – CustomerRepository pattern
- `src/models/Location.ts` – LocationRepository pattern
- `src/models/Ratesheet.ts` – Complex ratesheet queries with approval workflow

### Pricing Engine
- `src/lib/pricing-engine.ts` – Critical pricing calculation logic (contains documented bug fixes)
- `src/lib/price-engine-hourly.ts` – Hourly rate calculations

### Configuration Files
- `package.json` – Dependencies
- `tsconfig.json` – TypeScript strict mode configuration
- `next.config.js` – Next.js configuration
- `tailwind.config.js` – Styling configuration

### Root Layout
- `src/app/layout.tsx` – Affects the entire application

---

## ⚠️ HIGH-RISK AREAS (Modify With Extreme Caution)

Changes here have cascading effects across the application.

### Repositories (`src/models/`)
All repositories follow a static class pattern:
- `COLLECTION` constant
- `create`, `findById`, `findAll`, `update`, `delete`
- **Do not deviate from existing patterns**

### Navigation
- `src/components/NavigationLayout.tsx`
- `src/components/NavigationHeader.tsx`

### Complex Visualization Components
- `src/components/GraphVisualization.tsx` (~1500 lines, ReactFlow)
- `src/components/HierarchyManager.tsx` (~560 lines)
- `src/components/CalendarTimeline.tsx` (D3 timeline)

### API Routes Handling Database Sync
- `src/app/api/graph/sync/route.ts` – Neo4j sync (destructive)
- `src/app/api/admin/seed/route.ts` – Database seeding

---

## ✅ SAFE ZONES (Lower Risk)

These areas are suitable for incremental changes when following established patterns.

### New Pages
- New pages in `src/app/`
- New API routes in `src/app/api/` using `NextResponse`

### Simple Form Components
- `src/components/CustomerForm.tsx`
- `src/components/LocationForm.tsx`
- `src/components/VenueForm.tsx`
- `src/components/SubLocationForm.tsx`

### UI Display Components
- `src/components/AttributesManager.tsx`
- `src/components/TimezoneSelector.tsx`
- `src/components/DecisionAuditPanel.tsx`

### Documentation
- All `*.md` files in the root directory

---

## Architectural Patterns to Follow

### 1. Repository Pattern

export class EntityRepository {
    private static COLLECTION = 'collection_name';

    static async create(...): Promise<Entity> {}
    static async findById(id: string | ObjectId): Promise<Entity | null> {}
    static async findAll(): Promise<Entity[]> {}
    static async update(
    id: string | ObjectId,
    updates: Partial<Entity>
    ): Promise<Entity | null> {}
    static async delete(id: string | ObjectId): Promise<boolean> {}
}

### 2. API Route Pattern

export async function GET() {
  try {
    const data = await Repository.findAll();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch' },
      { status: 500 }
    );
  }
}

### 3. Client Component Pattern

'use client';

import { useState, useEffect } from 'react';

export default function Component() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => { ... };
}

### 4. Path aliases

Always use @/ prefix for imports:

import { CustomerRepository } from '@/models/Customer';
import { getDb } from '@/lib/mongodb';

# Rules for AI-Assisted Changes


## Before Making Any Change

1. Read the file(s) being modified
2. Identify the zone (Read-Only, High-Risk, Safe)
3. Propose High-Risk changes for human review first

## Component Modifications

* Keep changes small and focused
* Do not refactor unrelated code
* Preserve Tailwind patterns
* No new dependencies without approval

## Data Model Changes

* NEVER modify src/models/types.ts lightly
* Changes cascade across the entire codebase
* Repository method signatures must remain backward compatible

## API Route Changes

* Do not change HTTP methods for existing endpoints
* Preserve response structures
* Prefer adding new endpoints over modifying existing ones

## Database Operations

* NEVER modify database connection logic
* NEVER drop or clear data without explicit request
* Neo4j sync is destructive (clear + rebuild)
