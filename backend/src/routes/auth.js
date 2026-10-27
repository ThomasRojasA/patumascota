import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  ADMIN_SESSION_LIFETIME_MS,
  adminSessionCookieName,
  createAdminSession,
  requireAdmin,
  revokeAdminSession,
  verifyAdminPassword
} from '../auth.js';

const router = Router();
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => res.status(429).json({
    error: 'Demasiados intentos de inicio de sesión. Espera 15 minutos antes de volver a intentarlo.'
  })
});

function sessionCookieOptions(includeLifetime = true) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  };
  if (includeLifetime) options.maxAge = ADMIN_SESSION_LIFETIME_MS;
  return options;
}

router.post('/login', loginLimiter, (req, res) => {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return res.status(503).json({ error: 'El acceso de administrador no está configurado en el servidor.' });
  }
  if (!verifyAdminPassword(req.body?.password, password)) {
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  }

  const session = createAdminSession(password);
  res.cookie(adminSessionCookieName(), session.sessionId, sessionCookieOptions());
  res.json({ csrfToken: session.csrfToken });
});

router.get('/me', requireAdmin, (req, res) => res.json({
  authenticated: true,
  csrfToken: req.adminCsrfToken
}));

router.post('/logout', requireAdmin, (req, res) => {
  revokeAdminSession(req.adminSessionId);
  res.clearCookie(adminSessionCookieName(), sessionCookieOptions(false));
  res.status(204).end();
});

export default router;
