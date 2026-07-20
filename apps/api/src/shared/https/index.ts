import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ServerOptions } from 'https';
import logger from '../utils/logger';

export function getHttpsOptions(): ServerOptions | null {
  if (process.env.HTTPS !== 'true') return null;

  const certPath = process.env.HTTPS_CERT_PATH || resolve('certs/cert.pem');
  const keyPath = process.env.HTTPS_KEY_PATH || resolve('certs/key.pem');

  try {
    return {
      cert: readFileSync(certPath),
      key: readFileSync(keyPath),
    };
  } catch (err) {
    logger.warn('HTTPS certs not found. Generate with: npm run certs:generate');
    return null;
  }
}
