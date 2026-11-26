import 'reflect-metadata';
import { Body, Controller, Get, type INestApplication, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ErrorCode, problemSchema } from '@verso/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppModule } from './app.module.js';
import { ZodValidationPipe } from './common/zod-validation.pipe.js';
import { setupApp } from './setup-app.js';

const ORIGIN = 'http://localhost:3000';
process.env['WEB_ORIGIN'] ??= ORIGIN;

const bookSchema = z.object({ title: z.string().min(1), pages: z.number().int().positive() });

@Controller('test')
class TestController {
  @Post('books')
  create(@Body(new ZodValidationPipe(bookSchema)) body: z.infer<typeof bookSchema>) {
    return body;
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret internal failure');
  }
}

@Module({ imports: [AppModule], controllers: [TestController] })
class TestAppModule {}

describe('API skeleton (integration)', () => {
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

  it('GET /health -> 200 { status: "ok" } outside the /api prefix', async () => {
    const res = await request(server).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/health -> 404 problem+json', async () => {
    const res = await request(server).get('/api/health');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(problemSchema.parse(res.body).code).toBe(ErrorCode.NOT_FOUND);
  });

  it('unknown route -> 404 problem+json NOT_FOUND', async () => {
    const res = await request(server).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    const problem = problemSchema.parse(res.body);
    expect(problem).toMatchObject({ code: 'NOT_FOUND', status: 404, type: 'about:blank' });
  });

  it('valid body passes the ZodValidationPipe', async () => {
    const res = await request(server)
      .post('/api/test/books')
      .set('Origin', ORIGIN)
      .send({ title: 'Dune', pages: 412 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ title: 'Dune', pages: 412 });
  });

  it('invalid body -> 400 VALIDATION_ERROR with errors[] path and message', async () => {
    const res = await request(server)
      .post('/api/test/books')
      .set('Origin', ORIGIN)
      .send({ title: '', pages: 'x' });
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    const problem = problemSchema.parse(res.body);
    expect(problem.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(problem.errors?.map((e) => e.path).sort()).toEqual(['pages', 'title']);
    expect(problem.errors?.every((e) => e.message.length > 0)).toBe(true);
  });

  it('malformed JSON -> 400 VALIDATION_ERROR', async () => {
    const res = await request(server)
      .post('/api/test/books')
      .set('Origin', ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{not json');
    expect(res.status).toBe(400);
    expect(problemSchema.parse(res.body).code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('unexpected error -> 500 INTERNAL_ERROR with no stack or message leak', async () => {
    const res = await request(server).get('/api/test/boom');
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    const problem = problemSchema.parse(res.body);
    expect(problem.code).toBe(ErrorCode.INTERNAL_ERROR);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('secret');
    expect(raw).not.toMatch(/\bat\s.+\(.+:\d+:\d+\)/);
    expect(problem.detail).toBeUndefined();
  });

  it('every response carries helmet headers', async () => {
    for (const path of ['/health', '/api/nope']) {
      const res = await request(server).get(path);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    }
  });
});
