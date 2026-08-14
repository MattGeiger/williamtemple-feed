// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import express from 'express';
import request from 'supertest';
import { describe, expect, test } from 'vitest';
import dataImportRouter from '../../../src/routes/data-import';

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.auth = {
    userId: 'history-staff-user',
    email: 'history-staff@example.org',
    role: 'STAFF',
    accessState: 'ALLOWED',
  };
  next();
});
app.use('/api/data-import', dataImportRouter);

describe('unified import history routes', () => {
  test('allows authenticated staff to read organization-wide import history', async () => {
    const response = await request(app).get('/api/data-import/history');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.imports)).toBe(true);
  });

  test('keeps lifecycle changes administrator-only', async () => {
    const response = await request(app)
      .post('/api/data-import/history/lifecycle')
      .send({ mode: 'rollback', imports: [{ domain: 'service', id: 1 }] });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({ code: 'ADMIN_REQUIRED' });
  });
});
