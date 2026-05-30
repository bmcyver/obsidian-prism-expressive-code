export interface ThemeRegistration {
	name: string;
	displayName?: string;
	type?: 'light' | 'dark' | string;
	colors: Record<string, string>;
	tokenColors: any[];
	settings?: any[];
	semanticHighlighting?: boolean;
}
