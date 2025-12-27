/**
 * Logger utility for MCP server
 * Ensures all logging goes to stderr and doesn't interfere with JSON-RPC on stdout
 * CRITICAL: MCP servers use stdout for JSON-RPC, so ALL output must go to stderr
 */

// Write to stderr to avoid interfering with JSON-RPC on stdout
const stderr = process.stderr;

// Helper to safely stringify values
function safeStringify(value: any): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }
  return String(value);
}

export const logger = {
  error: (...args: any[]) => {
    const message = args.map(safeStringify).join(' ');
    stderr.write(`[ERROR] ${message}\n`);
  },
  warn: (...args: any[]) => {
    const message = args.map(safeStringify).join(' ');
    stderr.write(`[WARN] ${message}\n`);
  },
  info: (...args: any[]) => {
    const message = args.map(safeStringify).join(' ');
    stderr.write(`[INFO] ${message}\n`);
  },
  debug: (...args: any[]) => {
    if (process.env.DEBUG) {
      const message = args.map(safeStringify).join(' ');
      stderr.write(`[DEBUG] ${message}\n`);
    }
  },
};

