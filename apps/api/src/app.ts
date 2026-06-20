import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import routes from './routes';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';

function isAllowedDevOrigin(origin: string) {
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.localhost')) {
      return true;
    }

    const match172 = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (match172) {
      const secondOctet = Number(match172[1]);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }

    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }

    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }

    return origin === env.WEB_ORIGIN;
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
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (origin === env.WEB_ORIGIN || (env.NODE_ENV === 'development' && isAllowedDevOrigin(origin))) {
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
      next();
    },
    express.static(path.resolve(env.UPLOAD_DIR))
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan('dev'));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
