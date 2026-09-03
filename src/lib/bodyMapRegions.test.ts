import { describe, expect, it } from 'vitest';
import { BODY_MAP_REGIONS, bodyMapRegionById, bodyMapRegionsForView } from './bodyMapRegions';

describe('body map regions', () => {
  it('keeps region ids unique and normalized coordinates inside the canvas', () => {
    const ids = BODY_MAP_REGIONS.map((region) => region.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const region of BODY_MAP_REGIONS) {
      expect(region.x).toBeGreaterThanOrEqual(0);
      expect(region.x).toBeLessThanOrEqual(1);
      expect(region.y).toBeGreaterThanOrEqual(0);
      expect(region.y).toBeLessThanOrEqual(1);
    }
  });

  it('supports anterior and posterior guided regions', () => {
    expect(bodyMapRegionsForView('front').length).toBeGreaterThan(10);
    expect(bodyMapRegionsForView('back').length).toBeGreaterThan(10);
  });

  it('resolves persisted semantic region ids', () => {
    expect(bodyMapRegionById('back_lumbar_right')?.label).toBe('Lombar direita');
    expect(bodyMapRegionById(null)).toBeNull();
  });
});
