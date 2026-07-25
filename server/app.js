import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { registerApiRoutes } from "./api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApiApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  registerApiRoutes(app);
  return app;
}

export function createServerApp() {
  const app = express();
  app.use(cors());
  app.use("/api", createApiApp());

  const distPath = path.join(__dirname, "..", "dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}
