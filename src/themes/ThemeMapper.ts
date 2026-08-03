import { type App } from 'obsidian';
import { type ThemeRegistration } from './types';
import { THEMES } from '../config';
import { type Settings } from '../settings/types';

/**
 * Returns the active theme registration based on Obsidian's dark/light mode and user settings.
 */
export function getThemeForEC(app: App, settings: Settings): ThemeRegistration {
  const activeThemeId = app.isDarkMode()
    ? settings.darkTheme
    : settings.lightTheme;

  const themeDef = THEMES.find((t) => t.id === activeThemeId) ?? THEMES[0]!;
  return themeDef.theme;
}
