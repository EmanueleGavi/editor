import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, tables } from '../db/index.js';
import { hashPassword, verifyPassword, DUMMY_HASH } from '../lib/password.js';
import { createSession, revokeSession, revokeAllUserSessions } from '../lib/sessions.js';
import { env } from '../env.js';
import { requireAuth } from '../middleware/auth.js';

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(200),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const cookieOpts = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: env.SESSION_TTL_DAYS * 86400,
};

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });
    const { email, password } = parsed.data;
    const normalized = email.trim().toLowerCase();

    const existing = await db.select().from(tables.users)
      .where(eq(tables.users.email, normalized)).limit(1);
    if (existing[0]) return reply.code(409).send({ error: 'email_taken' });

    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(tables.users)
      .values({ email: normalized, passwordHash })
      .returning({ id: tables.users.id, email: tables.users.email });

    // TODO: invia email di verifica
    // await sendVerificationEmail(user.id, user.email);

    const { token } = await createSession(user.id, req.ip, req.headers['user-agent']);
    reply.setCookie('sid', token, cookieOpts);
    return { user };
  });

  app.post('/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });
    const { email, password } = parsed.data;
    const normalized = email.trim().toLowerCase();

    const rows = await db.select().from(tables.users)
      .where(eq(tables.users.email, normalized)).limit(1);
    const user = rows[0];

    const hash = user?.passwordHash ?? DUMMY_HASH;
    const ok = await verifyPassword(hash, password);
    if (!user || !ok || user.disabledAt) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    const { token } = await createSession(user.id, req.ip, req.headers['user-agent']);
    reply.setCookie('sid', token, cookieOpts);
    return { user: { id: user.id, email: user.email } };
  });

  app.post('/auth/logout', async (req, reply) => {
    const token = req.cookies['sid'];
    if (token) await revokeSession(token);
    reply.clearCookie('sid', { path: '/' });
    return { ok: true };
  });

  app.post('/auth/logout-all', { preHandler: requireAuth }, async (req) => {
    await revokeAllUserSessions(req.user!.id);
    return { ok: true };
  });

  app.get('/auth/session', async (req, reply) => {
    const token = req.cookies['sid'];
    if (!token) return reply.code(401).send({ error: 'unauthorized' });
    const { getSessionUser } = await import('../lib/sessions.js');
    const user = await getSessionUser(token);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return { user };
  });
}