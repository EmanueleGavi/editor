import crypto from 'node:crypto';
import { eq, and, gt } from 'drizzle-orm';
import { db, tables } from '../db/index.js';
import { env } from '../env.js';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export async function createSession(userId: string, ip?: string, ua?: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const id = sha256(token);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 86400_000);

  await db.insert(tables.sessions).values({ id, userId, expiresAt, ip, userAgent: ua });
  return { token, expiresAt };
}

export async function getSessionUser(token: string) {
  const id = sha256(token);
  const rows = await db
    .select({
      userId: tables.users.id,
      email: tables.users.email,
      emailVerifiedAt: tables.users.emailVerifiedAt,
      disabledAt: tables.users.disabledAt,
    })
    .from(tables.sessions)
    .innerJoin(tables.users, eq(tables.users.id, tables.sessions.userId))
    .where(and(eq(tables.sessions.id, id), gt(tables.sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row || row.disabledAt) return null;
  return { id: row.userId, email: row.email, emailVerified: !!row.emailVerifiedAt };
}

export async function revokeSession(token: string) {
  const id = sha256(token);
  await db.delete(tables.sessions).where(eq(tables.sessions.id, id));
}

export async function revokeAllUserSessions(userId: string) {
  await db.delete(tables.sessions).where(eq(tables.sessions.userId, userId));
}