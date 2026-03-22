import express, { type Express } from "express";
import dealsRouter from "./routes/deals";

export const app: Express = express();

app.use(express.json());

function healthHandler(_req: express.Request, res: express.Response) {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
}

app.get("/api/health", healthHandler);
app.use("/api/deals", dealsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[api] Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
});
