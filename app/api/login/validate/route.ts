import { NextRequest, NextResponse } from 'next/server';
import { getSessionIdFromToken, deleteToken } from '@/lib/session-storage';
import { getSessionFromStorage } from '@/lib/session-manager-redis';

/**
 * Validate a login token
 * Used by the login page to check if token is valid
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Get session ID from token
    const sessionId = await getSessionIdFromToken(token);

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get session to verify it exists
    const session = await getSessionFromStorage(sessionId);

    if (!session) {
      // Token is valid but session doesn't exist - clean up token
      await deleteToken(token);
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if already logged in
    if (session.loginStatus === 'logged_in' && session.cookies.length > 0) {
      return NextResponse.json({
        valid: true,
        sessionId: session.sessionId,
        email: session.email,
        alreadyLoggedIn: true,
        message: 'Already logged in',
      });
    }

    return NextResponse.json({
      valid: true,
      sessionId: session.sessionId,
      email: session.email,
      alreadyLoggedIn: false,
      message: 'Token is valid',
    });

  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to validate token',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

