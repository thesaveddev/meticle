import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  name: 'meticle-api',
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l' },
        },
      }),
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.newPassword', 'req.body.confirmPassword', 'req.body.token', 'req.body.secret', 'req.body.backupCode', 'req.body.mfaCode', 'req.body.mfaToken', 'req.body.refreshToken'],
    censor: '[REDACTED]',
  },
});

export default logger;

/**
 * Returns a catch handler that logs the error at warn level instead of swallowing it.
 * Use for fire-and-forget async operations (email, notifications, etc.)
 * where failure should not crash the request but should still be observable.
 */
export function logWarn(label: string) {
  return (err: unknown) => {
    logger.warn({ err }, label);
  };
}
