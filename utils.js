import { Embed, EmbedBuilder } from "discord.js";

// Guild timezone management
const guildTimezones = new Map();
const DEFAULT_TIMEZONE = "UTC";

function getGuildTimezone(guildId) {
  return guildTimezones.get(guildId) || DEFAULT_TIMEZONE;
}

// Message splitting for longer responses
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
      codeBlockLanguage = line.slice(3).trim();
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

function processMessageContent(message) {
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

  return prompt.trim();
}

async function handleEngineResponse(
  message,
  response,
  translations,
  defaultLanguage
) {
  // Send text responses
  const replies = response.data.messages;
  for (const reply of replies) {
    const chunks = splitMessage(reply);
    for (const chunk of chunks) {
      await message.channel.send(chunk);
    }
  }

  // Handle stock info if present
  if (response.data.additional_content?.stock_info_list?.length > 0) {
    await sendStockInfoEmbeds(
      message,
      response.data.additional_content.stock_info_list,
      translations,
      defaultLanguage
    );
  }

  if (response.data.additional_content?.giphy_url) {
    await sendMemeEmbed(message, response.data.additional_content.giphy_url);
  }
}

async function sendStockInfoEmbeds(
  message,
  stockInfo,
  translations,
  defaultLanguage
) {
  const userLocale = message.guild?.preferredLocale || defaultLanguage;
  const langCode = userLocale.split("-")[0];
  const lang = translations[langCode] || translations[defaultLanguage];

  for (const stock of stockInfo) {
    const changeSymbol = stock.change >= 0 ? "▲" : "▼";
    const changeColor = stock.change >= 0 ? 0x00ff00 : 0xff0000;

    const embed = new EmbedBuilder()
      .setColor(changeColor)
      .setTitle(`${stock.stock_name} (${stock.ticker})`)
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
        text: `${lang.lastUpdated}: ${new Date(stock.timestamp).toLocaleString(
          userLocale,
          {
            timeZone: getGuildTimezone(message.guild?.id),
            timeZoneName: "short",
          }
        )}`,
      });

    await message.channel.send({ embeds: [embed] });
  }
}

async function sendMemeEmbed(message, memeUrl) {
  const embed = new EmbedBuilder().setImage(memeUrl);
  await message.channel.send({ embeds: [embed] });
}

export {
  guildTimezones,
  splitMessage,
  processMessageContent,
  handleEngineResponse,
  sendStockInfoEmbeds,
};
