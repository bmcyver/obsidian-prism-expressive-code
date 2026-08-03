export interface ThemeRegistration {
  name: string;
  displayName?: string;
  type?: string;
  colors: Record<string, string>;
}

export interface ThemeDefinition {
  id: string;
  displayName: string;
  theme: ThemeRegistration;
}
