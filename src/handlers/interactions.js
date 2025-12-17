// ==========================================================
// DISCORD INTERACTION HANDLERS
// ==========================================================
import { translations, defaultLanguage } from "../translations.js";
import { makeEngineRequest } from "../services/engine.js";
import { getRemoteConfigValue } from "../config/firebase.js";

// Shared function to generate hello message content
export async function generateHelloContent(sessionId, speakerName, userId) {
  try {
    const greeting =
      translations[defaultLanguage]?.greeting || "안녕! 난 다빈이야.";

    // Get AI capabilities info
    const aiResponse = await processAIRequest(
      "너 뭐 할 수 있어? 예시와 함께 보여줘.",
      sessionId,
      speakerName,
      userId
    );

    const aiResult = await formatEngineResponseForInteraction(
      aiResponse,
      translations,
      defaultLanguage,
      "ko"
    );

    return `${greeting}

${aiResult.content}`;
  } catch (error) {
    console.error("Error generating hello content:", error);
    const greeting =
      translations[defaultLanguage]?.greeting || "안녕! 난 다빈이야.";
    return `${greeting}

죄송합니다. 현재 AI 기능에 문제가 있습니다.`;
  }
}

// Handle HTTP webhook interactions (for Express server)
export async function handleInteraction(req, res) {
  const interaction = req.body;

  // Handle Discord ping (verification)
  if (interaction.type === 1) {
    return res.json({ type: 1 });
  }

  // Handle application commands (slash commands)
  if (interaction.type === 2) {
    return handleApplicationCommand(interaction, res);
  }

  // Handle message components (buttons, select menus, etc.)
  if (interaction.type === 3) {
    return handleMessageComponent(interaction, res);
  }

  res.status(400).send("Unknown interaction type");
}

async function handleApplicationCommand(interaction, res) {
  const commandName = interaction.data.name;

  // Handle hello command
  if (commandName === "hello") {
    // Defer the response immediately
    res.json({
      type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    });

    // Handle the actual processing async
    setImmediate(async () => {
      try {
        const sessionInfo = getSessionInfo(interaction);

        const responseContent = await generateHelloContent(
          sessionInfo.sessionId,
          sessionInfo.speakerName,
          sessionInfo.userId
        );

        await editDeferredResponse(interaction, responseContent);
      } catch (error) {
        console.error("Error with engine API in hello command:", error);
        const greeting =
          translations[defaultLanguage]?.greeting || "안녕! 난 다빈이야.";
        const fallbackContent = `${greeting}

죄송합니다. 현재 AI 기능에 문제가 있습니다.`;

        await editDeferredResponse(interaction, fallbackContent);
      }
    });
    return;
  }

  // Handle chat command
  if (commandName === "chat") {
    // Defer the response immediately
    res.json({
      type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    });

    // Handle the actual processing async
    setImmediate(async () => {
      try {
        const message = extractPromptFromCommand(interaction);
        const sessionInfo = getSessionInfo(interaction);
        const response = await processAIRequest(
          message,
          sessionInfo.sessionId,
          sessionInfo.speakerName,
          sessionInfo.userId
        );

        const result = await formatEngineResponseForInteraction(
          response,
          translations,
          defaultLanguage,
          interaction.locale
        );

        // If there are embeds, use editDeferredResponseWithEmbed, otherwise use editDeferredResponse
        if (result.embeds && result.embeds.length > 0) {
          await editDeferredResponseWithEmbed(interaction, result);
        } else {
          await editDeferredResponse(interaction, result.content);
        }
      } catch (error) {
        console.error("Error with engine API in webhook:", error);
        await editDeferredResponse(
          interaction,
          "Sorry. I can't process your request right now."
        );
      }
    });
    return;
  }

  // Handle activate command
  if (commandName === "activate") {
    // Defer the response immediately
    res.json({
      type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    });

    // Handle the actual processing async
    setImmediate(async () => {
      try {
        // Request activation code from engine
        const requestBody = {
          discord_user_id: interaction.member.user.id,
        };

        const response = await makeEngineRequest(
          "/activation/discord",
          "POST",
          requestBody
        );

        // Extract activation code from response
        const activationCode = response.data?.activation_code;

        if (!activationCode) {
          throw new Error("No activation code received from engine");
        }

        // Get activation base URL from Firebase Remote Config
        const activationBaseUrl = await getRemoteConfigValue(
          "ACTIVATION_URL",
          "https://dabinilab.com/activation"
        );
        const activationUrl = `${activationBaseUrl}/discord?code=${activationCode}`;

        // Support Korean and English based on user locale
        const isKorean = interaction.locale?.startsWith("ko");
        const message = isKorean
          ? `다빈이 계정을 활성화하려면 아래 링크를 클릭하세요:\n${activationUrl}\n이 링크는 일정 시간 후 만료됩니다.`
          : `Click the link below to activate your Dabini account:\n${activationUrl}\nThis link will expire after a certain period of time.`;

        await editDeferredResponse(interaction, message);
      } catch (error) {
        console.error("Error with activation command:", error);
        await editDeferredResponse(
          interaction,
          "Sorry. I can't generate an activation URL right now."
        );
      }
    });
    return;
  }

  // Handle deactivate command
  if (commandName === "deactivate") {
    // Defer the response immediately
    res.json({
      type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    });

    // Handle the actual processing async
    setImmediate(async () => {
      try {
        // Request deactivation from engine
        const requestBody = {
          discord_user_id: interaction.member.user.id,
        };

        await makeEngineRequest("/activation/discord", "DELETE", requestBody);

        // Support Korean and English based on user locale
        const isKorean = interaction.locale?.startsWith("ko");
        const message = isKorean
          ? "다빈이 계정이 비활성화되었습니다."
          : "Your Dabini account has been deactivated.";

        await editDeferredResponse(interaction, message);
      } catch (error) {
        console.error("Error with deactivate command:", error);
        const isKorean = interaction.locale?.startsWith("ko");
        const errorMessage = isKorean
          ? "죄송합니다. 지금은 비활성화 요청을 처리할 수 없습니다."
          : "Sorry. I can't process the deactivation request right now.";
        await editDeferredResponse(interaction, errorMessage);
      }
    });
    return;
  }

  // Handle image-gen command
  if (commandName === "image-gen") {
    // Defer the response immediately
    res.json({
      type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    });

    // Handle the actual processing async
    setImmediate(async () => {
      try {
        const prompt = extractPromptFromCommand(interaction);
        const sessionInfo = getSessionInfo(interaction);
        const userId = `discord-${interaction.member.user.id}`;

        // Request image generation from engine
        const requestBody = {
          prompt: prompt,
          user_id: userId,
          session_id: sessionInfo.sessionId,
        };

        const response = await makeEngineRequest("/image", "POST", requestBody);

        const result = response.data;

        const fallbackMessage = "미안, 요청을 처리할 수 없어.";

        if (result.success && result.is_returning_image && result.image_url) {
          // Image generation succeeded - send as Discord embed
          const embedContent = {
            embeds: [
              {
                title: "🎨 이미지 생성 완료!",
                description:
                  result.response_message ||
                  `네가 그려달라고 한 ${prompt} 이미지야!`,
                image: {
                  url: result.image_url,
                },
                color: 0xe25f8d,
                footer: {
                  text: "AI 이미지 생성 by 다빈이",
                },
              },
            ],
          };

          await editDeferredResponseWithEmbed(interaction, embedContent);
        } else {
          // Use response_message from engine (error messages are already generated)
          const errorMessage = result.response_message || fallbackMessage;
          await editDeferredResponse(interaction, errorMessage);
        }
      } catch (error) {
        console.error("Error with image-generation command:", error);
        await editDeferredResponse(interaction, "미안, 요청을 처리할 수 없어.");
      }
    });
    return;
  }

  // Handle image-edit command
  if (commandName === "image-edit") {
    // Defer the response immediately
    res.json({
      type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    });

    // Handle the actual processing async
    setImmediate(async () => {
      try {
        const prompt = extractPromptFromCommand(interaction);
        const sessionInfo = getSessionInfo(interaction);
        const userId = `discord-${interaction.member.user.id}`;

        // Request image edit from engine
        const requestBody = {
          prompt: prompt,
          user_id: userId,
          session_id: sessionInfo.sessionId,
        };

        const response = await makeEngineRequest(
          "/image/edit",
          "POST",
          requestBody
        );

        const result = response.data;

        const fallbackMessage = "미안, 요청을 처리할 수 없어.";

        if (result.success && result.is_returning_image && result.image_url) {
          // Image edit succeeded - send as Discord embed
          // Sanitize user input before using in embed description
          function sanitizeDiscordInput(input) {
            // Escape Discord markdown and mentions
            return input
              .replace(/([*_~`|>])/g, "\\$1") // Escape markdown
              .replace(/@/g, "@\u200b"); // Prevent mentions
          }
          const sanitizedPrompt = sanitizeDiscordInput(prompt);
          const embedContent = {
            embeds: [
              {
                title: "✨ 이미지 수정 완료!",
                description:
                  result.response_message ||
                  `네가 수정해달라고 한 ${sanitizedPrompt} 이미지야!`,
                image: {
                  url: result.image_url,
                },
                color: 0xe25f8d,
                footer: {
                  text: "AI 이미지 수정 by 다빈이",
                },
              },
            ],
          };

          await editDeferredResponseWithEmbed(interaction, embedContent);
        } else {
          // Use response_message from engine (error messages are already generated)
          const errorMessage = result.response_message || fallbackMessage;
          await editDeferredResponse(interaction, errorMessage);
        }
      } catch (error) {
        console.error("Error with image-edit command:", error);
        await editDeferredResponse(interaction, "미안, 요청을 처리할 수 없어.");
      }
    });
    return;
  }

  // Unknown command
  res.status(400).send("Unknown command");
}

// Helper function to get session info from Discord context
function getSessionInfo(context) {
  const channelId =
    context.channelId || context.channel?.id || context.channel_id;
  const sessionId = `discord-${channelId}`;
  const speakerName = context.member?.nick || context.member?.user?.username;
  const userId = `discord-${context.member?.user?.id}`;

  return { sessionId, speakerName, userId };
}

// Common function to handle AI requests
async function processAIRequest(userMessage, sessionId, speakerName, userId) {
  const requestBody = {
    messages: [userMessage],
    session_id: sessionId,
    speaker_name: speakerName,
    user_id: userId,
  };

  return await makeEngineRequest("/messages", "POST", requestBody);
}

function handleMessageComponent(interaction, res) {
  return res.json({
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      content: "Hello from component interaction! 👋",
    },
  });
}

function extractPromptFromCommand(interaction) {
  const commandData = interaction.data;
  let prompt = "";

  // Extract prompt from command options if available
  if (commandData.options && commandData.options.length > 0) {
    const messageOption = commandData.options.find(
      (option) => option.name === "message" || option.name === "prompt"
    );
    if (messageOption) {
      prompt = messageOption.value;
    }
  }

  // If no prompt found, use the command name as default
  if (!prompt) {
    prompt = commandData.name;
  }

  return prompt;
}

async function formatEngineResponseForInteraction(
  response,
  translations,
  defaultLanguage,
  userLocale = "en"
) {
  const langCode = userLocale.split("-")[0];
  const lang = translations[langCode] || translations[defaultLanguage];

  // Combine all message responses into one response
  const replies = response.data.messages;

  // Validate messages array exists and has content
  if (!replies || !Array.isArray(replies) || replies.length === 0) {
    const fallbackMessage =
      langCode === "ko"
        ? "죄송합니다. 응답을 생성할 수 없습니다."
        : "Sorry, I couldn't generate a response.";
    return {
      content: fallbackMessage,
      embeds: [],
    };
  }

  let combinedContent = replies.join("\n\n");

  // Truncate if too long for Discord (2000 char limit for interaction responses)
  if (combinedContent.length > 2000) {
    let truncateAt = 1997;
    // Check if we're cutting in the middle of a surrogate pair (emoji, etc.)
    const charCode = combinedContent.charCodeAt(truncateAt - 1);
    if (charCode >= 0xd800 && charCode <= 0xdbff) {
      // High surrogate - we're about to cut a surrogate pair, move back one position
      truncateAt--;
    }
    combinedContent = combinedContent.substring(0, truncateAt) + "...";
  }

  // Prepare result with content and optional embeds
  const result = {
    content: combinedContent,
    embeds: [],
  };

  // Handle stock info if present
  if (response.data.additional_content?.stock_info_list?.length > 0) {
    for (const stock of response.data.additional_content.stock_info_list) {
      const changeSymbol = stock.change >= 0 ? "▲" : "▼";
      const changeColor = stock.change >= 0 ? 0x00ff00 : 0xff0000;

      const embed = {
        color: changeColor,
        title: `${stock.stock_name} (${stock.ticker})`,
        url: stock.url,
        fields: [
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
          },
        ],
        footer: {
          text: `${lang.lastUpdated}: ${new Date(
            stock.timestamp
          ).toLocaleString(userLocale, {
            timeZoneName: "short",
          })}`,
        },
      };

      result.embeds.push(embed);
    }
  }

  // Handle meme/giphy if present
  if (response.data.additional_content?.giphy_url) {
    result.embeds.push({
      image: {
        url: response.data.additional_content.giphy_url,
      },
    });
  }

  return result;
}

async function editDeferredResponse(interaction, content) {
  const baseUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`;
  const originalUrl = `${baseUrl}/messages/@original`;

  try {
    // Handle array of messages (split messages)
    if (Array.isArray(content)) {
      // Handle empty array - send fallback to prevent indefinite pending state
      if (content.length === 0) {
        await fetch(originalUrl, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "No response available" }),
        });
        return;
      }

      // Send first message as edit to original
      const originalResponse = await fetch(originalUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content[0] }),
      });
      if (!originalResponse.ok) {
        const errorBody = await originalResponse.text().catch(() => "");
        console.error(
          `Discord API error editing original message: ${originalResponse.status} ${originalResponse.statusText} - ${errorBody}`
        );
      }

      // Send remaining messages as follow-ups
      for (let i = 1; i < content.length; i++) {
        const followUpResponse = await fetch(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content[i] }),
        });
        if (!followUpResponse.ok) {
          const errorBody = await followUpResponse.text().catch(() => "");
          console.error(
            `Discord API error on follow-up message ${i}: ${followUpResponse.status} ${followUpResponse.statusText} - ${errorBody}`
          );
          // Continue sending remaining messages even if one fails
        }
      }
    } else {
      // Single message
      const response = await fetch(originalUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content || "No response available" }),
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        console.error(
          `Discord API error editing original message: ${response.status} ${response.statusText} - ${errorBody}`
        );
      }
    }
  } catch (error) {
    console.error("Failed to edit deferred response:", error);
  }
}

async function editDeferredResponseWithEmbed(interaction, embedData) {
  const followupUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;

  try {
    const response = await fetch(followupUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(embedData),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `Discord API error editing deferred response with embed: ${response.status} ${response.statusText} - ${errorBody}`
      );
    }
  } catch (error) {
    console.error("Failed to edit deferred response with embed:", error);
  }
}
