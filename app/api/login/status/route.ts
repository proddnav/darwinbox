import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromStorage, getSessionByTelegram } from '@/lib/session-manager-redis';

/**
 * Check login status for a session
 * Used by n8n to poll for login completion
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');
    const telegramChatId = searchParams.get('telegramChatId');

    if (!sessionId && !telegramChatId) {
      return NextResponse.json(
        { error: 'sessionId or telegramChatId is required' },
        { status: 400 }
      );
    }

    let session;
    if (sessionId) {
      session = await getSessionFromStorage(sessionId);
    } else if (telegramChatId) {
      session = await getSessionByTelegram(telegramChatId);
    }

    if (!session) {
      return NextResponse.json(
        { 
          loggedIn: false,
          message: 'Session not found',
        },
        { status: 404 }
      );
    }

    // Check if logged in (has cookies and login status is logged_in)
    const loggedIn = session.cookies.length > 0 && session.loginStatus === 'logged_in';

    return NextResponse.json({
      loggedIn,
      sessionId: session.sessionId,
      email: session.email,
      cookiesCount: session.cookies?.length || 0,
      loginStatus: session.loginStatus || 'pending',
      message: loggedIn 
        ? 'User is logged in' 
        : 'Waiting for user to login',
    });

  } catch (error) {
    console.error('Login status error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check login status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}




