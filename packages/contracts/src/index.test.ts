import { describe, expect, it } from 'vitest';
import { exportBundleSchema, isoDateSchema, legacyStateSchema } from './index';

describe('runtime contracts', () => {
  it('accepts real calendar dates and rejects impossible dates', () => {
    expect(isoDateSchema.safeParse('2026-02-28').success).toBe(true);
    expect(isoDateSchema.safeParse('2026-02-30').success).toBe(false);
  });

  it('rejects malformed export bundles at the trust boundary', () => {
    expect(exportBundleSchema.safeParse({ format: 'form-export', schemaVersion: 1 }).success).toBe(false);
  });

  it('rejects malformed legacy backups safely', () => {
    expect(legacyStateSchema.safeParse({ version: 1 }).success).toBe(false);
  });
});
