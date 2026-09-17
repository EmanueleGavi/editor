import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, tables } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getActivePlan } from '../middleware/entitlements.js';
import { PLANS } from '../lib/plans.js';

export async function meRoutes(app: FastifyInstance) {
  app.get('/api/me', { preHandler: requireAuth }, async (req) => {
    const plan = await getActivePlan(req.user!.id);

    const rows = await db.select().from(tables.subscriptions)
      .where(eq(tables.subscriptions.userId, req.user!.id)).limit(1);
    const sub = rows[0];

    return {
      user: req.user,
      plan,
      features: PLANS[plan].features,
      limits: PLANS[plan].limits,
      subscription: sub ? {
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      } : null,
    };
  });
}