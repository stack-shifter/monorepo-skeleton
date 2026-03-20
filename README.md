# SaaS — npm Workspaces Monorepo

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
        ├── cdk.json            # "app": "npx ts-node --prefer-ts-exts bin/app.ts"
        ├── bin/
        │   └── app.ts          # CDK app entrypoint — instantiates stacks
        └── lib/
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

## Building From Scratch

This section walks through creating this repo from nothing. Every command is meant to be run in order.

### Prerequisites

```bash
node --version   # 20+
npm --version    # 10+
docker --version # for local Postgres
```

---

### Step 1 — Initialise the repo

```bash
mkdir saas && cd saas
git init
```

Scaffold the root `package.json` and install root dev dependencies:

```bash
npm init -y
npm pkg set name="saas" private=true
npm pkg set workspaces='["shared","api","workers","infra/*"]' --json
npm pkg set scripts.build="npm run build -w @repo/shared && npm run build -w @repo/api && npm run build -w @repo/workers && npm run build -w @repo/infra-cdk"
npm pkg set scripts.dev="npm run dev -w @repo/api"
npm pkg set scripts.typecheck="npm run build -w @repo/shared && tsc --noEmit -p api/tsconfig.json && tsc --noEmit -p workers/tsconfig.json"
npm install -D typescript @types/node
```

Create the shared TypeScript base config that every workspace extends:

```bash
cat > tsconfig.base.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true
  },
  "exclude": ["node_modules", "dist", "cdk.out"]
}
EOF
```

```bash
cat > .gitignore << 'EOF'
node_modules/
dist/
.env
*.js.map
*.d.ts.map
drizzle/
cdk.out/
EOF
```

---

### Step 2 — Create the `shared/` package

`shared` is a single npm package with three subpath exports: `core`, `db`, and `services`.

```bash
mkdir -p shared/src/{core,db/schema,services}
cd shared && npm init -y && cd ..
```

Set the package name, mark it private, and add scripts:

```bash
npm pkg set name="@repo/shared" private=true --prefix shared
npm pkg set scripts.build="tsc" scripts.dev="tsc --watch" --prefix shared
npm pkg set scripts.db:push="drizzle-kit push" scripts.db:studio="drizzle-kit studio" --prefix shared
npm pkg set scripts.db:seed="ts-node src/db/seed.ts" --prefix shared
```

Add the subpath `exports` and `typesVersions` fields manually to `shared/package.json` — these are objects that `npm pkg set` doesn't handle cleanly:

```json
// shared/package.json — add these two fields
"exports": {
  "./core":     { "types": "./dist/core/index.d.ts",     "default": "./dist/core/index.js"     },
  "./db":       { "types": "./dist/db/index.d.ts",       "default": "./dist/db/index.js"       },
  "./services": { "types": "./dist/services/index.d.ts", "default": "./dist/services/index.js" }
},
"typesVersions": {
  "*": {
    "core":     ["./dist/core/index.d.ts"],
    "db":       ["./dist/db/index.d.ts"],
    "services": ["./dist/services/index.d.ts"]
  }
}
```

> **Why `exports` + `typesVersions`?**
> `exports` tells the Node.js runtime how to resolve `require('@repo/shared/core')` at runtime.
> `typesVersions` tells TypeScript how to resolve the same import to the correct `.d.ts` file.
> Both are needed because `"moduleResolution": "node"` doesn't read `exports` for types.

Install dependencies into the workspace from the repo root:

```bash
npm install -w @repo/shared drizzle-orm pg
npm install -w @repo/shared -D @types/pg drizzle-kit ts-node
```

Create the tsconfig and Drizzle config:

```bash
cat > shared/tsconfig.json << 'EOF'
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
  "include": ["src"]
}
EOF
```

```bash
cat > shared/drizzle.config.ts << 'EOF'
import type { Config } from "drizzle-kit";
export default {
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
EOF
```

Now write the source files. Populate `shared/src/db/schema/`, `shared/src/db/`, `shared/src/core/`, and `shared/src/services/` — see the files in this repo for the full content.

The key rule for imports **within** `shared/`: always use relative paths (e.g. `../db/index`). Never import `@repo/shared/*` from inside the same package.

---

### Step 3 — Create the `api/` workspace

```bash
mkdir -p api/src/routes
cd api && npm init -y && cd ..
```

```bash
npm pkg set name="@repo/api" private=true main="./dist/index.js" --prefix api
npm pkg set scripts.build="tsc" scripts.start="node dist/index.js" --prefix api
npm pkg set scripts.dev="ts-node-dev --respawn --transpile-only src/index.ts" --prefix api
```

```bash
npm install -w @repo/api @repo/shared express zod
npm install -w @repo/api -D @types/express ts-node-dev
```

> **`"@repo/shared": "*"`** — npm workspaces resolves this to the local `shared/` package via symlink. The `*` means "any version", which is correct for local packages that share a lockfile.

```bash
cat > api/tsconfig.json << 'EOF'
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist", "composite": false },
  "references": [{ "path": "../shared" }],
  "include": ["src"]
}
EOF
```

Write `api/src/index.ts` (Express server + graceful shutdown) and `api/src/routes/deals.ts` (thin route wrappers). Routes import from `@repo/shared/core` and `@repo/shared/db` — no business logic in routes.

---

### Step 4 — Create the `workers/` workspace

```bash
mkdir -p workers/src
cd workers && npm init -y && cd ..
```

```bash
npm pkg set name="@repo/workers" private=true --prefix workers
npm pkg set scripts.build="tsc" scripts.dev="tsc --watch" --prefix workers
```

> **No `main` field** — Lambda workers have no single entrypoint. Each handler file (`emailProcessor.ts`, `aiWorker.ts`) is its own entrypoint referenced directly by the CDK stack.

```bash
npm install -w @repo/workers @repo/shared
npm install -w @repo/workers -D @types/aws-lambda
```

```bash
cat > workers/tsconfig.json << 'EOF'
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist", "composite": false },
  "references": [{ "path": "../shared" }],
  "include": ["src"]
}
EOF
```

Write `workers/src/emailProcessor.ts` and `workers/src/aiWorker.ts`. Each is a thin SQS handler that calls into `@repo/shared/core` and `@repo/shared/services` — no business logic in handlers.

---

### Step 5 — Create the CDK infra

Use `cdk init` to scaffold the standard CDK project structure:

```bash
mkdir -p infra/cdk && cd infra/cdk
cdk init app --language typescript
cd ../..
```

`cdk init` generates `bin/`, `lib/`, `cdk.json`, `tsconfig.json`, and `package.json`. It also runs `npm install` inside `infra/cdk/`. Delete that nested install so the root workspace manages dependencies instead:

```bash
rm -rf infra/cdk/node_modules infra/cdk/package-lock.json
```

Update the package name and add `esbuild` to the generated `package.json`:

```bash
npm pkg set name="@repo/infra-cdk" private=true --prefix infra/cdk
npm pkg set scripts.synth="cdk synth" scripts.deploy="cdk deploy" --prefix infra/cdk
npm install -w @repo/infra-cdk -D esbuild
```

> **`esbuild`** — required by CDK's `NodejsFunction`. It bundles each Lambda handler at `cdk synth` time directly from the `.ts` source file. No separate worker build step needed before deploying.

Replace the generated `tsconfig.json` so it extends the repo base config instead of standing alone:

```bash
cat > infra/cdk/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": ".", "outDir": "./dist", "composite": false },
  "include": ["bin", "lib"]
}
EOF
```

> **`rootDir: "."`** — CDK needs to compile both `bin/` and `lib/` in one pass, so the root is the package directory itself rather than a `src/` subfolder. This matches what `cdk init` generates.

Rename the generated entrypoint and stack files to match this repo's conventions, then write your stack content:

```bash
# cdk init creates bin/<project-name>.ts and lib/<project-name>-stack.ts
# Rename to the conventions used in this repo
mv infra/cdk/bin/*.ts infra/cdk/bin/app.ts
mkdir -p infra/cdk/lib/stacks
mv infra/cdk/lib/*-stack.ts infra/cdk/lib/stacks/stack.ts
```

Update `cdk.json` to point at the renamed entrypoint:

```bash
npm pkg set app="npx ts-node --prefer-ts-exts bin/app.ts" --prefix infra/cdk
```

Write `infra/cdk/bin/app.ts` (creates the CDK `App`, instantiates stacks, calls `app.synth()`) and replace `infra/cdk/lib/stacks/stack.ts` with the `RealEstateWorkerStack` definition using `NodejsFunction`, SQS queues, and DLQs.

> **`repoRoot` path in `stack.ts`**: `__dirname` at runtime points to `infra/cdk/lib/stacks`, which is 4 levels deep. Use `path.resolve(__dirname, "../../../..")` to reach the repo root — one extra `..` compared to what you might expect.

---

### Step 6 — Install all dependencies

```bash
npm install
```

npm workspaces installs everything from all `package.json` files into a single root `node_modules/` and symlinks each workspace package so `@repo/shared`, `@repo/api`, etc. resolve correctly.

---

### Step 7 — Set up local infrastructure

```bash
cp .env.example .env
docker compose up -d               # starts Postgres on :5432, PgBouncer on :6432
npm run db:push -w @repo/shared    # pushes Drizzle schema to the database
npm run db:seed -w @repo/shared    # optional: inserts sample tenant + deal
```

---

### Step 8 — Verify everything builds

```bash
npm run build
```

Expected output — four packages compile in dependency order:

```
@repo/shared    ✓
@repo/api       ✓
@repo/workers   ✓
@repo/infra-cdk ✓
```

---

### Step 9 — Run the API and test it

```bash
npm run dev -w @repo/api
```

```bash
curl -X POST http://localhost:3000/deals \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: <tenant-uuid-from-seed>" \
  -d '{"title":"123 Main St","contactName":"Jane Smith","contactEmail":"jane@example.com","value":"425000.00","stage":"qualified"}'
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
