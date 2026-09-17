import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { db, tables } from '../db/index.js';
import { PLANS, isActivePlan, type Plan } from '../lib/plans.js';

export async function getActivePlan(userId: string): Promise<Plan> {
  const rows = await db
    .select()
    .from(tables.subscriptions)
    .where(eq(tables.subscriptions.userId, userId))
    .orderBy(desc(tables.subscriptions.updatedAt))
    .limit(1);

  const sub = rows[0];
  if (!sub || !isActivePlan(sub.status)) return 'free';
  return (sub.plan as Plan) ?? 'free';
}

export function requireFeature(feature: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) return reply.code(401).send({ error: 'unauthorized' });
    const plan = await getActivePlan(req.user.id);
    if (!(PLANS[plan].features as readonly string[]).includes(feature)) {
      return reply.code(403).send({ error: 'feature_not_in_plan', feature, plan });
    }
  };
}