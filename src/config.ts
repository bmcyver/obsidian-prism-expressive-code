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
import { type ThemeRegistration } from './themes/types';

export type { ThemeRegistration } from './themes/types';

export interface EcSettingsProps {
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
  ecDefaultShowLineNumbers: false,
  ecDefaultWrap: false,
  ecDefaultFrame: 'auto',
  ecDefaultCollapseStyle: 'collapsible-auto',
};

export function createEcEngineConfig(
  input: EcConfigInput,
): ExpressiveCodeEngineConfig {
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
    styleOverrides: {
      codeFontFamily: 'var(--font-monospace)',
      codeFontSize: 'var(--code-size)',
      borderWidth: '0px',
      borderColor: 'transparent',
      frames: {
        frameBoxShadowCssValue: 'none',
      },
    },
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
