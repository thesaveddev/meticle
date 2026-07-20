import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';

const app = express();
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

describe('HTTP server', () => {
  it('should respond to health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
  });
});
