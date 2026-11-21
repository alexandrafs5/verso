import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

/** App-level setup shared by main.ts and the integration tests. */
export function setupApp(app: INestApplication): void {
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.setGlobalPrefix('api', { exclude: ['health'] });
}
