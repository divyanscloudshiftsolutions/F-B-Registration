/**
 * Live API integration tests against a deployed NFC Bar backend.
 *
 * Usage:
 *   npx ts-node tests/api.integration.test.ts
 *   npm run test:integration
 *
 * Env overrides:
 *   API_BASE_URL   default https://api.nfc-qr.app.cloudshiftsolutions.in
 *   API_USERNAME   default admin
 *   API_PASSWORD   default admin123
 */
import assert from 'assert';

const BASE_URL = (process.env.API_BASE_URL || 'https://api.nfc-qr.app.cloudshiftsolutions.in').replace(/\/$/, '');
const API = `${BASE_URL}/api`;
const USERNAME = process.env.API_USERNAME || 'admin';
const PASSWORD = process.env.API_PASSWORD || 'admin123';

type Json = Record<string, unknown>;

let passed = 0;
let failed = 0;
let authToken = '';

async function request(
  method: string,
  path: string,
  options: { body?: unknown; token?: string; expectOk?: boolean } = {}
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${path.startsWith('http') ? path : `${BASE_URL}${path}`}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (options.expectOk !== false && !res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  }

  return { status: res.status, data };
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err?.message || err}`);
  }
}

async function main() {
  console.log(`\nNFC QR API integration tests`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`User:   ${USERNAME}\n`);

  // --- Public / health ---
  await test('GET / returns OK status', async () => {
    const { status, data } = await request('GET', '/');
    assert.strictEqual(status, 200);
    assert.ok(data.status === 'OK' || data.status === 'ok');
  });

  await test('GET /health returns ok', async () => {
    const { status, data } = await request('GET', '/health');
    assert.strictEqual(status, 200);
    assert.ok(data.status === 'ok' || data.status === 'OK');
  });

  await test('GET /api/config is public', async () => {
    const { status, data } = await request('GET', '/api/config');
    assert.strictEqual(status, 200);
    assert.ok(data.success === true || typeof data.tokenType === 'string' || data.nfcEnabled !== undefined);
  });

  // --- Auth ---
  await test('POST /api/auth/login with seed admin', async () => {
    const { status, data } = await request('POST', '/api/auth/login', {
      body: { username: USERNAME, password: PASSWORD },
    });
    assert.strictEqual(status, 200);
    assert.ok(data.success === true || data.token || data.accessToken, `login body: ${JSON.stringify(data)}`);
    authToken = (data.token || data.accessToken) as string;
    assert.ok(authToken && typeof authToken === 'string', 'expected session token');
  });

  await test('POST /api/auth/login rejects bad password', async () => {
    const { status, data } = await request('POST', '/api/auth/login', {
      body: { username: USERNAME, password: 'wrong-password-xyz' },
      expectOk: false,
    });
    assert.ok(status === 401 || status === 400 || status === 403, `expected auth failure, got ${status}`);
    assert.ok(!data?.token, 'must not return token on failed login');
  });

  if (!authToken) {
    console.error('\nAborting authenticated tests — login failed.\n');
    process.exit(1);
  }

  await test('GET /api/auth/me returns current user', async () => {
    const { status, data } = await request('GET', '/api/auth/me', { token: authToken });
    assert.strictEqual(status, 200);
    assert.ok(data.user || data.success);
    const user = (data.user || data) as Json;
    assert.ok(user.username || user.id);
  });

  await test('Authenticated routes reject missing Bearer', async () => {
    const { status } = await request('GET', '/api/auth/me', { expectOk: false });
    assert.ok(status === 401 || status === 403, `expected 401/403, got ${status}`);
  });

  // --- Authenticated reads (non-destructive) ---
  await test('GET /api/tables', async () => {
    const { status, data } = await request('GET', '/api/tables', { token: authToken });
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(data) || Array.isArray(data.tables) || data.success !== false);
  });

  await test('GET /api/tables/available', async () => {
    const { status } = await request('GET', '/api/tables/available', { token: authToken });
    assert.strictEqual(status, 200);
  });

  await test('GET /api/tables/occupancy', async () => {
    const { status } = await request('GET', '/api/tables/occupancy', { token: authToken });
    assert.strictEqual(status, 200);
  });

  await test('GET /api/tokens/active', async () => {
    const { status } = await request('GET', '/api/tokens/active', { token: authToken });
    assert.strictEqual(status, 200);
  });

  await test('GET /api/rate-card', async () => {
    const { status, data } = await request('GET', '/api/rate-card', {
      token: authToken,
      expectOk: false,
    });
    // Some deploys use /rate-cards instead
    if (status === 404) {
      const alt = await request('GET', '/api/rate-cards', { token: authToken });
      assert.strictEqual(alt.status, 200);
      return;
    }
    assert.strictEqual(status, 200, `rate-card failed: ${JSON.stringify(data)}`);
  });

  await test('GET /api/cards/available', async () => {
    const { status } = await request('GET', '/api/cards/available', { token: authToken });
    assert.strictEqual(status, 200);
  });

  await test('GET /api/users (admin)', async () => {
    const { status, data } = await request('GET', '/api/users', {
      token: authToken,
      expectOk: false,
    });
    assert.ok(status === 200 || status === 403, `unexpected ${status}: ${JSON.stringify(data)}`);
    if (status === 200) {
      assert.ok(Array.isArray(data) || Array.isArray(data.users) || data.success !== false);
    }
  });

  await test('GET /api/reports/dashboard (admin/manager)', async () => {
    const { status } = await request('GET', '/api/reports/dashboard', {
      token: authToken,
      expectOk: false,
    });
    assert.ok(status === 200 || status === 403, `unexpected ${status}`);
  });

  await test('GET /api/config/delivery-methods', async () => {
    const { status } = await request('GET', '/api/config/delivery-methods', {
      token: authToken,
      expectOk: false,
    });
    assert.ok(status === 200 || status === 404, `unexpected ${status}`);
  });

  await test('POST /api/auth/logout', async () => {
    const { status, data } = await request('POST', '/api/auth/logout', { token: authToken });
    assert.ok(status === 200 || status === 204, `logout status ${status}: ${JSON.stringify(data)}`);
  });

  await test('GET /api/auth/me fails after logout', async () => {
    const { status } = await request('GET', '/api/auth/me', {
      token: authToken,
      expectOk: false,
    });
    assert.ok(status === 401 || status === 403, `expected session invalid, got ${status}`);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Integration suite crashed:', err);
  process.exit(1);
});
