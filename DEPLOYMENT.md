# Deployment Guide

This guide covers deploying the Venue Management System to various platforms.

## Prerequisites

Before deploying:
- ✅ Code tested locally
- ✅ Build passes: `npm run build`
- ✅ MongoDB instance available (cloud or self-hosted)
- ✅ Environment variables configured

## MongoDB Atlas Setup (Recommended for Production)

1. **Create Account**: Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)

2. **Create Cluster**:
   - Click "Build a Database"
   - Choose FREE tier (M0) for testing
   - Select a region close to your deployment
   - Create cluster (takes ~3-5 minutes)

3. **Configure Network Access**:
   - Go to "Network Access"
   - Click "Add IP Address"
   - Choose "Allow Access from Anywhere" (0.0.0.0/0) or specify your deployment IPs

4. **Create Database User**:
   - Go to "Database Access"
   - Add new database user
   - Set username and password
   - Grant "Read and write to any database" role

5. **Get Connection String**:
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy connection string
   - Replace `<password>` with your password
   - Replace `<dbname>` with `venue-management`

Example connection string:
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/venue-management?retryWrites=true&w=majority
```

## Deployment Platforms

### 1. Vercel (Recommended)

**Pros**: Easy, free tier, automatic deployments, edge functions  
**Cons**: Serverless (connection pooling needs care)

#### Steps:

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository
   - Configure project:
     - Framework Preset: Next.js
     - Root Directory: `./`
     - Build Command: `npm run build`
     - Output Directory: `.next`

3. **Set Environment Variables**:
   - Add `MONGODB_URI` with your MongoDB Atlas connection string
   - Example: `mongodb+srv://user:pass@cluster.mongodb.net/venue-management`

4. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete
   - Visit your deployed site

5. **Seed Production Database**:
   ```bash
   # Run locally with production MongoDB URI
   MONGODB_URI="your-production-uri" npm run seed
   ```

#### Vercel Configuration (vercel.json)

Create `vercel.json` for custom settings:
```json
{
  "env": {
    "MONGODB_URI": "@mongodb_uri"
  },
  "build": {
    "env": {
      "MONGODB_URI": "@mongodb_uri"
    }
  }
}
```

### 2. Netlify

**Pros**: Easy deployment, good for static sites  
**Cons**: Less ideal for heavy server-side rendering

#### Steps:

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Build for Netlify**:
   ```bash
   npm run build
   ```

3. **Deploy**:
   ```bash
   netlify deploy --prod
   ```

4. **Set Environment Variables**:
   - Go to Site Settings → Build & deploy → Environment
   - Add `MONGODB_URI`

### 3. Railway

**Pros**: Good for full-stack apps, built-in MongoDB  
**Cons**: Paid service after free tier

#### Steps:

1. **Sign up** at [railway.app](https://railway.app)

2. **Create New Project**:
   - Click "New Project"
   - Choose "Deploy from GitHub repo"
   - Select your repository

3. **Add MongoDB**:
   - Click "New" → "Database" → "Add MongoDB"
   - Railway provides a MongoDB instance
   - Connection string auto-populated

4. **Configure Service**:
   - Environment variables set automatically
   - Or add manually: `MONGODB_URI`

5. **Deploy**:
   - Automatic deployment on git push

### 4. AWS (Advanced)

**Pros**: Scalable, full control  
**Cons**: Complex setup, more expensive

#### High-level Steps:

1. **Set up EC2 instance** or use **Elastic Beanstalk**
2. **Install Node.js** on instance
3. **Set up MongoDB** (use Atlas or DocumentDB)
4. **Configure security groups** for port access
5. **Deploy code**:
   ```bash
   git clone your-repo
   cd venue-management-system
   npm install
   npm run build
   npm start
   ```
6. **Use PM2** for process management:
   ```bash
   npm install -g pm2
   pm2 start npm --name "venue-app" -- start
   ```

### 5. Docker Deployment

**Pros**: Consistent environment, easy to scale  
**Cons**: Requires Docker knowledge

#### Dockerfile:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
```

#### docker-compose.yml:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/venue-management
    depends_on:
      - mongo

  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
```

#### Deploy:

```bash
docker-compose up -d
```

## Environment Variables

Required in production:

```bash
# MongoDB connection string (REQUIRED)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/venue-management

# Optional: Node environment
NODE_ENV=production
```

## Post-Deployment Checklist

After deploying:

- [ ] Site loads correctly
- [ ] Database connection works
- [ ] All pages render properly
- [ ] Navigation works
- [ ] MongoDB Atlas has proper security (IP whitelist, user permissions)
- [ ] Environment variables are set
- [ ] SSL/HTTPS enabled
- [ ] Custom domain configured (if applicable)
- [ ] Error monitoring set up (Sentry, LogRocket, etc.)

## Seeding Production Database

**⚠️ Important**: Only seed once!

```bash
# Method 1: Run locally against production DB
MONGODB_URI="your-production-uri" npm run seed

# Method 2: SSH into server
ssh your-server
cd venue-management-system
npm run seed

# Method 3: Create temporary script deployment
# Add to package.json:
"scripts": {
  "seed:prod": "node scripts/seed.js"
}
# Then run once after deployment
```

## Monitoring & Maintenance

### Health Checks

Create a health check endpoint:

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    await db.admin().ping();
    return NextResponse.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', database: 'disconnected' },
      { status: 503 }
    );
  }
}
```

### Logging

Add logging service:
- **Vercel**: Built-in logging
- **Railway**: View logs in dashboard  
- **Custom**: Use Winston or Pino

### Error Tracking

Recommended services:
- Sentry
- LogRocket
- Bugsnag

### Performance Monitoring

- Vercel Analytics (built-in)
- Google Analytics
- New Relic

## Scaling Considerations

When traffic grows:

1. **Database Indexing**:
   ```javascript
   db.locations.createIndex({ customerId: 1 });
   db.location_venues.createIndex({ locationId: 1 });
   db.location_venues.createIndex({ venueId: 1 });
   ```

2. **Caching**:
   - Use Redis for frequently accessed data
   - Implement query result caching

3. **CDN**:
   - Vercel has built-in CDN
   - Use Cloudflare for additional caching

4. **Database Scaling**:
   - MongoDB Atlas auto-scaling
   - Read replicas for heavy read workloads

## Backup Strategy

### MongoDB Atlas (Automated)
- Atlas provides automatic backups (M10+ tiers)
- Point-in-time recovery available

### Manual Backups

```bash
# Export entire database
mongodump --uri="your-mongodb-uri" --out=./backup

# Import backup
mongorestore --uri="your-mongodb-uri" ./backup

# Export specific collection
mongoexport --uri="your-mongodb-uri" --collection=customers --out=customers.json

# Import collection
mongoimport --uri="your-mongodb-uri" --collection=customers --file=customers.json
```

## Rollback Procedure

If deployment fails:

1. **Vercel**: Click "Redeploy" on previous successful deployment
2. **Railway**: Revert to previous deployment in dashboard
3. **Manual**: Git revert and redeploy
   ```bash
   git revert HEAD
   git push
   ```

## Security Best Practices

- ✅ Use environment variables for secrets
- ✅ Enable MongoDB authentication
- ✅ Use IP whitelisting in MongoDB Atlas
- ✅ Enable HTTPS/SSL
- ✅ Set proper CORS headers
- ✅ Sanitize user inputs
- ✅ Keep dependencies updated
- ✅ Use security headers

## Cost Estimates

### Free Tier Options:
- **Vercel**: Free (generous limits)
- **MongoDB Atlas**: Free M0 cluster (512MB)
- **Total**: $0/month for small projects

### Production Scaling:
- **Vercel Pro**: $20/month
- **MongoDB Atlas M10**: ~$57/month
- **Total**: ~$77/month for production app

## Support & Resources

- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com/)
- [Railway Docs](https://docs.railway.app/)

---

**Ready to deploy?** Follow the platform-specific steps above and you'll be live in minutes!
