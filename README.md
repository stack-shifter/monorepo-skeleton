# Real Estate SaaS — npm Workspaces Monorepo

A minimal, production-quality monorepo demonstrating:

- **Express API** — container-friendly (App Runner / ECS)
- **Lambda workers** — CDK-deployable, SQS-triggered
- **Shared business logic** — zero duplication between API and workers
- **Drizzle ORM + Postgres** — PgBouncer-safe pool configuration
- **Dependency injection** — testable `ctx` pattern throughout

---

## File Tree

```
mono-repo-npm/
├── .env.example
├── .gitignore
├── docker-compose.yml          # Postgres + PgBouncer for local dev
├── example-requests.http       # Ready-to-run HTTP examples
├── package.json                # Root — npm workspaces
├── tsconfig.base.json          # Shared TS compiler options
│
├── api/                        # @repo/api — Express server
│   ├── Dockerfile              # Multi-stage, App Runner / ECS ready
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Server bootstrap + graceful shutdown
│       └── routes/
│           └── deals.ts        # POST /deals, GET /deals (thin wrappers)
│
├── workers/                    # @repo/workers — Lambda handlers
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── emailProcessor.ts   # SQS → send confirmation email
│       └── aiWorker.ts         # SQS → generate AI summary
│
├── shared/                     # @repo/shared — single package, three subpaths
│   ├── drizzle.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── core/               # @repo/shared/core — ALL business logic
│       │   ├── types.ts        # AppContext (DI), input/result types
│       │   ├── deals.ts        # createDeal(), getDealsByTenant()
│       │   ├── activities.ts   # logActivity()
│       │   └── index.ts
│       │
│       ├── db/                 # @repo/shared/db — Drizzle + pg pool
│       │   ├── client.ts       # getDb() singleton, PgBouncer-safe pool (max: 5)
│       │   ├── seed.ts         # npm run db:seed
│       │   ├── index.ts
│       │   └── schema/
│       │       ├── tenants.ts
│       │       ├── deals.ts    # deal_stage enum, deals table
│       │       ├── activities.ts   # activity_type enum, activities table
│       │       └── index.ts
│       │
│       └── services/           # @repo/shared/services — stub services
│           ├── ai.ts           # AIService interface + StubAIService
│           ├── email.ts        # EmailService interface + StubEmailService
│           └── index.ts
│
└── infra/
    └── cdk/                    # @repo/infra-cdk — CDK stacks
        ├── cdk.json
        └── src/
            ├── app.ts          # CDK app entrypoint — instantiates stacks
            └── stacks/
                └── stack.ts    # RealEstateWorkerStack — EmailWorker + AIWorker
```

---

## Running Locally

### 1. Start Postgres + PgBouncer

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Default DATABASE_URL matches docker-compose — edit if needed
```

### 4. Push schema to the database

```bash
npm run db:push -w @repo/shared
```

### 5. Seed the database (optional)

```bash
DATABASE_URL=postgres://postgres:password@localhost:5432/realestate_dev \
  npm run db:seed -w @repo/shared
```

### 6. Start the API

```bash
npm run dev -w @repo/api
```

### 7. Create a deal

```bash
curl -X POST http://localhost:3000/deals \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: <your-tenant-uuid>" \
  -d '{
    "title": "123 Main St — Buyer Representation",
    "contactName": "Jane Smith",
    "contactEmail": "jane@example.com",
    "value": "425000.00",
    "stage": "qualified"
  }'
```

Or open `example-requests.http` in VS Code (REST Client extension) or any JetBrains IDE.

### 8. Build all packages

```bash
npm run build --workspaces
```

---

## Key Design Decisions

### Single `shared/` package with subpath exports

Instead of three separate packages (`@repo/core`, `@repo/db`, `@repo/services`), all shared code lives in one package — `@repo/shared` — with three subpaths:

```
@repo/shared/core      → business logic
@repo/shared/db        → Drizzle client + schema
@repo/shared/services  → AI and email stubs
```

Apps declare one dependency (`"@repo/shared": "*"`) and import by subpath. Subpaths are wired via `exports` and `typesVersions` in `shared/package.json` so both the Node.js runtime and TypeScript resolve correctly. Internal cross-references (`core` → `db`, `services` → `db`) use relative imports within the package, eliminating all circular workspace dependencies.

### No logic duplication

`createDeal()` and `logActivity()` live only in `shared/src/core`. The Express route and both Lambda handlers are thin wrappers that call the exact same functions. Adding a new entrypoint (CLI, webhook, cron) never requires copying business logic.

```
POST /deals  ──┐
               ├──► createDeal(input, ctx)  ◄── @repo/shared/core
SQS event  ────┘
```

### Dependency injection via `AppContext`

Every core function accepts a `ctx` object instead of importing globals:

```typescript
interface AppContext {
  db: Db;
  tenantId: string;
}
```

This makes unit testing trivial — pass in a mock `db`, no database required. It also enforces multi-tenancy at the type level: you can't call a core function without a `tenantId`.

### PgBouncer-safe pool

`shared/src/db/client.ts` configures the pg pool for PgBouncer transaction mode:

- `max: 5` — keeps server-side connections low (PgBouncer multiplexes the rest)
- No prepared statements — drizzle-orm/node-postgres does not use them by default, which is required for transaction pooling mode

Connect to Postgres directly (port `5432`) or through PgBouncer (port `6432`) — the app code is identical either way.

### Graceful shutdown

The Express server calls `server.close()` followed by `closeDb()` on `SIGTERM`/`SIGINT`. This drains in-flight requests and releases the pg pool before the process exits — required for zero-downtime rolling deploys on App Runner or ECS.

### Lambda: `NodejsFunction` + esbuild, no manual build step

Lambda workers are defined with CDK's `NodejsFunction`, pointing directly at `.ts` source files. esbuild bundles and transpiles at `cdk synth` time — no `tsc` required before deploying workers. Everything is tree-shaken into a single file per Lambda, keeping cold-start size minimal.

### Lambda DLQs and partial batch failure

Each Lambda worker has its own SQS dead-letter queue (`maxReceiveCount: 3`) and reports partial batch failures (`reportBatchItemFailures: true`). A single bad message doesn't block the rest of the batch, and failed messages land in the DLQ for inspection rather than being silently dropped.

### Stub services with swappable interfaces

`@repo/shared/services` exports interfaces (`AIService`, `EmailService`) alongside stub implementations that log to the console. Swap the implementation — point to SES, Bedrock, Resend, etc. — without touching any caller.
