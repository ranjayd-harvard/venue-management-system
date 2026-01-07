# Venue Management System

A full-stack Next.js application for managing customers, locations, and venues with MongoDB persistence. This project demonstrates a many-to-many relationship between locations and venues.

## Features

- **Customer Management**: Track customer information including contact details and addresses
- **Location Management**: Each customer can have multiple locations
- **Venue Management**: Reusable venues that can be associated with multiple locations
- **Many-to-Many Relationships**: Locations can have multiple venues, and venues can be used across multiple locations
- **Seed Script**: Populate the database with sample data

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: MongoDB
- **Architecture**: Server Components with API Routes

## Project Structure

```
venue-management-system/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── customers/
│   │   │       └── route.ts          # Customer API endpoints
│   │   ├── customers/
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx          # Customer detail page
│   │   │   └── page.tsx              # Customers list page
│   │   ├── locations/
│   │   │   └── page.tsx              # Locations list page
│   │   ├── venues/
│   │   │   └── page.tsx              # Venues list page
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                  # Home page
│   ├── lib/
│   │   └── mongodb.ts                # MongoDB connection utility
│   └── models/
│       ├── Customer.ts               # Customer repository
│       ├── Location.ts               # Location repository
│       ├── Venue.ts                  # Venue repository
│       ├── LocationVenue.ts          # Junction table repository
│       └── types.ts                  # TypeScript types
├── scripts/
│   └── seed.ts                       # Database seeding script
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── README.md
```

## Database Schema

### Collections

1. **customers**
   - `_id`: ObjectId
   - `name`: string
   - `email`: string
   - `phone`: string (optional)
   - `address`: string (optional)
   - `createdAt`: Date
   - `updatedAt`: Date

2. **locations**
   - `_id`: ObjectId
   - `customerId`: ObjectId (references customers)
   - `name`: string
   - `address`: string
   - `city`: string
   - `state`: string
   - `zipCode`: string
   - `country`: string
   - `createdAt`: Date
   - `updatedAt`: Date

3. **venues**
   - `_id`: ObjectId
   - `name`: string
   - `description`: string (optional)
   - `capacity`: number (optional)
   - `venueType`: string
   - `createdAt`: Date
   - `updatedAt`: Date

4. **location_venues** (junction table)
   - `_id`: ObjectId
   - `locationId`: ObjectId (references locations)
   - `venueId`: ObjectId (references venues)
   - `createdAt`: Date

### Relationships

- **Customer → Location**: One-to-Many (a customer can have multiple locations)
- **Location ↔ Venue**: Many-to-Many (a location can have multiple venues, and a venue can be used in multiple locations)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- MongoDB installed and running locally on `mongodb://localhost:27017`
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd venue-management-system
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env.local
```

4. Update `.env.local` with your MongoDB connection string:
```
MONGODB_URI=mongodb://localhost:27017/venue-management
```

### Running the Application

1. **Seed the database** (first time only):
```bash
npm run seed
```

This will create:
- 3 customers
- 6 locations (2 per customer)
- 6 venues
- 17 location-venue relationships demonstrating the many-to-many relationship

2. **Start the development server**:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run seed` - Seed the database with sample data

## Usage

### Home Page
The home page provides an overview and links to view customers, locations, and venues.

### Customers Page
- View all customers
- See the number of locations each customer has
- Click on a customer to view their details

### Customer Detail Page
- View customer information
- See all locations belonging to the customer
- View all venues associated with each location

### Locations Page
- View all locations across all customers
- See which customer owns each location
- View the number of venues at each location

### Venues Page
- View all available venues
- See venue details including type and capacity
- View how many locations each venue is used in

## API Endpoints

### Customers
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create a new customer

Additional endpoints can be easily added following the same pattern.

## Many-to-Many Relationship Example

The seed script creates venues that are shared across multiple locations:

- **Grand Ballroom** is used in 3 different locations
- **Conference Hall A** is used in 3 different locations
- **Rooftop Garden** is used in 3 different locations

This demonstrates the flexibility of the many-to-many relationship where:
- A single venue can serve multiple locations
- A location can have multiple venue options
- The relationship is managed through the `location_venues` junction table

## Development

### Adding New Features

1. **New Models**: Add to `src/models/`
2. **New API Routes**: Add to `src/app/api/`
3. **New Pages**: Add to `src/app/`

### TypeScript Types

All types are defined in `src/models/types.ts` for consistency across the application.

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Set environment variables in your production environment

3. Start the production server:
```bash
npm run start
```

## MongoDB Connection

The application uses connection pooling for efficient database access. In development mode, the connection is cached globally to prevent connection exhaustion during hot reloading.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT

## Support

For issues or questions, please open an issue in the repository.
