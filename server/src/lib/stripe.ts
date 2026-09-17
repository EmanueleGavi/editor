import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db, tables } from '../db/index.js';
import { env } from '../env.js';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

export async function getOrCreateCustomer(userId: string, email: string) {
  const existing = await db
    .select()
    .from(tables.subscriptions)
    .where(eq(tables.subscriptions.userId, userId))
    .limit(1);
  if (existing[0]?.stripeCustomerId) return existing[0].stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  await db.insert(tables.subscriptions).values({
    userId,
    stripeCustomerId: customer.id,
    plan: 'free',
    status: 'active',
  });

  return customer.id;
}

export function priceIdToPlan(priceId: string): 'pro' | 'team' | null {
  if (priceId === env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === env.STRIPE_PRICE_TEAM) return 'team';
  return null;
}