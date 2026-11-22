import type { INestApplication } from '@nestjs/common';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

const AUTH_PATH = '/api/auth';

function skipAuthPath(parser: (req: Request, res: Response, next: NextFunction) => void) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === AUTH_PATH || req.path.startsWith(`${AUTH_PATH}/`)) return next();
    parser(req, res, next);
  };
}

/**
 * App-level setup shared by main.ts and the integration tests.
 * The app must be created with `bodyParser: false`: Better Auth reads the raw body on /api/auth,
 * so JSON and urlencoded parsing is registered here for every other path.
 */
export function setupApp(app: INestApplication): void {
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(skipAuthPath(json()));
  app.use(skipAuthPath(urlencoded({ extended: true })));
  app.setGlobalPrefix('api', { exclude: ['health'] });
}
