// ==========================================================
// ENVIRONMENT CONFIGURATION
// ==========================================================
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export const config = {
  discord: {
    loginToken: process.env.DISCORD_LOGIN_TOKEN,
    publicKey: process.env.DISCORD_PUBLIC_KEY,
  },
  engine: {
    url: process.env.ENGINE_URL,
  },
  server: {
    port: process.env.PORT || 8080,
  },
};

// Validate required environment variables
export function validateEnvironment() {
  const required = ["DISCORD_LOGIN_TOKEN", "DISCORD_PUBLIC_KEY", "ENGINE_URL"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}
