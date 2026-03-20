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
├── apps/
│   ├── api/                    # @repo/api — Express server
│   │   ├── Dockerfile          # Multi-stage, App Runner / ECS ready
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts        # Server bootstrap + graceful shutdown
│   │       └── routes/
│   │           └── deals.ts    # POST /deals, GET /deals (thin wrappers)
│   │
│   └── workers/                # @repo/workers — Lambda handlers
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── emailProcessor.ts   # SQS → send confirmation email
│           └── aiWorker.ts         # SQS → generate AI summary
│
├── packages/
│   ├── core/                   # @repo/core — ALL business logic lives here
│   │   └── src/
│   │       ├── types.ts        # AppContext (DI), input/result types
│   │       ├── deals.ts        # createDeal(), getDealsByTenant()
│   │       ├── activities.ts   # logActivity()
│   │       └── index.ts
│   │
│   ├── db/                     # @repo/db — Drizzle + pg pool
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── client.ts       # getDb() singleton, PgBouncer-safe pool (max: 5)
│   │       ├── seed.ts         # npm run db:seed
│   │       ├── index.ts
│   │       └── schema/
│   │           ├── tenants.ts
│   │           ├── deals.ts    # deal_stage enum, deals table
│   │           ├── activities.ts   # activity_type enum, activities table
│   │           └── index.ts
│   │
│   └── services/               # @repo/services — stub services
│       └── src/
│           ├── ai.ts           # AIService interface + StubAIService
│           ├── email.ts        # EmailService interface + StubEmailService
│           └── index.ts
│
└── infra/
    └── cdk/                    # @repo/infra-cdk — CDK stacks
        ├── cdk.json
        └── src/
            └── stack.ts        # EmailWorker + AIWorker Lambdas, SQS, DLQs
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
npm run db:push -w @repo/db
```

### 5. Seed the database (optional)

```bash
DATABASE_URL=postgres://postgres:password@localhost:5432/realestate_dev \
  npm run db:seed -w @repo/db
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

### No logic duplication

`createDeal()` and `logActivity()` live only in `@repo/core`. The Express route and both Lambda handlers are thin wrappers that call the exact same functions. Adding a new entrypoint (e.g., a CLI script, a webhook receiver) never requires copying business logic.

```
POST /deals  ──┐
               ├──► createDeal(input, ctx)  ◄── @repo/core
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

`packages/db/src/client.ts` configures the pg pool for PgBouncer transaction mode:

- `max: 5` — keeps server-side connections low (PgBouncer multiplexes the rest)
- No prepared statements — drizzle-orm/node-postgres does not use them by default, which is required for transaction pooling mode

Connect to Postgres directly (port `5432`) or through PgBouncer (port `6432`) — the app code is identical either way.

### Graceful shutdown

The Express server calls `server.close()` followed by `closeDb()` on `SIGTERM`/`SIGINT`. This drains in-flight requests and releases the pg pool before the process exits — required for zero-downtime rolling deploys on App Runner or ECS.

### Lambda DLQs and partial batch failure

Each Lambda worker has its own SQS dead-letter queue (`maxReceiveCount: 3`) and reports partial batch failures (`reportBatchItemFailures: true`). A single bad message doesn't block the rest of the batch, and failed messages land in the DLQ for inspection rather than being silently dropped.

### Stub services with swappable interfaces

`@repo/services` exports interfaces (`AIService`, `EmailService`) alongside stub implementations that log to the console. Swap the implementation — point to SES, Bedrock, Resend, etc. — without touching any caller.
