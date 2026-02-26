# Agent Contracts for Dompetin PWA Integration

## Overview
This file defines shared contracts between agents to ensure seamless integration of PWA functionality into the Dompetin T3 Stack application.

**Last Updated**: 2026-02-22

---

## 1. Type Definitions

### Session Shape
```typescript
// From Auth & Security Agent
interface Session {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
  };
  expiresAt: Date;
}
```

### PWA Install State
```typescript
// From PWA Agent
interface PWAInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  platform: 'desktop' | 'android' | 'ios' | 'unknown';
  dismissed: boolean;
}
```

---

## 2. API Route Naming Conventions

### tRPC Procedure Naming
- Queries: `router.resource.action` (e.g., `post.getLatest`)
- Mutations: `router.resource.action` (e.g., `post.create`)
- Protected: Use `protectedProcedure` wrapper
- Public: Use `publicProcedure` wrapper

### Cacheable Routes
- Cacheable: `GET /api/trpc/*` (with StaleWhileRevalidate, 5 min TTL)
- Non-Cacheable: `POST /api/trpc/*`, `/api/auth/*`

### Documented tRPC Procedures

#### postRouter (`src/server/api/routers/post.ts`)

**Cacheable Queries (Read-Only)**:
- `post.hello` - Public query
  - Input: `{ text: string }`
  - Returns: `{ greeting: string }`
  - Cache Strategy: StaleWhileRevalidate (5 min TTL)

- `post.getLatest` - Protected query
  - Input: None
  - Returns: Post object or null
  - Cache Strategy: StaleWhileRevalidate (5 min TTL)
  - Requires: Authenticated session

- `post.getSecretMessage` - Protected query
  - Input: None
  - Returns: `{ secret: string }`
  - Cache Strategy: StaleWhileRevalidate (5 min TTL)
  - Requires: Authenticated session

**Non-Cacheable Mutations**:
- `post.create` - Protected mutation
  - Input: `{ name: string }`
  - Returns: void
  - Cache Strategy: Not cached (mutations are not cached)
  - Requires: Authenticated session

### PWA Cache Configuration

The following cache strategies are configured in `next.config.js`:

1. **dompetin-v1-api** - API routes
   - Pattern: `/api/trpc/*`
   - Strategy: StaleWhileRevalidate
   - TTL: 5 minutes (300 seconds)
   - Max entries: 64

2. **dompetin-v1-offline** - General offline fallback
   - Pattern: All HTTPS requests
   - Strategy: NetworkFirst
   - Max entries: 200

3. **dompetin-v1-images** - Static images
   - Pattern: `.(png|jpg|jpeg|svg|gif|webp|ico)$`
   - Strategy: CacheFirst
   - TTL: 30 days
   - Max entries: 64

4. **dompetin-v1-static** - Static assets
   - Pattern: `.(js|css|woff|woff2|ttf|eot)$`
   - Strategy: CacheFirst
   - TTL: 30 days
   - Max entries: 64

---

## 3. Auth Session Shape

### Session Object
```typescript
// From Auth & Security Agent
type Session = typeof auth.$Infer.Session;
```

### Protected Routes List
- `/` - Public (home page)
- Currently no other protected routes defined in the application

### Non-Cacheable Auth Endpoints
- `/api/auth/*` - All auth endpoints (NetworkFirst, no caching)
  - `/api/auth/sign-in/*` - Sign in endpoints
  - `/api/auth/sign-out` - Sign out endpoint
  - `/api/auth/session/*` - Session management
  - `/api/auth/callback/*` - OAuth callbacks

### Auth Configuration
- Provider: Better Auth v1.3+
- Methods: Email/password, GitHub OAuth
- Session Storage: Database-backed (Drizzle ORM)
- Session Token Expiration: Configured in Better Auth
- Token Exclusion: Auth tokens are never cached by service worker

---

## 4. PWA Cache Naming Strategy

### Cache Version Format
```
dompetin-v{version}-{resourceType}
```

### Examples
- `dompetin-v1-static` - Static assets
- `dompetin-v1-api` - tRPC API responses
- `dompetin-v1-offline` - Offline fallback
- `dompetin-v1-images` - Images and icons

### Cache TTL
- Static assets: 30 days
- API responses: 5 minutes
- Auth routes: 0 (never cache)
- Images: 30 days

---

## 5. File/Folder Ownership Map

### Backend Agent
- `src/server/api/routers/`
- `src/server/db/schema.ts`
- `src/server/db/index.ts`

### Frontend Agent
- `src/app/` (excluding API routes)
- `src/components/` (excluding PWA components)
- `src/trpc/`
- `src/lib/` (excluding PWA utilities)

### PWA Agent
- `next.config.js`
- `public/manifest.json`
- `public/icons/`
- `src/components/pwa/`
- `src/lib/pwa/`

### Auth & Security Agent
- `src/server/better-auth/`
- `src/app/api/auth/[...all]/route.ts`

### Testing Agent
- `*.test.ts`
- `*.test.tsx`
- `__tests__/`

---

## 6. Code Style and Conventions

### TypeScript
- Use strict type checking
- Prefer interfaces for object shapes
- Use `zod` for runtime validation

### React
- Use Server Components by default
- Mark Client Components with `"use client"`
- Use functional components with hooks

### tRPC
- Use `publicProcedure` for unauthenticated endpoints
- Use `protectedProcedure` for authenticated endpoints
- Return typed responses

### CSS
- Use Tailwind utility classes
- Follow CSS variable naming in `src/styles/globals.css`
- Use shadcn/ui components when available

---

## 7. Environment Variables

### Required for PWA
- None (next-pwa uses build-time config)

### Existing Variables
- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Auth secret (production only)
- `BETTER_AUTH_GITHUB_CLIENT_ID` - GitHub OAuth client ID
- `BETTER_AUTH_GITHUB_CLIENT_SECRET` - GitHub OAuth client secret

---

## 8. PWA Configuration

### Manifest Fields (To be configured by PWA Agent)
- `name`: "Dompetin"
- `short_name`: "Dompetin"
- `description`: "Personal finance management"
- `start_url`: "/"
- `display`: "standalone"
- `theme_color`: Match Tailwind primary (from globals.css)
- `background_color`: Match Tailwind background (from globals.css)

### Service Worker Config (To be configured by PWA Agent)
- Runtime: `workbox`
- Cache strategy:
  - StaleWhileRevalidate for API routes
  - NetworkFirst for auth routes
  - CacheFirst for static assets
- Offline fallback: `/` route
- Development mode: Disabled (for debugging)

---

## 9. Testing Requirements

### Lighthouse PWA Audit
- Score: > 90 in all categories
- Test URL: `/` (home page)
- Must pass offline testing

### Manual Testing Checklist
- [ ] Install prompt shows on supported devices
- [ ] App installs successfully
- [ ] App works offline (cached data)
- [ ] Auth works offline (if cached)
- [ ] Service worker caches API responses
- [ ] Cached data persists across sessions
- [ ] Auth tokens excluded from cache

---

## 10. Deployment Checklist

### Before Deploy
- [ ] All tests passing
- [ ] Lighthouse audit passes
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Service worker tested in production build

### HTTPS Required
- PWA requires HTTPS (except localhost)
- Vercel provides automatic HTTPS
- Self-hosted: configure SSL certificate

---

## 11. Execution Phases

### Phase 1: Foundation & Setup (Parallel)
- PWA Agent: Install next-pwa, create next.config.js, generate manifest
- Auth & Security Agent: Document protected routes

### Phase 2: Service Worker & Caching (Sequential)
- PWA Agent: Configure cache strategies
- Backend Agent: Document API routes for caching
- Auth & Security Agent: Review auth caching rules

### Phase 3: Frontend Integration (Sequential)
- Frontend Agent: Update layout.tsx with PWA meta tags
- PWA Agent: Create offline indicator component
- Auth & Security Agent: Review auth integration

### Phase 4: Install Prompt UX (Sequential)
- PWA Agent: Create install prompt components
- Frontend Agent: Integrate prompts in UI

### Phase 5: Testing & Validation (Sequential)
- Testing Agent: Run Lighthouse audit
- Testing Agent: Test offline functionality
- Testing Agent: Test install prompts

### Phase 6: Deployment Preparation (Parallel)
- All Agents: Update documentation
- PWA Agent: Document deployment requirements

---

## 12. Color Scheme (From globals.css)

The following colors are used for PWA manifest:

### Light Mode Colors
- Primary color: `oklch(0.205 0 0)` → `#000000` (Black)
- Background color: `oklch(1 0 0)` → `#ffffff` (White)
- Accent color: `oklch(0.97 0 0)` → `#f8f8f8` (Light Gray)

### Dark Mode Colors
- Primary color: `oklch(0.985 0 0)` → `#fafafa` (White)
- Background color: `oklch(0.145 0 0)` → `#1a1a1a` (Dark Gray)
- Accent color: `oklch(0.269 0 0)` → `#404040` (Medium Gray)

### PWA Manifest Configuration
The manifest uses light mode colors for consistency:
- `theme_color`: `#000000` (Primary)
- `background_color`: `#ffffff` (Background)

---

## Change Log
- 2026-02-22: Initial contracts for PWA integration
