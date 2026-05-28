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
	darkTheme: 'one-dark-pro',
	lightTheme: 'one-light',
	preferThemeColors: true,
	inlineHighlighting: true,
	ecDefaultShowLineNumbers: false,
	ecDefaultWrap: false,
	ecDefaultFrame: FrameType.Auto,
	ecDefaultCollapseStyle: CollapseStyle.CollapsibleAuto,
};
