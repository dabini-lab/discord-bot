// ==========================================================
// IMPORTS & CONFIGURATION
// ==========================================================
import { Client, GatewayIntentBits } from "discord.js";
import express from "express";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";
import { translations, defaultLanguage } from "./translations.js";
import { processMessageContent, handleEngineResponse } from "./utils.js";

// Load environment variables
dotenv.config();

// Environment variables
const DISCORD_LOGIN_TOKEN = process.env.DISCORD_LOGIN_TOKEN;
const ENGINE_URL = process.env.ENGINE_URL;
const PORT = process.env.PORT || 8080;

// ==========================================================
// DISCORD CLIENT SETUP
// ==========================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ==========================================================
// ENGINE API CLIENT SETUP
// ==========================================================
const auth = new GoogleAuth();
let engineClient;

async function initializeEngineClient() {
  try {
    engineClient = await auth.getIdTokenClient(ENGINE_URL);
    console.log("Engine client initialized successfully");
  } catch (error) {
    console.error("Failed to initialize engine client:", error);
  }
}

// ==========================================================
// EVENT HANDLERS
// ==========================================================
client.on("messageCreate", async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Only respond to mentions
  if (message.mentions.has(client.user)) {
    const prompt = processMessageContent(message);
    // Skip if prompt is empty after processing
    if (!prompt) return;

    try {
      const requestBody = {
        messages: [prompt],
        session_id: `discord-${message.channel.id}`,
        speaker_name:
          message.member.displayName || message.member.user.username,
      };

      const response = await engineClient.request({
        url: `${ENGINE_URL}/messages`,
        method: "POST",
        data: requestBody,
      });

      await handleEngineResponse(
        message,
        response,
        translations,
        defaultLanguage
      );
    } catch (error) {
      console.error("Error with engine API:", error);
      await message.channel.send(
        "Sorry. I can't process your request right now."
      );
    }
  }
});

// ==========================================================
// EXPRESS SERVER
// ==========================================================
const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.sendStatus(200);
});

// ==========================================================
// INITIALIZATION
// ==========================================================
async function startBot() {
  try {
    // Initialize API client
    await initializeEngineClient();

    // Start Express server
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // Login to Discord
    await client.login(DISCORD_LOGIN_TOKEN);
    console.log("Discord bot logged in successfully");
  } catch (error) {
    console.error("Failed to start the bot:", error);
  }
}

startBot();
