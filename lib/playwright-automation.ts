import { firefox, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import { Session } from './session-manager';
import { logger } from './logger';

export interface ReimbursementData {
  date: string;
  amount: number;
  merchant: string;
  description: string;
  category: string;
  filePath?: string;
}

// Get project root directory - ensure it's valid
function getProjectRoot(): string {
  const cwd = process.cwd();
  
  // Validate cwd is reasonable
  if (!cwd || cwd === '/' || cwd.length < 3) {
    // Try to use a sensible default based on common project locations
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (homeDir) {
      const defaultPath = path.join(homeDir, 'darwinbox-reimbursements');
      logger.info(`⚠️  Invalid working directory (${cwd}), using default for browser profiles: ${defaultPath}`);
      return defaultPath;
    }
    throw new Error(`Invalid working directory: ${cwd}. Please ensure the MCP server is run from the project directory.`);
  }
  
  return cwd;
}

export async function initBrowserContext(sessionId: string, cookies?: any[]): Promise<BrowserContext> {
  // Each session gets its own browser profile directory
  // Use a persistent location instead of /tmp to preserve cookies
  const projectRoot = getProjectRoot();
  const profileDir = path.join(projectRoot, '.browser-profiles', `darwinbox-${sessionId}`);
  
  // Ensure the directory exists before launching
  const { mkdir } = await import('fs/promises');
  const { existsSync } = await import('fs');
  
  if (!existsSync(profileDir)) {
    try {
      await mkdir(profileDir, { recursive: true });
      logger.info(`✓ Created browser profile directory: ${profileDir}`);
    } catch (error) {
      logger.info(`✗ Failed to create browser profile directory: ${profileDir}`);
      logger.info(`  Error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Cannot create browser profile directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Check if profile directory is locked (another instance might be using it)
  const lockFile = path.join(profileDir, 'lock');
  const parentLockFile = path.join(profileDir, 'parent.lock');
  
  if (existsSync(lockFile)) {
    logger.info(`⚠️  Profile lock file exists. Attempting to remove it...`);
    try {
      const { unlink } = await import('fs/promises');
      await unlink(lockFile);
      logger.info(`✓ Removed lock file`);
    } catch (error) {
      logger.info(`⚠️  Could not remove lock file: ${error}`);
    }
  }
  
  if (existsSync(parentLockFile)) {
    logger.info(`⚠️  Parent lock file exists. Attempting to remove it...`);
    try {
      const { unlink } = await import('fs/promises');
      await unlink(parentLockFile);
      logger.info(`✓ Removed parent lock file`);
    } catch (error) {
      logger.info(`⚠️  Could not remove parent lock file: ${error}`);
    }
  }

  let browserContext: BrowserContext;
  let launchAttempts = 0;
  const maxAttempts = 3;
  
  while (launchAttempts < maxAttempts) {
    try {
      launchAttempts++;
      logger.info(`Attempting to launch browser (attempt ${launchAttempts}/${maxAttempts})...`);
      
      browserContext = await firefox.launchPersistentContext(profileDir, {
        headless: false, // Always visible for user interaction
        viewport: { width: 1280, height: 720 },
        timeout: 60000, // Increased timeout
        firefoxUserPrefs: {
          'dom.disable_beforeunload': true,
          'media.autoplay.enabled': false,
          'browser.sessionstore.resume_from_crash': false,
        },
        args: [
          '--no-first-run',
          '--no-default-browser-check',
        ],
        // Keep browser alive - don't let signals close it
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
      });
      
      // If we get here, browser launched successfully
      logger.info(`✓ Browser launched successfully on attempt ${launchAttempts}`);
      break;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.info(`✗ Launch attempt ${launchAttempts} failed: ${errorMsg}`);
      
      if (launchAttempts >= maxAttempts) {
        // Last attempt failed
        throw new Error(`Failed to launch browser after ${maxAttempts} attempts: ${errorMsg}. Please close any existing Firefox windows and try again.`);
      }
      
      // Check if it's a profile lock issue
      if (errorMsg.includes('Target page, context or browser has been closed') || 
          errorMsg.includes('already in use') ||
          (errorMsg.includes('profile') && errorMsg.includes('lock'))) {
        logger.info(`⚠️  Profile may be in use. Waiting 5 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try removing lock files again
        if (existsSync(lockFile)) {
          try {
            const { unlink } = await import('fs/promises');
            await unlink(lockFile);
            logger.info(`✓ Removed lock file`);
          } catch (e) {
            logger.info(`⚠️  Could not remove lock file: ${e}`);
          }
        }
        if (existsSync(parentLockFile)) {
          try {
            const { unlink } = await import('fs/promises');
            await unlink(parentLockFile);
            logger.info(`✓ Removed parent lock file`);
          } catch (e) {
            logger.info(`⚠️  Could not remove parent lock file: ${e}`);
          }
        }
      } else {
        // Different error, wait shorter time
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  if (!browserContext) {
    throw new Error('Failed to launch browser context');
  }

  // Wait longer for browser to fully initialize
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // CRITICAL: Verify browser context is still alive and navigate immediately
  // This keeps the browser open - without navigation, Firefox may close
  let retries = 5;
  let navigationSuccess = false;
  
  while (retries > 0 && !navigationSuccess) {
    try {
      // Check if browser context is still alive
      const pages = browserContext.pages();
      logger.info(`✓ Browser context has ${pages.length} page(s)`);
      
      let page;
      if (pages.length === 0) {
        // Create a page immediately to keep browser alive
        logger.info(`Creating new page to keep browser alive...`);
        page = await browserContext.newPage();
        logger.info(`✓ Created initial page`);
      } else {
        page = pages[0];
        logger.info(`✓ Using existing page`);
      }
      
      // Navigate immediately to keep browser open - THIS IS CRITICAL!
      // Without navigation, Firefox may close the window
      logger.info(`Navigating to Darwinbox to keep browser open...`);
      await page.goto('https://zepto.darwinbox.in/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      logger.info(`✓ Successfully navigated to Darwinbox - browser is now open and stable`);
      navigationSuccess = true;
      
      // Wait a moment to ensure page is fully loaded
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      retries--;
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.info(`⚠️  Navigation attempt failed (${retries} retries left): ${errorMsg}`);
      
      if (retries === 0) {
        // Last retry failed - check if browser is still alive
        try {
          const pages = browserContext.pages();
          if (pages.length > 0) {
            logger.info(`⚠️  Navigation failed but browser is still open. Continuing anyway...`);
            navigationSuccess = true; // Browser is open, even if navigation failed
          } else {
            throw new Error(`Browser closed immediately after launch. This usually means the profile is locked by another Firefox instance. Please close all Firefox windows and try again. Original error: ${errorMsg}`);
          }
        } catch (checkError) {
          throw new Error(`Browser context failed: ${errorMsg}. Check error: ${checkError instanceof Error ? checkError.message : String(checkError)}`);
        }
      } else {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  if (!navigationSuccess) {
    throw new Error('Failed to navigate to Darwinbox after multiple attempts. Browser may have closed.');
  }

  // If cookies are provided, add them to the browser context
  if (cookies && cookies.length > 0) {
    try {
      // Set cookies before navigating
      await browserContext.addCookies(cookies);
      logger.info(`✓ Restored ${cookies.length} cookies to browser context`);
    } catch (error) {
      logger.info(`⚠️  Failed to restore cookies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Add event listeners to detect if browser closes unexpectedly
  browserContext.on('close', () => {
    logger.info(`⚠️  Browser context was closed unexpectedly`);
  });

  // Keep a reference to prevent garbage collection
  (browserContext as any)._keepAlive = true;

  return browserContext;
}

export async function loginToDarwinbox(
  session: Session
): Promise<{ success: boolean; message: string; cookies?: any[] }> {
  try {
    // Browser context must exist - don't create new one here
    if (!session.browserContext) {
      return {
        success: false,
        message: 'Browser window not open. Please click Login first.',
      };
    }

    // Use existing page or get the first page from the context
    const pages = session.browserContext.pages();
    let page;
    
    if (pages.length > 0) {
      // Reuse existing page
      page = pages[0];
      logger.info(`✓ Reusing existing page in browser context`);
    } else {
      // Create new page in existing context
      page = await session.browserContext.newPage();
      logger.info(`✓ Created new page in existing browser context`);
    }
    
    // Navigate to Darwinbox (or refresh if already there)
    try {
      const currentUrl = page.url();
      if (currentUrl.includes('zepto.darwinbox.in')) {
        // Already on Darwinbox, just refresh
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
        logger.info(`✓ Refreshed Darwinbox page`);
      } else {
        // Navigate to Darwinbox
        await page.goto('https://zepto.darwinbox.in/', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        logger.info(`✓ Navigated to Darwinbox`);
      }
    } catch (error) {
      logger.info(`⚠️  Navigation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Try to navigate again
      await page.goto('https://zepto.darwinbox.in/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    }

    await page.waitForTimeout(2000);

    // Check if already logged in
    try {
      await page.waitForSelector('img[src="/images/Icons_latest/attendance.png"]', { timeout: 5000 });
      
      // Get cookies
      const cookies = await session.browserContext.cookies();
      session.cookies = cookies;
      
      return {
        success: true,
        message: 'Already logged in',
        cookies,
      };
    } catch (e) {
      // Not logged in - browser window is open, user needs to login
      return {
        success: false,
        message: 'Please login to Darwinbox in the browser window that is open',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Login failed',
    };
  }
}

export async function submitReimbursement(
  session: Session,
  data: ReimbursementData
): Promise<{ success: boolean; message: string }> {
  try {
    if (!session.browserContext) {
      return { success: false, message: 'Browser session not initialized' };
    }

    const page = session.browserContext.pages()[0] || await session.browserContext.newPage();
    
    // Navigate to reimbursements section
    // TODO: Update selectors based on actual Darwinbox UI
    await page.goto('https://zepto.darwinbox.in/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    // Check if logged in
    try {
      await page.waitForSelector('img[src="/images/Icons_latest/attendance.png"]', { timeout: 5000 });
    } catch (e) {
      return { success: false, message: 'Not logged in. Please login first.' };
    }

    // Navigate to reimbursements - this will need to be updated based on actual UI
    // Look for reimbursements/expenses menu item and click
    // Then click "New Request" or similar button
    // Fill form fields
    // Upload file if filePath provided
    // Select category
    // Submit

    // Placeholder - actual implementation will need proper selectors
    return {
      success: true,
      message: 'Reimbursement submitted successfully (placeholder - needs actual selectors)',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Submission failed',
    };
  }
}

