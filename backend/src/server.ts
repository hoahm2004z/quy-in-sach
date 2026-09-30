import { createApp } from './app';
import { env } from './config';
import { prisma } from './utils/prisma';
import { isSupabaseStorageConfigured } from './modules/media/storage';

function assertProductionReady(): void {
  if (env.NODE_ENV !== 'production') return;

  const missing: string[] = [];
  if (!env.SUPABASE_JWT_SECRET) missing.push('SUPABASE_JWT_SECRET');
  if (!env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.DIRECT_URL) missing.push('DIRECT_URL');
  if (process.env.ALLOW_DEV_LOGIN === 'true') {
    missing.push('ALLOW_DEV_LOGIN must not be true in production');
  }
  if (!isSupabaseStorageConfigured()) {
    missing.push('Supabase Storage (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
  }
  if (missing.length > 0) {
    throw new Error(
      `Production config incomplete: ${missing.join(', ')}. ` +
        'Local storage / dev-login are not allowed in production.',
    );
  }
}

async function bootstrap() {
  assertProductionReady();

  const app = createApp();

  // Fail fast if DB is unreachable
  await prisma.$connect();

  const host = process.env.HOST || '0.0.0.0';
  const server = app.listen(env.PORT, host, () => {
    console.log(`API listening on http://${host}:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch(async (err) => {
  console.error('Failed to start server', err);
  await prisma.$disconnect();
  process.exit(1);
});
