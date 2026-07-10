import {
  type ExpressiveCodeEngineConfig,
  type ExpressiveCodeTheme,
  type StyleValueOrValues,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { type ThemeRegistration } from '../core/Highlighter';
import type PrismExpressiveCodePlugin from '../main';

export interface ThemeDefinition {
  id: string;
  displayName: string;
  import: () => Promise<unknown>;
}

export const THEMES: ThemeDefinition[] = [
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

export const VALID_THEME_IDS = new Set(THEMES.map((t) => t.id));

export const THEME_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  THEMES.map((t) => [t.id, t.displayName]),
);

export const THEME_IMPORTS = Object.fromEntries(
  THEMES.map((t) => [t.id, t.import]),
);

export function getECTheme(
  useThemeColors: boolean,
): ExpressiveCodeEngineConfig['styleOverrides'] {
  let backgroundColor: UnresolvedStyleValue;
  let foregroundColor: UnresolvedStyleValue;
  let gutterBorderColor: UnresolvedStyleValue;
  let gutterTextColor: UnresolvedStyleValue;
  let gutterTextActiveColor: UnresolvedStyleValue;

  if (useThemeColors) {
    backgroundColor = ({
      theme,
    }: {
      theme: ExpressiveCodeTheme;
    }): StyleValueOrValues =>
      theme.colors['editor.background'] ?? 'var(--pec-code-background)';
    foregroundColor = ({
      theme,
    }: {
      theme: ExpressiveCodeTheme;
    }): StyleValueOrValues =>
      theme.colors['editor.foreground'] ?? 'var(--pec-code-normal)';
    gutterBorderColor = ({
      theme,
    }: {
      theme: ExpressiveCodeTheme;
    }): StyleValueOrValues =>
      theme.colors['editorLineNumber.foreground'] ??
      'var(--pec-gutter-border-color)';
    gutterTextColor = ({
      theme,
    }: {
      theme: ExpressiveCodeTheme;
    }): StyleValueOrValues =>
      theme.colors['editorLineNumber.foreground'] ??
      'var(--pec-gutter-text-color)';
    gutterTextActiveColor = ({
      theme,
    }: {
      theme: ExpressiveCodeTheme;
    }): StyleValueOrValues =>
      (theme.colors['editorLineNumber.activeForeground'] ||
        theme.colors['editorLineNumber.foreground']) ??
      'var(--pec-gutter-text-color-highlight)';
  } else {
    backgroundColor = 'var(--pec-code-background)';
    foregroundColor = 'var(--pec-code-normal)';
    gutterBorderColor = 'var(--pec-gutter-border-color)';
    gutterTextColor = 'var(--pec-gutter-text-color)';
    gutterTextActiveColor = 'var(--pec-gutter-text-color-highlight)';
  }

  return {
    borderColor: 'var(--pec-code-block-border-color)',
    borderRadius: 'var(--pec-code-block-border-radius)',
    borderWidth: 'var(--pec-code-block-border-width)',
    codeBackground: backgroundColor,
    codeFontFamily: 'var(--font-monospace)',
    codeFontSize: 'var(--code-size)',
    codeFontWeight: 'var(--font-normal)',
    codeForeground: foregroundColor,
    codeLineHeight: 'var(--line-height-normal)',
    codePaddingBlock: 'var(--size-4-3)',
    codePaddingInline: 'var(--size-4-4)',
    codeSelectionBackground: 'var(--text-selection)',
    focusBorder: 'var(--background-modifier-border)',
    scrollbarThumbColor: 'var(--scrollbar-thumb-bg)',
    scrollbarThumbHoverColor: 'var(--scrollbar-active-thumb-bg)',
    uiFontFamily: 'var(--font-interface)',
    uiFontSize: 'var(--font-text-size)',
    uiFontWeight: 'var(--font-normal)',
    uiLineHeight: 'var(--line-height-normal)',
    uiPaddingBlock: '0.2rem',
    uiPaddingInline: 'var(--size-4-4)',
    uiSelectionBackground: 'var(--text-selection)',
    uiSelectionForeground: 'var(--text-normal)',
    gutterBorderColor: gutterBorderColor,
    gutterBorderWidth: 'var(--pec-gutter-border-width)',
    gutterForeground: gutterTextColor,
    gutterHighlightForeground: gutterTextActiveColor,
    textMarkers: {
      delBackground: 'var(--pec-highlight-red-background)',
      delBorderColor: 'var(--pec-highlight-red)',
      delDiffIndicatorColor: 'var(--pec-highlight-red)',
      inlineMarkerBorderWidth: 'var(--border-width)',
      insBackground: 'var(--pec-highlight-green-background)',
      insBorderColor: 'var(--pec-highlight-green)',
      insDiffIndicatorColor: 'var(--pec-highlight-green)',
      lineDiffIndicatorMarginLeft: '0.3rem',
      lineMarkerAccentMargin: '0rem',
      lineMarkerAccentWidth: '0.15rem',
      lineMarkerLabelColor: 'white',
      lineMarkerLabelPaddingInline: '0.2rem',
      markBackground: 'var(--pec-highlight-neutral-background)',
      markBorderColor: 'var(--pec-highlight-neutral)',
    },
    frames: {
      editorActiveTabBackground: backgroundColor,
      editorActiveTabBorderColor: 'transparent',
      editorActiveTabForeground: 'var(--text-normal)',
      editorActiveTabIndicatorBottomColor: 'transparent',
      editorActiveTabIndicatorHeight: 'var(--pec-active-tab-border-width)',
      editorActiveTabIndicatorTopColor: 'var(--pec-active-tab-border-color)',
      editorBackground: backgroundColor,
      editorTabBarBackground: 'var(--color-primary)',
      editorTabBarBorderBottomColor: 'transparent',
      editorTabBarBorderColor: 'transparent',
      editorTabBorderRadius: 'var(--pec-code-border-radius)',
      editorTabsMarginBlockStart: '0',
      editorTabsMarginInlineStart: '0',
      frameBoxShadowCssValue: 'none',
      inlineButtonBackground: 'var(--background-modifier-hover)',
      inlineButtonBackgroundActiveOpacity: '1',
      inlineButtonBackgroundHoverOrFocusOpacity: '1',
      inlineButtonBackgroundIdleOpacity: '0',
      inlineButtonBorder: 'var(--pec-code-border-color)',
      inlineButtonBorderOpacity: '1',
      inlineButtonForeground: 'var(--text-normal)',
      shadowColor: 'transparent',
      terminalBackground: backgroundColor,
      terminalTitlebarBackground: backgroundColor,
      terminalTitlebarBorderBottomColor: 'transparent',
      terminalTitlebarDotsForeground: 'var(--pec-terminal-dots-color)',
      terminalTitlebarDotsOpacity: '1',
      terminalTitlebarForeground: 'var(--text-normal)',
      tooltipSuccessBackground: 'var(--pec-tooltip-background)',
      tooltipSuccessForeground: 'var(--pec-tooltip-text-color)',
    },
  };
}

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
    if (this.plugin.app.isDarkMode()) {
      return this.plugin.loadedSettings.darkTheme;
    } else {
      return this.plugin.loadedSettings.lightTheme;
    }
  }
}
