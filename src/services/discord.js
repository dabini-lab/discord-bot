// ==========================================================
// DISCORD CLIENT SETUP AND EVENT HANDLERS
// ==========================================================
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  PermissionFlagsBits,
} from "discord.js";
import { processMessageContent, handleEngineResponse } from "../utils.js";
import { translations, defaultLanguage } from "../translations.js";
import { makeEngineRequest } from "./engine.js";
import { config } from "../config/environment.js";
import { generateHelloContent } from "../handlers/interactions.js";

// Helper function to get session info from Discord context
function getSessionInfo(context) {
  const channelId = context.channelId || context.channel?.id;
  const sessionId = `discord-${channelId}`;
  const speakerName = context.member?.displayName || context.author?.username;

  return { sessionId, speakerName };
}

// Common function to handle AI requests
async function processAIRequest(userMessage, sessionId, speakerName) {
  const requestBody = {
    messages: [userMessage],
    session_id: sessionId,
    speaker_name: speakerName,
  };

  return await makeEngineRequest("/messages", "POST", requestBody);
}

// Slash commands definition
const commands = [
  {
    name: "hello",
    description: "간단한 인사 명령어",
    description_localizations: {
      ko: "간단한 인사 명령어",
      "en-US": "Simple greeting command",
    },
  },
  {
    name: "chat",
    description: "AI와 대화하기",
    description_localizations: {
      ko: "AI와 대화하기",
      "en-US": "Chat with AI",
    },
    options: [
      {
        name: "message",
        description: "AI에게 보낼 메시지",
        description_localizations: {
          ko: "AI에게 보낼 메시지",
          "en-US": "Message to send to AI",
        },
        type: 3, // STRING type
        required: true,
      },
    ],
  },
  {
    name: "activation",
    description: "Activation for Dabini account",
    description_localizations: {
      ko: "다빈이 계정 활성화",
      "en-US": "Activation for Dabini account",
    },
  },
  {
    name: "image-generation",
    description: "Generate an image with AI",
    description_localizations: {
      ko: "이미지 생성",
      "en-US": "Generate an image with AI",
    },
    options: [
      {
        name: "prompt",
        description: "이미지 생성 프롬프트 (예: 고양이 그려줘)",
        description_localizations: {
          ko: "이미지 생성 프롬프트 (예: 고양이 그려줘)",
          "en-US": "Image generation prompt (e.g., draw a cat)",
        },
        type: 3, // STRING type
        required: true,
      },
    ],
  },
];

export class DiscordBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.rest = new REST({ version: "10" }).setToken(config.discord.loginToken);
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.keepAliveInterval = null;
    this.setupEventHandlers();
  }

  async registerSlashCommands() {
    try {
      console.log("Started refreshing application (/) commands.");

      // Get application ID from the token
      const application = await this.rest.get(
        Routes.oauth2CurrentApplication()
      );
      const applicationId = application.id;

      // Register commands globally
      await this.rest.put(Routes.applicationCommands(applicationId), {
        body: commands,
      });

      console.log("Successfully reloaded application (/) commands.");
      console.log(`Registered ${commands.length} command(s):`);
      commands.forEach((cmd) =>
        console.log(`- /${cmd.name}: ${cmd.description}`)
      );
    } catch (error) {
      console.error("Error registering commands:", error);
      throw error;
    }
  }

  setupEventHandlers() {
    this.client.on("ready", async () => {
      console.log(`Discord bot logged in as ${this.client.user.tag}`);
      this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection

      // Start keep-alive mechanism
      this.startKeepAlive();

      // Register slash commands when bot is ready
      try {
        await this.registerSlashCommands();
      } catch (error) {
        console.error("Failed to register slash commands:", error);
      }
    });

    // Handle disconnection events
    this.client.on("disconnect", (event) => {
      console.log(`Discord bot disconnected:`, event);
      this.handleReconnection();
    });

    this.client.on("error", (error) => {
      console.error("Discord client error:", error);
      this.handleReconnection();
    });

    this.client.on("shardDisconnect", (event, id) => {
      console.log(`Shard ${id} disconnected:`, event);
      this.handleReconnection();
    });

    this.client.on("shardError", (error, shardId) => {
      console.error(`Shard ${shardId} error:`, error);
      this.handleReconnection();
    });

    // Handle when bot is added to a new guild
    this.client.on("guildCreate", async (guild) => {
      console.log(`Bot added to new guild: ${guild.name} (ID: ${guild.id})`);

      try {
        // Find the system channel or the first text channel
        const channel =
          guild.systemChannel ||
          guild.channels.cache.find(
            (ch) =>
              ch.type === 0 &&
              ch
                .permissionsFor(guild.members.me)
                .has(PermissionFlagsBits.SendMessages)
          );

        if (channel) {
          // Generate session info for this guild
          const sessionId = `discord-${channel.id}`;
          const speakerName = this.client.user.username;

          // Get the same content as /hello command
          const welcomeContent = await generateHelloContent(
            sessionId,
            speakerName
          );

          await channel.send(welcomeContent);
          console.log(`Sent welcome message to ${guild.name}`);
        } else {
          console.log(
            `No suitable channel found in ${guild.name} to send welcome message`
          );
        }
      } catch (error) {
        console.error(`Error sending welcome message to ${guild.name}:`, error);
      }
    });

    this.client.on("messageCreate", this.handleMessage.bind(this));
  }

  startKeepAlive() {
    // Clear existing interval if any
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    // Check connection every 5 minutes
    this.keepAliveInterval = setInterval(async () => {
      if (!this.client.readyTimestamp) {
        console.log("Discord client not ready, attempting reconnection...");
        this.handleReconnection();
      } else {
        // Send a ping to verify connection
        try {
          const ping = this.client.ws?.ping;
          if (ping !== undefined && ping > 0) {
            console.log(`Discord client alive - ping: ${ping}ms`);
          } else {
            console.log(
              "Discord client ping unavailable, attempting reconnection..."
            );
            this.handleReconnection();
          }
        } catch (error) {
          console.log("Discord client ping failed, attempting reconnection...");
          this.handleReconnection();
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  async handleReconnection() {
    if (this.isReconnecting) {
      return; // Already attempting to reconnect
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        `Max reconnection attempts (${this.maxReconnectAttempts}) exceeded`
      );
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    console.log(
      `Attempting to reconnect Discord bot (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`
    );

    setTimeout(async () => {
      try {
        // Destroy the current client
        if (this.client && this.client.readyTimestamp) {
          this.client.destroy();
        }

        // Create a new client instance
        this.client = new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
          ],
        });

        // Re-setup event handlers
        this.setupEventHandlers();

        // Attempt to login
        await this.client.login(config.discord.loginToken);
        console.log("Discord bot reconnected successfully");
        this.isReconnecting = false;
      } catch (error) {
        console.error(
          `Reconnection attempt ${this.reconnectAttempts} failed:`,
          error
        );
        this.isReconnecting = false;

        // Try again if we haven't exceeded max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => this.handleReconnection(), 5000);
        }
      }
    }, delay);
  }

  async handleMessage(message) {
    // Ignore bot messages
    if (message.author.bot) return;

    // Only respond to mentions
    if (!message.mentions.has(this.client.user)) return;

    const prompt = processMessageContent(message);
    // Skip if prompt is empty after processing
    if (!prompt) return;

    try {
      // Show typing indicator while processing
      await message.channel.sendTyping();

      const { sessionId, speakerName } = getSessionInfo(message);
      const response = await processAIRequest(prompt, sessionId, speakerName);

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

  async login(token) {
    return this.client.login(token);
  }

  get user() {
    return this.client.user;
  }
}
