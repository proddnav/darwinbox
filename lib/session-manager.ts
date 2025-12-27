import { BrowserContext } from 'playwright';
import { v4 as uuidv4 } from 'uuid';

export interface Session {
  sessionId: string;
  email: string;
  browserContext: BrowserContext | null;
  cookies: any[];
  createdAt: Date;
  expiresAt: Date;
}

// In-memory session storage
// In production, use Redis (Upstash Redis on Vercel)
const sessions = new Map<string, Session>();

// Session expiry: 24 hours
const SESSION_DURATION = 24 * 60 * 60 * 1000;

export function createSession(email: string): Session {
  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION);

  const session: Session = {
    sessionId,
    email,
    browserContext: null,
    cookies: [],
    createdAt: now,
    expiresAt,
  };

  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): Session | undefined {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return undefined;
  }

  // Check if expired
  if (new Date() > session.expiresAt) {
    // Cleanup
    if (session.browserContext) {
      session.browserContext.close().catch(console.error);
    }
    sessions.delete(sessionId);
    return undefined;
  }

  return session;
}

export function updateSession(sessionId: string, updates: Partial<Session>): boolean {
  const session = sessions.get(sessionId);
  if (!session) {
    return false;
  }

  Object.assign(session, updates);
  return true;
}

export function deleteSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session?.browserContext) {
    session.browserContext.close().catch(console.error);
  }
  sessions.delete(sessionId);
}

// Cleanup expired sessions periodically
setInterval(() => {
  const now = new Date();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      deleteSession(sessionId);
    }
  }
}, 60 * 60 * 1000); // Run every hour

