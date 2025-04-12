// 주요 클래스 가져오기
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import express from "express";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";
import { translations, defaultLanguage } from "./translations.js";

dotenv.config();

const DISCORD_LOGIN_TOKEN = process.env.DISCORD_LOGIN_TOKEN;
const ENGINE_URL = process.env.ENGINE_URL;
const app = express();
const PORT = process.env.PORT || 8080;

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

      // Get the text response
      const replies = response.data.messages;

      for (const reply of replies) {
        // Send the text response in chunks
        const chunks = splitMessage(reply);
        for (const chunk of chunks) {
          await message.channel.send(chunk);
        }
      }

      // Check if stock info exists and create embeds
      if (response.data.stock_info && response.data.stock_info.length > 0) {
        for (const stock of response.data.stock_info) {
          const changeSymbol = stock.change >= 0 ? "▲" : "▼";
          const changeColor = stock.change >= 0 ? 0x00ff00 : 0xff0000; // Green for positive, red for negative

          // Get user's preferred language from guild settings or fall back to default
          const userLocale = message.guild?.preferredLocale || defaultLanguage;
          // Get the first part of the locale (e.g., 'en-US' -> 'en')
          const langCode = userLocale.split("-")[0];
          // Get translations for user's language or fall back to default
          const lang = translations[langCode] || translations[defaultLanguage];

          const embed = new EmbedBuilder()
            .setColor(changeColor)
            .setTitle(`${stock.company_name} (${stock.ticker})`)
            .setURL(stock.url)
            .addFields(
              {
                name: lang.price,
                value: `${stock.price} ${stock.currency}`,
                inline: true,
              },
              {
                name: lang.change,
                value: `${changeSymbol} ${Math.abs(stock.change).toFixed(
                  2
                )} (${Math.abs(stock.change_percentage).toFixed(2)}%)`,
                inline: true,
              }
            )
            .setFooter({
              text: `${lang.lastUpdated}: ${new Date(
                stock.timestamp
              ).toLocaleString(userLocale)}`,
            });

          await message.channel.send({ embeds: [embed] });
        }
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
