# Quick Setup Guide

## Prerequisites
- Node.js 18 or higher
- MongoDB running locally (default port 27017)

### 1. Install Dependencies
```bash
cd venue-management-system
npm install
```

### 2. Configure Environment
The `.env.local` file is already configured for local MongoDB:
```
MONGODB_URI=mongodb://localhost:27017/venue-management
```

If you need to change the MongoDB URI, edit `.env.local`

### 3. Seed the Database
```bash
npm run seed
```

Expected output:
```
🌱 Starting database seeding...

Creating customers...
✓ Created customer: Acme Corporation
✓ Created customer: TechStart Inc
✓ Created customer: Global Events Ltd

Creating locations...
✓ Created location: Acme NYC Headquarters
✓ Created location: Acme Brooklyn Office
... (6 locations total)

Creating venues...
✓ Created venue: Grand Ballroom
✓ Created venue: Conference Hall A
... (6 venues total)

Creating location-venue relationships...
✓ Linked locations with venues

✅ Database seeding completed successfully!

Summary:
- Created 3 customers
- Created 6 locations
- Created 6 venues
- Created 17 location-venue relationships
```

### 4. Start Development Server
```bash
npm run dev
```

Visit: http://localhost:3000

## Project Features

### Pages
- **Home** (`/`) - Overview and navigation
- **Customers** (`/customers`) - List all customers
- **Customer Detail** (`/customers/[id]`) - View customer with locations and venues
- **Locations** (`/locations`) - List all locations
- **Venues** (`/venues`) - List all venues

### Key Relationships Demonstrated

1. **Customer → Location** (One-to-Many)
   - Acme Corporation has 2 locations
   - TechStart Inc has 2 locations
   - Global Events Ltd has 2 locations

2. **Location ↔ Venue** (Many-to-Many)
   - Each location can have multiple venues
   - Each venue can be used in multiple locations
   - Example: "Grand Ballroom" is available at 3 different locations

### Database Collections
- `customers` - Customer information
- `locations` - Location information with customerId reference
- `venues` - Venue information
- `location_venues` - Junction table for many-to-many relationship

## Troubleshooting

### MongoDB Connection Issues
If you get connection errors:
1. Ensure MongoDB is running: `mongod` or check your system services
2. Verify the connection string in `.env.local`
3. Check if port 27017 is available

### Seed Script Fails
If seeding fails:
1. Make sure MongoDB is running
2. The database will be created automatically
3. You can run the seed script multiple times (it will create duplicates)

### Port Already in Use
If port 3000 is busy:
```bash
npm run dev -- -p 3001
```

## Git Repository Ready

This project is ready to be pushed to GitHub:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Venue Management System"

# Add remote
git remote add origin <your-github-repo-url>

# Push
git push -u origin main
```

## Next Steps

1. Add authentication
2. Add CRUD operations for all entities
3. Add form validation
4. Add pagination for large datasets
5. Add search and filtering
6. Add data visualization
7. Deploy to Vercel or similar platform

## Support

For issues or questions, refer to the main README.md file.
