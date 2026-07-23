import {
  ExpressiveCodeTheme,
  type ExpressiveCodeEngineConfig,
  type ExpressiveCodeThemeInput,
} from '@expressive-code/core';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginFrames } from '@expressive-code/plugin-frames';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { pluginTextMarkers } from '@expressive-code/plugin-text-markers';
import { customPluginPrism } from './prism/CustomPluginPrism';
import { getECTheme } from './themes/ecStyleOverrides';
import { type ThemeRegistration } from './themes/types';

// Re-export for vite.config.mts backwards compatibility
export {
  createCssVariableThemeBundle,
  type CssVariableThemeBundle,
} from './themes/CssVariableThemeBundle';
export type { ThemeRegistration } from './themes/types';

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

export const EC_VIRTUAL_SETTINGS: EcSettingsProps = {
  preferThemeColors: true,
  ecDefaultShowLineNumbers: false,
  ecDefaultWrap: false,
  ecDefaultFrame: 'auto',
  ecDefaultCollapseStyle: 'collapsible-auto',
};

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
