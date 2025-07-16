// ==========================================================
// EXPRESS SERVER SETUP
// ==========================================================
import express from "express";
import { verifyDiscordSignature } from "../middleware/verification.js";
import { handleInteraction } from "../handlers/interactions.js";
import { config } from "../config/environment.js";

export function createServer() {
  const app = express();

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Raw body parser for webhook verification
  app.use(
    "/interactions",
    express.raw({ type: "application/json" }),
    (req, res, next) => {
      req.rawBody = req.body;
      req.body = JSON.parse(req.body);
      next();
    }
  );

  // Discord webhook endpoint
  app.post("/interactions", verifyDiscordSignature, handleInteraction);

  return app;
}

export function startServer(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(config.server.port, "0.0.0.0", (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Server is running on port ${config.server.port}`);
        resolve(server);
      }
    });
  });
}
