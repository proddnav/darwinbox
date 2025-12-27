import { BrowserContext } from 'playwright';
import { Session } from './session-manager';
import { initBrowserContext, loginToDarwinbox } from './playwright-automation';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { logger } from './logger';

const MCP_SESSION_ID = 'mcp-session';

// Get the project root directory - ensure it's valid
function getProjectRoot(): string {
  const cwd = process.cwd();
  
  // Validate cwd is reasonable
  if (!cwd || cwd === '/' || cwd.length < 3) {
    // Try to use a sensible default based on common project locations
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (homeDir) {
      const defaultPath = path.join(homeDir, 'darwinbox-reimbursements');
      // Use process.stderr directly to avoid circular dependency issues during module load
      process.stderr.write(`[WARN] Invalid working directory (${cwd}), using default: ${defaultPath}\n`);
      return defaultPath;
    }
    throw new Error(`Invalid working directory: ${cwd}. Please ensure the MCP server is run from the project directory.`);
  }
  
  return cwd;
}

const PROJECT_ROOT = getProjectRoot();
const MCP_SESSIONS_DIR = path.join(PROJECT_ROOT, 'saved-sessions', 'mcp');
const MCP_SESSION_FILE = path.join(MCP_SESSIONS_DIR, 'session.json');

// Ensure MCP sessions directory exists
async function ensureMcpSessionsDir() {
  if (!existsSync(MCP_SESSIONS_DIR)) {
    try {
      // Use absolute path to ensure we're creating in the right place
      const absoluteSessionsDir = path.isAbsolute(MCP_SESSIONS_DIR) 
        ? MCP_SESSIONS_DIR 
        : path.resolve(PROJECT_ROOT, MCP_SESSIONS_DIR);
      
      // Ensure parent directory exists first
      const parentDir = path.dirname(absoluteSessionsDir);
      if (!existsSync(parentDir)) {
        await mkdir(parentDir, { recursive: true });
      }
      await mkdir(absoluteSessionsDir, { recursive: true });
      logger.info(`✓ Created MCP sessions directory: ${absoluteSessionsDir}`);
    } catch (error) {
      logger.info(`✗ Failed to create MCP sessions directory: ${MCP_SESSIONS_DIR}`);
      logger.info(`  Error: ${error instanceof Error ? error.message : String(error)}`);
      logger.info(`  Project root: ${PROJECT_ROOT}`);
      logger.info(`  Current working directory: ${process.cwd()}`);
      // Don't throw - try to continue with in-memory session
      logger.info(`  Continuing with in-memory session only...`);
    }
  }
}

/**
 * Load MCP session from disk
 */
export async function loadMcpSession(): Promise<Session | null> {
  try {
    await ensureMcpSessionsDir();
  } catch (error) {
    logger.info(`Failed to ensure sessions directory exists: ${error}`);
    // Continue anyway - might be able to read existing session
  }
  
  if (!existsSync(MCP_SESSION_FILE)) {
    return null;
  }
  
  try {
    const fileContent = await readFile(MCP_SESSION_FILE, 'utf-8');
    const sessionData = JSON.parse(fileContent);
    
    // Reconstruct session object
    const session: Session = {
      sessionId: sessionData.sessionId || MCP_SESSION_ID,
      email: sessionData.email,
      browserContext: null, // Will be recreated when needed
      cookies: sessionData.cookies || [],
      createdAt: new Date(sessionData.createdAt),
      expiresAt: new Date(sessionData.expiresAt),
    };
    
    // Check if expired
    if (new Date() > session.expiresAt) {
      // Delete expired session
      await deleteMcpSession();
      return null;
    }
    
    logger.info(`✓ MCP session loaded from disk: ${session.email}`);
    return session;
  } catch (error) {
    logger.info(`✗ Failed to load MCP session from disk: ${error}`);
    return null;
  }
}

/**
 * Save MCP session to disk
 */
export async function saveMcpSession(session: Session): Promise<void> {
  try {
    await ensureMcpSessionsDir();
  } catch (error) {
    logger.info(`Failed to ensure sessions directory exists: ${error}`);
    throw new Error(`Cannot save session: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Convert session to JSON-serializable format
  const sessionData = {
    sessionId: session.sessionId,
    email: session.email,
    cookies: session.cookies,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    // Note: browserContext cannot be serialized, so we don't save it
  };
  
  await writeFile(MCP_SESSION_FILE, JSON.stringify(sessionData, null, 2));
  logger.info(`✓ MCP session saved to disk: ${session.email}`);
}

/**
 * Delete MCP session from disk
 */
export async function deleteMcpSession(): Promise<void> {
  if (existsSync(MCP_SESSION_FILE)) {
    const { unlink } = await import('fs/promises');
    await unlink(MCP_SESSION_FILE).catch(() => {});
    logger.info(`✓ MCP session deleted from disk`);
  }
}

/**
 * Get or create MCP session with browser context
 * IMPORTANT: Reuses existing browser context if valid to avoid opening new windows
 */
export async function getOrCreateMcpSession(email: string): Promise<Session> {
  // Try to load existing session
  let session = await loadMcpSession();
  
  // If session exists but email doesn't match, delete old session and create new one
  if (session && session.email !== email) {
    logger.info(`⚠️  Existing session found for different email (${session.email}). Deleting and creating new session for ${email}.`);
    await deleteMcpSession();
    session = null;
  }
  
  if (session && session.email === email) {
    // IMPORTANT: Check if browser context is still valid BEFORE trying to recreate
    // This prevents opening new windows when the existing one is still working
    // Session exists - FIRST check if browser context is still valid
    // Only recreate if absolutely necessary to avoid opening new windows
    if (session.browserContext) {
      let contextValid = false;
      try {
        // Check if context itself is accessible
        const pages = session.browserContext.pages();
        if (pages.length > 0) {
          // Try to access a page to verify it's really alive
          try {
            const page = pages[0];
            // Try to get URL - if this works, context is alive
            const testUrl = page.url();
            // Try a simple operation to verify page is responsive (with timeout)
            await Promise.race([
              page.evaluate(() => document.readyState),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
            ]);
            contextValid = true;
            logger.info('✓ Reusing existing browser context (verified alive and responsive)');
            return session; // Return immediately - don't recreate!
          } catch (e) {
            // Page is not accessible, context is dead
            contextValid = false;
            logger.warn(`Browser context pages exist but are not accessible: ${e instanceof Error ? e.message : String(e)}`);
          }
        } else {
          contextValid = false;
          logger.warn('Browser was closed (no pages), will recreate browser context');
        }
      } catch (error) {
        // Browser context is invalid
        contextValid = false;
        logger.warn(`Browser context invalid (${error}), will recreate...`);
      }
      
      if (!contextValid) {
        // Clear the invalid context reference first
        const oldContext = session.browserContext;
        session.browserContext = null;
        
        // Try to close the old context gracefully
        try {
          if (oldContext) {
            await oldContext.close().catch(() => {
              // Ignore errors closing old context
            });
          }
        } catch (e) {
          // Ignore
        }
        
        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Only create new context if we don't have a valid one
    if (!session.browserContext) {
      logger.info('Creating new browser context...');
      session.browserContext = await initBrowserContext(
        MCP_SESSION_ID,
        session.cookies
      );
    }
    
    return session;
  }
  
  // Create new session
  const now = new Date();
  const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  const expiresAt = new Date(now.getTime() + SESSION_DURATION);
  
  session = {
    sessionId: MCP_SESSION_ID,
    email,
    browserContext: null,
    cookies: [],
    createdAt: now,
    expiresAt,
  };
  
  // Initialize browser context
  session.browserContext = await initBrowserContext(MCP_SESSION_ID);
  
  // Save to disk
  await saveMcpSession(session);
  
  return session;
}

/**
 * Check if MCP session is logged in
 * IMPORTANT: If browserContext is null (loaded from disk), tries to recreate it first
 */
export async function checkMcpLoginStatus(session: Session): Promise<{ success: boolean; message: string }> {
  // If browser context is null, try to recreate it first (browser might already be open)
  if (!session.browserContext) {
    // Try to get or create session which will recreate browser context
    const recreatedSession = await getOrCreateMcpSession(session.email);
    if (recreatedSession.browserContext) {
      // Update session with recreated context
      session.browserContext = recreatedSession.browserContext;
    } else {
      return {
        success: false,
        message: 'Browser context not initialized. Please login first.',
      };
    }
  }
  
  // Check if browser context is still valid
  try {
    const pages = session.browserContext.pages();
    if (pages.length === 0) {
      // No pages - try to recreate context
      const recreatedSession = await getOrCreateMcpSession(session.email);
      if (recreatedSession.browserContext) {
        session.browserContext = recreatedSession.browserContext;
      } else {
        return {
          success: false,
          message: 'Browser window was closed. Please login again.',
        };
      }
    }
  } catch (error) {
    // Context is invalid - try to recreate
    const recreatedSession = await getOrCreateMcpSession(session.email);
    if (recreatedSession.browserContext) {
      session.browserContext = recreatedSession.browserContext;
    } else {
      return {
        success: false,
        message: 'Browser context is invalid. Please login again.',
      };
    }
  }
  
  // Check login status
  const loginResult = await loginToDarwinbox(session);
  
  if (loginResult.success && loginResult.cookies) {
    // Update session with latest cookies
    session.cookies = loginResult.cookies;
    await saveMcpSession(session);
  }
  
  return {
    success: loginResult.success,
    message: loginResult.message,
  };
}

/**
 * Login to Darwinbox for MCP (with persistence)
 */
export async function loginMcpToDarwinbox(email: string): Promise<{ success: boolean; message: string; sessionId: string }> {
  try {
    // Get or create session
    const session = await getOrCreateMcpSession(email);
    
    // Check if already logged in
    const loginStatus = await checkMcpLoginStatus(session);
    
    if (loginStatus.success) {
      return {
        success: true,
        message: 'Already logged in',
        sessionId: session.sessionId,
      };
    }
    
    // Attempt login
    const loginResult = await loginToDarwinbox(session);
    
    if (loginResult.success) {
      // Update session with cookies
      if (loginResult.cookies) {
        session.cookies = loginResult.cookies;
        await saveMcpSession(session);
      }
      
      return {
        success: true,
        message: 'Login successful',
        sessionId: session.sessionId,
      };
    } else {
      // Browser is open, waiting for user to login
      return {
        success: false,
        message: loginResult.message || 'Please login to Darwinbox in the browser window',
        sessionId: session.sessionId,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Login failed',
      sessionId: MCP_SESSION_ID,
    };
  }
}

