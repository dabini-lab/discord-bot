// ==========================================================
// FIREBASE CONFIGURATION
// ==========================================================
import admin from "firebase-admin";

let app = null;
let remoteConfigCache = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Default config values
const defaultConfig = {
  ACTIVATION_URL: "https://dabinilab.com/activation",
};

// Initialize Firebase Admin SDK
export function initializeFirebase() {
  try {
    // Get project ID from environment or use application default credentials
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GCP_PROJECT ||
      process.env.GCLOUD_PROJECT;

    const config = {
      credential: admin.credential.applicationDefault(),
    };

    if (projectId) {
      config.projectId = projectId;
    }

    app = admin.initializeApp(config);
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    throw error;
  }
}

// Get Remote Config server template with caching
async function getRemoteConfigTemplate() {
  const now = Date.now();

  // Return cached template if still valid
  if (remoteConfigCache && now - lastFetchTime < CACHE_DURATION_MS) {
    return remoteConfigCache;
  }

  // Fetch fresh server template
  try {
    const rc = admin.remoteConfig();
    const template = await rc.getServerTemplate({
      defaultConfig: defaultConfig,
    });

    remoteConfigCache = template.evaluate();
    lastFetchTime = now;

    return remoteConfigCache;
  } catch (error) {
    console.error(
      "Error fetching Remote Config server template:",
      error.message || error
    );
    throw error;
  }
}

// Get a Remote Config parameter value
export async function getRemoteConfigValue(key, defaultValue = "") {
  try {
    if (!app) {
      console.warn("Firebase not initialized, using default value");
      return defaultValue;
    }

    const config = await getRemoteConfigTemplate();

    // Try to get the value from the evaluated template
    const value = config.getString(key);

    if (!value) {
      console.warn(
        `Remote Config parameter "${key}" not found, using default value`
      );
      return defaultValue;
    }

    return value;
  } catch (error) {
    console.error(
      `Error fetching Remote Config value for "${key}":`,
      error.message || error
    );
    return defaultValue;
  }
}

// Force refresh the Remote Config cache
export async function refreshRemoteConfig() {
  try {
    const rc = admin.remoteConfig();
    const template = await rc.getServerTemplate({
      defaultConfig: defaultConfig,
    });

    remoteConfigCache = template.evaluate();
    lastFetchTime = Date.now();
  } catch (error) {
    console.error("Error refreshing Remote Config:", error.message || error);
  }
}
