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

      // Register slash commands when bot is ready
      try {
        await this.registerSlashCommands();
      } catch (error) {
        console.error("Failed to register slash commands:", error);
      }
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
