import {
  ExpressiveCodeTheme,
  type ExpressiveCodeEngineConfig,
  type ExpressiveCodeThemeInput,
} from '@expressive-code/core';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginFrames } from '@expressive-code/plugin-frames';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { pluginTextMarkers } from '@expressive-code/plugin-text-markers';
import { customPluginPrism } from '../prism/CustomPluginPrism';
import { getECTheme } from '../themes/ThemeManager';

export interface ThemeRegistration {
  name: string;
  displayName?: string;
  type?: string;
  colors: Record<string, string>;
  tokenColors: unknown[];
  settings?: unknown[];
  semanticHighlighting?: boolean;
}

export interface EcSettingsProps {
  preferThemeColors: boolean;
  ecDefaultShowLineNumbers: boolean;
  ecDefaultWrap: boolean;
  ecDefaultFrame: 'code' | 'terminal' | 'none' | 'auto';
  ecDefaultCollapseStyle:
    'github' | 'collapsible-start' | 'collapsible-end' | 'collapsible-auto';
}

export interface EcConfigInput {
  theme: ThemeRegistration;
  settings: EcSettingsProps;
}

export interface CssVariableThemeBundle {
  theme: ThemeRegistration;
  restoreCssVariables: (css: string) => string;
}

export const EC_VIRTUAL_SETTINGS: EcSettingsProps = {
  preferThemeColors: true,
  ecDefaultShowLineNumbers: false,
  ecDefaultWrap: false,
  ecDefaultFrame: 'auto',
  ecDefaultCollapseStyle: 'collapsible-auto',
};

export function createCssVariableThemeBundle(
  theme: ThemeRegistration,
): CssVariableThemeBundle {
  const cssVarToPlaceholder = new Map<string, string>();
  let placeholderCounter = 0;

  const toPlaceholder = (value: string): string => {
    if (!value.trim().startsWith('var(')) {
      return value;
    }

    const existing = cssVarToPlaceholder.get(value);
    if (existing) {
      return existing;
    }

    // Start offset at 0xE00000 to prevent conflicts with black (#000000) or other very common colors
    const colorInt = 0xe00000 + placeholderCounter;
    const placeholder = `#${colorInt.toString(16).toUpperCase()}`;
    placeholderCounter += 1;
    cssVarToPlaceholder.set(value, placeholder);
    return placeholder;
  };

  const mapThemeTokenColor = <
    T extends { settings?: { foreground?: string; background?: string } },
  >(
    token: T,
  ): T => {
    if (!token.settings) {
      return token;
    }

    return {
      ...token,
      settings: {
        ...token.settings,
        foreground: token.settings.foreground
          ? toPlaceholder(token.settings.foreground)
          : undefined,
        background: token.settings.background
          ? toPlaceholder(token.settings.background)
          : undefined,
      },
    };
  };

  const newColors: Record<string, string> = {};
  for (const [key, val] of Object.entries(theme.colors)) {
    newColors[key] = toPlaceholder(val);
  }

  const newTokenColors = (theme.tokenColors ?? []).map((token) =>
    mapThemeTokenColor(
      token as { settings?: { foreground?: string; background?: string } },
    ),
  );
  const newSettings = (theme.settings ?? []).map((token) =>
    mapThemeTokenColor(
      token as { settings?: { foreground?: string; background?: string } },
    ),
  );

  const restoreCssVariables = (css: string): string => {
    let result = css;
    for (const [cssVar, placeholder] of cssVarToPlaceholder.entries()) {
      result = result.replaceAll(placeholder, cssVar);
    }
    return result;
  };

  return {
    theme: {
      ...theme,
      colors: newColors,
      tokenColors: newTokenColors,
      settings: newSettings,
    },
    restoreCssVariables,
  };
}

export function createEcEngineConfig(
  input: EcConfigInput,
): ExpressiveCodeEngineConfig {
  const useThemeColors = input.settings.preferThemeColors;

  return {
    themes: [
      new ExpressiveCodeTheme(
        input.theme as unknown as ExpressiveCodeThemeInput,
      ),
    ],
    plugins: [
      customPluginPrism(),
      pluginCollapsibleSections(),
      pluginTextMarkers(),
      pluginLineNumbers(),
      pluginFrames(),
    ].filter(Boolean),
    styleOverrides: getECTheme(useThemeColors),
    minSyntaxHighlightingColorContrast: 0,
    themeCssRoot: 'div.expressive-code',
    defaultProps: {
      showLineNumbers: input.settings.ecDefaultShowLineNumbers,
      wrap: input.settings.ecDefaultWrap,
      frame: input.settings.ecDefaultFrame,
      collapseStyle: input.settings.ecDefaultCollapseStyle,
    },
  };
}
