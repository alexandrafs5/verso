import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  setupApp(app);
  const port = Number(process.env['PORT'] ?? 4000);
  await app.listen(port);
}

void bootstrap();
