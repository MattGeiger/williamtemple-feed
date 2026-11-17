// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { beforeAll, beforeEach, afterAll, describe, expect, test } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { Express } from 'express';

let directory: string;
let prisma: PrismaClient;
let app: Express;
let cookie: string;
let terms: typeof import('../../../src/services/auth/terms');
let defaults: typeof import('../../../src/services/brand-config/presets');
const ORIGIN = 'http://localhost:5173';
const ADMIN = { id: 'onboarding-admin', email: 'admin@williamtemple.org', role: 'ADMINISTRATOR' };
const STAFF = { id: 'onboarding-staff', email: 'staff@williamtemple.org', role: 'STAFF' };

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'feed-login-onboarding-'));
  const dbPath = join(directory, 'test.db');
  execFileSync('sqlite3', [dbPath, 'VACUUM;']);
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.JWT_SECRET = 'local-onboarding-test-secret-not-used-outside-disposable-tests';
  process.env.APP_URL = ORIGIN;
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    cwd: join(__dirname, '../../..'), env: process.env, stdio: 'pipe',
  });
  prisma = (await import('../../../src/db')).default;
  terms = await import('../../../src/services/auth/terms');
  defaults = await import('../../../src/services/brand-config/presets');
  app = (await import('../../../src/server')).createServer();
});

beforeEach(async () => {
  await prisma.userReleaseVisit.deleteMany();
  await prisma.termsAcceptance.deleteMany();
  await prisma.adminAuditLog.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.brandConfiguration.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({ data: ADMIN });
  await prisma.user.create({ data: STAFF });
  const { TokenService } = await import('../../../src/services/auth/token-service');
  cookie = `auth_token=${TokenService.generateJWT(ADMIN.id, ADMIN.email)}`;
});

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  if (directory) rmSync(directory, { recursive: true, force: true });
});

const document = async () => (await request(app).get('/api/auth/terms').expect(200)).body.document;
const accept = async (doc?: { version: string; hash: string }) => request(app)
  .post('/api/auth/terms').set('Cookie', cookie).set('Origin', ORIGIN)
  .send({ accepted: true, ...(doc ?? await document()) });

describe('server-enforced, retained FEED agreements', () => {
  test('public terms are readable; identity, Basic credentials and a forged PDF header cannot bypass the gate', async () => {
    const doc = await document();
    expect(doc.organizationName).toBe('William Temple House');
    expect(doc.text.match(/Matt Geiger/g)).toHaveLength(1);
    expect(doc.text).toContain('obligation for Temple Consulting, LLC');
    for (const headers of [{}, { Authorization: 'Basic dGVzdDp0ZXN0' }, { 'x-internal-pdf-request': 'true' }]) {
      await request(app).get('/api/categories').set(headers).expect(401);
    }
    await request(app).get('/health').expect(200);
    const denied = await request(app).get('/api/categories').set('Cookie', cookie).expect(403);
    expect(denied.body.error.code).toBe('TERMS_ACCEPTANCE_REQUIRED');
    const session = await request(app).get('/api/auth/session').set('Cookie', cookie).expect(200);
    expect(session.body).toMatchObject({ authenticated: true, termsAccepted: false, release: { version: '1.9.1', seen: false } });
    expect(await prisma.userReleaseVisit.count()).toBe(0);
  });

  test('requires authenticated, same-origin, explicit acceptance of the exact displayed document', async () => {
    const doc = await document();
    await request(app).post('/api/auth/terms').set('Origin', ORIGIN).send({ accepted: true, ...doc }).expect(401);
    for (const origin of ['', 'https://untrusted.example']) {
      await request(app).post('/api/auth/terms').set('Cookie', cookie).set('Origin', origin).send({ accepted: true, ...doc }).expect(403);
    }
    for (const accepted of [false, 'true', null]) {
      await request(app).post('/api/auth/terms').set('Cookie', cookie).set('Origin', ORIGIN).send({ ...doc, accepted }).expect(400);
    }
    await accept({ ...doc, hash: 'wrong-hash' }).then(r => expect(r.status).toBe(409));
    await accept({ ...doc, version: 'outdated' }).then(r => expect(r.status).toBe(409));
    expect(await prisma.termsAcceptance.count()).toBe(0);
  });

  test('retains server identity and exact text, unlocks APIs, and retries preserve both evidence and History', async () => {
    const doc = await document();
    const response = await request(app).post('/api/auth/terms').set('Cookie', cookie).set('Origin', ORIGIN)
      .send({ accepted: true, ...doc, userId: STAFF.id, email: STAFF.email, acceptedAt: '2000-01-01T00:00:00Z', text: 'forged' }).expect(200);
    const first = await prisma.termsAcceptance.findUniqueOrThrow({ where: { id: response.body.acceptance.id } });
    expect(first).toMatchObject({ userId: ADMIN.id, emailAtAcceptance: ADMIN.email, termsText: doc.text, termsHash: doc.hash });
    expect(first.acceptedAt.getFullYear()).not.toBe(2000);
    await accept(doc).then(r => expect(r.status).toBe(200));
    expect(await prisma.termsAcceptance.count()).toBe(1);
    expect(await prisma.adminAuditLog.count({ where: { action: 'TERMS_ACCEPTED' } })).toBe(1);
    expect((await prisma.termsAcceptance.findFirstOrThrow()).acceptedAt).toEqual(first.acceptedAt);
    await request(app).get('/api/categories').set('Cookie', cookie).expect(200);
    const session = await request(app).get('/api/auth/session').set('Cookie', cookie).expect(200);
    expect(session.body.termsAccepted).toBe(true);
    expect(session.body.release.seen).toBe(false);
    const retained = await request(app).get(`/api/admin/terms-acceptances/${first.id}`).set('Cookie', cookie).expect(200);
    expect(retained.body.acceptance.termsText).toBe(doc.text);
    const { TokenService } = await import('../../../src/services/auth/token-service');
    await terms.recordTermsAcceptance(STAFF.id, { accepted: true, ...doc });
    await request(app).get(`/api/admin/terms-acceptances/${first.id}`)
      .set('Cookie', `auth_token=${TokenService.generateJWT(STAFF.id, STAFF.email)}`).expect(403);
    await prisma.user.delete({ where: { id: STAFF.id } });
    expect(await prisma.termsAcceptance.count()).toBe(2);
    expect(await prisma.adminAuditLog.count({ where: { action: 'TERMS_ACCEPTED' } })).toBe(2);
  });

  test('an audit failure rolls back acceptance rather than silently granting access', async () => {
    await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_terms_history BEFORE INSERT ON AdminAuditLog BEGIN SELECT RAISE(ABORT, 'test audit failure'); END;`);
    try {
      const response = await accept();
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await prisma.termsAcceptance.count()).toBe(0);
    } finally { await prisma.$executeRawUnsafe('DROP TRIGGER reject_terms_history;'); }
  });

  test('simultaneous agreement retries produce one original acceptance and one History event', async () => {
    const doc = await document();
    const responses = await Promise.all([accept(doc), accept(doc), accept(doc)]);
    expect(responses.map(response => response.status)).toEqual([200, 200, 200]);
    expect(new Set(responses.map(response => response.body.acceptance.id)).size).toBe(1);
    expect(await prisma.termsAcceptance.count()).toBe(1);
    expect(await prisma.adminAuditLog.count({ where: { action: 'TERMS_ACCEPTED' } })).toBe(1);
  });

  test('uses only activated organization identity, ignores app name and colors, and retains old wording after an identity update', async () => {
    const initial = await document();
    const config = structuredClone(defaults.WTH_BRAND_CONFIG);
    config.identity.organizationName = 'Example [Organization](https://untrusted.example)';
    config.identity.appName = 'A renamed app';
    await prisma.brandConfiguration.create({ data: { id: 'test-brand', payload: config, isActive: false } });
    expect((await document()).hash).toBe(initial.hash); // A draft is not authoritative.
    await prisma.brandConfiguration.update({ where: { id: 'test-brand' }, data: { isActive: true } });
    const active = await document();
    expect(active.text).toContain('Example \\[Organization\\]\\(https://untrusted\\.example\\)');
    expect(active.text).not.toContain('A renamed app');
    await accept(initial).then(r => expect(r.status).toBe(409));
    await accept(active).then(r => expect(r.status).toBe(200));
    config.colors.accent = { l: 0.5, c: 0.1, h: 150 };
    await prisma.brandConfiguration.update({ where: { id: 'test-brand' }, data: { payload: config } });
    expect((await document()).hash).toBe(active.hash);
    config.identity.organizationName = 'Another Organization';
    await prisma.brandConfiguration.update({ where: { id: 'test-brand' }, data: { payload: config } });
    await request(app).get('/api/categories').set('Cookie', cookie).expect(403);
    expect((await prisma.termsAcceptance.findFirstOrThrow()).termsText).toBe(active.text);
    await prisma.brandConfiguration.update({ where: { id: 'test-brand' }, data: { payload: { invalid: true } } });
    await request(app).get('/api/auth/terms').expect(503);
    await request(app).get('/api/categories').set('Cookie', cookie).expect(503);
  });

  test.each(['otp', 'magic-link'])('%s sign-in still requires terms and does not consume release presentation', async method => {
    const { TokenService } = await import('../../../src/services/auth/token-service');
    const token = method === 'otp' ? '123456' : 'test-magic-token';
    await prisma.verificationToken.create({ data: {
      identifier: ADMIN.email, token: TokenService.hashToken(token),
      type: method === 'otp' ? 'otp' : 'magic_link', expires: new Date(Date.now() + 60_000),
    } });
    const response = await request(app).post(`/api/auth/${method}/verify`)
      .send({ email: ADMIN.email, ...(method === 'otp' ? { code: token } : { token }) }).expect(200);
    const signedCookie = response.headers['set-cookie'][0].split(';')[0];
    const session = await request(app).get('/api/auth/session').set('Cookie', signedCookie).expect(200);
    expect(session.body).toMatchObject({ authenticated: true, termsAccepted: false, release: { seen: false } });
    await request(app).get('/api/categories').set('Cookie', signedCookie).expect(403);
  });

  test('a roster restore reusing an id for a different email cannot inherit another person’s agreement', async () => {
    const doc = await document();
    await accept(doc).then(r => expect(r.status).toBe(200));
    await prisma.user.update({ where: { id: ADMIN.id }, data: { email: 'replacement@williamtemple.org' } });
    const session = await request(app).get('/api/auth/session').set('Cookie', cookie).expect(200);
    expect(session.body.termsAccepted).toBe(false);
    await accept(doc).then(r => expect(r.status).toBe(200));
    expect(await prisma.termsAcceptance.count()).toBe(2);
    expect(await prisma.termsAcceptance.count({ where: { emailAtAcceptance: ADMIN.email } })).toBe(1);
  });
});

describe('account-specific release presentation', () => {
  test('requires terms, Origin and the exact displayed release, then remembers across new sessions', async () => {
    const mark = (version = '1.9.1', origin = ORIGIN) => request(app).post('/api/auth/release-seen')
      .set('Cookie', cookie).set('Origin', origin).send({ version });
    await mark().expect(403);
    await accept().then(r => expect(r.status).toBe(200));
    await mark('1.9.1', 'https://untrusted.example').expect(403);
    await mark('1.9.0').expect(409);
    await prisma.userReleaseVisit.create({ data: { userId: ADMIN.id, version: '1.9.0' } });
    expect((await request(app).get('/api/auth/session').set('Cookie', cookie)).body.release.seen).toBe(false);
    await mark().expect(200);
    const first = await prisma.userReleaseVisit.findFirstOrThrow({ where: { version: '1.9.1' } });
    await mark().expect(200);
    expect(await prisma.userReleaseVisit.count({ where: { version: '1.9.1' } })).toBe(1);
    expect((await prisma.userReleaseVisit.findFirstOrThrow({ where: { version: '1.9.1' } })).firstSeenAt).toEqual(first.firstSeenAt);
    await request(app).post('/api/auth/logout').set('Cookie', cookie).expect(200);
    const { TokenService } = await import('../../../src/services/auth/token-service');
    const nextCookie = `auth_token=${TokenService.generateJWT(ADMIN.id, ADMIN.email)}`;
    expect((await request(app).get('/api/auth/session').set('Cookie', nextCookie)).body.release.seen).toBe(true);
    const staffCookie = `auth_token=${TokenService.generateJWT(STAFF.id, STAFF.email)}`;
    expect((await request(app).get('/api/auth/session').set('Cookie', staffCookie)).body.release.seen).toBe(false);
  });
});
