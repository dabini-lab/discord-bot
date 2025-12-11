// ==========================================================
// DISCORD SLASH COMMAND REGISTRATION (Stateless)
// ==========================================================
import { REST, Routes } from "discord.js";
import { config } from "../config/environment.js";

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
  {
    name: "image-edit",
    description: "Edit an image with AI",
    description_localizations: {
      ko: "이미지 수정",
      "en-US": "Edit an image with AI",
    },
    options: [
      {
        name: "prompt",
        description: "이미지 수정 프롬프트 (예: 배경을 바다로 바꿔줘)",
        description_localizations: {
          ko: "이미지 수정 프롬프트 (예: 배경을 바다로 바꿔줘)",
          "en-US": "Image edit prompt (e.g., change background to ocean)",
        },
        type: 3, // STRING type
        required: true,
      },
    ],
  },
];

// Stateless command registration service
export class DiscordCommandService {
  constructor() {
    this.rest = new REST({ version: "10" }).setToken(config.discord.loginToken);
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
}

// Legacy export for backward compatibility (deprecated)
export class DiscordBot {
  constructor() {
    console.warn(
      "DiscordBot class is deprecated. Gateway connection removed for stateless microservice architecture."
    );
    this.commandService = new DiscordCommandService();
  }

  async registerSlashCommands() {
    return this.commandService.registerSlashCommands();
  }

  // Stub methods for backward compatibility
  async login() {
    console.warn("login() is deprecated and does nothing in stateless mode");
  }

  stopKeepAlive() {
    console.warn(
      "stopKeepAlive() is deprecated and does nothing in stateless mode"
    );
  }

  get client() {
    return {
      readyTimestamp: null,
      user: null,
      destroy: () => {},
    };
  }
}
