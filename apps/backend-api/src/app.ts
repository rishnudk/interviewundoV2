import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { logger } from './config/logger';
import { router } from './presentation/routes';
import { errorHandler } from './presentation/middleware/error-handler';
import { requestId } from './presentation/middleware/request-id';
import { rateLimiter } from './presentation/middleware/rate-limiter';
import { swaggerSpec } from './docs/openapi';

// ============================================================
// Express App Bootstrap
// ============================================================

const app = express();

// --- Proxy Trust (required: behind Nginx reverse proxy) ---
app.set('trust proxy', 1);

// --- Global Middleware ---
app.use(requestId);
app.use(helmet());
app.use(rateLimiter);
app.use(
  cors({
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  pinoHttp({
    logger,
    quietReqLogger: true,
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  }),
);

app.get('/api-docs.json', (_req, res) => {
  res.json(swaggerSpec);
});

app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'InterviewPrep API Docs',
  }),
);

// --- Routes ---
app.use(router);

// --- Global Error Handler (must be last) ---
app.use(errorHandler);

export { app };
