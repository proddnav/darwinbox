import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/session-manager-redis';
import { saveLoginToken } from '@/lib/session-storage';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Initialize login flow for Telegram bot
 * Creates a session and generates a secure login token
 */
export async function POST(request: NextRequest) {
  try {
    const { telegramChatId, email } = await request.json();

    if (!telegramChatId || !email) {
      return NextResponse.json(
        { error: 'telegramChatId and email are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Create session
    const session = await createSession(email, telegramChatId);

    // Generate secure login token
    const loginToken = crypto.randomBytes(32).toString('hex');

    // Save token with 15 minute expiry
    await saveLoginToken(loginToken, session.sessionId, 900); // 15 minutes

    // Get base URL from environment or request
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                    request.headers.get('origin') || 'http://localhost:3000';

    const loginUrl = `${baseUrl}/login/${loginToken}`;

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      loginToken,
      loginUrl,
      message: 'Login URL generated successfully',
    });

  } catch (error) {
    console.error('Init login error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize login',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

