import { v4 as uuidv4 } from 'uuid';
import { 
  saveSession, 
  getSession, 
  getSessionByTelegramChatId,
  deleteSession, 
  updateSession,
  SessionData 
} from './session-storage';

export interface Session {
  sessionId: string;
  email: string;
  browserContext: any; // Can't serialize BrowserContext, store separately
  cookies: any[];
  createdAt: Date;
  expiresAt: Date;
  telegramChatId?: string;
  browserlessSessionId?: string;
  loginStatus?: 'pending' | 'logged_in' | 'expired';
}

// Store browser contexts in memory (can't serialize)
// In production, use Browserless which manages contexts remotely
const browserContexts = new Map<string, any>();

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function createSession(email: string, telegramChatId?: string): Promise<Session> {
  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION);

  const sessionData: SessionData = {
    sessionId,
    email,
    cookies: [],
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    telegramChatId,
    loginStatus: 'pending',
  };

  await saveSession(sessionData);

  const session: Session = {
    sessionId,
    email,
    browserContext: null,
    cookies: [],
    createdAt: now,
    expiresAt,
    telegramChatId,
    loginStatus: 'pending',
  };

  return session;
}

export async function getSessionFromStorage(sessionId: string): Promise<Session | null> {
  const sessionData = await getSession(sessionId);
  
  if (!sessionData) {
    return null;
  }

  // Check if expired
  if (new Date() > new Date(sessionData.expiresAt)) {
    await deleteSession(sessionId);
    if (browserContexts.has(sessionId)) {
      browserContexts.delete(sessionId);
    }
    return null;
  }

  const session: Session = {
    sessionId: sessionData.sessionId,
    email: sessionData.email,
    browserContext: browserContexts.get(sessionId) || null,
    cookies: sessionData.cookies || [],
    createdAt: new Date(sessionData.createdAt),
    expiresAt: new Date(sessionData.expiresAt),
    telegramChatId: sessionData.telegramChatId,
    browserlessSessionId: sessionData.browserlessSessionId,
    loginStatus: sessionData.loginStatus,
  };

  return session;
}

export async function getSessionByTelegram(telegramChatId: string): Promise<Session | null> {
  const sessionData = await getSessionByTelegramChatId(telegramChatId);
  
  if (!sessionData) {
    return null;
  }

  return getSessionFromStorage(sessionData.sessionId);
}

export async function updateSessionStorage(sessionId: string, updates: Partial<SessionData>): Promise<boolean> {
  return await updateSession(sessionId, updates);
}

export async function saveSessionStorage(session: Session): Promise<void> {
  const sessionData: SessionData = {
    sessionId: session.sessionId,
    email: session.email,
    cookies: session.cookies || [],
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    telegramChatId: session.telegramChatId,
    browserlessSessionId: session.browserlessSessionId,
    loginStatus: session.loginStatus || 'pending',
  };

  await saveSession(sessionData);

  // Store browser context separately in memory (or use Browserless)
  if (session.browserContext) {
    browserContexts.set(session.sessionId, session.browserContext);
  }
}

export async function deleteSessionStorage(sessionId: string): Promise<void> {
  await deleteSession(sessionId);
  if (browserContexts.has(sessionId)) {
    const context = browserContexts.get(sessionId);
    if (context && typeof context.close === 'function') {
      context.close().catch(console.error);
    }
    browserContexts.delete(sessionId);
  }
}

// For backward compatibility with existing code
export const createSessionSync = createSession;
export const getSessionSync = getSessionFromStorage;
export const updateSessionSync = updateSessionStorage;
export const deleteSessionSync = deleteSessionStorage;




