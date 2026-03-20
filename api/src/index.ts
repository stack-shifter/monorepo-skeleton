import { closeDb } from "@repo/shared/db";
import { app } from "./app";

const PORT = process.env.PORT ?? 3000;

const server = app.listen(PORT, () => {
  console.log(`[api] Listening on http://0.0.0.0:${PORT}`);
});

async function shutdown(signal: string) {
  console.log(`[api] ${signal} received — shutting down`);
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
