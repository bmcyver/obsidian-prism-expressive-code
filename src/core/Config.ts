import {
  ExpressiveCodeTheme,
  type ExpressiveCodeEngineConfig,
  type ExpressiveCodeThemeInput,
} from '@expressive-code/core';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginFrames } from '@expressive-code/plugin-frames';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { customPluginPrism } from '../prism/PrismHighlighter';
import { pluginTextMarkers } from '@expressive-code/plugin-text-markers';
import { type ThemeRegistration } from './types';

import { getECTheme } from '../themes/ThemeManager';

export interface EcSettingsProps {
  preferThemeColors: boolean;
  ecDefaultShowLineNumbers: boolean;
  ecDefaultWrap: boolean;
  ecDefaultFrame: 'code' | 'terminal' | 'none' | 'auto';
  ecDefaultCollapseStyle:
    | 'github'
    | 'collapsible-start'
    | 'collapsible-end'
    | 'collapsible-auto';
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
          : token.settings.foreground,
        background: token.settings.background
          ? toPlaceholder(token.settings.background)
          : token.settings.background,
      },
    };
  };

  const mappedTheme: ThemeRegistration = {
    ...theme,
    colors: Object.fromEntries(
      Object.entries(theme.colors ?? {}).map(([key, value]) => [
        key,
        toPlaceholder(value),
      ]),
    ),
    tokenColors: (theme.tokenColors ?? []).map(
      mapThemeTokenColor as (value: unknown) => unknown,
    ),
  };

  return {
    theme: mappedTheme,
    restoreCssVariables: (css: string): string => {
      let output = css;
      for (const [cssVar, placeholder] of cssVarToPlaceholder) {
        output = output.replaceAll(placeholder, cssVar);
      }
      return output;
    },
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
