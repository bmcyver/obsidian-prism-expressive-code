import { type ThemeRegistration } from './types';
import { THEME_IMPORTS } from './definitions';
import type PrismExpressiveCodePlugin from '../main';

export class ThemeMapper {
  plugin: PrismExpressiveCodePlugin;
  private cachedThemeId?: string;
  private cachedTheme?: ThemeRegistration;

  constructor(plugin: PrismExpressiveCodePlugin) {
    this.plugin = plugin;
  }

  private async loadEssentialTheme(
    activeTheme: string,
  ): Promise<ThemeRegistration> {
    const themeLoader = THEME_IMPORTS[activeTheme];
    if (themeLoader) {
      return ((await themeLoader()) as { default: ThemeRegistration }).default;
    }
    const fallbackLoader = THEME_IMPORTS['one-dark-pro'];
    if (!fallbackLoader) {
      throw new Error('Fallback theme not found');
    }
    return ((await fallbackLoader()) as { default: ThemeRegistration }).default;
  }

  async getThemeForEC(): Promise<ThemeRegistration> {
    const activeTheme = this.getThemeIdentifier();
    if (this.cachedThemeId === activeTheme && this.cachedTheme) {
      return this.cachedTheme;
    }
    this.cachedTheme = await this.loadEssentialTheme(activeTheme);
    this.cachedThemeId = activeTheme;
    return this.cachedTheme;
  }

  getThemeIdentifier(): string {
    return this.plugin.app.isDarkMode()
      ? this.plugin.loadedSettings.darkTheme
      : this.plugin.loadedSettings.lightTheme;
  }
}
