import { describe, expect, test, vi } from 'vitest';
import { errorHandler, type AppError } from '../../src/middleware/error-handler';

const runHandler = (error: AppError) => {
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })), json } as never;
  errorHandler(error, { path: '/api/test', method: 'GET' } as never, res, vi.fn() as never);
  return json.mock.calls[0][0] as { error: { message: string; code: string } };
};

describe('global error handler', () => {
  test('withholds an internal failure message instead of forwarding it', () => {
    // The exact shape that leaked into a toast during procurement work: an
    // absolute server path, the query that failed, and schema internals.
    const prismaError = new Error(
      'Invalid `prisma.procurementOrderRevision.findMany()` invocation in\n' +
      '/Users/russbook/williamtemple-feed/packages/backend/src/services/procurement/index.ts:812:47\n' +
      'Unknown argument `supersededByImportId`.'
    ) as AppError;

    const body = runHandler(prismaError);

    expect(body.error.message).not.toContain('prisma.');
    expect(body.error.message).not.toContain('/Users/');
    expect(body.error.message).not.toContain('supersededByImportId');
    expect(body.error.message).toBe(
      'FEED could not complete that request. Please try again, and let Matt know if it keeps happening.'
    );
  });

  test('withholds an unexpected runtime failure the same way', () => {
    const body = runHandler(
      new TypeError("Cannot read properties of undefined (reading 'weightHundredths')") as AppError
    );
    expect(body.error.message).not.toMatch(/undefined|weightHundredths/);
  });

  test('still forwards a curated message the application wrote for the user', () => {
    const importError = new Error(
      'This file does not match either standardized OFB export. Choose a Completed Orders or Agency Pickups CSV from the OFB exporter and retry.'
    ) as AppError;
    importError.statusCode = 400;
    importError.code = 'UNRECOGNIZED_OFB_EXPORT';

    const body = runHandler(importError);

    expect(body.error.message).toContain('Choose a Completed Orders or Agency Pickups CSV');
    expect(body.error.code).toBe('UNRECOGNIZED_OFB_EXPORT');
  });
});
