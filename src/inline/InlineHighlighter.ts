import {
  flattenTokens,
  getStyleForPrismTypes,
  LANGUAGE_ALIASES,
  FontStyle,
  type FlatToken,
  type ThemeLike,
} from '../prism/PrismUtils';
import { LRUCache } from '../utils/LRUCache';
import { type ThemeMapper } from '../themes/ThemeManager';
import type * as Prism from 'prismjs';

export interface ThemedToken {
  content: string;
  color?: string;
  bgColor?: string;
  fontStyle?: FontStyle;
  offset: number;
}

export interface TokensResult {
  tokens: ThemedToken[];
}

export class InlineHighlighter {
  private themeMapper: ThemeMapper;
  private tokenCache = new LRUCache<string, TokensResult>(50);
  private safeLanguagesSet: Set<string> = new Set();

  constructor(themeMapper: ThemeMapper) {
    this.themeMapper = themeMapper;
  }

  public initialize(safeLanguagesSet: Set<string>): void {
    this.safeLanguagesSet = safeLanguagesSet;
  }

  public clearCache(): void {
    this.tokenCache.clear();
  }

  public async getHighlightTokens(
    code: string,
    lang: string,
  ): Promise<TokensResult | undefined> {
    const prism = (window as unknown as { Prism?: typeof Prism }).Prism;
    if (!prism || this.safeLanguagesSet.size === 0) {
      return undefined;
    }
    let lowerLang = lang.toLowerCase();
    lowerLang = LANGUAGE_ALIASES[lowerLang] ?? lowerLang;
    if (!this.safeLanguagesSet.has(lowerLang)) {
      return undefined;
    }

    const cacheKey = `${lowerLang}:${code}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const grammar = prism.languages[lowerLang];
    if (!grammar) {
      return undefined;
    }

    const prismTokens = prism.tokenize(code, grammar);
    const flatTokens = flattenTokens(prismTokens);
    const theme = await this.themeMapper.getThemeForEC();
    const themedTokens = this.convertToThemedTokens(
      flatTokens,
      theme as ThemeLike,
      lowerLang,
    );

    const result = {
      tokens: themedTokens,
    };

    this.tokenCache.set(cacheKey, result);

    return result;
  }

  private convertToThemedTokens(
    flatTokens: FlatToken[],
    theme: ThemeLike,
    lang?: string,
  ): ThemedToken[] {
    const tokens: ThemedToken[] = [];
    let currentOffset = 0;

    for (const token of flatTokens) {
      const style = getStyleForPrismTypes(
        theme,
        token.types,
        token.typeKey,
        lang,
      );
      tokens.push({
        content: token.content,
        color: style.color ?? theme.fg ?? 'var(--pec-code-normal)',
        fontStyle: style.fontStyle,
        offset: currentOffset,
      });
      currentOffset += token.content.length;
    }

    return tokens;
  }

  public renderTokens(tokens: ThemedToken[], parent: HTMLElement): void {
    for (const token of tokens) {
      this.tokenToSpan(token, parent);
    }
  }

  public tokenToSpan(token: ThemedToken, parent: HTMLElement): void {
    const tokenStyle = this.getTokenStyle(token);
    parent.createSpan({
      text: token.content,
      cls: tokenStyle.classes.join(' '),
      attr: { style: tokenStyle.style },
    });
  }

  public getTokenStyle(token: ThemedToken): {
    style: string;
    classes: string[];
  } {
    const fontStyle = token.fontStyle ?? FontStyle.None;

    return {
      style: `color: ${token.color}`,
      classes: [
        (fontStyle & FontStyle.Italic) !== 0 ? 'pec-italic' : undefined,
        (fontStyle & FontStyle.Bold) !== 0 ? 'pec-bold' : undefined,
        (fontStyle & FontStyle.Underline) !== 0 ? 'pec-ul' : undefined,
      ].filter(Boolean) as string[],
    };
  }
}
