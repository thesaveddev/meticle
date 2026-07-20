import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  name: 'caredesk-api',
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
    paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.newPassword', 'body.confirmPassword', 'body.token', 'body.secret', 'body.backupCode', 'body.mfaCode'],
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
