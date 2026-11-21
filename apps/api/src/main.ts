import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.setGlobalPrefix('api', { exclude: ['health'] });
  const port = Number(process.env['PORT'] ?? 4000);
  await app.listen(port);
}

void bootstrap();
