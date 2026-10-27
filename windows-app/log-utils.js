const privateField = /password|token|secret|authorization|cookie|customer|email|phone|address|notes|image|csrf|api.?key|apikey/i;

function sanitizeValue(value, key = '', depth = 0) {
  if (privateField.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (depth >= 5) return '[MAX_DEPTH]';
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(item => sanitizeValue(item, '', depth + 1));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 30)
        .map(([childKey, childValue]) => [
          childKey.slice(0, 80),
          sanitizeValue(childValue, childKey, depth + 1)
        ])
    );
  }
  return String(value).slice(0, 500);
}

export function sanitizeLogEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new TypeError('El evento de registro debe ser un objeto.');
  }

  const safeEvent = {
    type: ['api', 'connection', 'desktop'].includes(event.type) ? event.type : 'api',
    timestamp: new Date().toISOString()
  };

  if (event.method !== undefined) {
    safeEvent.method = String(event.method).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12);
  }
  if (event.path !== undefined) {
    safeEvent.path = String(event.path).split(/[?#]/, 1)[0].slice(0, 180);
  }
  if (event.status === null || Number.isFinite(event.status)) safeEvent.status = event.status;
  if (Number.isFinite(event.durationMs)) safeEvent.durationMs = Math.max(0, Math.round(event.durationMs));
  if (event.connection !== undefined) {
    safeEvent.connection = String(event.connection).slice(0, 20);
  }
  if (event.event !== undefined) safeEvent.event = String(event.event).slice(0, 60);
  if (event.response !== undefined) safeEvent.response = sanitizeValue(event.response);
  if (event.error !== undefined) safeEvent.error = sanitizeValue(String(event.error), 'error');

  return safeEvent;
}
