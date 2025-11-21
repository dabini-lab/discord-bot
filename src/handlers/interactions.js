// ==========================================================
// DISCORD INTERACTION HANDLERS
// ==========================================================
import { translations, defaultLanguage } from "../translations.js";
import { makeEngineRequest } from "../services/engine.js";
import { getRemoteConfigValue } from "../config/firebase.js";

// Shared function to generate hello message content
export async function generateHelloContent(sessionId, speakerName) {
  try {
    const greeting =
      translations[defaultLanguage]?.greeting || "안녕! 난 다빈이야.";

    // Get AI capabilities info
    const aiResponse = await processAIRequest(
      "너 뭐 할 수 있어? 예시와 함께 보여줘.",
      sessionId,
      speakerName
    );

    const aiCapabilities = await formatEngineResponseForInteraction(
      aiResponse,
      translations,
      defaultLanguage,
      "ko"
    );

    return `${greeting}

**이용약관**: <https://dabinilab.com/terms/>
**개인정보처리방침**: <https://dabinilab.com/privacy/>

${aiCapabilities}`;
  } catch (error) {
    console.error("Error generating hello content:", error);
    const greeting =
      translations[defaultLanguage]?.greeting || "안녕! 난 다빈이야.";
    return `${greeting}

**이용약관**: <https://dabinilab.com/terms/>
**개인정보처리방침**: <https://dabinilab.com/privacy/>

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
          sessionInfo.speakerName
        );

        await editDeferredResponse(interaction, responseContent);
      } catch (error) {
        console.error("Error with engine API in hello command:", error);
        const greeting =
          translations[defaultLanguage]?.greeting || "안녕! 난 다빈이야.";
        const fallbackContent = `${greeting}

**이용약관**: <https://dabinilab.com/terms/>
**개인정보처리방침**: <https://dabinilab.com/privacy/>

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
          sessionInfo.speakerName
        );

        const responseContent = await formatEngineResponseForInteraction(
          response,
          translations,
          defaultLanguage,
          interaction.locale
        );
        await editDeferredResponse(interaction, responseContent);
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

  // Handle activation command
  if (commandName === "activation") {
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

  // Handle image-generation command
  if (commandName === "image-generation") {
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

        const response = await makeEngineRequest("/image/edit", "POST", requestBody);

        const result = response.data;

        const fallbackMessage = "미안, 요청을 처리할 수 없어.";

        if (result.success && result.is_returning_image && result.image_url) {
          // Image edit succeeded - send as Discord embed
          const embedContent = {
            embeds: [
              {
                title: "✨ 이미지 편집 완료!",
                description:
                  result.response_message ||
                  `네가 편집해달라고 한 ${prompt} 이미지야!`,
                image: {
                  url: result.image_url,
                },
                color: 0xe25f8d,
                footer: {
                  text: "AI 이미지 편집 by 다빈이",
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
  let combinedContent = replies.join("\n\n");

  // Truncate if too long for Discord (2000 char limit for interaction responses)
  if (combinedContent.length > 2000) {
    combinedContent = combinedContent.substring(0, 1997) + "...";
  }

  return combinedContent;
}

async function editDeferredResponse(interaction, content) {
  const followupUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;

  await fetch(followupUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

async function editDeferredResponseWithEmbed(interaction, embedData) {
  const followupUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;

  try {
    await fetch(followupUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(embedData),
    });
  } catch (error) {
    console.error("Failed to edit deferred response with embed:", error);
  }
}
