import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './env.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { billingRoutes } from './routes/billing.js';

const app = Fastify({ logger: true });

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, {
  origin: env.APP_URL,
  credentials: true,
});
await app.register(cookie, { secret: env.SESSION_SECRET });
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

await app.register(authRoutes, { prefix: '/api' });
await app.register(meRoutes);
await app.register(billingRoutes);

app.get('/health', async () => ({ ok: true }));

app.listen({ port: env.PORT, host: '0.0.0.0' })
  .then((addr) => app.log.info(`Server su ${addr}`))
  .catch((err) => { app.log.error(err); process.exit(1); });