import { describe, expect, it } from 'vitest';
import type { ColorTheme } from './colorTheme';

describe('color theme contract', () => {
  it('keeps supported themes explicit', () => {
    const themes: ColorTheme[] = ['light', 'dark'];
    expect(themes).toEqual(['light', 'dark']);
  });
});
