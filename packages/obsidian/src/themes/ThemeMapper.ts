import { type ThemeRegistration } from 'shiki/core';
import type * as hast_types from 'hast';
import { OBSIDIAN_THEME } from 'packages/ec-core/src/ObsidianTheme';
import type ShikiPlugin from 'packages/obsidian/src/main';
import { ESSENTIAL_THEMES } from 'packages/obsidian/src/Highlighter';

export const OBSIDIAN_THEME_IDENTIFIER = 'obsidian-theme';

export class ThemeMapper {
	plugin: ShikiPlugin;
	mapCounter: number;
	mapping: Map<string, string>;

	constructor(plugin: ShikiPlugin) {
		this.plugin = plugin;

		this.mapCounter = 0;
		this.mapping = new Map();
	}

	private async loadEssentialTheme(activeTheme: string): Promise<ThemeRegistration> {
		const themeLoader = ESSENTIAL_THEMES[activeTheme as keyof typeof ESSENTIAL_THEMES];
		if (themeLoader) {
			return (await themeLoader()).default as ThemeRegistration;
		}
		return (await ESSENTIAL_THEMES['one-dark-pro']()).default as ThemeRegistration;
	}

	async getThemeForEC(): Promise<ThemeRegistration> {
		const activeTheme = this.getThemeIdentifier();

		if (!this.usingObsidianTheme()) {
			return this.loadEssentialTheme(activeTheme);
		}

		return {
			displayName: OBSIDIAN_THEME.displayName,
			name: OBSIDIAN_THEME.name,
			semanticHighlighting: OBSIDIAN_THEME.semanticHighlighting,
			colors: Object.fromEntries(Object.entries(OBSIDIAN_THEME.colors).map(([key, value]) => [key, this.mapColor(value)])),
			tokenColors: OBSIDIAN_THEME.tokenColors.map(token => {
				const newToken = { ...token };

				if (newToken.settings) {
					newToken.settings = { ...newToken.settings };
				}

				if (newToken.settings.foreground) {
					newToken.settings.foreground = this.mapColor(newToken.settings.foreground);
				}

				return newToken;
			}),
		};
	}

	getThemeIdentifier(): string {
		if (this.plugin.app.isDarkMode()) {
			return this.plugin.loadedSettings.darkTheme;
		} else {
			return this.plugin.loadedSettings.lightTheme;
		}
	}

	usingObsidianTheme(): boolean {
		return this.getThemeIdentifier() === OBSIDIAN_THEME_IDENTIFIER;
	}

	/**
	 * Maps a color or CSS variable to a hex color.
	 */
	mapColor(color: string): string {
		if (this.mapping.has(color)) {
			return this.mapping.get(color)!;
		} else {
			const newColor = `#${this.mapCounter.toString(16).padStart(6, '0').toUpperCase()}`;
			this.mapCounter += 1;
			this.mapping.set(color, newColor);
			return newColor;
		}
	}

	/**
	 * Maps the placeholder colors in the AST to CSS variables.
	 */
	fixAST(ast: hast_types.Parents): hast_types.Parents {
		if (!this.usingObsidianTheme()) {
			return ast;
		}

		ast.children = ast.children.map((child: any) => {
			if (child.type === 'element') {
				return this.fixNode(child);
			} else {
				return child;
			}
		});

		return ast;
	}

	private fixNode(node: hast_types.Element): hast_types.Element {
		if (node.properties?.style) {
			let style = node.properties.style as string;
			for (const [key, value] of this.mapping) {
				style = style.replaceAll(value, key);
			}
			node.properties.style = style;
		}

		for (const child of node.children) {
			if (child.type === 'element') {
				this.fixNode(child);
			}
		}

		return node;
	}
}
