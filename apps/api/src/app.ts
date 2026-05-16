import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import routes from './routes';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: env.WEB_ORIGIN,
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
