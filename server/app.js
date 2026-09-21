import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createTtsProvider } from './services/tts.js';
import { ApiError, errorHandler } from './utils/errors.js';
import { parse, ttsSchema, validateVoice } from './utils/validation.js';
import { createDatabase } from './services/database.js';
import { optionalAuth } from './middleware/auth.js';
import { accountRoutes } from './routes/account.js';
import { fileRoutes } from './routes/files.js';
import { createAi } from './services/ai.js';
import { aiRoutes } from './routes/ai.js';
import { guestQuota, synthesisCapacity } from './middleware/usage.js';

export function createApp({
  provider = createTtsProvider(),
  database = createDatabase(),
  ai = createAi(),
  env = process.env,
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', Number(env.TRUST_PROXY) || false);
  app.use(helmet());
  const origins = (env.CLIENT_URL || 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map((s) => s.trim());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origins.includes(origin)) callback(null, true);
        else callback(new ApiError(403, 'ORIGIN_FORBIDDEN', 'This origin is not allowed.'));
      },
      exposedHeaders: ['Content-Disposition', 'X-History-Id', 'X-Save-Warning'],
    }),
  );
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  const limiter = rateLimit({
    windowMs: 60000,
    limit: Number(env.RATE_LIMIT_MAX) || 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait a minute and try again.',
        },
      }),
  });
  app.use('/api', limiter, (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', fileRoutes());
  app.use((req, _res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json'))
      return next(
        new ApiError(415, 'INVALID_CONTENT_TYPE', 'Send this request as application/json.'),
      );
    next();
  });
  app.use(express.json({ limit: '40kb' }));
  app.get('/api/config', (_req, res) =>
    res.json({
      success: true,
      tts: provider.configured,
      auth: database.configured,
      ai: ai.configured && database.configured,
      maxCharacters: 5000,
    }),
  );
  app.get('/api/voices', async (req, res) => {
    if (
      Object.keys(req.query).some((k) => k !== 'language') ||
      (req.query.language !== undefined &&
        (typeof req.query.language !== 'string' || req.query.language.length > 35))
    )
      throw new ApiError(400, 'INVALID_LANGUAGE', 'Specify one valid language.');
    const voices = await provider.listVoices();
    res.json({
      success: true,
      voices: req.query.language ? voices.filter((v) => v.language === req.query.language) : voices,
    });
  });
  app.use('/api', optionalAuth(database));
  app.post('/api/tts', guestQuota(env), synthesisCapacity(), async (req, res) => {
    try {
      const input = parse(ttsSchema, req.body);
      if (input.save && !req.user)
        throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in to save speech to your history.');
      validateVoice(input, await provider.listVoices());
      if (req.user) await database.reserve(req.user, Number(env.DAILY_GENERATION_LIMIT) || 50);
      const audio = await provider.synthesize(input);
      if (req.user) {
        try {
          await database.logUsage(req.user, input);
        } catch {
          console.error(
            JSON.stringify({ event: 'usage_log_failed', code: 'DATABASE_UNAVAILABLE' }),
          );
        }
      }
      if (input.save) {
        try {
          const id = await database.save(req.user, input, audio);
          res.set('X-History-Id', id);
        } catch {
          res.set(
            'X-Save-Warning',
            'Your speech is ready, but saving failed. Download it to keep a copy.',
          );
        }
      }
      res
        .type('audio/mpeg')
        .set('Content-Disposition', 'attachment; filename="labmentix-speech.mp3"')
        .send(audio);
    } finally {
      res.locals.releaseSynthesis();
    }
  });
  app.use('/api', accountRoutes(database));
  app.use('/api', aiRoutes(ai));
  app.use((_req, _res, next) =>
    next(new ApiError(404, 'NOT_FOUND', 'This API route does not exist.')),
  );
  app.use(errorHandler);
  return app;
}
