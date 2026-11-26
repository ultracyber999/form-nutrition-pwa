import { describe, expect, it } from 'vitest';
import { dailyCheckinSchema, exportBundleSchema, isoDateSchema, legacyStateSchema } from './index';

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
  it('accepts pre-deployment check-ins without the optional symptoms flag', () => {
    const row = { id: '00000000-0000-4000-8000-000000000001', localDate: '2026-11-26', steps: null, waterMl: null, sleepMinutes: null, trainingStatus: null, hunger1to5: null, energy1to5: null, notes: null, createdAt: '2026-11-26T00:00:00.000Z', updatedAt: '2026-11-26T00:00:00.000Z', version: 1 };
    expect(dailyCheckinSchema.safeParse(row).success).toBe(true);
    expect(dailyCheckinSchema.safeParse({ ...row, concerningSymptoms: true }).success).toBe(true);
  });
});
