import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';

vi.mock('./index', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

describe('setup', () => {
  it('should read schema.sql file', () => {
    const schemaPath = require('path').join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS organizations');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS shifts');
    expect(schema).toContain('-- Indexes');
  });
});
