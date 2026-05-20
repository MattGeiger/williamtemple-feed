import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const buildApp = async () => {
  const [{ jwtAuthMiddleware }, { authMiddleware }] = await Promise.all([
    import('@/middleware/auth/jwt-middleware'),
    import('@/middleware/auth/auth-middleware'),
  ]);

  const app = express();
  app.use(cookieParser());
  app.use(jwtAuthMiddleware);
  app.use(authMiddleware);
  app.get('/api/protected', (req, res) => {
    res.json({ ok: true, user: req.auth ?? null });
  });
  return app;
};

describe('jwtAuthMiddleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key-test-secret-key-test-secret-key-test-secret-key';
    process.env.JWT_EXPIRES_IN = '7d';
    process.env.AUTH_USERNAME = 'admin';
    process.env.AUTH_PASSWORD = 'pass';
    process.env.NODE_ENV = 'production';
    process.env.FORCE_AUTH = 'true';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it('accepts a valid JWT cookie and bypasses Basic Auth', async () => {
    const { TokenService } = await import('@/services/auth/token-service');
    const app = await buildApp();
    const token = TokenService.generateJWT('user-1', 'user@williamtemple.org');

    const response = await request(app)
      .get('/api/protected')
      .set('Cookie', `auth_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      userId: 'user-1',
      email: 'user@williamtemple.org',
    });
  });

  it('falls back to Basic Auth when JWT is missing', async () => {
    const app = await buildApp();
    const basic = Buffer.from('admin:pass').toString('base64');

    const response = await request(app)
      .get('/api/protected')
      .set('Authorization', `Basic ${basic}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it('rejects when JWT is invalid and no Basic Auth is provided', async () => {
    const app = await buildApp();

    const response = await request(app)
      .get('/api/protected')
      .set('Cookie', 'auth_token=badtoken');

    expect(response.status).toBe(401);
  });
});
