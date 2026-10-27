import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import authRouter from '../src/routes/auth.js';
import { requireAdmin } from '../src/auth.js';

test('admin login uses protected, CSRF-checked, rate-limited sessions', async () => {
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousEnvironment = process.env.NODE_ENV;
  process.env.ADMIN_PASSWORD = 'qa-admin-password-2026';
  process.env.NODE_ENV = 'production';

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.get('/api/protected', requireAdmin, (req, res) => res.json({ ok: true }));
  app.post('/api/protected', requireAdmin, (_req, res) => res.status(204).end());
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const unauthenticated = await fetch(`${base}/protected`);
    assert.equal(unauthenticated.status, 401);

    const malformedLogin = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(malformedLogin.status, 401);

    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD })
    });
    assert.equal(login.status, 200);
    const loginBody = await login.json();
    assert.equal(typeof loginBody.csrfToken, 'string');
    assert.equal('token' in loginBody, false);

    const setCookie = login.headers.get('set-cookie');
    assert.ok(setCookie);
    assert.match(setCookie, /^__Host-admin_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /SameSite=Strict/i);
    assert.match(setCookie, /Path=\//i);
    assert.match(setCookie, /Max-Age=43200/i);
    const sessionCookie = setCookie.split(';')[0];

    const sessionCheck = await fetch(`${base}/auth/me`, {
      headers: { Cookie: sessionCookie }
    });
    assert.equal(sessionCheck.status, 200);
    const sessionBody = await sessionCheck.json();
    assert.equal(sessionBody.csrfToken, loginBody.csrfToken);

    const missingCsrf = await fetch(`${base}/protected`, {
      method: 'POST',
      headers: { Cookie: sessionCookie }
    });
    assert.equal(missingCsrf.status, 403);

    const invalidCsrf = await fetch(`${base}/protected`, {
      method: 'POST',
      headers: { Cookie: sessionCookie, 'X-CSRF-Token': 'forged-token' }
    });
    assert.equal(invalidCsrf.status, 403);

    const validCsrf = await fetch(`${base}/protected`, {
      method: 'POST',
      headers: { Cookie: sessionCookie, 'X-CSRF-Token': loginBody.csrfToken }
    });
    assert.equal(validCsrf.status, 204);

    const logout = await fetch(`${base}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: sessionCookie, 'X-CSRF-Token': loginBody.csrfToken }
    });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie') || '', /Expires=Thu, 01 Jan 1970/i);

    const revokedSession = await fetch(`${base}/auth/me`, {
      headers: { Cookie: sessionCookie }
    });
    assert.equal(revokedSession.status, 401);

    const secondLogin = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD })
    });
    assert.equal(secondLogin.status, 200);
    const secondCookie = secondLogin.headers.get('set-cookie').split(';')[0];
    process.env.ADMIN_PASSWORD = 'rotated-admin-password-2026';
    const invalidatedSession = await fetch(`${base}/auth/me`, {
      headers: { Cookie: secondCookie }
    });
    assert.equal(invalidatedSession.status, 401);
    process.env.ADMIN_PASSWORD = 'qa-admin-password-2026';

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const failedLogin = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-password' })
      });
      assert.equal(failedLogin.status, 401);
    }

    const rateLimitedLogin = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD })
    });
    assert.equal(rateLimitedLogin.status, 429);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});
