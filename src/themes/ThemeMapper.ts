import { type ThemeRegistration } from 'src/core/types';
import type * as hast_types from 'hast';
import type ShikiPlugin from 'src/main';
import { THEME_IMPORTS } from 'src/themes/ThemeRegistry';

export class ThemeMapper {
	plugin: ShikiPlugin;
	private cachedThemeId?: string;
	private cachedTheme?: ThemeRegistration;

	constructor(plugin: ShikiPlugin) {
		this.plugin = plugin;
	}

	private async loadEssentialTheme(activeTheme: string): Promise<ThemeRegistration> {
		const themeLoader = THEME_IMPORTS[activeTheme];
		if (themeLoader) {
			return (await themeLoader()).default as ThemeRegistration;
		}
		return (await THEME_IMPORTS['one-dark-pro']()).default as ThemeRegistration;
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
		if (this.plugin.app.isDarkMode()) {
			return this.plugin.loadedSettings.darkTheme;
		} else {
			return this.plugin.loadedSettings.lightTheme;
		}
	}

	/**
	 * Maps the placeholder colors in the AST to CSS variables (no-op as ObsidianTheme is dropped).
	 */
	fixAST(ast: hast_types.Parents): hast_types.Parents {
		return ast;
	}
}
