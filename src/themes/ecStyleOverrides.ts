import {
  type ExpressiveCodeEngineConfig,
  type ExpressiveCodeTheme,
  type StyleValueOrValues,
  type UnresolvedStyleValue,
} from '@expressive-code/core';

/**
 * Creates a resolver that reads a color from the theme, falling back to a CSS variable.
 */
function themeColor(
  colorKey: string,
  fallbackVar: string,
): UnresolvedStyleValue {
  return ({ theme }: { theme: ExpressiveCodeTheme }): StyleValueOrValues =>
    theme.colors[colorKey] ?? fallbackVar;
}

/**
 * Creates a resolver that tries multiple color keys, falling back to a CSS variable.
 */
function themeColorWithFallback(
  colorKeys: string[],
  fallbackVar: string,
): UnresolvedStyleValue {
  return ({ theme }: { theme: ExpressiveCodeTheme }): StyleValueOrValues => {
    for (const key of colorKeys) {
      const value = theme.colors[key];
      if (value) return value;
    }
    return fallbackVar;
  };
}

export function getECTheme(
  useThemeColors: boolean,
): ExpressiveCodeEngineConfig['styleOverrides'] {
  const bg = useThemeColors
    ? themeColor('editor.background', 'var(--pec-code-background)')
    : 'var(--pec-code-background)';

  const fg = useThemeColors
    ? themeColor('editor.foreground', 'var(--pec-code-normal)')
    : 'var(--pec-code-normal)';

  const gutterBorder = useThemeColors
    ? themeColor(
        'editorLineNumber.foreground',
        'var(--pec-gutter-border-color)',
      )
    : 'var(--pec-gutter-border-color)';

  const gutterText = useThemeColors
    ? themeColor('editorLineNumber.foreground', 'var(--pec-gutter-text-color)')
    : 'var(--pec-gutter-text-color)';

  const gutterActive = useThemeColors
    ? themeColorWithFallback(
        ['editorLineNumber.activeForeground', 'editorLineNumber.foreground'],
        'var(--pec-gutter-text-color-highlight)',
      )
    : 'var(--pec-gutter-text-color-highlight)';

  return {
    borderColor: 'var(--pec-code-block-border-color)',
    borderRadius: 'var(--pec-code-block-border-radius)',
    borderWidth: 'var(--pec-code-block-border-width)',
    codeBackground: bg,
    codeFontFamily: 'var(--font-monospace)',
    codeFontSize: 'var(--code-size)',
    codeFontWeight: 'var(--font-normal)',
    codeForeground: fg,
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
    gutterBorderColor: gutterBorder,
    gutterBorderWidth: 'var(--pec-gutter-border-width)',
    gutterForeground: gutterText,
    gutterHighlightForeground: gutterActive,
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
      editorActiveTabBackground: bg,
      editorActiveTabBorderColor: 'transparent',
      editorActiveTabForeground: 'var(--text-normal)',
      editorActiveTabIndicatorBottomColor: 'transparent',
      editorActiveTabIndicatorHeight: 'var(--pec-active-tab-border-width)',
      editorActiveTabIndicatorTopColor: 'var(--pec-active-tab-border-color)',
      editorBackground: bg,
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
      terminalBackground: bg,
      terminalTitlebarBackground: bg,
      terminalTitlebarBorderBottomColor: 'transparent',
      terminalTitlebarDotsForeground: 'var(--pec-terminal-dots-color)',
      terminalTitlebarDotsOpacity: '1',
      terminalTitlebarForeground: 'var(--text-normal)',
      tooltipSuccessBackground: 'var(--pec-tooltip-background)',
      tooltipSuccessForeground: 'var(--pec-tooltip-text-color)',
    },
  };
}
