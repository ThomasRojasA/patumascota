import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeLogEvent } from './log-utils.js';

test('sanitizes credentials and customer data from API responses', () => {
  const event = sanitizeLogEvent({
    type: 'api',
    method: 'post',
    path: '/api/auth/login?debug=1',
    status: 200,
    response: {
      csrfToken: 'csrf-value',
      password: 'password-value',
      customer: 'Customer name',
      notes: 'Private customer note',
      products: [{ id: 1, image: 'https://res.cloudinary.com/private-image' }]
    }
  });

  assert.equal(event.path, '/api/auth/login');
  assert.equal(event.method, 'POST');
  assert.equal(event.response.csrfToken, '[REDACTED]');
  assert.equal(event.response.password, '[REDACTED]');
  assert.equal(event.response.customer, '[REDACTED]');
  assert.equal(event.response.notes, '[REDACTED]');
  assert.equal(event.response.products[0].image, '[REDACTED]');
});

test('limits response depth and list size', () => {
  const event = sanitizeLogEvent({
    type: 'api',
    response: {
      items: Array.from({ length: 25 }, (_, id) => ({ id })),
      nested: { a: { b: { c: { d: { e: { value: 'too deep' } } } } } }
    }
  });

  assert.equal(event.response.items.length, 20);
  assert.equal(event.response.nested.a.b.c.d, '[MAX_DEPTH]');
});

test('rejects invalid log event payloads', () => {
  assert.throws(() => sanitizeLogEvent(null), TypeError);
  assert.throws(() => sanitizeLogEvent([]), TypeError);
});
