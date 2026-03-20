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
├── .actrc                          # act local CI runner config
├── .env.example
├── .gitignore
├── .secrets.act                    # placeholder secrets for act (safe to commit)
├── docker-compose.yml              # Postgres + PgBouncer for local dev
├── example-requests.http           # Ready-to-run HTTP examples
├── package.json                    # Root — npm workspaces
├── tsconfig.base.json              # Shared TS compiler options
├── vitest.config.ts                # Single vitest config for all packages
│
├── .github/
│   └── workflows/
│       ├── dev-branch.yml          # CI on dev-* branches and PRs
│       └── release.yml             # Build, push, CDK synth, GitHub Release on v* tags
│
├── api/                            # @repo/api — Express server
│   ├── Dockerfile                  # Multi-stage, App Runner / ECS ready
│   ├── package.json
│   ├── tsconfig.json
│   ├── test/                  # Tests — sibling to src/
│   │   └── routes/
│   │       └── deals.test.ts       # Supertest integration tests (11 tests)
│   └── src/
│       ├── app.ts                  # Express app (no server.listen — importable in tests)
│       ├── index.ts                # Server bootstrap + graceful shutdown
│       └── routes/
│           └── deals.ts            # POST /deals, GET /deals (thin wrappers)
│
├── workers/                        # @repo/workers — Lambda handlers
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── emailProcessor.ts       # SQS → send confirmation email
│       └── aiWorker.ts             # SQS → generate AI summary
│
├── lib/                            # @repo/lib — single package, three subpaths
│   ├── drizzle.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── test/                  # Tests — sibling to src/
│   │   ├── core/
│   │   │   ├── deals.test.ts       # 6 tests
│   │   │   └── activities.test.ts  # 3 tests
│   │   └── services/
│   │       ├── ai.test.ts          # 5 tests
│   │       └── email.test.ts       # 3 tests
│   └── src/
│       ├── core/                   # @repo/lib/core — ALL business logic
│       │   ├── types.ts            # AppContext (DI), input/result types
│       │   ├── deals.ts            # createDeal(), getDealsByTenant()
│       │   ├── activities.ts       # logActivity()
│       │   └── index.ts
│       │
│       ├── db/                     # @repo/lib/db — Drizzle + pg pool
│       │   ├── client.ts           # getDb() singleton, PgBouncer-safe pool (max: 5)
│       │   ├── seed.ts             # npm run db:seed
│       │   ├── index.ts
│       │   └── schema/
│       │       ├── tenants.ts
│       │       ├── deals.ts        # deal_stage enum, deals table
│       │       ├── activities.ts   # activity_type enum, activities table
│       │       └── index.ts
│       │
│       └── services/               # @repo/lib/services — stub services
│           ├── ai.ts               # AIService interface + StubAIService
│           ├── email.ts            # EmailService interface + StubEmailService
│           └── index.ts
│
└── infra/
    └── cdk/                        # @repo/infra-cdk — CDK stacks
        ├── cdk.json                # "app": "npx ts-node --prefer-ts-exts bin/app.ts"
        ├── bin/
        │   └── app.ts              # CDK app entrypoint — instantiates stacks
        └── lib/
            └── stacks/
                └── stack.ts        # RealEstateWorkerStack — EmailWorker + AIWorker
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
npm run db:push -w @repo/lib
```

### 5. Seed the database (optional)

```bash
DATABASE_URL=postgres://postgres:password@localhost:5432/realestate_dev \
  npm run db:seed -w @repo/lib
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

### 8. Run tests

```bash
npm test          # runs all 28 tests across lib + api
```

### 9. Build all packages

```bash
npm run build
```

---

## Building From Scratch

This section walks through creating this repo from nothing. Every command is meant to be run in order.

### Prerequisites

```bash
node --version   # 24+
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
npm pkg set workspaces='["lib","api","workers","infra/*"]' --json
npm pkg set engines.node=">=24" --json
npm pkg set scripts.build="npm run build -w @repo/lib && npm run build -w @repo/api && npm run build -w @repo/workers && npm run build -w @repo/infra-cdk"
npm pkg set scripts.dev="npm run dev -w @repo/api"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm pkg set scripts.typecheck="npm run build -w @repo/lib && tsc --noEmit -p api/tsconfig.json && tsc --noEmit -p workers/tsconfig.json"
npm install -D typescript @types/node vitest
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

Create the vitest config at the root — one config to run tests for all packages:

```bash
cat > vitest.config.ts << 'EOF'
import { defineConfig, defineProject } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: "lib",
          root: "./lib",
          include: ["test/**/*.test.ts"],
          environment: "node",
          globals: true,
        },
      }),
      defineProject({
        test: {
          name: "api",
          root: "./api",
          include: ["test/**/*.test.ts"],
          environment: "node",
          globals: true,
        },
      }),
    ],
  },
});
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
.secrets.act.local
EOF
```

---

### Step 2 — Create the `lib/` package

`lib` is a single npm package with three subpath exports: `core`, `db`, and `services`.

```bash
mkdir -p lib/src/{core,db/schema,services} lib/test/{core,services}
cd lib && npm init -y && cd ..
```

Set the package name, mark it private, and add scripts:

```bash
npm pkg set name="@repo/lib" private=true --prefix lib
npm pkg set scripts.build="tsc" scripts.dev="tsc --watch" --prefix lib
npm pkg set scripts.db:push="drizzle-kit push" scripts.db:studio="drizzle-kit studio" --prefix lib
npm pkg set scripts.db:seed="tsx src/db/seed.ts" --prefix lib
npm pkg set scripts.test="vitest run --project lib" --prefix lib
npm pkg set scripts.test:watch="vitest --project lib" --prefix lib
```

Add the subpath `exports` and `typesVersions` fields manually to `lib/package.json` — these are objects that `npm pkg set` doesn't handle cleanly:

```json
// lib/package.json — add these two fields
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
> `exports` tells the Node.js runtime how to resolve `require('@repo/lib/core')` at runtime.
> `typesVersions` tells TypeScript how to resolve the same import to the correct `.d.ts` file.
> Both are needed because `"moduleResolution": "node"` doesn't read `exports` for types.

Install dependencies into the workspace from the repo root:

```bash
npm install -w @repo/lib drizzle-orm pg
npm install -w @repo/lib -D @types/pg drizzle-kit tsx
```

Create the tsconfig and Drizzle config:

```bash
cat > lib/tsconfig.json << 'EOF'
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist" },
  "include": ["src"]
}
EOF
```

```bash
cat > lib/drizzle.config.ts << 'EOF'
import type { Config } from "drizzle-kit";
export default {
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
EOF
```

Now write the source files. Populate `lib/src/db/schema/`, `lib/src/db/`, `lib/src/core/`, and `lib/src/services/` — see the files in this repo for the full content.

The key rule for imports **within** `lib/`: always use relative paths (e.g. `../db/index`). Never import `@repo/lib/*` from inside the same package.

---

### Step 3 — Create the `api/` workspace

```bash
mkdir -p api/src/routes api/test/routes
cd api && npm init -y && cd ..
```

```bash
npm pkg set name="@repo/api" private=true main="./dist/index.js" --prefix api
npm pkg set scripts.build="tsc" scripts.start="node dist/index.js" --prefix api
npm pkg set scripts.dev="tsx watch src/index.ts" --prefix api
npm pkg set scripts.test="vitest run --project api" --prefix api
npm pkg set scripts.test:watch="vitest --project api" --prefix api
```

```bash
npm install -w @repo/api @repo/lib express zod
npm install -w @repo/api -D @types/express @types/supertest supertest tsx
```

> **`"@repo/lib": "*"`** — npm workspaces resolves this to the local `lib/` package via symlink. The `*` means "any version", which is correct for local packages that share a lockfile.

```bash
cat > api/tsconfig.json << 'EOF'
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist", "composite": false },
  "references": [{ "path": "../lib" }],
  "include": ["src"]
}
EOF
```

Write `api/src/app.ts` (Express app without `server.listen`) and `api/src/index.ts` (imports `app`, starts the server, handles graceful shutdown). Splitting `app` from `index` lets tests import the app directly without binding a port.

Write `api/src/routes/deals.ts` (thin route wrappers — no business logic in routes) and `api/test/routes/deals.test.ts` (supertest tests with `vi.mock` for `@repo/lib/core` and `@repo/lib/db`).

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
npm install -w @repo/workers @repo/lib
npm install -w @repo/workers -D @types/aws-lambda
```

```bash
cat > workers/tsconfig.json << 'EOF'
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "rootDir": "./src", "outDir": "./dist", "composite": false },
  "references": [{ "path": "../lib" }],
  "include": ["src"]
}
EOF
```

Write `workers/src/emailProcessor.ts` and `workers/src/aiWorker.ts`. Each is a thin SQS handler that calls into `@repo/lib/core` and `@repo/lib/services` — no business logic in handlers.

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

### Step 6 — Add GitHub Actions workflows

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/dev-branch.yml` (triggers on `dev-*` branches, runs typecheck → test → build → Docker smoke build) and `.github/workflows/release.yml` (triggers on `v*.*.*` tags, runs CI then pushes to GHCR, synthesizes CDK, and creates a GitHub Release).

Add an `.actrc` for local simulation and a `.secrets.act` with placeholder values:

```bash
cat > .actrc << 'EOF'
--platform ubuntu-latest=catthehacker/ubuntu:act-latest
--container-architecture linux/amd64
EOF

cat > .secrets.act << 'EOF'
GITHUB_TOKEN=fake-token-for-local-act-runs
EOF
```

---

### Step 7 — Install all dependencies

```bash
npm install
```

npm workspaces installs everything from all `package.json` files into a single root `node_modules/` and symlinks each workspace package so `@repo/lib`, `@repo/api`, etc. resolve correctly.

---

### Step 8 — Set up local infrastructure

```bash
cp .env.example .env
docker compose up -d               # starts Postgres on :5432, PgBouncer on :6432
npm run db:push -w @repo/lib       # pushes Drizzle schema to the database
npm run db:seed -w @repo/lib       # optional: inserts sample tenant + deal
```

---

### Step 9 — Verify everything works

```bash
npm test          # 28 tests across lib + api
npm run build     # compiles all four packages in dependency order
```

---

### Step 10 — Run the API and test it

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

### Single `lib/` package with subpath exports

Instead of three separate packages (`@repo/core`, `@repo/db`, `@repo/services`), all shared code lives in one package — `@repo/lib` — with three subpaths:

```
@repo/lib/core         → business logic
@repo/lib/db           → Drizzle client + schema
@repo/lib/services     → AI and email stubs
```

Apps declare one dependency (`"@repo/lib": "*"`) and import by subpath. Subpaths are wired via `exports` and `typesVersions` in `lib/package.json` so both the Node.js runtime and TypeScript resolve correctly. Internal cross-references (`core` → `db`, `services` → `db`) use relative imports within the package, eliminating all circular workspace dependencies.

### No logic duplication

`createDeal()` and `logActivity()` live only in `lib/src/core`. The Express route and both Lambda handlers are thin wrappers that call the exact same functions. Adding a new entrypoint (CLI, webhook, cron) never requires copying business logic.

```
POST /deals  ──┐
               ├──► createDeal(input, ctx)  ◄── @repo/lib/core
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

### Single vitest config

All 28 tests across `lib` and `api` run from one config at the repo root:

```bash
npm test                          # all packages
npm test -w @repo/lib             # lib only (uses --project lib internally)
npm test -w @repo/api             # api only
```

`vitest.config.ts` defines two named projects (`lib`, `api`) under `test.projects`, each with its own `root` and `include` globs. `vitest` itself lives only in root `devDependencies` — no per-package vitest install needed.

### `app.ts` extracted from `index.ts`

`api/src/app.ts` creates and configures the Express app but never calls `server.listen`. `api/src/index.ts` imports it and starts the server. Tests import `app` directly via supertest — no port is bound, no cleanup needed.

### PgBouncer-safe pool

`lib/src/db/client.ts` configures the pg pool for PgBouncer transaction mode:

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

`@repo/lib/services` exports interfaces (`AIService`, `EmailService`) alongside stub implementations that log to the console. Swap the implementation — point to SES, Bedrock, Resend, etc. — without touching any caller.

---

## CI / CD

Two workflows live in `.github/workflows/`:

| Workflow | Trigger | Jobs |
|---|---|---|
| `dev-branch.yml` | push / PR to any `dev-*` branch | typecheck → test → build → docker smoke build |
| `release.yml` | push of a `v*.*.*` tag | typecheck → test → build → docker push to GHCR → CDK synth → GitHub Release |

### dev-branch workflow

Runs on every push to `dev-*` branches and on PRs targeting them. A second job does a Docker build (no push) as a smoke test to catch Dockerfile regressions early. Concurrent runs on the same branch are cancelled automatically.

### release workflow

Triggered by a semver tag (e.g. `v1.2.0`). After CI passes:

1. **docker-publish** — builds and pushes the API image to GitHub Container Registry with `major`, `major.minor`, and full `major.minor.patch` tags.
2. **cdk-synth** — synthesizes the CDK stacks to verify CloudFormation templates are valid before any deploy.
3. **github-release** — creates a GitHub Release with auto-generated release notes from merged PRs.

To cut a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

### Simulate locally with `act`

[`act`](https://github.com/nektos/act) runs GitHub Actions workflows locally using Docker.

```bash
# Install (macOS)
brew install act

# Simulate the dev-branch CI push event
act push --workflows .github/workflows/dev-branch.yml \
         --secret-file .secrets.act

# Simulate just the typecheck + test jobs (faster, skips Docker build)
act push --workflows .github/workflows/dev-branch.yml \
         --secret-file .secrets.act \
         --job ci

# Simulate a tag release (replace vX.Y.Z with any semver)
act push --workflows .github/workflows/release.yml \
         --secret-file .secrets.act \
         --eventpath - <<'EOF'
{"ref": "refs/tags/v1.0.0", "repository": {"full_name": "your-org/saas"}}
EOF
```

> `.secrets.act` is committed with placeholder values. Copy it to `.secrets.act.local` (gitignored) and fill in real tokens if you need the Docker push or GitHub Release steps to actually run.
