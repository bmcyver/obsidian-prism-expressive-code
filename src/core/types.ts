export interface ThemeRegistration {
  name: string;
  displayName?: string;
  type?: string;
  colors: Record<string, string>;
  tokenColors: unknown[];
  settings?: unknown[];
  semanticHighlighting?: boolean;
}
