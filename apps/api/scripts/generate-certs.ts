import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const certsDir = resolve('certs');
if (!existsSync(certsDir)) mkdirSync(certsDir, { recursive: true });

if (!existsSync(resolve(certsDir, 'key.pem'))) {
  execSync(
    `openssl req -x509 -nodes -days 365 -newkey rsa:2048 ` +
    `-keyout ${certsDir}/key.pem -out ${certsDir}/cert.pem ` +
    `-subj "/C=GB/ST=London/L=London/O=Meticle/OU=Dev/CN=localhost"`,
    { stdio: 'inherit' }
  );
  console.log('Self-signed certs generated in', certsDir);
} else {
  console.log('Certs already exist in', certsDir);
}
