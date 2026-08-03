import oneLightCss from './styles/prism-one-light.css?raw';
import oneDarkCss from './styles/prism-one-dark.css?raw';

/**
 * Dynamically loads the full Prism theme CSS based on active theme or mode.
 */
export function getDynamicThemeCss(themeIdOrType?: string): string {
  const normalized = (themeIdOrType ?? '').toLowerCase();
  const isLight =
    normalized.includes('light') ||
    normalized === 'one-light' ||
    normalized === 'light';

  return isLight ? oneLightCss : oneDarkCss;
}
