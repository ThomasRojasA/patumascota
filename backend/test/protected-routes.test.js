import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import movementsRouter from '../src/routes/movements.js';
import productsRouter from '../src/routes/products.js';
import salesRouter from '../src/routes/sales.js';
import { requireAdmin } from '../src/auth.js';

test('all administrative API routes reject unauthenticated requests', async () => {
  process.env.ADMIN_PASSWORD = 'qa-admin-password-2026';
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/products', productsRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/movements', movementsRouter);
  app.get('/api/dashboard', requireAdmin, (_req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  await once(server, 'listening');

  const requests = [
    ['GET', '/api/products?includeInactive=true'],
    ['POST', '/api/products', '{}'],
    ['PUT', '/api/products/1', '{}'],
    ['DELETE', '/api/products/1'],
    ['POST', '/api/products/1/image'],
    ['GET', '/api/sales'],
    ['POST', '/api/sales', '{}'],
    ['GET', '/api/movements'],
    ['POST', '/api/movements', '{}'],
    ['GET', '/api/dashboard']
  ];

  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [method, path, body] of requests) {
      const response = await fetch(`${base}${path}`, {
        method,
        ...(body !== undefined ? {
          headers: { 'Content-Type': 'application/json' },
          body
        } : {})
      });
      assert.equal(response.status, 401, `${method} ${path} should require an administrator session`);
    }
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
