import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

export function adminSessionCookieName() {
  return process.env.NODE_ENV === 'production' ? '__Host-admin_session' : 'admin_session';
}

const sessions = new Map();

function fingerprint(value) {
  return createHash('sha256').update(value).digest();
}

function equalBuffers(left, right) {
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createAdminSession(password) {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }

  const sessionId = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  sessions.set(sessionId, {
    csrfToken,
    passwordFingerprint: fingerprint(password),
    expiresAt: now + ADMIN_SESSION_LIFETIME_MS
  });
  return { sessionId, csrfToken };
}

export function revokeAdminSession(sessionId) {
  sessions.delete(sessionId);
}

export function requireAdmin(req, res, next) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return res.status(503).json({ error: 'El acceso de administrador no está configurado en el servidor.' });
  }

  const sessionId = req.cookies?.[adminSessionCookieName()];
  const session = sessionId && sessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now() ||
      !equalBuffers(session.passwordFingerprint, fingerprint(password))) {
    if (sessionId) sessions.delete(sessionId);
    return res.status(401).json({ error: 'Inicia sesión como administrador para continuar.' });
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const csrfHeader = req.get('x-csrf-token') || '';
    if (!equalBuffers(Buffer.from(csrfHeader), Buffer.from(session.csrfToken))) {
      return res.status(403).json({ error: 'La solicitud no superó la validación de seguridad. Recarga la sesión.' });
    }
  }

  req.adminSessionId = sessionId;
  req.adminCsrfToken = session.csrfToken;
  next();
}

export function verifyAdminPassword(candidate, configuredPassword) {
  if (!configuredPassword) return false;
  const submitted = String(candidate || '');
  if (Buffer.byteLength(submitted) > 1024) return false;
  return equalBuffers(fingerprint(submitted), fingerprint(configuredPassword));
}
