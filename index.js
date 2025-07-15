// ==========================================================
// DISCORD BOT - MAIN ENTRY POINT
// ==========================================================
import { validateEnvironment, config } from "./src/config/environment.js";
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

      // Login to Discord
      await this.startDiscordBot();

      console.log("Bot application started successfully");
    } catch (error) {
      console.error("Failed to start the bot application:", error);
      process.exit(1);
    }
  }

  async initializeServices() {
    console.log("Initializing services...");

    // Initialize engine API client
    await initializeEngine();

    // Initialize Discord bot
    this.discordBot = new DiscordBot();
  }

  async startServer() {
    console.log("Starting HTTP server...");
    const app = createServer();
    this.server = await startServer(app);
  }

  async startDiscordBot() {
    console.log("Starting Discord bot...");
    await this.discordBot.login(config.discord.loginToken);
  }

  async shutdown() {
    console.log("Shutting down bot application...");

    if (this.server) {
      this.server.close();
    }

    // Add any other cleanup logic here
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
botApp.initialize();
