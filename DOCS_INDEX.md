# Documentation Index

Welcome to the Venue Management System documentation! This index will help you find the information you need.

## 🚀 Quick Start

**New to the project?** Start here:

1. **[SETUP.md](SETUP.md)** - Get up and running in 5 minutes
2. **[README.md](README.md)** - Complete project overview
3. **Run the seed script** to populate your database

## 📚 Documentation Overview

### Getting Started
| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[SETUP.md](SETUP.md)** | Quick setup guide | First time setup |
| **[README.md](README.md)** | Main documentation | Understanding the project |
| **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** | High-level overview | Project overview |

### Technical Documentation
| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[SCHEMA.md](SCHEMA.md)** | Database schema details | Understanding data model |
| **[FILE_STRUCTURE.md](FILE_STRUCTURE.md)** | Complete file listing | Finding specific files |
| **[TIMELINE_SIMULATOR.md](TIMELINE_SIMULATOR.md)** | Timeline simulator & pricing visualization | Using the pricing simulator |
| **[PRICING_TIMELINE_FIXES.md](PRICING_TIMELINE_FIXES.md)** | Critical timeline chart rendering fixes | Debugging chart issues |
| **[SURGE_PRICING.md](SURGE_PRICING.md)** | Surge pricing system architecture | Implementing dynamic pricing |

### Guides
| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Production deployment | Going to production |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | Contribution guidelines | Contributing to project |
| **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** | Common issues & fixes | When you encounter errors |

### Legal
| Document | Purpose |
|----------|---------|
| **[LICENSE](LICENSE)** | MIT License terms |

## 🎯 Documentation by Role

### For Developers
1. Start with **[SETUP.md](SETUP.md)** to get running
2. Read **[SCHEMA.md](SCHEMA.md)** to understand the data model
3. Check **[FILE_STRUCTURE.md](FILE_STRUCTURE.md)** to navigate the codebase
4. Reference **[CONTRIBUTING.md](CONTRIBUTING.md)** when making changes
5. Use **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** when stuck

### For DevOps/Platform Engineers
1. Review **[README.md](README.md)** for project overview
2. Follow **[DEPLOYMENT.md](DEPLOYMENT.md)** for production setup
3. Monitor using health checks described in **[DEPLOYMENT.md](DEPLOYMENT.md)**
4. Reference **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** for common issues

### For Project Managers
1. Read **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** for high-level overview
2. Review **[README.md](README.md)** for feature details
3. Check **[DEPLOYMENT.md](DEPLOYMENT.md)** for deployment options

### For New Contributors
1. Read **[README.md](README.md)** to understand the project
2. Follow **[SETUP.md](SETUP.md)** to set up your environment
3. Study **[CONTRIBUTING.md](CONTRIBUTING.md)** for guidelines
4. Check **[FILE_STRUCTURE.md](FILE_STRUCTURE.md)** to find your way around

## 📖 Document Summaries

### SETUP.md
**Quick setup guide** with step-by-step instructions:
- Prerequisites checklist
- Installation steps
- Database seeding
- Starting the server
- Troubleshooting tips

**Read time**: 5 minutes  
**Level**: Beginner

### README.md
**Complete project documentation** covering:
- Project overview
- Features list
- Database schema
- API endpoints
- Development guide
- Deployment basics

**Read time**: 15 minutes  
**Level**: Beginner to Intermediate

### PROJECT_SUMMARY.md
**Executive summary** including:
- Key features
- Tech stack
- File structure overview
- Quick start commands
- Status and roadmap

**Read time**: 5 minutes  
**Level**: All

### SCHEMA.md
**Database architecture** with:
- Entity relationships
- Collection structures
- Visual diagrams
- Query patterns
- Many-to-many explanation

**Read time**: 10 minutes  
**Level**: Intermediate

### FILE_STRUCTURE.md
**Complete file listing** showing:
- Directory structure
- File descriptions
- Import patterns
- Naming conventions
- File relationships

**Read time**: 10 minutes  
**Level**: Intermediate

### DEPLOYMENT.md
**Production deployment guide** for:
- MongoDB Atlas setup
- Platform-specific instructions (Vercel, Railway, AWS)
- Docker deployment
- Environment configuration
- Monitoring and scaling

**Read time**: 20 minutes  
**Level**: Intermediate to Advanced

### CONTRIBUTING.md
**Contributor guidelines** with:
- Development setup
- Code standards
- Git workflow
- PR process
- Feature ideas

**Read time**: 15 minutes  
**Level**: Intermediate

### TROUBLESHOOTING.md
**Problem-solving guide** covering:
- MongoDB connection issues
- Next.js errors
- Build problems
- TypeScript issues
- Common pitfalls

**Read time**: As needed
**Level**: All

### TIMELINE_SIMULATOR.md
**Interactive pricing simulator documentation** including:
- Real-time pricing visualization
- Surge pricing integration
- Simulation mode & layer toggles
- Scenario planning & management
- Price display logic
- API integration details

**Read time**: 20 minutes
**Level**: Intermediate

### SURGE_PRICING.md
**Dynamic surge pricing system** covering:
- Architecture & design philosophy
- Mathematical surge calculation formula
- Database schema (surge_configs)
- API integration
- Time window logic
- Admin interface
- Testing & monitoring

**Read time**: 25 minutes
**Level**: Intermediate to Advanced

### SURGE_TESTING_GUIDE.md
**Complete surge pricing testing workflow** including:
- Phase-by-phase testing instructions
- Virtual vs materialized surge configs
- Live Mode vs Simulation Mode testing
- Approval workflow validation
- Visual verification checklist
- Common issues & solutions
- Test results template

**Read time**: 30 minutes
**Level**: Intermediate

### SURGE_FINAL_FIX.md
**Materialized surge ratesheets implementation** covering:
- Root cause analysis of display issues
- Backend API loading logic
- SURGE_MULTIPLIER type usage
- Pricing engine integration
- Complete code changes reference

**Read time**: 20 minutes
**Level**: Advanced

### SURGE_LIVE_MODE_FIX.md
**Live Mode display fixes** including:
- Layer type assignment logic
- Mode-based display behavior
- RATESHEET vs SURGE type usage
- Timeline simulator integration

**Read time**: 15 minutes
**Level**: Intermediate

### SURGE_VIRTUAL_LABEL.md
**Visual labeling system** covering:
- "(Virtual)" label feature
- Virtual vs materialized distinction
- Mode switching clarity
- Testing checklist

**Read time**: 10 minutes
**Level**: Beginner to Intermediate

### SURGE_SYSTEM_STATUS.md
**Current system status & quick reference** including:
- Completed features checklist
- Database state and cleanup info
- Key technical decisions
- Console log reference
- Success metrics
- API endpoints & database queries
- Quick reference tables

**Read time**: 15 minutes
**Level**: All

### PRICING_TIMELINE_FIXES.md
**Critical chart rendering fixes** covering:
- Timeline positioning bug resolution
- Flat price line visibility fixes
- SVG gradient coordinate system issues
- Three-layer rendering with fallback
- Y-axis calculation edge cases
- Testing checklist and debugging tips
- Code patterns to avoid

**Read time**: 20 minutes
**Level**: Intermediate to Advanced

## 🔍 Quick Reference

### Common Tasks

| I want to... | See... |
|-------------|--------|
| Set up the project | [SETUP.md](SETUP.md) |
| Understand the database | [SCHEMA.md](SCHEMA.md) |
| Deploy to production | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Fix an error | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Contribute code | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Find a specific file | [FILE_STRUCTURE.md](FILE_STRUCTURE.md) |
| Learn about features | [README.md](README.md) |
| Get project overview | [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) |
| Use pricing simulator | [TIMELINE_SIMULATOR.md](TIMELINE_SIMULATOR.md) |
| Fix timeline chart issues | [PRICING_TIMELINE_FIXES.md](PRICING_TIMELINE_FIXES.md) |
| Implement surge pricing | [SURGE_PRICING.md](SURGE_PRICING.md) |
| Test surge pricing | [SURGE_TESTING_GUIDE.md](SURGE_TESTING_GUIDE.md) |
| Fix surge display issues | [SURGE_FINAL_FIX.md](SURGE_FINAL_FIX.md) |
| Understand surge labels | [SURGE_VIRTUAL_LABEL.md](SURGE_VIRTUAL_LABEL.md) |
| Check surge system status | [SURGE_SYSTEM_STATUS.md](SURGE_SYSTEM_STATUS.md) |

### Key Sections

#### Database
- Schema overview: [SCHEMA.md](SCHEMA.md)
- Relationships: [SCHEMA.md](SCHEMA.md) → "Relationship Types"
- Collections: [README.md](README.md) → "Database Schema"

#### API
- Endpoints: [README.md](README.md) → "API Endpoints"
- Adding routes: [CONTRIBUTING.md](CONTRIBUTING.md) → "Adding API Routes"

#### Deployment
- Platforms: [DEPLOYMENT.md](DEPLOYMENT.md) → "Deployment Platforms"
- Environment: [DEPLOYMENT.md](DEPLOYMENT.md) → "Environment Variables"
- Scaling: [DEPLOYMENT.md](DEPLOYMENT.md) → "Scaling Considerations"

#### Development
- File structure: [FILE_STRUCTURE.md](FILE_STRUCTURE.md)
- Code standards: [CONTRIBUTING.md](CONTRIBUTING.md) → "Coding Standards"
- Git workflow: [CONTRIBUTING.md](CONTRIBUTING.md) → "Git Workflow"

## 📝 Documentation Standards

All documentation in this project follows these principles:

- ✅ **Clear**: Easy to understand language
- ✅ **Concise**: No unnecessary information
- ✅ **Complete**: All necessary details included
- ✅ **Current**: Up-to-date with latest code
- ✅ **Coded**: Code examples where helpful

## 🆘 Need Help?

1. Check the relevant documentation above
2. Search [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
3. Review [CONTRIBUTING.md](CONTRIBUTING.md) for questions about contributing
4. Open an issue on GitHub if problem persists

## 📋 Checklist for New Users

- [ ] Read [SETUP.md](SETUP.md)
- [ ] Install dependencies
- [ ] Start MongoDB
- [ ] Configure `.env.local`
- [ ] Run seed script
- [ ] Start dev server
- [ ] Browse to http://localhost:3000
- [ ] Read [README.md](README.md) for deeper understanding
- [ ] Review [SCHEMA.md](SCHEMA.md) for data model
- [ ] Check [CONTRIBUTING.md](CONTRIBUTING.md) if planning to contribute

## 🎓 Learning Path

### Beginner
1. [SETUP.md](SETUP.md) - Get started
2. [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Overview
3. [README.md](README.md) - Full details
4. Play with the application

### Intermediate
1. [SCHEMA.md](SCHEMA.md) - Understand data
2. [FILE_STRUCTURE.md](FILE_STRUCTURE.md) - Navigate code
3. [CONTRIBUTING.md](CONTRIBUTING.md) - Make changes
4. Build new features

### Advanced
1. [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
2. [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Debug issues
3. Optimize and scale
4. Contribute back

## 📞 Support Channels

- **Documentation**: You're reading it!
- **Code Comments**: Inline documentation in source files
- **GitHub Issues**: For bugs and feature requests
- **Pull Requests**: For contributions

## 🔄 Keeping Documentation Updated

This documentation is maintained alongside the code. When making changes:

1. Update relevant .md files
2. Keep examples current
3. Note breaking changes
4. Update this index if adding new docs

---

**Happy coding!** 🚀

Start with [SETUP.md](SETUP.md) to begin your journey.
