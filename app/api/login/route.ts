import { NextRequest, NextResponse } from 'next/server';
import { createSession, updateSession } from '@/lib/session-manager';
import { initBrowserContext, loginToDarwinbox } from '@/lib/playwright-automation';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Create new session
    const session = await createSession(email);
    console.error(`✓ Session created for ${email}: ${session.sessionId}`);

    // Initialize browser context
    session.browserContext = await initBrowserContext(session.sessionId);
    await updateSession(session.sessionId, { browserContext: session.browserContext });

    // Navigate to Darwinbox and check login status
    const loginResult = await loginToDarwinbox(session);

    if (loginResult.success) {
      // Update session with cookies
      if (loginResult.cookies) {
        await updateSession(session.sessionId, { cookies: loginResult.cookies });
        console.error(`✓ Saved ${loginResult.cookies.length} cookies to session`);
      }
      return NextResponse.json({
        success: true,
        sessionId: session.sessionId,
        message: 'Already logged in',
      });
    } else {
      // Browser opened, waiting for user to login
      return NextResponse.json({
        success: false,
        sessionId: session.sessionId,
        message: loginResult.message,
        action: 'login_required',
      });
    }
  } catch (error) {
    console.error('Login API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize login',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Check login status
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Import here to avoid circular dependency
    const { getSession } = await import('@/lib/session-manager');
    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check login status - browser context must exist to be considered logged in
    // Don't assume logged in just from cookies - browser must be open
    let loginResult;
    let browserOpen = false;
    
    if (session.browserContext) {
      // Browser context exists - check if it's still valid
      try {
        // Try to get pages to verify browser is still open
        const pages = session.browserContext.pages();
        browserOpen = pages.length > 0;
        
        if (browserOpen) {
          // Browser is open - check login status in existing window
          loginResult = await loginToDarwinbox(session);
        } else {
          // Browser context exists but no pages - browser was closed
          loginResult = {
            success: false,
            message: 'Browser window was closed. Please click Login to open browser again.',
          };
        }
      } catch (error) {
        // Browser context is invalid/closed
        browserOpen = false;
        loginResult = {
          success: false,
          message: 'Browser window is not open. Please click Login to open browser.',
        };
      }
    } else {
      // No browser context - not logged in (don't assume from cookies)
      loginResult = {
        success: false,
        message: 'Not logged in. Please click Login to open browser window.',
      };
    }

    // Update session with cookies if login successful
    if (loginResult.success && loginResult.cookies) {
      await updateSession(session.sessionId, { cookies: loginResult.cookies });
      console.error(`✓ Updated session with ${loginResult.cookies.length} cookies`);
    }

    return NextResponse.json({
      loggedIn: loginResult.success,
      browserOpen: browserOpen && loginResult.success,
      message: loginResult.message,
    });
  } catch (error) {
    console.error('Login Status API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check login status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

