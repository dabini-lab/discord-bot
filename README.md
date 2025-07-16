# Discord Bot - Refactored Structure

This Discord bot has been refactored for better maintainability, modularity, and organization.

## Project Structure

```
discord-bot/
├── src/
│   ├── config/
│   │   └── environment.js          # Environment configuration and validation
│   ├── services/
│   │   ├── discord.js              # Discord bot client and event handlers
│   │   └── engine.js               # Engine API client and service
│   ├── handlers/
│   │   └── interactions.js         # Discord interaction handlers (slash commands, etc.)
│   ├── middleware/
│   │   └── verification.js         # Discord webhook signature verification
│   ├── server/
│   │   └── app.js                  # Express server setup and configuration
│   ├── translations.js             # Internationalization translations
│   └── utils.js                    # Utility functions (message processing, etc.)
├── index.js                        # Main application entry point
├── package.json
└── Dockerfile
```

## Key Improvements

### 1. **Modular Architecture**

- Separated concerns into logical modules
- Each module has a single responsibility
- Clear boundaries between different parts of the application

### 2. **Configuration Management**

- Centralized environment configuration in `src/config/environment.js`
- Environment validation with clear error messages
- Type-safe configuration access

### 3. **Service Layer**

- `DiscordBot` class encapsulates Discord client logic
- `EngineService` handles all API communications
- Singleton pattern for shared services

### 4. **Error Handling**

- Improved error handling throughout the application
- Graceful shutdown handling with SIGINT/SIGTERM
- Better error messages and logging

### 5. **Server Organization**

- Express server setup separated from main logic
- Middleware properly organized
- Clean route handling

### 6. **Class-based Design**

- Main application logic encapsulated in `BotApplication` class
- Better state management and lifecycle control
- Easier testing and maintenance

## Environment Variables

Required environment variables:

- `DISCORD_LOGIN_TOKEN` - Discord bot token
- `DISCORD_PUBLIC_KEY` - Discord application public key
- `ENGINE_URL` - URL for the engine API

Optional:

- `PORT` - Server port (defaults to 8080)

## Running the Bot

```bash
npm start
```

## Development

```bash
npm run dev
```

## Features

- **Discord Message Handling**: Responds to mentions with AI-powered responses
- **Slash Command Support**: Handles Discord slash commands via webhooks
- **Stock Information**: Displays stock data with rich embeds
- **Multilingual Support**: Supports multiple languages (Korean, English, Japanese, Chinese)
- **Webhook Verification**: Secure Discord webhook signature verification
- **Health Monitoring**: Health check endpoint for monitoring

## Benefits of the Refactor

1. **Maintainability**: Code is easier to read, understand, and modify
2. **Testability**: Modular structure makes unit testing easier
3. **Scalability**: Easy to add new features without affecting existing code
4. **Debugging**: Better error handling and logging for easier troubleshooting
5. **Code Reuse**: Shared functionality is properly extracted and reusable
6. **Type Safety**: Better structure for potential TypeScript migration
