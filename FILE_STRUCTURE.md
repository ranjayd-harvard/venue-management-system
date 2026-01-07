# Complete File Structure

This document provides a complete overview of all files in the project.

## Root Directory Files

```
venue-management-system/
├── .env.example              # Environment variables template
├── .env.local               # Local environment variables (not in git)
├── .eslintrc.json           # ESLint configuration
├── .gitattributes           # Git attributes for line endings
├── .gitignore              # Git ignore rules
├── CONTRIBUTING.md          # Contributing guidelines
├── DEPLOYMENT.md            # Deployment guide
├── LICENSE                  # MIT License
├── PROJECT_SUMMARY.md       # Project overview and summary
├── README.md                # Main documentation
├── SCHEMA.md                # Database schema documentation
├── SETUP.md                 # Quick setup guide
├── TROUBLESHOOTING.md       # Common issues and solutions
├── next.config.js           # Next.js configuration
├── package.json             # NPM dependencies and scripts
├── postcss.config.js        # PostCSS configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── tsconfig.json            # TypeScript configuration
```

## Source Code Structure

```
src/
├── app/                      # Next.js App Router
│   ├── api/                 # API Routes
│   │   └── customers/
│   │       └── route.ts     # Customer API endpoints (GET, POST)
│   ├── customers/           # Customer pages
│   │   ├── [id]/
│   │   │   └── page.tsx    # Dynamic customer detail page
│   │   └── page.tsx        # Customer list page
│   ├── locations/
│   │   └── page.tsx        # Location list page
│   ├── venues/
│   │   └── page.tsx        # Venue list page
│   ├── globals.css         # Global styles with Tailwind
│   ├── layout.tsx          # Root layout component
│   └── page.tsx            # Home page
├── lib/
│   └── mongodb.ts          # MongoDB connection utility
└── models/                  # Data models and repositories
    ├── Customer.ts         # Customer repository
    ├── Location.ts         # Location repository
    ├── LocationVenue.ts    # Junction table repository
    ├── Venue.ts            # Venue repository
    └── types.ts            # TypeScript type definitions
```

## Scripts Directory

```
scripts/
└── seed.ts                  # Database seeding script
```

## File Descriptions

### Configuration Files

| File | Purpose |
|------|---------|
| `.env.example` | Template for environment variables |
| `.env.local` | Local environment configuration (gitignored) |
| `.eslintrc.json` | Code linting rules |
| `.gitattributes` | Git file handling settings |
| `.gitignore` | Files/folders to exclude from git |
| `next.config.js` | Next.js framework configuration |
| `package.json` | Node dependencies and npm scripts |
| `postcss.config.js` | PostCSS plugins configuration |
| `tailwind.config.js` | Tailwind CSS customization |
| `tsconfig.json` | TypeScript compiler options |

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Main project documentation |
| `SETUP.md` | Quick start guide |
| `SCHEMA.md` | Database schema and relationships |
| `PROJECT_SUMMARY.md` | Project overview |
| `CONTRIBUTING.md` | Contribution guidelines |
| `TROUBLESHOOTING.md` | Common issues and fixes |
| `DEPLOYMENT.md` | Production deployment guide |
| `LICENSE` | MIT License terms |

### Application Files

#### Models (`src/models/`)

| File | Purpose |
|------|---------|
| `types.ts` | TypeScript interfaces for all entities |
| `Customer.ts` | Customer CRUD operations |
| `Location.ts` | Location CRUD operations |
| `Venue.ts` | Venue CRUD operations |
| `LocationVenue.ts` | Junction table operations |

#### Pages (`src/app/`)

| File | Route | Purpose |
|------|-------|---------|
| `page.tsx` | `/` | Home page with navigation |
| `customers/page.tsx` | `/customers` | List all customers |
| `customers/[id]/page.tsx` | `/customers/:id` | Customer detail view |
| `locations/page.tsx` | `/locations` | List all locations |
| `venues/page.tsx` | `/venues` | List all venues |

#### API Routes (`src/app/api/`)

| File | Endpoint | Methods |
|------|----------|---------|
| `customers/route.ts` | `/api/customers` | GET, POST |

#### Utilities (`src/lib/`)

| File | Purpose |
|------|---------|
| `mongodb.ts` | MongoDB connection with pooling |

#### Styles

| File | Purpose |
|------|---------|
| `app/globals.css` | Global styles and Tailwind imports |

### Scripts

| File | Command | Purpose |
|------|---------|---------|
| `scripts/seed.ts` | `npm run seed` | Populate database with sample data |

## File Size Reference

| Type | Files | Lines of Code |
|------|-------|---------------|
| TypeScript/TSX | 14 | ~1,500 |
| Configuration | 6 | ~100 |
| Documentation | 8 | ~2,000 |
| Total | 28 | ~3,600 |

## Key File Relationships

```
┌─────────────────────────────────────────┐
│           package.json                   │
│  (defines scripts and dependencies)      │
└────────────┬────────────────────────────┘
             │
             ├──> scripts/seed.ts (uses models)
             │
             ├──> src/app/** (pages)
             │    │
             │    ├──> uses models/
             │    └──> imports from lib/
             │
             └──> src/models/ (repositories)
                  │
                  └──> uses lib/mongodb.ts
```

## Import Patterns

### Path Aliases

The project uses `@/` as an alias for `src/`:

```typescript
// Instead of:
import { CustomerRepository } from '../../models/Customer';

// Use:
import { CustomerRepository } from '@/models/Customer';
```

### Common Imports

```typescript
// Page components
import { CustomerRepository } from '@/models/Customer';
import { LocationRepository } from '@/models/Location';
import Link from 'next/link';

// API routes
import { NextResponse } from 'next/server';

// Models
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
```

## Generated Files (Not in Git)

These directories/files are created during development but not committed:

```
.next/                   # Next.js build output
node_modules/            # NPM packages
.env.local              # Local environment (contains secrets)
*.log                   # Log files
```

## Build Artifacts

When building for production:

```
npm run build
```

Creates:
- `.next/` - Optimized production build
- `.next/static/` - Static assets
- `.next/server/` - Server-side code

## File Count Summary

```
Total Files: 28
├── TypeScript files: 14
├── Configuration files: 6
├── Documentation files: 8
└── Build/Generated: (excluded)

Total Lines of Code: ~3,600
├── Application code: ~1,500
├── Configuration: ~100
└── Documentation: ~2,000
```

## Adding New Files

When adding new files:

1. **Models**: Add to `src/models/`
2. **Pages**: Add to `src/app/`
3. **API Routes**: Add to `src/app/api/`
4. **Utilities**: Add to `src/lib/`
5. **Types**: Add to `src/models/types.ts` or create new file
6. **Documentation**: Add to root directory
7. **Scripts**: Add to `scripts/`

## File Naming Conventions

- **Components/Pages**: PascalCase (e.g., `CustomerList.tsx`)
- **Utilities**: camelCase (e.g., `mongodb.ts`)
- **Types**: PascalCase (e.g., `Customer.ts`, `types.ts`)
- **Config files**: lowercase with dots (e.g., `next.config.js`)
- **Documentation**: UPPERCASE.md (e.g., `README.md`)

---

This structure ensures a clean, maintainable, and scalable codebase.
