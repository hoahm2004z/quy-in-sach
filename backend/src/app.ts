import express from 'express';
import path from 'node:path';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { corsOrigins, env } from './config';
import { globalRateLimiter } from './middlewares/rateLimit';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth';
import { adminProductsRouter } from './modules/products';
import { adminDonationsRouter } from './modules/donations';
import { adminExpensesRouter } from './modules/expenses';
import { adminDashboardRouter } from './modules/dashboard/dashboard.routes';
import { publicRouter } from './modules/transparency/public.routes';
import {
  adminCompanionsRouter,
  adminAuditRouter,
  adminTrashRouter,
} from './modules/companions/companion.routes';
import { adminMediaRouter, isSupabaseStorageConfigured } from './modules/media';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: env.BODY_LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: env.BODY_LIMIT }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  app.use(globalRateLimiter);

  // Local Storage fallback: serve ONLY public-media (never private-documents).
  if (!isSupabaseStorageConfigured()) {
    const publicBucketRoot = path.resolve(
      process.cwd(),
      process.env.LOCAL_STORAGE_DIR || '.local-storage',
      env.SUPABASE_PUBLIC_MEDIA_BUCKET,
    );
    app.use(
      `/storage/${env.SUPABASE_PUBLIC_MEDIA_BUCKET}`,
      express.static(publicBucketRoot, {
        fallthrough: true,
        index: false,
        maxAge: env.NODE_ENV === 'production' ? '7d' : 0,
      }),
    );
  }

  app.use('/health', healthRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/admin/auth', authRouter);
  app.use('/api/admin/dashboard', adminDashboardRouter);
  app.use('/api/admin/products', adminProductsRouter);
  app.use('/api/admin/donations', adminDonationsRouter);
  app.use('/api/admin/expenses', adminExpensesRouter);
  app.use('/api/admin/media', adminMediaRouter);
  app.use('/api/admin/companions', adminCompanionsRouter);
  app.use('/api/admin/audit-logs', adminAuditRouter);
  app.use('/api/admin/trash', adminTrashRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
