import { describe, expect, test, vi } from 'vitest';
import request from 'supertest';

const mockPrisma = vi.hoisted(() => ({
  category: {
    findMany: vi.fn(),
  },
}));

vi.mock('../../src/db', () => ({ default: mockPrisma }));

describe('GET /api/public/inventory.json', () => {
  test('returns public in-stock inventory grouped by category without authentication', async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Produce',
        icon: 'apple',
        limit: 2,
        limitType: 'household',
        foodItems: [
          {
            id: 10,
            name: 'Apples',
            limit: 1,
            limitType: 'person',
            isLimited: true,
            isClearance: false,
            vegan: true,
            vegetarian: true,
            glutenFree: true,
            organic: false,
            halal: false,
            kosher: true,
            readyToEat: true,
            updatedAt: new Date('2026-05-24T12:00:00.000Z'),
          },
        ],
      },
      {
        id: 2,
        name: 'Empty Category',
        icon: 'package',
        limit: 10,
        limitType: 'household',
        foodItems: [],
      },
    ]);

    const { default: createServer } = await import('../../src/server');
    const app = createServer();

    const response = await request(app)
      .get('/api/public/inventory.json')
      .set('Origin', 'https://lotto.example.org')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body).toMatchObject({
      version: '1.2.1',
      totals: {
        categories: 1,
        foodItems: 1,
      },
      categories: [
        {
          id: 1,
          name: 'Produce',
          icon: 'apple',
          limit: 2,
          limitType: 'household',
          itemCount: 1,
          items: [
            {
              id: 10,
              name: 'Apples',
              limit: 1,
              limitType: 'person',
              statusTags: {
                inStock: true,
                limited: true,
                clearance: false,
              },
              dietaryFlags: {
                vegan: true,
                vegetarian: true,
                glutenFree: true,
                organic: false,
                halal: false,
                kosher: true,
                readyToEat: true,
              },
              updatedAt: '2026-05-24T12:00:00.000Z',
            },
          ],
        },
      ],
    });
    expect(response.body.generatedAt).toEqual(expect.any(String));
    expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
      include: {
        foodItems: {
          where: { isInStock: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  });
});
