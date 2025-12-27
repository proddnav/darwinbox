/**
 * Browserless Client
 * Connects to Browserless instance for remote browser automation
 */

export interface BrowserlessConfig {
  url: string; // e.g., http://localhost:3000
  token?: string;
}

/**
 * Get Browserless WebSocket URL for connecting via Playwright
 */
export function getBrowserlessWSEndpoint(config: BrowserlessConfig): string {
  const { url, token } = config;
  
  // Remove trailing slash
  const baseUrl = url.replace(/\/$/, '');
  
  // Browserless WebSocket endpoint
  let wsUrl = `${baseUrl}/chrome`;
  
  if (token) {
    wsUrl += `?token=${token}`;
  }
  
  return wsUrl;
}

/**
 * Connect to Browserless via CDP (Chrome DevTools Protocol)
 * This returns a WebSocket URL that Playwright can connect to
 */
export async function connectToBrowserless(config: BrowserlessConfig): Promise<string> {
  const wsUrl = getBrowserlessWSEndpoint(config);
  
  // For now, just return the WebSocket URL
  // Playwright will connect to it directly
  return wsUrl;
}

/**
 * Get Browserless configuration from environment variables
 */
export function getBrowserlessConfig(): BrowserlessConfig {
  const url = process.env.BROWSERLESS_URL || 'http://localhost:3000';
  const token = process.env.BROWSERLESS_TOKEN;
  
  return {
    url,
    token,
  };
}

