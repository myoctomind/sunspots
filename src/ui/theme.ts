/** Theme choice: sun up (light), sun down (dark), or auto (whatever the device asks for). */
export type ThemeSetting = 'auto' | 'up' | 'down';
export type Theme = 'light' | 'dark';

/** Pure: given the stored setting and the device preference, which theme wins. */
export function resolveTheme(setting: ThemeSetting, prefersDark: boolean): Theme {
  if (setting === 'up') return 'light';
  if (setting === 'down') return 'dark';
  return prefersDark ? 'dark' : 'light';
}
