import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import routes from './routes';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';

function isAllowedOrigin(origin: string) {
  if (env.NODE_ENV !== 'development') {
    return origin === env.WEB_ORIGIN;
  }

  if (!origin) {
    return true;
  }

  try {
    const url = new URL(origin);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed`));
      },
      credentials: true
    })
  );
  app.use(helmet());
  app.use(
    '/files',
    (req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.removeHeader('Content-Security-Policy');
      res.removeHeader('X-Frame-Options');
      next();
    },
    express.static(path.resolve(env.UPLOAD_DIR))
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan('dev'));

  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      service: 'CertiFlow API',
      routes: ['/health', '/auth/login', '/auth/register', '/auth/me']
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
