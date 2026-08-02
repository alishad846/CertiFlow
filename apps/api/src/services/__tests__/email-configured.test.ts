import { describe, it, expect } from 'vitest';
import { isCompanyEmailConfigured } from '../email';
import { seedTemplateFixture } from './helpers';
import { pool } from '../../db/pool';

describe('isCompanyEmailConfigured', () => {
  it('is false with no settings row, true when enabled with a host', async () => {
    const { companyId } = await seedTemplateFixture();
    expect(await isCompanyEmailConfigured(companyId)).toBe(false);

    await pool.query(
      `INSERT INTO company_email_settings (company_id, smtp_host, enabled) VALUES ($1, 'smtp.test', true)`,
      [companyId]
    );
    expect(await isCompanyEmailConfigured(companyId)).toBe(true);
  });

  it('is false when a settings row exists but is disabled', async () => {
    const { companyId } = await seedTemplateFixture();
    await pool.query(
      `INSERT INTO company_email_settings (company_id, smtp_host, enabled) VALUES ($1, 'smtp.test', false)`,
      [companyId]
    );
    expect(await isCompanyEmailConfigured(companyId)).toBe(false);
  });

  it('is false for a null company id', async () => {
    expect(await isCompanyEmailConfigured(null)).toBe(false);
  });
});
