import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const socketConnectionsTotal = new client.Counter({
  name: 'socket_connections_total',
  help: 'Total number of socket connections',
  labelNames: ['transport'],
});

const socketDisconnectionsTotal = new client.Counter({
  name: 'socket_disconnections_total',
  help: 'Total number of socket disconnections',
  labelNames: ['reason'],
});

const socketEventsTotal = new client.Counter({
  name: 'socket_events_total',
  help: 'Total number of socket events received',
  labelNames: ['event'],
});

const socketErrorsTotal = new client.Counter({
  name: 'socket_errors_total',
  help: 'Total number of socket errors',
  labelNames: ['kind'],
});

const socketActiveConnections = new client.Gauge({
  name: 'socket_active_connections',
  help: 'Current number of active socket connections',
});

const socketPresence = new client.Gauge({
  name: 'socket_online_users',
  help: 'Current number of online users',
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(socketConnectionsTotal);
register.registerMetric(socketDisconnectionsTotal);
register.registerMetric(socketEventsTotal);
register.registerMetric(socketErrorsTotal);
register.registerMetric(socketActiveConnections);
register.registerMetric(socketPresence);

export function recordSocketConnection(transport: string) {
  socketConnectionsTotal.labels(transport).inc();
}

export function recordSocketDisconnection(reason: string) {
  socketDisconnectionsTotal.labels(reason).inc();
}

export function recordSocketEvent(event: string) {
  socketEventsTotal.labels(event).inc();
}

export function recordSocketError(kind: string) {
  socketErrorsTotal.labels(kind).inc();
}

export function setSocketActiveConnections(count: number) {
  socketActiveConnections.set(count);
}

export function setSocketOnlineUsers(count: number) {
  socketPresence.set(count);
}

export function metricsMiddleware(req: any, res: any, next: any) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const statusCode = String(res.statusCode);

    httpRequestDuration.labels(method, route, statusCode).observe(duration);
    httpRequestTotal.labels(method, route, statusCode).inc();
  });

  next();
}

export async function getMetrics() {
  return register.metrics();
}

export { register };
