import { getRedisClient } from './redis-client';

export interface SessionData {
  sessionId: string;
  email: string;
  cookies: any[];
  createdAt: string;
  expiresAt: string;
  telegramChatId?: string;
  browserlessSessionId?: string;
  loginStatus?: 'pending' | 'logged_in' | 'expired';
}

const SESSION_PREFIX = 'session:';
const TOKEN_PREFIX = 'token:';
const TELEGRAM_PREFIX = 'telegram:';

export async function saveSession(session: SessionData): Promise<void> {
  const redis = getRedisClient();
  const key = `${SESSION_PREFIX}${session.sessionId}`;
  
  const data = JSON.stringify(session);
  const ttl = Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000);
  
  if (ttl > 0) {
    await redis.setex(key, ttl, data);
  } else {
    await redis.set(key, data);
  }

  // Also store telegram mapping if provided
  if (session.telegramChatId) {
    const telegramKey = `${TELEGRAM_PREFIX}${session.telegramChatId}`;
    await redis.setex(telegramKey, ttl, session.sessionId);
  }
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  const redis = getRedisClient();
  const key = `${SESSION_PREFIX}${sessionId}`;
  
  const data = await redis.get(key);
  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as SessionData;
  } catch (error) {
    console.error('Error parsing session data:', error);
    return null;
  }
}

export async function getSessionByTelegramChatId(telegramChatId: string): Promise<SessionData | null> {
  const redis = getRedisClient();
  const telegramKey = `${TELEGRAM_PREFIX}${telegramChatId}`;
  
  const sessionId = await redis.get(telegramKey);
  if (!sessionId) {
    return null;
  }

  return getSession(sessionId);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  const key = `${SESSION_PREFIX}${sessionId}`;
  
  // Get session first to clean up telegram mapping
  const session = await getSession(sessionId);
  if (session?.telegramChatId) {
    const telegramKey = `${TELEGRAM_PREFIX}${session.telegramChatId}`;
    await redis.del(telegramKey);
  }

  await redis.del(key);
}

export async function updateSession(sessionId: string, updates: Partial<SessionData>): Promise<boolean> {
  const existing = await getSession(sessionId);
  if (!existing) {
    return false;
  }

  const updated = { ...existing, ...updates };
  await saveSession(updated);
  return true;
}

// Token management
export async function saveLoginToken(token: string, sessionId: string, expiresInSeconds: number = 900): Promise<void> {
  const redis = getRedisClient();
  const key = `${TOKEN_PREFIX}${token}`;
  await redis.setex(key, expiresInSeconds, sessionId);
}

export async function getSessionIdFromToken(token: string): Promise<string | null> {
  const redis = getRedisClient();
  const key = `${TOKEN_PREFIX}${token}`;
  return await redis.get(key);
}

export async function deleteToken(token: string): Promise<void> {
  const redis = getRedisClient();
  const key = `${TOKEN_PREFIX}${token}`;
  await redis.del(key);
}
