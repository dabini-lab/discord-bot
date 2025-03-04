// 주요 클래스 가져오기
import { Client, Events, GatewayIntentBits } from 'discord.js';
import cron from 'node-cron';
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

const MONDAY_MESSAGE = '@everyone 토요일 목표는 다 했어? 오늘은 뭐 할거야?';
const SCHEDULE_MESSAGE = '@everyone 어제 목표는 다 했어? 오늘은 뭐 할거야?';

// 봇이 준비됐을때 한번만(once) 표시할 메시지
client.once(Events.ClientReady, async readyClient => {
    console.log(`${readyClient.user.tag}이 로그인했다.`);
    
    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
    if (channel) {
        await channel.send('다빈이 로그인했다!');
    }

    cron.schedule('30 17 * * 1', async () => {
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        if (channel) {
            await channel.send(MONDAY_MESSAGE);
        }
    }, {
        timezone: 'Asia/Seoul'
    });

    cron.schedule('30 17 * * 2-5', async () => {
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        if (channel) {
            await channel.send(SCHEDULE_MESSAGE);
        }
    }, {
        timezone: 'Asia/Seoul'
    });

    cron.schedule('0 12 * * 6', async () => {
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        if (channel) {
            await channel.send(SCHEDULE_MESSAGE);
        }
    }, {
        timezone: 'Asia/Seoul'
    });
});

const auth = new GoogleAuth();

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.mentions.has(client.user)) {
        const prompt = message.content.replace(`<@${client.user.id}>`, '').trim();
        if (prompt) {
            try {
                const client = await auth.getIdTokenClient(ENGINE_URL);
                const requestBody = {
                    messages: [prompt],
                    thread_id: DISCORD_CHANNEL_ID,
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
        } else {
            await message.channel.send('나 불렀어?');
        }
    }
});

app.post('/send-message', async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).send('Message is required');
    }

    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
    if (channel) {
        await channel.send(message);
        res.send('Message sent!');
    } else {
        res.status(404).send('Channel not found');
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
