import { describe, it, expect } from 'vitest';
import { resolveTheme, type ThemeSetting } from '../src/ui/theme';

describe('resolveTheme', () => {
  it('auto follows whatever the device asks for', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
  });

  it('sun up stays light even on a dark device', () => {
    expect(resolveTheme('up', true)).toBe('light');
    expect(resolveTheme('up', false)).toBe('light');
  });

  it('sun down stays dark even on a light device', () => {
    expect(resolveTheme('down', false)).toBe('dark');
    expect(resolveTheme('down', true)).toBe('dark');
  });

  it('falls back to the device when storage holds something unexpected', () => {
    expect(resolveTheme('midnight' as ThemeSetting, true)).toBe('dark');
    expect(resolveTheme('midnight' as ThemeSetting, false)).toBe('light');
  });
});
