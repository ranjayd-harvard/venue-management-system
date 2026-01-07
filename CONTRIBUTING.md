# Contributing to Venue Management System

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/venue-management-system.git
   cd venue-management-system
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
5. Start MongoDB locally
6. Seed the database:
   ```bash
   npm run seed
   ```
7. Run the development server:
   ```bash
   npm run dev
   ```

## Project Structure Guidelines

### Adding New Models

When adding new data models:

1. Create the TypeScript interface in `src/models/types.ts`
2. Create a repository class in `src/models/YourModel.ts`
3. Follow the existing repository pattern:
   - `create()` - Insert new documents
   - `findById()` - Get by ID
   - `findAll()` - Get all documents
   - `update()` - Update document
   - `delete()` - Delete document

Example:
```typescript
export class YourModelRepository {
  private static COLLECTION = 'your_collection';

  static async create(data: Omit<YourType, '_id' | 'createdAt' | 'updatedAt'>) {
    // Implementation
  }
  
  // ... other methods
}
```

### Adding New Pages

1. Create page component in `src/app/your-page/page.tsx`
2. Use Server Components by default
3. Follow the existing layout pattern
4. Include proper TypeScript types
5. Use Tailwind CSS for styling
6. Add navigation links where appropriate

Example structure:
```typescript
export const dynamic = 'force-dynamic';

export default async function YourPage() {
  // Fetch data
  const data = await YourRepository.findAll();
  
  return (
    <main className="min-h-screen p-8">
      {/* Your content */}
    </main>
  );
}
```

### Adding API Routes

1. Create route handler in `src/app/api/your-route/route.ts`
2. Export named functions for HTTP methods (GET, POST, PUT, DELETE)
3. Use proper error handling
4. Return NextResponse objects

Example:
```typescript
import { NextResponse } from 'next/server';
import { YourRepository } from '@/models/YourModel';

export async function GET() {
  try {
    const data = await YourRepository.findAll();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
```

## Coding Standards

### TypeScript

- Use strict mode (enabled in tsconfig.json)
- Define interfaces for all data structures
- Avoid `any` type - use proper types or `unknown`
- Use optional chaining (`?.`) and nullish coalescing (`??`)

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add semicolons at end of statements
- Use arrow functions for callbacks
- Destructure props and objects when beneficial

### Naming Conventions

- **Files**: PascalCase for components, camelCase for utilities
- **Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Components**: PascalCase
- **Functions**: camelCase, descriptive names

### MongoDB

- Use ObjectId for IDs
- Always include `createdAt` and `updatedAt` timestamps
- Use indexes for frequently queried fields
- Validate data before insertion

## Git Workflow

### Branches

- `main` - Production-ready code
- `develop` - Integration branch
- `feature/feature-name` - New features
- `fix/bug-name` - Bug fixes
- `docs/description` - Documentation updates

### Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
```
feat(customers): add customer deletion functionality
fix(seed): correct venue capacity data
docs(readme): update setup instructions
```

### Pull Request Process

1. Create a feature branch from `develop`
2. Make your changes
3. Test thoroughly:
   ```bash
   npm run build
   npm run lint
   ```
4. Update documentation if needed
5. Commit with clear messages
6. Push to your fork
7. Create a Pull Request to `develop` branch
8. Describe your changes clearly
9. Link related issues

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe testing done

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests pass
```

## Testing

### Manual Testing

Before submitting PR:
1. Run seed script successfully
2. Test all affected pages
3. Check responsive design
4. Verify database operations
5. Check for console errors

### Future: Automated Testing

When adding tests (future enhancement):
- Place unit tests next to source files: `Component.test.tsx`
- Place integration tests in `__tests__` directory
- Use descriptive test names
- Aim for 80%+ coverage on new code

## Documentation

### Code Comments

- Add JSDoc comments for public functions
- Explain complex logic with inline comments
- Keep comments up-to-date with code changes

Example:
```typescript
/**
 * Finds all venues associated with a specific location
 * @param locationId - The location's ObjectId
 * @returns Array of venues
 */
static async findByLocationId(locationId: string | ObjectId): Promise<Venue[]> {
  // Implementation
}
```

### README Updates

Update README.md when:
- Adding new features
- Changing setup process
- Adding dependencies
- Changing project structure

## Feature Ideas

Good first contributions:

### Easy
- [ ] Add search functionality to customer list
- [ ] Add sorting to tables
- [ ] Improve error messages
- [ ] Add loading states
- [ ] Add data validation

### Medium
- [ ] Implement customer editing
- [ ] Add location CRUD operations
- [ ] Add venue CRUD operations
- [ ] Implement pagination
- [ ] Add export to CSV

### Advanced
- [ ] Add authentication (NextAuth.js)
- [ ] Add role-based access control
- [ ] Add data analytics dashboard
- [ ] Add email notifications
- [ ] Add advanced filtering

## Questions?

- Check existing documentation (README.md, SETUP.md, SCHEMA.md)
- Search existing issues
- Create a new issue with your question

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what's best for the project
- Show empathy towards others

### Unacceptable Behavior

- Harassment or discriminatory language
- Trolling or insulting comments
- Personal or political attacks
- Publishing others' private information

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing to Venue Management System! 🎉
