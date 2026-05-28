import { type ThemeRegistration } from 'packages/ec-core/src/types';
import type * as hast_types from 'hast';
import type ShikiPlugin from 'packages/obsidian/src/main';
import { THEME_IMPORTS } from 'packages/obsidian/src/themes/ThemeRegistry';

export class ThemeMapper {
	plugin: ShikiPlugin;

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
		return this.loadEssentialTheme(activeTheme);
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
