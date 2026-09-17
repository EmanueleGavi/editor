import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, tables } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { stripe, getOrCreateCustomer, priceIdToPlan } from '../lib/stripe.js';
import { env } from '../env.js';

export async function billingRoutes(app: FastifyInstance) {
  // Webhook: registra con body raw (necessario per la firma Stripe)
  app.register(async (instance) => {
    instance.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_req, body, done) => done(null, body)
    );

    instance.post('/billing/webhook', async (req, reply) => {
      const sig = req.headers['stripe-signature'] as string;
      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig, env.STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        app.log.error({ err }, 'stripe webhook bad signature');
        return reply.code(400).send('bad signature');
      }

      // Idempotenza
      const already = await db.select().from(tables.stripeEvents)
        .where(eq(tables.stripeEvents.id, event.id)).limit(1);
      if (already[0]) return { ok: true };

      await db.insert(tables.stripeEvents).values({ id: event.id, type: event.type });

      switch (event.type) {
        case 'checkout.session.completed':
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const sub = event.data.object as any;
          await syncSubscription(sub);
          break;
        }
      }
      return { ok: true };
    });
  });

  // Checkout
  app.post('/billing/checkout', { preHandler: requireAuth }, async (req, reply) => {
    const { priceId } = req.body as { priceId?: string };
    if (!priceId) return reply.code(400).send({ error: 'missing_price_id' });

    const plan = priceIdToPlan(priceId);
    if (!plan) return reply.code(400).send({ error: 'invalid_price_id' });

    const customerId = await getOrCreateCustomer(req.user!.id, req.user!.email);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.APP_URL}/billing/success`,
      cancel_url: `${env.APP_URL}/pricing`,
      client_reference_id: req.user!.id,
      allow_promotion_codes: true,
    });
    return { url: session.url };
  });

  // Customer portal
  app.post('/billing/portal', { preHandler: requireAuth }, async (req) => {
    const rows = await db.select().from(tables.subscriptions)
      .where(eq(tables.subscriptions.userId, req.user!.id)).limit(1);
    const customerId = rows[0]?.stripeCustomerId;
    if (!customerId) return { url: null };
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.APP_URL}/account`,
    });
    return { url: session.url };
  });
}

async function syncSubscription(sub: any) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const priceId = sub.items?.data?.[0]?.price?.id;
  const plan = priceId ? priceIdToPlan(priceId) : null;

  const rows = await db.select().from(tables.subscriptions)
    .where(eq(tables.subscriptions.stripeCustomerId, customerId)).limit(1);

  const patch = {
    stripeSubscriptionId: sub.id,
    plan: plan ?? rows[0]?.plan ?? 'free',
    status: sub.status,
    currentPeriodEnd: sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    updatedAt: new Date(),
  };

  if (rows[0]) {
    await db.update(tables.subscriptions).set(patch)
      .where(eq(tables.subscriptions.id, rows[0].id));
  }
}