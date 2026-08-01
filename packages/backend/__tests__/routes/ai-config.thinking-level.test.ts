import { beforeEach, describe, expect, test, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockPrisma = {
  aIConfiguration: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  $transaction: vi.fn()
};

vi.mock('../../src/db', () => ({
  default: mockPrisma
}));

vi.mock('../../src/services/encryption', () => ({
  encryptApiKey: vi.fn().mockResolvedValue({ encrypted: 'encrypted', salt: 'salt' })
}));

describe('AI Configuration thinking level routes', () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
    app = express();
    app.use(express.json());

    const aiConfigRouter = (await import('../../src/routes/ai-config')).default;
    // AI configuration mutations require administrator authority as of
    // beta.5 (ISSUES.md #50a). `jwtAuthMiddleware` populates req.auth from a
    // per-request database read in the real app; these route tests stand that
    // in so the subject under test stays the route, not the guard.
    app.use((req, _res, next) => {
      req.auth = {
        userId: 'test-admin',
        email: 'admin@williamtemple.org',
        role: 'ADMINISTRATOR',
        accessState: 'ALLOWED',
      };
      next();
    });
    app.use('/api/ai-config', aiConfigRouter);
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(err.statusCode || 500).json({ error: err.message });
    });
  });

  test('creates configuration with valid thinking level', async () => {
    mockPrisma.aIConfiguration.create.mockResolvedValue({
      id: 1,
      name: 'Gemini',
      type: 'apikey',
      value: '',
      thinkingLevel: 'minimal'
    });

    const response = await request(app)
      .post('/api/ai-config')
      .send({
        name: 'Gemini',
        type: 'apikey',
        value: '',
        apiKey: 'test-key',
        serviceType: 'Google',
        thinkingLevel: 'minimal'
      })
      .expect(201);

    expect(mockPrisma.aIConfiguration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        thinkingLevel: 'minimal'
      })
    });
    expect(response.body.configuration.thinkingLevel).toBe('minimal');
  });

  test('creates configuration with null thinking level', async () => {
    mockPrisma.aIConfiguration.create.mockResolvedValue({
      id: 2,
      name: 'Gemini',
      type: 'apikey',
      value: '',
      thinkingLevel: null
    });

    const response = await request(app)
      .post('/api/ai-config')
      .send({
        name: 'Gemini',
        type: 'apikey',
        value: '',
        apiKey: 'test-key',
        serviceType: 'Google',
        thinkingLevel: null
      })
      .expect(201);

    expect(mockPrisma.aIConfiguration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        thinkingLevel: null
      })
    });
    expect(response.body.configuration.thinkingLevel).toBeNull();
  });

  test('rejects invalid thinking level values', async () => {
    await request(app)
      .post('/api/ai-config')
      .send({
        name: 'Gemini',
        type: 'apikey',
        value: '',
        apiKey: 'test-key',
        serviceType: 'Google',
        thinkingLevel: 'invalid'
      })
      .expect(400);

    expect(mockPrisma.aIConfiguration.create).not.toHaveBeenCalled();
  });

  test('updates thinking level for existing configuration', async () => {
    mockPrisma.aIConfiguration.findUnique.mockResolvedValue({
      id: 1,
      type: 'apikey',
      deletedAt: null
    });
    mockPrisma.aIConfiguration.update.mockResolvedValue({
      id: 1,
      thinkingLevel: 'low'
    });

    await request(app)
      .put('/api/ai-config/1')
      .send({ thinkingLevel: 'low' })
      .expect(200);

    expect(mockPrisma.aIConfiguration.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ thinkingLevel: 'low' })
    });
  });

  test('updates thinking level to null', async () => {
    mockPrisma.aIConfiguration.findUnique.mockResolvedValue({
      id: 1,
      type: 'apikey',
      deletedAt: null
    });
    mockPrisma.aIConfiguration.update.mockResolvedValue({
      id: 1,
      thinkingLevel: null
    });

    await request(app)
      .put('/api/ai-config/1')
      .send({ thinkingLevel: null })
      .expect(200);

    expect(mockPrisma.aIConfiguration.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ thinkingLevel: null })
    });
  });

  test('preserves thinking level when updating other fields', async () => {
    mockPrisma.aIConfiguration.findUnique.mockResolvedValue({
      id: 1,
      type: 'apikey',
      deletedAt: null
    });
    mockPrisma.aIConfiguration.update.mockResolvedValue({
      id: 1,
      name: 'Updated'
    });

    await request(app)
      .put('/api/ai-config/1')
      .send({ name: 'Updated' })
      .expect(200);

    const updateArg = mockPrisma.aIConfiguration.update.mock.calls[0][0];
    expect(updateArg.data.name).toBe('Updated');
    expect('thinkingLevel' in updateArg.data).toBe(false);
  });

  test('returns thinking level in response payload', async () => {
    mockPrisma.aIConfiguration.findUnique.mockResolvedValue({
      id: 3,
      name: 'Gemini',
      type: 'apikey',
      value: '',
      thinkingLevel: 'high',
      deletedAt: null
    });

    const response = await request(app)
      .get('/api/ai-config/3')
      .expect(200);

    expect(response.body.configuration.thinkingLevel).toBe('high');
  });

  test('returns null thinking level for legacy configs', async () => {
    mockPrisma.aIConfiguration.findUnique.mockResolvedValue({
      id: 4,
      name: 'Gemini',
      type: 'apikey',
      value: '',
      thinkingLevel: null,
      deletedAt: null
    });

    const response = await request(app)
      .get('/api/ai-config/4')
      .expect(200);

    expect(response.body.configuration.thinkingLevel).toBeNull();
  });
});
