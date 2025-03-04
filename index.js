// 주요 클래스 가져오기
import { Client, GatewayIntentBits } from 'discord.js';
import express from 'express';
import dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';

dotenv.config();

const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const DISCORD_LOGIN_TOKEN = process.env.DISCORD_LOGIN_TOKEN;
const ENGINE_URL = process.env.ENGINE_URL;
const app = express();
const PORT = 8080;

app.use(express.json());

// 클라이언트 객체 생성 (Guilds관련, 메시지관련 인텐트 추가)
const client = new Client({ intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
]});

const auth = new GoogleAuth();

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.mentions.has(client.user)) {
        // Replace all user and role mentions with their names
        let prompt = message.content;

        // Replace user mentions
        const userMentions = Array.from(message.mentions.users.values());
        for (const user of userMentions) {
            const member = message.guild.members.cache.get(user.id);
            const displayName = member?.displayName || user.username;
            const userMentionRegex = new RegExp(`<@!?${user.id}>`, 'g');
            prompt = prompt.replace(userMentionRegex, displayName);
        }

        // Replace role mentions
        const roleMentions = Array.from(message.mentions.roles.values());
        for (const role of roleMentions) {
            const roleMentionRegex = new RegExp(`<@&${role.id}>`, 'g');
            prompt = prompt.replace(roleMentionRegex, `@${role.name}`);
        }

        // Replace @everyone and @here
        prompt = prompt.replace(/@everyone/g, '모두');
        prompt = prompt.replace(/@here/g, '여기있는사람들');

        prompt = prompt.trim();
        console.log('Original message:', message.content);
        console.log('Processed prompt:', prompt);

        // if prompt is empty
        if (!prompt) {
            return;
        }

        try {
            const client = await auth.getIdTokenClient(ENGINE_URL);
            const requestBody = {
                messages: [prompt],
                thread_id: DISCORD_CHANNEL_ID,
                speaker_name: message.author.displayName || message.author.username,
            };
            const response = await client.request({
                url: `${ENGINE_URL}/messages`,
                method: 'POST',
                data: requestBody
            });
            const reply = response.data.response.content;
            await message.channel.send(reply);
        } catch (error) {
            console.error('Error with engine API:', error);
            await message.channel.send('Engine API 호출 중 문제가 발생했어.');
        }
    }
});

app.get('/health', (req, res) => {
    res.sendStatus(200);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

// 시크릿키(토큰)을 통해 봇 로그인 실행
client.login(DISCORD_LOGIN_TOKEN);
