#!/usr/bin/env node

/**
 * Setup script for MCP Darwinbox login
 * This script opens a browser, lets you login, and saves the session permanently
 * Run this once to set up persistent login for the MCP server
 */

import { firefox } from 'playwright';
import * as path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import readline from 'readline';

const MCP_SESSION_ID = 'mcp-session';
const MCP_SESSIONS_DIR = path.join(process.cwd(), 'saved-sessions', 'mcp');
const MCP_SESSION_FILE = path.join(MCP_SESSIONS_DIR, 'session.json');
const PROFILE_DIR = path.join(process.cwd(), '.browser-profiles', `darwinbox-${MCP_SESSION_ID}`);

// Ensure MCP sessions directory exists
async function ensureMcpSessionsDir() {
  if (!existsSync(MCP_SESSIONS_DIR)) {
    await mkdir(MCP_SESSIONS_DIR, { recursive: true });
  }
}

// Get email from user
function getEmail(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter your Darwinbox email: ', (email) => {
      rl.close();
      resolve(email.trim());
    });
  });
}

async function setupLogin() {
  console.log('🔐 Darwinbox MCP Login Setup');
  console.log('============================\n');

  // Get email
  const email = await getEmail();
  if (!email) {
    console.error('❌ Email is required');
    process.exit(1);
  }

  console.log(`\n📧 Email: ${email}`);
  console.log('🌐 Opening browser for login...\n');

  // Create browser context with persistent profile
  const browserContext = await firefox.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    timeout: 30000,
    firefoxUserPrefs: {
      'dom.disable_beforeunload': true,
      'media.autoplay.enabled': false,
    },
    args: [
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  try {
    // Navigate to Darwinbox
    const page = browserContext.pages()[0] || await browserContext.newPage();
    await page.goto('https://zepto.darwinbox.in/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    console.log('✅ Browser opened');
    console.log('👆 Please login to Darwinbox in the browser window');
    console.log('⏳ Waiting for you to complete login...\n');

    // Wait for user to login - check every 2 seconds
    let loggedIn = false;
    let attempts = 0;
    const maxAttempts = 300; // 10 minutes max wait

    while (!loggedIn && attempts < maxAttempts) {
      await page.waitForTimeout(2000);
      attempts++;

      try {
        // Check if logged in by looking for the attendance icon
        await page.waitForSelector('img[src="/images/Icons_latest/attendance.png"]', { timeout: 1000 });
        loggedIn = true;
        console.log('✅ Login detected!');
      } catch (e) {
        // Not logged in yet, continue waiting
        if (attempts % 30 === 0) {
          // Print status every minute
          console.log(`⏳ Still waiting... (${Math.floor(attempts / 30)} minutes)`);
        }
      }
    }

    if (!loggedIn) {
      console.error('\n❌ Login timeout. Please try again.');
      await browserContext.close();
      process.exit(1);
    }

    // Get cookies
    const cookies = await browserContext.cookies();
    console.log(`✅ Retrieved ${cookies.length} cookies\n`);

    // Save session to disk
    await ensureMcpSessionsDir();
    
    const now = new Date();
    const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    const expiresAt = new Date(now.getTime() + SESSION_DURATION);

    const sessionData = {
      sessionId: MCP_SESSION_ID,
      email: email,
      cookies: cookies,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await writeFile(MCP_SESSION_FILE, JSON.stringify(sessionData, null, 2));
    console.log('💾 Session saved successfully!');
    console.log(`📁 Saved to: ${MCP_SESSION_FILE}`);
    console.log(`⏰ Session expires: ${expiresAt.toLocaleString()}\n`);

    console.log('✅ Setup complete!');
    console.log('🎉 You can now use the MCP server without logging in again.');
    console.log('📝 The browser window will stay open - you can close it when done.\n');

    // Keep browser open for a bit so user can see it worked
    console.log('⏳ Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);

    // Ask if user wants to keep browser open
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('\nClose browser now? (y/n): ', async (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        await browserContext.close();
        console.log('✅ Browser closed');
      } else {
        console.log('🌐 Browser will stay open. Close it manually when done.');
      }
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ Error during setup:', error);
    await browserContext.close();
    process.exit(1);
  }
}

// Run setup
setupLogin().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});






