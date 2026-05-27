import { OBSIDIAN_THEME_IDENTIFIER } from 'packages/obsidian/src/themes/ThemeRegistry';

export enum FrameType {
	Code = 'code',
	Terminal = 'terminal',
	None = 'none',
	Auto = 'auto',
}

export enum CollapseStyle {
	Github = 'github',
	CollapsibleStart = 'collapsible-start',
	CollapsibleEnd = 'collapsible-end',
	CollapsibleAuto = 'collapsible-auto',
}

export interface Settings {
	darkTheme: string;
	lightTheme: string;
	preferThemeColors: boolean;
	inlineHighlighting: boolean;
	ecDefaultShowLineNumbers: boolean;
	ecDefaultWrap: boolean;
	ecDefaultFrame: FrameType;
	ecDefaultCollapseStyle: CollapseStyle;
}

export const DEFAULT_SETTINGS: Settings = {
	darkTheme: OBSIDIAN_THEME_IDENTIFIER,
	lightTheme: OBSIDIAN_THEME_IDENTIFIER,
	preferThemeColors: true,
	inlineHighlighting: true,
	ecDefaultShowLineNumbers: false,
	ecDefaultWrap: false,
	ecDefaultFrame: FrameType.Auto,
	ecDefaultCollapseStyle: CollapseStyle.CollapsibleAuto,
};
