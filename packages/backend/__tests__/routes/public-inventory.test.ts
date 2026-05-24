import { describe, expect, test, vi } from 'vitest';
import request from 'supertest';

const mockPrisma = vi.hoisted(() => ({
  language: {
    findMany: vi.fn(),
  },
  category: {
    findMany: vi.fn(),
  },
}));

vi.mock('../../src/db', () => ({ default: mockPrisma }));

describe('GET /api/public/inventory.json', () => {
  test('returns public in-stock inventory grouped by category without authentication', async () => {
    mockPrisma.language.findMany.mockResolvedValue([
      { name: 'Spanish' },
      { name: 'Arabic' },
    ]);
    mockPrisma.category.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Produce',
        translations: [
          { language: 'Spanish', name: 'Frutas y verduras' },
          { language: 'Arabic', name: 'منتجات زراعية' },
        ],
        icon: 'apple',
        limit: 2,
        limitType: 'household',
        foodItems: [
          {
            id: 10,
            name: 'Apples',
            translations: [
              { language: 'Spanish', name: 'Manzanas' },
              { language: 'Arabic', name: 'تفاح' },
            ],
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
        translations: [],
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
      languages: ['Spanish', 'Arabic'],
      totals: {
        categories: 1,
        foodItems: 1,
      },
      categories: [
        {
          id: 1,
          name: 'Produce',
          translations: {
            Spanish: 'Frutas y verduras',
            Arabic: 'منتجات زراعية',
          },
          icon: 'apple',
          limit: 2,
          limitType: 'household',
          itemCount: 1,
          items: [
            {
              id: 10,
              name: 'Apples',
              translations: {
                Spanish: 'Manzanas',
                Arabic: 'تفاح',
              },
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
    expect(mockPrisma.language.findMany).toHaveBeenCalledWith({
      where: { isEnabled: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        name: true,
      },
    });
    expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
      include: {
        translations: {
          where: {
            language: { in: ['Spanish', 'Arabic'] },
          },
          select: {
            language: true,
            name: true,
          },
        },
        foodItems: {
          where: { isInStock: true },
          include: {
            translations: {
              where: {
                language: { in: ['Spanish', 'Arabic'] },
              },
              select: {
                language: true,
                name: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  });
});
