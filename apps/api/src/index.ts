import express from "express";
import { closeDb } from "@repo/db";
import dealsRouter from "./routes/deals";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

// Health check — required by App Runner / ECS health checks
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/deals", dealsRouter);

// Global error handler — keeps stack traces out of API responses in production
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[api] Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(PORT, () => {
  console.log(`[api] Listening on http://0.0.0.0:${PORT}`);
});

// Graceful shutdown — drain connections before exiting
async function shutdown(signal: string) {
  console.log(`[api] ${signal} received — shutting down`);
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
