import { type App } from 'obsidian';
import { type ThemeRegistration } from './types';
import { THEMES } from '../config';
import { type Settings } from '../settings/types';

let cachedThemeId: string | null = null;
let cachedTheme: ThemeRegistration | null = null;

export function clearThemeCache(): void {
  cachedThemeId = null;
  cachedTheme = null;
}

/**
 * Obsidian 앱의 다크/라이트 모드 및 사용자 설정에 적합한 테마를 불러오고 캐싱하는 단일 함수
 */
export async function getThemeForEC(
  app: App,
  settings: Settings,
): Promise<ThemeRegistration> {
  const activeThemeId = app.isDarkMode()
    ? settings.darkTheme
    : settings.lightTheme;

  if (cachedThemeId === activeThemeId && cachedTheme) {
    return cachedTheme;
  }

  const themeDef = THEMES.find((t) => t.id === activeThemeId) ?? THEMES[0]!;

  try {
    const mod = (await themeDef.import()) as { default: ThemeRegistration };
    cachedThemeId = themeDef.id;
    cachedTheme = mod.default;
    return mod.default;
  } catch {
    const fallbackDef = THEMES[0]!;
    const mod = (await fallbackDef.import()) as { default: ThemeRegistration };
    cachedThemeId = fallbackDef.id;
    cachedTheme = mod.default;
    return mod.default;
  }
}
