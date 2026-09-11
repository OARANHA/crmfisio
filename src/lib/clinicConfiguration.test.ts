import { describe, expect, it } from 'vitest';
import {
  CLINIC_WEEKDAYS,
  listIanaTimeZones,
  normalizeOpeningHours,
  openingHourForToggle,
  validateOpeningHours,
} from './clinicConfiguration';

describe('clinic configuration helpers', () => {
  it('uses an explicit Monday-Sunday 0..6 contract', () => {
    expect(CLINIC_WEEKDAYS.map((item) => item.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(CLINIC_WEEKDAYS[0]?.label).toBe('Segunda');
    expect(CLINIC_WEEKDAYS[6]?.label).toBe('Domingo');
  });

  it('normalizes a partial backend schedule into seven days', () => {
    const rows = normalizeOpeningHours([
      { clinic_id: 'clinic-a', day_of_week: 0, is_open: true, opens_at: '08:00:00', closes_at: '18:00:00' },
    ]);

    expect(rows).toHaveLength(7);
    expect(rows[0]).toEqual({ day_of_week: 0, is_open: true, opens_at: '08:00', closes_at: '18:00' });
    expect(rows[6]).toEqual({ day_of_week: 6, is_open: false, opens_at: null, closes_at: null });
  });

  it('creates a valid default interval only when a closed day is explicitly opened', () => {
    const closed = { day_of_week: 2, is_open: false, opens_at: null, closes_at: null };
    expect(openingHourForToggle(closed, true)).toEqual({ day_of_week: 2, is_open: true, opens_at: '08:00', closes_at: '18:00' });
    expect(openingHourForToggle({ ...closed, is_open: true, opens_at: '09:00', closes_at: '17:00' }, false)).toEqual(closed);
  });

  it('rejects incomplete weeks and invalid opening intervals', () => {
    const validWeek = CLINIC_WEEKDAYS.map(({ day }) => ({
      day_of_week: day,
      is_open: day < 5,
      opens_at: day < 5 ? '08:00' : null,
      closes_at: day < 5 ? '18:00' : null,
    }));
    expect(validateOpeningHours(validWeek)).toBeNull();
    expect(validateOpeningHours(validWeek.slice(0, 6))).toBe('Informe os sete dias da semana.');
    expect(validateOpeningHours(validWeek.map((row) => row.day_of_week === 0 ? { ...row, opens_at: '19:00' } : row))).toContain('Segunda');
  });

  it('exposes IANA timezones without imposing a Brazil-only default', () => {
    const zones = listIanaTimeZones();
    expect(zones).toContain('UTC');
    expect(new Set(zones).size).toBe(zones.length);
  });
});
