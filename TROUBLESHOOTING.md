# Troubleshooting Guide

Common issues and their solutions for the Venue Management System.

## MongoDB Connection Issues

### Error: "MongoServerError: connect ECONNREFUSED 127.0.0.1:27017"

**Cause**: MongoDB is not running or not accessible.

**Solutions**:

1. **Check if MongoDB is running**:
   ```bash
   # macOS (Homebrew)
   brew services list
   
   # Linux
   sudo systemctl status mongod
   
   # Windows
   # Check Services app for MongoDB service
   ```

2. **Start MongoDB**:
   ```bash
   # macOS (Homebrew)
   brew services start mongodb-community
   
   # Linux
   sudo systemctl start mongod
   
   # Windows
   net start MongoDB
   ```

3. **Verify MongoDB is listening**:
   ```bash
   netstat -an | grep 27017
   ```

4. **Check connection string** in `.env.local`:
   ```
   MONGODB_URI=mongodb://localhost:27017/venue-management
   ```

### Error: "MongoParseError: Invalid connection string"

**Cause**: Malformed MongoDB URI.

**Solution**: Ensure `.env.local` has correct format:
```
# Correct
MONGODB_URI=mongodb://localhost:27017/venue-management

# Wrong - missing protocol
MONGODB_URI=localhost:27017/venue-management

# Wrong - extra spaces
MONGODB_URI = mongodb://localhost:27017/venue-management
```

### Error: "MongoServerError: Authentication failed"

**Cause**: MongoDB requires authentication but credentials not provided.

**Solution**: Add credentials to connection string:
```
MONGODB_URI=mongodb://username:password@localhost:27017/venue-management
```

## Seed Script Issues

### Error: "Cannot find module 'dotenv'"

**Cause**: Dependencies not installed.

**Solution**:
```bash
npm install
```

### Seed script creates duplicate data

**Cause**: Running seed script multiple times.

**Solution**: 
1. **Reset database**:
   ```bash
   # Connect to MongoDB
   mongosh
   
   # Switch to database
   use venue-management
   
   # Drop collections
   db.customers.drop()
   db.locations.drop()
   db.venues.drop()
   db.location_venues.drop()
   
   # Exit
   exit
   ```

2. **Re-run seed**:
   ```bash
   npm run seed
   ```

### Error: "SyntaxError: Cannot use import statement outside a module"

**Cause**: Node version or TypeScript configuration issue.

**Solution**:
1. Check Node version (needs 18+):
   ```bash
   node --version
   ```

2. Update if needed:
   ```bash
   # Using nvm
   nvm install 18
   nvm use 18
   ```

## Next.js Development Issues

### Error: "Port 3000 is already in use"

**Cause**: Another process is using port 3000.

**Solutions**:

1. **Use different port**:
   ```bash
   npm run dev -- -p 3001
   ```

2. **Kill process on port 3000**:
   ```bash
   # macOS/Linux
   lsof -ti:3000 | xargs kill -9
   
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

### Error: "Module not found: Can't resolve '@/...'

**Cause**: Path alias not configured or imports incorrect.

**Solution**: Verify `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Pages not updating after changes

**Cause**: Next.js cache issues.

**Solution**:
1. **Clear Next.js cache**:
   ```bash
   rm -rf .next
   npm run dev
   ```

2. **Hard refresh browser**: Ctrl+Shift+R (Cmd+Shift+R on Mac)

## TypeScript Issues

### Error: "Type 'ObjectId' is not assignable to type 'string'"

**Cause**: Mixing ObjectId and string types.

**Solution**: Use `.toString()`:
```typescript
// Wrong
const id: string = customer._id;

// Correct
const id: string = customer._id!.toString();
```

### Error: "Object is possibly 'null'"

**Cause**: TypeScript strict null checks.

**Solution**: Add null check or non-null assertion:
```typescript
// Option 1: Null check
if (customer) {
  console.log(customer.name);
}

// Option 2: Non-null assertion (use carefully)
console.log(customer!.name);

// Option 3: Optional chaining
console.log(customer?.name);
```

## Build Issues

### Error: "Type error: ... is not assignable"

**Cause**: Type mismatch in code.

**Solution**: 
1. Run TypeScript compiler to see full errors:
   ```bash
   npx tsc --noEmit
   ```

2. Fix type errors one by one.

### Build succeeds but page shows 500 error

**Cause**: Runtime error in Server Component.

**Solution**: Check server logs in terminal for stack trace.

## Tailwind CSS Issues

### Styles not applying

**Cause**: Tailwind not processing files.

**Solutions**:

1. **Verify `tailwind.config.js` content paths**:
   ```javascript
   content: [
     './src/app/**/*.{js,ts,jsx,tsx,mdx}',
     './src/components/**/*.{js,ts,jsx,tsx,mdx}',
   ]
   ```

2. **Rebuild**:
   ```bash
   rm -rf .next
   npm run dev
   ```

3. **Check `globals.css` has directives**:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```

## Data Display Issues

### Customer shows 0 locations but locations exist

**Cause**: Incorrect ObjectId comparison.

**Solution**: Ensure using ObjectId for queries:
```typescript
// Wrong
const locations = await LocationRepository.findByCustomerId(customer._id.toString());

// Correct
const locations = await LocationRepository.findByCustomerId(customer._id);
```

### Venues not showing for location

**Cause**: Missing relationships in `location_venues` table.

**Solution**: 
1. **Check relationships exist**:
   ```bash
   mongosh
   use venue-management
   db.location_venues.find().pretty()
   ```

2. **Re-run seed if needed**:
   ```bash
   npm run seed
   ```

## Performance Issues

### Pages loading slowly

**Possible causes**:
1. Too many database queries
2. Missing indexes
3. Large data sets

**Solutions**:

1. **Add database indexes**:
   ```javascript
   // In seed script or migration
   await db.collection('locations').createIndex({ customerId: 1 });
   await db.collection('location_venues').createIndex({ locationId: 1 });
   await db.collection('location_venues').createIndex({ venueId: 1 });
   ```

2. **Implement pagination** for large lists.

3. **Use caching** for frequently accessed data.

## Environment Issues

### Error: "Please add your MongoDB URI to .env.local"

**Cause**: `.env.local` file missing or not loaded.

**Solutions**:

1. **Create `.env.local`**:
   ```bash
   cp .env.example .env.local
   ```

2. **Verify file contents**:
   ```
   MONGODB_URI=mongodb://localhost:27017/venue-management
   ```

3. **Restart dev server** (required after .env changes):
   ```bash
   # Stop with Ctrl+C, then:
   npm run dev
   ```

### Environment variables not loading in production

**Cause**: Different env file in production.

**Solution**: Set environment variables in hosting platform:
- Vercel: Project Settings → Environment Variables
- Heroku: Config Vars
- Docker: docker-compose.yml or .env file

## Git Issues

### Large files not committing

**Cause**: node_modules or .next directory included.

**Solution**: Ensure `.gitignore` is proper:
```
/node_modules
/.next
.env.local
```

Then remove from git:
```bash
git rm -r --cached node_modules
git rm -r --cached .next
git commit -m "Remove ignored files"
```

## Common Pitfalls

### 1. Forgetting to start MongoDB
Always start MongoDB before running the app.

### 2. Not running seed script
Database needs sample data. Run `npm run seed`.

### 3. Modifying .env.example instead of .env.local
Use `.env.local` for local configuration.

### 4. Not restarting dev server after .env changes
Environment variables are loaded at startup.

### 5. Using client components when server components work
Default to Server Components unless you need interactivity.

## Getting Help

If your issue isn't covered here:

1. **Check server logs** in terminal for error details
2. **Check browser console** for client-side errors
3. **Search existing GitHub issues**
4. **Create new issue** with:
   - Clear description
   - Steps to reproduce
   - Error messages
   - Environment details (OS, Node version, MongoDB version)

## Debug Mode

Enable verbose logging:

```typescript
// In mongodb.ts, add:
const client = new MongoClient(uri, {
  ...options,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
```

Check MongoDB logs:
```bash
# macOS (Homebrew)
tail -f /usr/local/var/log/mongodb/mongo.log

# Linux
tail -f /var/log/mongodb/mongod.log
```

## Still Stuck?

1. Read the [README.md](README.md) thoroughly
2. Check [SETUP.md](SETUP.md) for setup details
3. Review [SCHEMA.md](SCHEMA.md) for data model
4. Open an issue on GitHub with details

---

**Remember**: Most issues are environment-related. Double-check MongoDB is running and environment variables are set correctly.
