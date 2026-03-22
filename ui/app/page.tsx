import { getApiStatus } from "@/lib/api";

export default async function HomePage() {
  const apiStatus = await getApiStatus();

  return (
    <main className="flex min-h-screen items-center justify-center p-6 md:p-10">
      <section className="grid w-full max-w-6xl gap-8 rounded-[2rem] border border-[var(--card-border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(32,57,44,0.12)] backdrop-blur md:grid-cols-[1.3fr_0.9fr] md:p-12">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-3 rounded-full border border-[var(--card-border)] bg-white/70 px-4 py-2 text-sm font-medium text-[var(--muted)]">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            ECS-ready frontend workspace
          </div>

          <div className="space-y-5">
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Monorepo Demo</p>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance md:text-7xl">
              Next.js 16 UI for the shared API and worker platform.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--muted)] md:text-xl">
              This app is intentionally small: a production-shaped shell that exercises the backend through
              server-side requests and is ready to ship as an ECS Fargate container.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-[var(--accent)] p-6 text-white">
              <p className="text-sm uppercase tracking-[0.24em] text-emerald-100">Frontend</p>
              <p className="mt-4 text-3xl font-semibold">Next.js 16</p>
              <p className="mt-3 text-sm leading-7 text-emerald-50/85">
                App Router, Tailwind v4, standalone output, and runtime environment injection.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--card-border)] bg-white/70 p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Backend</p>
              <p className="mt-4 text-3xl font-semibold">Express + Workers</p>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                API requests flow through the UI server and target the shared business layer behind the API.
              </p>
            </div>
          </div>
        </div>

        <aside className="space-y-5 rounded-[1.75rem] border border-[var(--card-border)] bg-white/78 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">API health</p>
              <h2 className="mt-2 text-2xl font-semibold">Server-side connectivity</h2>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                apiStatus.ok
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {apiStatus.ok ? "healthy" : "degraded"}
            </div>
          </div>

          {apiStatus.ok ? (
            <div className="rounded-3xl bg-[var(--accent-soft)] p-5">
              <p className="text-sm font-medium text-[var(--muted)]">Express API responded successfully.</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--accent)]">{apiStatus.data.status}</p>
              <p className="mt-3 text-sm text-[var(--muted)]">Timestamp: {apiStatus.data.timestamp}</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-amber-300 bg-amber-50 p-5">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-700">Backend unavailable</p>
              <p className="mt-3 text-lg font-semibold text-amber-900">{apiStatus.error}</p>
              <p className="mt-3 text-sm leading-6 text-amber-800/80">
                Start the API with <code className="rounded bg-white/70 px-1.5 py-0.5">npm run dev:api</code> or
                point <code className="rounded bg-white/70 px-1.5 py-0.5">API_BASE_URL</code> at a reachable API.
              </p>
            </div>
          )}

          <div className="rounded-3xl border border-[var(--card-border)] p-5">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Runtime contract</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
              <li>
                UI health endpoint: <code>/_health</code>
              </li>
              <li>
                API base URL: <code>{process.env.API_BASE_URL ?? "missing"}</code>
              </li>
              <li>
                Local startup: <code>npm run dev:all</code>
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
