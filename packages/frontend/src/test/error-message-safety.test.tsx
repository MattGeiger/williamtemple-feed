import { describe, expect, test } from 'vitest';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';

const presentable = (message: string): boolean =>
  (ErrorHandlerService as unknown as {
    isUserPresentableMessage: (value: string) => boolean;
  }).isUserPresentableMessage(message);

describe('toast messages never carry developer artifacts', () => {
  test('rejects the Prisma dump that leaked during procurement work', () => {
    expect(presentable(
      "\nInvalid `prisma.procurementOrderRevision.findMany()` invocation in\n" +
      "/Users/russbook/williamtemple-feed/packages/backend/src/services/procurement/index.ts:812:47\n\n" +
      "Unknown argument `supersededByImportId`. Available options are marked with ?."
    )).toBe(false);
  });

  test('rejects paths, SQL, driver codes, and oversized blobs', () => {
    expect(presentable('SQLITE_BUSY: database is locked')).toBe(false);
    expect(presentable('connect ECONNREFUSED 127.0.0.1:3001')).toBe(false);
    expect(presentable('SELECT * FROM ProcurementLine WHERE id = 1')).toBe(false);
    expect(presentable('Error in /Users/russbook/williamtemple-feed/packages/backend/src/db.ts')).toBe(false);
    expect(presentable('Cannot find module at node_modules/@prisma/client')).toBe(false);
    expect(presentable(`Something failed. ${'detail '.repeat(60)}`)).toBe(false);
  });

  test('still surfaces curated ASK-aligned messages', () => {
    expect(presentable(
      'This file does not match either standardized OFB export. Choose a Completed Orders or Agency Pickups CSV from the OFB exporter and retry.'
    )).toBe(true);
    expect(presentable('Row 14 has an invalid Pickup Time. Export the pickup range again and retry the import.')).toBe(true);
    expect(presentable('Choose an OFB CSV smaller than 5 MB.')).toBe(true);
  });
});
