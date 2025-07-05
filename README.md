# Smart Job Seeker

An intelligent job search and application management platform that helps you create a detailed profile, discover matching opportunities, and optimize your job application process with AI assistance.

**Vision:** Create your profile once, automatically match it against scraped job listings from various platforms, and intelligently manage your entire job search journey with AI-powered insights and context-aware assistance.

## Core Features

### Profile Management
- **Comprehensive User Profiles** - Create detailed profiles with work experience, education, skills, methodologies, and technical expertise
- **Personal Portfolio Website** - Modern, responsive portfolio showcasing professional background, skills, and experience
- **Profile Data Export** - Export profile data and schema in multiple formats for portability

### Job Search & Matching (Coming Soon 🚀)
- **Job Scraping** - Automatically scrape job listings from multiple platforms (feature in development)
- **Intelligent Matching** - Match your profile against scraped jobs using AI-powered analysis
- **Smart Discovery** - Discover relevant opportunities based on your skills and preferences

### Application Management & AI Assistance
- **Job Application Tracking** - Organize and track all job applications, interviews, and follow-ups
- **AI-Powered Assistance** - Context-aware AI helps improve application quality and strategy
- **Interview Preparation** - Store and manage interview questions with AI-generated answers
- **Application Analytics** - Insights and metrics to optimize your job search process

### Technical Features
- **AI Integration** - Powered by Groq for intelligent, context-aware features
- **Directus CMS Integration** - Headless CMS for managing portfolio content and data
- **Webhook System** - Secure webhook endpoints for Directus Flow integration
- **Resume Management** - JSON Resume support with PDF export capabilities

## Roadmap

### Current Status ✅
- User authentication and profile system
- Comprehensive job application tracking
- AI-powered interview preparation and application assistance
- Directus CMS integration for content management
- All infrastructure in place for job matching

### Upcoming (Next Big Feature) 🚀
- **Job Scraping Module** - Automated job listing scraper from multiple job platforms (LinkedIn, Indeed, etc.)
- **Profile Matching Engine** - Intelligent matching between user profiles and scraped job listings
- **Smart Job Recommendations** - AI-powered job suggestions based on profile fit
- **Automated Application Workflow** - Semi-automated job application process with AI assistance

The job scraping functionality will be the cornerstone feature that ties everything together, allowing users to passively discover matching opportunities while the system intelligently manages their application process.

## Tech Stack

### Frontend
- **SvelteKit 5** - Modern web framework with TypeScript
- **Svelte** - Reactive UI framework
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **FontAwesome** - Icon library

### Backend
- **Node.js** - JavaScript runtime
- **TypeScript** - Type safety for backend code
- **SvelteKit Server Routes** - API endpoints and server logic
- **Prisma** - Object-relational mapping (ORM)
- **JWT** - JSON Web Token authentication

### Database & CMS
- **PostgreSQL** - Relational database
- **Directus** - Headless CMS
- **Prisma Schema** - Database schema management

### External Services
- **Groq API** - High-performance LLM inference for AI-powered features
- **SMTP2GO** - Email delivery service

### DevOps & Tools
- **Docker & Docker Compose** - Containerization and orchestration
- **Vite** - Build tool and dev server
- **Vitest** - Unit and integration testing
- **Prisma Migrations** - Database versioning
- **Deno fmt** - Code formatting

## Project Structure

```
smart-job-seeker/
├── src/
│   ├── routes/                    # SvelteKit pages and API routes
│   │   ├── +page.svelte          # Home page
│   │   ├── portfolio/            # Portfolio section
│   │   ├── resume/               # Resume page
│   │   └── api/                  # API endpoints
│   │       └── webhook/          # Webhook handler
│   ├── lib/
│   │   ├── server/               # Server-side utilities
│   │   ├── components/           # Reusable Svelte components
│   │   ├── data/                 # Static data and config
│   │   └── images/               # Image assets
│   ├── app.html                  # Root HTML template
│   ├── app.css                   # Global styles
│   └── hooks.server.ts           # Server hooks
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Database migrations
├── scripts/                       # Utility scripts
│   ├── export-profile-schema.ts
│   ├── export-profile-data.ts
│   ├── export-profiles-pdf.ts
│   ├── build-json-resume.ts
│   └── ...
├── docker-compose.yml            # Docker services configuration
├── Dockerfile                     # SvelteKit app image
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── CLAUDE.md                      # Development notes
└── docs/
    ├── AUTHENTICATION.md         # Auth system documentation
    ├── WEBHOOK.md               # Webhook integration guide
    └── TESTING.md               # Testing guide
```

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd smart-job-seeker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your configuration:
   - `APP_URL` - Application URL
   - `JWT_SECRET` - Secret for JWT tokens
   - `DATABASE_URL` - PostgreSQL connection string
   - `SMTP2GO_API_KEY` - Email service API key
   - `GROQ_API_KEY` - Groq API key for AI features
   - Directus admin credentials and configuration

### Development

**Start all services with Docker Compose:**
```bash
npm run docker:dev
```

This starts:
- **SvelteKit app** on `http://localhost:5173`
- **Directus admin** on `http://localhost:8055`
- **PostgreSQL database** on port 5432

**Or run locally without Docker:**
```bash
npm run dev-web    # Start SvelteKit dev server
npm run dev-db     # Start Prisma database
npm run dev-directus # Start Directus (requires Docker)
```

**Useful development commands:**
```bash
npm run docker:dev:cli           # Access app container shell
npm run docker:db:cli            # Access PostgreSQL CLI
npm run docker:update-schema     # Sync Prisma schema from DB
npm run docker:db:migrate        # Run database migrations
npm run docker:export-profile-*  # Export profile data/schema
```

## API Endpoints

### Webhook
- `POST /api/webhook` - Secure webhook endpoint for Directus integration
  - Supports: `profile.export`, `item.create`, `item.update`, `item.delete`, `custom.event`

## Database Schema

The Prisma schema includes models for:
- **Users** - Authentication and profiles
- **Profiles** - User portfolios
- **Applications** - Job application tracking
- **Vacancies** - Job listings
- **Work Experience** - Career history
- **Education** - Educational background
- **Skills** - Technical and professional skills
- **Interviews** - Interview questions and answers
- **Collected Data** - Exported profile data
- **Directus** - CMS integration models

See `prisma/schema.prisma` for complete schema details.

## Webhook Integration

Secure webhook endpoint for Directus Flow integration at `POST /api/webhook`.

**Features:**
- HMAC-SHA256 signature verification
- Multiple event type support
- Batch profile export
- Profile schema and data collection

**Event Types:**
- `profile.export` - Export profile data and schema
- `item.create` - Item creation handler
- `item.update` - Item update handler
- `item.delete` - Item deletion handler
- `custom.event` - Custom event handler

For setup and usage, see [docs/WEBHOOK.md](docs/WEBHOOK.md).

## Testing

This project uses **Vitest** for unit and integration testing.

```bash
npm run test              # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:ui          # Open test UI dashboard
```

**Test Structure:**
- Webhook handler tests: `src/routes/api/webhook/__tests__/`
- Utility function tests: `src/lib/server/__tests__/`
- Mocked database calls for isolation

For complete testing guide, see [docs/TESTING.md](docs/TESTING.md).

## Code Quality

The project follows strict code quality standards:

```bash
npm run check           # Type checking and svelte-check
npm run lint           # ESLint and Prettier
npm run format         # Auto-format code with Prettier
npx deno fmt          # Format TypeScript/SvelteKit code
npx deno fmt --unstable-component  # Format Svelte files
```

**Requirements:**
- TypeScript strict mode enabled
- ESLint with Svelte support
- Prettier for consistent formatting
- Deno formatter for modern code standards

## Scripts

### Database Management
```bash
npm run docker:db:migrate              # Run migrations
npm run docker:db:migrate:new          # Create new migration
npm run docker:db:backup               # Backup database
npm run docker:db:restore              # Restore database
npm run docker:update-schema           # Sync Prisma schema
```

### Profile Export
```bash
npm run docker:export-profile-json     # Export profile as JSON
npm run docker:export-profile-schema   # Export profile schema
npm run docker:export-profile-data     # Export profile data
npm run docker:export-profiles-pdf     # Export profiles as PDF
```

### Build & Deployment
```bash
npm run build                          # Production build
npm run rebuild                        # Clean build
npm run docker:build-app               # Build in container
npm run preview                        # Preview production build
```

### Development
```bash
npm run dev                            # Start dev server
npm run dev-concur                     # Start all services concurrently
npm run check                          # TypeScript and Svelte checks
npm run lint                           # Lint code
npm run format                         # Format code
npm run test                           # Run tests
```

## Deployment

The application is configured for deployment on **Vercel** with adapter already configured.

**Build process:**
```bash
npm install
npm run build
```

**Environment variables** must be set in production:
- `JWT_SECRET` - Secure random token
- `DATABASE_URL` - Production PostgreSQL URL
- `GROQ_API_KEY` - Groq API credentials for AI features
- `SMTP2GO_API_KEY` - Email service credentials
- `WEBHOOK_SECRET` - Webhook authentication
- Directus configuration (ADMIN_SECRET, ADMIN_EMAIL, etc.)

## Docker Services

### Admin (Directus CMS)
```bash
docker compose up admin
# Access at http://localhost:8055
```

### App (SvelteKit)
```bash
docker compose up app
# Access at http://localhost:5173
```

### Database (PostgreSQL)
```bash
docker compose up database
# Port: 5432
# User: postgres
# Database: smartjobseeker
```

**Run all services:**
```bash
npm run docker:dev
```

**Stop services:**
```bash
docker compose down
```

**Access container shell:**
```bash
npm run docker:dev:cli
```

## Configuration

### Environment Variables

Key environment variables (see `.env.example` for complete list):

| Variable | Description | Example |
|----------|-------------|---------|
| `APP_URL` | Application URL | `http://localhost:5173` |
| `JWT_SECRET` | JWT signing secret | 64-character hex string |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://...` |
| `GROQ_API_KEY` | Groq API key for LLM features | `gsk_...` |
| `SMTP2GO_API_KEY` | Email service API key | `api_...` |
| `WEBHOOK_SECRET` | Webhook authentication secret | 64-character hex string |

### Prisma

Database schema and migrations are managed through Prisma.

```bash
npx prisma studio          # View database in UI
npx prisma migrate dev     # Create and apply migrations
npx prisma generate       # Generate Prisma Client
```

See `prisma/schema.prisma` for the complete schema.

## Performance

### Optimization Features
- **Image Optimization** - Enhanced images with `@sveltejs/enhanced-img`
- **Code Splitting** - Automatic code splitting via SvelteKit
- **Lazy Loading** - AOS (Animate on Scroll) for performance
- **CSS Optimization** - Tailwind CSS with PurgeCSS
- **Build Optimization** - Vite for fast builds

### Monitoring
- Vercel Analytics integration
- Error tracking capability
- Performance monitoring ready

## Security

### Features
- **HMAC-SHA256** - Webhook signature verification for secure Directus integration
- **Secure Headers** - Automatic in production
- **Environment Variable Protection** - Sensitive credentials stored securely

## Development Notes

From [CLAUDE.md](CLAUDE.md):

- **TypeScript** is enabled with strict type checking
- Use `npx tsx` for running TypeScript scripts
- Use ES Modules (`import`) instead of CommonJS (`require`)
- Use `rm -f` instead of `rm` when removing files
- Use modern Svelte 5 APIs: `import { page } from '$app/state'`
- Format code with `npx deno fmt` after changes
- For `.svelte` files: `npx deno fmt --unstable-component`

## Documentation

- **[CLAUDE.md](CLAUDE.md)** - Development setup and guidelines
- **[docs/WEBHOOK.md](docs/WEBHOOK.md)** - Webhook integration guide
- **[docs/TESTING.md](docs/TESTING.md)** - Testing framework setup

## Contributing

When contributing to this project:

1. Follow the code quality standards (lint, format, type check)
2. Write tests for new features
3. Update documentation if needed
4. Use descriptive commit messages
5. Ensure all tests pass before submitting

## Support

For issues or questions:
- Check existing documentation in `/docs`
- Review test files for usage examples
- Check the CLAUDE.md development notes
- Consult API endpoint examples in authentication docs

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## About

**Smart Job Seeker** is a personal project by Rik Wanders, a Senior Full Stack Developer with 12+ years of experience in Python, Node.js, and modern web technologies.

- **Website:** https://www.rikwanders.tech/
- **GitHub:** https://github.com/gitaarik
- **LinkedIn:** https://www.linkedin.com/in/rik-wanders-software

Built with TypeScript, SvelteKit, PostgreSQL, and Directus CMS.
