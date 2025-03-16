import express from "express";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";
import crypto from 'crypto';

dotenv.config();

const ENGINE_URL = process.env.ENGINE_URL;
const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const app = express();
const PORT = 8080;

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

const auth = new GoogleAuth();
let engineClient;

async function initializeEngineClient() {
  engineClient = await auth.getIdTokenClient(ENGINE_URL);
}

initializeEngineClient().catch(console.error);

function verifyDiscordRequest(signature, timestamp, rawBody) {
  try {
    const message = timestamp + rawBody.toString();
    const PUBLIC_KEY = DISCORD_PUBLIC_KEY;
    
    const verifier = crypto.createVerify('SHA256');
    verifier.update(message);
    
    const isValid = verifier.verify(
      PUBLIC_KEY,
      Buffer.from(signature, 'hex')
    );
    
    return isValid;
  } catch (err) {
    console.error('Error verifying request:', err);
    return false;
  }
}

function splitMessage(text, maxLength = 2000) {
  const chunks = [];
  let currentChunk = '';
  let inCodeBlock = false;
  let codeBlockLanguage = '';

  const lines = text.split('\n');
  
  for (const line of lines) {
    // Detect code block start
    if (line.startsWith('```')) {
      inCodeBlock = true;
      codeBlockLanguage = line.slice(3);
      currentChunk += line + '\n';
      continue;
    }
    
    // Detect code block end
    if (line === '```' && inCodeBlock) {
      inCodeBlock = false;
      
      // If adding the closing tag would exceed limit, start new chunk
      if (currentChunk.length + line.length > maxLength) {
        chunks.push(currentChunk + '```'); // Close the current code block
        currentChunk = '```' + codeBlockLanguage + '\n'; // Start new code block with same language
      }
      
      currentChunk += line + '\n';
      continue;
    }

    // Handle content (both inside and outside code blocks)
    if (currentChunk.length + line.length + 1 > maxLength) {
      if (inCodeBlock) {
        chunks.push(currentChunk + '```'); // Close current code block
        currentChunk = '```' + codeBlockLanguage + '\n' + line + '\n'; // Start new with same language
      } else {
        chunks.push(currentChunk.trim());
        currentChunk = line + '\n';
      }
    } else {
      currentChunk += line + '\n';
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function handleInteraction(data) {
  if (data.type === 1) {
    return { type: 1 };
  }

  if (data.type === 2) {
    let prompt = data.data.content;
    const memberName = data.member.nick || data.member.user.username;

    try {
      const requestBody = {
        messages: [prompt],
        thread_id: `discord-${data.channel_id}`,
        speaker_name: memberName,
      };

      const response = await engineClient.request({
        url: `${ENGINE_URL}/messages`,
        method: "POST",
        data: requestBody,
      });

      const reply = response.data.response.content;
      const chunks = splitMessage(reply);

      return {
        type: 4,
        data: {
          content: chunks[0],
          // If there are more chunks, they would need to be sent as follow-up messages
        }
      };
    } catch (error) {
      console.error("Error with engine API:", error);
      return {
        type: 4,
        data: {
          content: "Engine API 호출 중 문제가 발생했어."
        }
      };
    }
  }
}

app.post('/interactions', async (req, res) => {
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];

  if (!verifyDiscordRequest(signature, timestamp, req.rawBody)) {
    return res.status(401).send('Invalid signature');
  }

  const interaction = await handleInteraction(req.body);
  return res.json(interaction);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
