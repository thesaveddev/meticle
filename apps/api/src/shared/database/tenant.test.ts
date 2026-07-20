import { describe, it, expect } from 'vitest';
import { transaction } from './index';

describe('transaction helper', () => {
  it('should successfully commit a transaction', async () => {
    const result = await transaction(async (client) => {
      const res = await client.query('SELECT 1 as val');
      return res.rows[0].val;
    });
    expect(result).toBe(1);
  });

  it('should rollback on error', async () => {
    const pool = (await import('./index')).default;
    // Create a test table for rollback verification
    await pool.query('CREATE TEMP TABLE IF NOT EXISTS tx_test (id INT)');
    await pool.query('DELETE FROM tx_test');

    try {
      await transaction(async (client) => {
        await client.query('INSERT INTO tx_test (id) VALUES (1)');
        throw new Error('force rollback');
      });
    } catch {
      // Expected
    }

    const result = await pool.query('SELECT COUNT(*) as cnt FROM tx_test');
    expect(parseInt(result.rows[0].cnt)).toBe(0);
  });
});

describe('registration schema enforcement', () => {
  it('should only allow CARE_WORKER role in self-registration', async () => {
    const { registerSchema } = await import('../../shared/validation/schemas');

    const valid = registerSchema.safeParse({
      email: 'worker@test.com',
      password: 'Password123!',
      role: 'CARE_WORKER',
      name: 'Test Worker',
    });
    expect(valid.success).toBe(true);

    const invalid = registerSchema.safeParse({
      email: 'admin@test.com',
      password: 'Password123!',
      role: 'ORG_ADMIN',
      name: 'Test Admin',
    });
    expect(invalid.success).toBe(false);
  });
});
