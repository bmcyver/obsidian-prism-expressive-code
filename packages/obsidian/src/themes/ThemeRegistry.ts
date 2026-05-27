
export interface ThemeDefinition {
	id: string;
	displayName: string;
	import?: () => Promise<any>;
}

export const OBSIDIAN_THEME_IDENTIFIER = 'obsidian-theme';

export const THEMES: ThemeDefinition[] = [
	{
		id: OBSIDIAN_THEME_IDENTIFIER,
		displayName: 'Obsidian built-in (both)',
	},
	{
		id: 'one-dark-pro',
		displayName: 'One Dark Pro (dark)',
		import: () => import('shiki/themes/one-dark-pro.mjs'),
	},
	{
		id: 'one-light',
		displayName: 'One Light (light)',
		import: () => import('shiki/themes/one-light.mjs'),
	},
];

export const VALID_THEME_IDS = new Set(THEMES.map(t => t.id));

export const THEME_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
	THEMES.map(t => [t.id, t.displayName])
);

export const THEME_IMPORTS = Object.fromEntries(
	THEMES.filter(t => t.import).map(t => [t.id, t.import!])
);
