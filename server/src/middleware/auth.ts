import type { FastifyRequest, FastifyReply } from 'fastify';
import { getSessionUser } from '../lib/sessions.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; email: string; emailVerified: boolean };
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies['sid'];
  if (!token) return reply.code(401).send({ error: 'unauthorized' });

  const user = await getSessionUser(token);
  if (!user) return reply.code(401).send({ error: 'unauthorized' });

  req.user = user;
}