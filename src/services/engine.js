// ==========================================================
// ENGINE API CLIENT
// ==========================================================
import { GoogleAuth } from "google-auth-library";
import { config } from "../config/environment.js";

class EngineService {
  constructor() {
    this.auth = new GoogleAuth();
    this.client = null;
  }

  async initialize() {
    try {
      this.client = await this.auth.getIdTokenClient(config.engine.url);
      console.log("Engine client initialized successfully");
    } catch (error) {
      console.error("Failed to initialize engine client:", error);
      throw error;
    }
  }

  async makeRequest(endpoint, method = "GET", data = null) {
    if (!this.client) {
      throw new Error("Engine client not initialized");
    }

    try {
      const response = await this.client.request({
        url: `${config.engine.url}${endpoint}`,
        method,
        data,
      });

      return response;
    } catch (error) {
      console.error(
        `Engine API request failed (${method} ${endpoint}):`,
        error
      );
      throw error;
    }
  }
}

// Export singleton instance
export const engineService = new EngineService();

// Convenience function for making requests
export async function makeEngineRequest(endpoint, method = "GET", data = null) {
  return engineService.makeRequest(endpoint, method, data);
}

// Initialize the engine service
export async function initializeEngine() {
  return engineService.initialize();
}
