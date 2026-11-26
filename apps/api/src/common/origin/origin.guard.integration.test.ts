import 'reflect-metadata';
import {
  Controller,
  Delete,
  Get,
  type INestApplication,
  Module,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { problemSchema } from '@verso/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { setupApp } from '../../setup-app.js';

process.env['BETTER_AUTH_SECRET'] ??= 'test-secret-test-secret-test-secret';
process.env['BETTER_AUTH_URL'] ??= 'http://localhost:3000';
process.env['WEB_ORIGIN'] ??= 'http://localhost:3000';

const ORIGIN = 'http://localhost:3000';

@Controller('v1/test-origin')
class TestOriginController {
  @Get()
  read() {
    return { ok: true };
  }

  @Post()
  create() {
    return { ok: true };
  }

  @Put()
  replace() {
    return { ok: true };
  }

  @Patch()
  update() {
    return { ok: true };
  }

  @Delete()
  remove() {
    return { ok: true };
  }
}

@Module({ imports: [AppModule], controllers: [TestOriginController] })
class TestAppModule {}

const WRITES = ['post', 'put', 'patch', 'delete'] as const;

describe('Origin check (integration)', () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    app = await NestFactory.create(TestAppModule, {
      bufferLogs: true,
      logger: false,
      bodyParser: false,
    });
    setupApp(app);
    await app.init();
    server = app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    await app.close();
  });

  const expectRejected = (res: request.Response) => {
    expect(res.status).toBe(403);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(problemSchema.parse(res.body).code).toBe('ORIGIN_NOT_ALLOWED');
  };

  it.each(WRITES)('rejects %s without an Origin header', async (method) => {
    expectRejected(await request(server)[method]('/api/v1/test-origin'));
  });

  it.each(WRITES)('rejects %s from another origin', async (method) => {
    expectRejected(
      await request(server)[method]('/api/v1/test-origin').set('Origin', 'https://evil.example'),
    );
  });

  it.each(WRITES)('lets %s through from the web origin', async (method) => {
    const res = await request(server)[method]('/api/v1/test-origin').set('Origin', ORIGIN);
    expect(res.status).toBeLessThan(300);
  });

  it('rejects an origin that only starts like the web origin', async () => {
    expectRejected(
      await request(server).post('/api/v1/test-origin').set('Origin', `${ORIGIN}.evil.example`),
    );
  });

  it('checks the path ignoring case, as the router does', async () => {
    expectRejected(await request(server).post('/API/v1/test-origin'));
  });

  it('checks PATCH /api/v1/me before the session', async () => {
    expectRejected(await request(server).patch('/api/v1/me').send({ name: 'X' }));
  });

  it('does not require Origin on reads', async () => {
    expect((await request(server).get('/api/v1/test-origin')).status).toBe(200);
  });

  it('leaves /api/auth to Better Auth', async () => {
    const res = await request(server).get('/api/auth/get-session');
    expect(res.status).toBe(200);
  });
});
