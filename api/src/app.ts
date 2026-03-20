import express, { type Express } from "express";
import dealsRouter from "./routes/deals";

export const app: Express = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/deals", dealsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[api] Unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
});
