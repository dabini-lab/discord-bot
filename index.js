// ==========================================================
// DISCORD BOT - MAIN ENTRY POINT
// ==========================================================
import { validateEnvironment, config } from "./src/config/environment.js";
import { initializeFirebase } from "./src/config/firebase.js";
import { DiscordBot } from "./src/services/discord.js";
import { initializeEngine } from "./src/services/engine.js";
import { createServer, startServer } from "./src/server/app.js";

class BotApplication {
  constructor() {
    this.discordBot = null;
    this.server = null;
  }

  async initialize() {
    try {
      // Validate environment configuration
      validateEnvironment();
      console.log("Environment configuration validated");

      // Initialize services
      await this.initializeServices();

      // Start server
      await this.startServer();

      console.log("Bot application started successfully (stateless mode)");
    } catch (error) {
      console.error("Failed to start the bot application:", error);
      process.exit(1);
    }
  }

  async initializeServices() {
    console.log("Initializing services...");

    // Initialize Firebase
    await initializeFirebase();

    // Initialize engine API client
    await initializeEngine();

    // Initialize Discord command service (stateless)
    this.discordBot = new DiscordBot();
    await this.discordBot.registerSlashCommands();
  }

  async startServer() {
    console.log("Starting HTTP server...");
    const app = createServer();
    this.server = await startServer(app);
  }

  async shutdown() {
    console.log("Shutting down bot application...");

    if (this.server) {
      this.server.close();
    }

    process.exit(0);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nReceived SIGINT, shutting down gracefully...");
  if (botApp) {
    await botApp.shutdown();
  }
});

process.on("SIGTERM", async () => {
  console.log("\nReceived SIGTERM, shutting down gracefully...");
  if (botApp) {
    await botApp.shutdown();
  }
});

// Start the application
const botApp = new BotApplication();
(async () => {
  try {
    await botApp.initialize();
  } catch (error) {
    console.error("Unhandled error during bot initialization:", error);
    process.exit(1);
  }
})();
