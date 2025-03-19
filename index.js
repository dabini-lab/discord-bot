// 주요 클래스 가져오기
import { Client, GatewayIntentBits } from "discord.js";
import express from "express";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";

dotenv.config();

const DISCORD_LOGIN_TOKEN = process.env.DISCORD_LOGIN_TOKEN;
const ENGINE_URL = process.env.ENGINE_URL;
const app = express();
const PORT = 8080;

app.use(express.json());

// 클라이언트 객체 생성 (Guilds관련, 메시지관련 인텐트 추가)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const auth = new GoogleAuth();
let engineClient;

// Initialize the engine client
async function initializeEngineClient() {
  engineClient = await auth.getIdTokenClient(ENGINE_URL);
}

initializeEngineClient().catch(console.error);

// Add this helper function before the messageCreate event handler
function splitMessage(text, maxLength = 2000) {
  const chunks = [];
  let currentChunk = "";
  let inCodeBlock = false;
  let codeBlockLanguage = "";

  const lines = text.split("\n");

  for (const line of lines) {
    // Detect code block start
    if (line.startsWith("```")) {
      inCodeBlock = true;
      codeBlockLanguage = line.slice(3);
      currentChunk += line + "\n";
      continue;
    }

    // Detect code block end
    if (line === "```" && inCodeBlock) {
      inCodeBlock = false;

      // If adding the closing tag would exceed limit, start new chunk
      if (currentChunk.length + line.length > maxLength) {
        chunks.push(currentChunk + "```"); // Close the current code block
        currentChunk = "```" + codeBlockLanguage + "\n"; // Start new code block with same language
      }

      currentChunk += line + "\n";
      continue;
    }

    // Handle content (both inside and outside code blocks)
    if (currentChunk.length + line.length + 1 > maxLength) {
      if (inCodeBlock) {
        chunks.push(currentChunk + "```"); // Close current code block
        currentChunk = "```" + codeBlockLanguage + "\n" + line + "\n"; // Start new with same language
      } else {
        chunks.push(currentChunk.trim());
        currentChunk = line + "\n";
      }
    } else {
      currentChunk += line + "\n";
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.mentions.has(client.user)) {
    // Replace all user and role mentions with their names
    let prompt = message.content;

    // Replace user mentions
    const userMentions = Array.from(message.mentions.users.values());
    for (const user of userMentions) {
      const member = message.guild.members.cache.get(user.id);
      const displayName = member?.displayName || user.username;
      const userMentionRegex = new RegExp(`<@!?${user.id}>`, "g");
      prompt = prompt.replace(userMentionRegex, displayName);
    }

    // Replace role mentions
    const roleMentions = Array.from(message.mentions.roles.values());
    for (const role of roleMentions) {
      const roleMentionRegex = new RegExp(`<@&${role.id}>`, "g");
      prompt = prompt.replace(roleMentionRegex, `@${role.name}`);
    }

    // Replace @everyone and @here
    prompt = prompt.replace(/@everyone/g, "모두");
    prompt = prompt.replace(/@here/g, "여기있는사람들");

    prompt = prompt.trim();
    console.log("Original message:", message.content);
    console.log("Processed prompt:", prompt);

    // if prompt is empty
    if (!prompt) {
      return;
    }

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
      const reply = response.data.response.content;
      const chunks = splitMessage(reply);
      for (const chunk of chunks) {
        await message.channel.send(chunk);
      }
    } catch (error) {
      console.error("Error with engine API:", error);
      await message.channel.send("Engine API 호출 중 문제가 발생했어.");
    }
  }
});

app.get("/health", (req, res) => {
  res.sendStatus(200);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});

// 시크릿키(토큰)을 통해 봇 로그인 실행
client.login(DISCORD_LOGIN_TOKEN);
