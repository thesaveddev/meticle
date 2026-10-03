/**
 * Thin Google Play Developer API client.
 *
 * Uses the service-account JWT flow directly rather than pulling in
 * google-auth-library: the whole surface used here is one token exchange, and
 * the dependency would be larger than the code it replaces.
 *
 * The service account key is never read from a committed path. It comes from
 * `GOOGLE_PLAY_SERVICE_ACCOUNT` or an explicit argument, and the file is
 * gitignored (see the `meticlecare-*.json` and `*service*account*.json`
 * rules). Nothing in this repository writes that key.
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

/** Exchange a service account key for an access token. */
export async function getAccessToken(keyPath) {
  const sa = JSON.parse(readFileSync(keyPath, 'utf8'));

  if (sa.type !== 'service_account') {
    throw new Error(`${keyPath} is not a service account key (type: ${sa.type})`);
  }
  if (!sa.private_key || !sa.client_email) {
    throw new Error(`${keyPath} is missing private_key or client_email`);
  }

  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'RS256', typ: 'JWT' });
  const claims = b64({
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  });

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${signer.sign(sa.private_key, 'base64url')}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(`Could not authenticate as ${sa.client_email}: HTTP ${res.status} ${JSON.stringify(body)}`);
  }
  return { token: body.access_token, account: sa.client_email };
}

export class PlayApi {
  constructor(token) {
    this.token = token;
  }

  async #request(method, url, body, headers = {}) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      // Play returns an HTML error page for some failures; surface something
      // readable rather than a bare SyntaxError.
      throw new Error(`HTTP ${res.status} from ${method} ${url}\n${text.slice(0, 400)}`);
    }

    if (!res.ok) {
      const err = parsed?.error?.errors?.[0] ?? parsed?.error ?? {};
      throw new Error(`HTTP ${res.status} ${err.domain ?? ''} ${err.reason ?? ''}: ${err.message ?? text.slice(0, 300)}`);
    }
    return parsed;
  }

  edits(packageName) {
    return `${API}/applications/${packageName}/edits`;
  }

  /** Open an edit. Every listing change is scoped to one of these. */
  insertEdit(packageName) {
    return this.#request('POST', `${this.edits(packageName)}`, {});
  }

  commitEdit(packageName, editId) {
    return this.#request('POST', `${this.edits(packageName)}/${editId}:commit`, {});
  }

  deleteEdit(packageName, editId) {
    return this.#request('DELETE', `${this.edits(packageName)}/${editId}`).catch(() => null);
  }

  getListing(packageName, editId, language) {
    return this.#request('GET', `${this.edits(packageName)}/${editId}/listings/${language}`);
  }

  listListings(packageName, editId) {
    return this.#request('GET', `${this.edits(packageName)}/${editId}/listings`);
  }

  /** `listings` (no language) carries the default title, short and full description. */
  updateListing(packageName, editId, body) {
    return this.#request('PUT', `${this.edits(packageName)}/${editId}/listings`, body);
  }

  patchListing(packageName, editId, language, body) {
    return this.#request('PATCH', `${this.edits(packageName)}/${editId}/listings/${language}`, body);
  }

  /**
   * Two-step image upload. Play does not take the bytes on the edit endpoint:
   * the POST returns a one-time upload URI, which then receives a raw PUT.
   */
  async uploadImage(packageName, editId, language, imageType, bytes) {
    const { uploadUri } = await this.#request(
      'POST',
      `${this.edits(packageName)}/${editId}/listings/${language}/${imageType}`,
      {},
    );
    if (!uploadUri) throw new Error('Play did not return an uploadUri for ' + imageType);

    const res = await fetch(uploadUri, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: bytes,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Image upload failed for ${imageType}: HTTP ${res.status} ${text.slice(0, 300)}`);
    }
    return { image: JSON.parse(text).image };
  }

  /**
   * Data safety is not an edit resource. It is its own endpoint taking the CSV
   * as a string, and it applies immediately - it cannot be rolled back with
   * `deleteEdit`.
   */
  setDataSafety(packageName, csv) {
    return this.#request('POST', `${API}/applications/${packageName}/dataSafety`, {
      safetyLabels: csv,
    });
  }
}