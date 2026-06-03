import {
  flattenTokens,
  getStyleForPrismTypes,
  LANGUAGE_ALIASES,
  FontStyle,
  type FlatToken,
  type ThemeLike,
} from "src/prism/PrismUtils";
import { LRUCache } from "src/cache/LRUCache";
import { type ThemeMapper } from "src/themes/ThemeMapper";
import type * as Prism from "prismjs";

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

  constructor(themeMapper: ThemeMapper) {
    this.themeMapper = themeMapper;
  }

  public clearCache(): void {
    this.tokenCache.clear();
  }

  public async getHighlightTokens(
    code: string,
    lang: string,
    prism: typeof Prism,
    safeLanguagesSet: Set<string>,
    supportedLanguages: string[],
  ): Promise<TokensResult | undefined> {
    if (!prism || !supportedLanguages) {
      return undefined;
    }
    let lowerLang = lang.toLowerCase();
    lowerLang = LANGUAGE_ALIASES[lowerLang] ?? lowerLang;
    if (!safeLanguagesSet.has(lowerLang)) {
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
        color: style.color ?? theme.fg ?? "var(--shiki-code-normal)",
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
      cls: tokenStyle.classes.join(" "),
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
        (fontStyle & FontStyle.Italic) !== 0 ? "shiki-italic" : undefined,
        (fontStyle & FontStyle.Bold) !== 0 ? "shiki-bold" : undefined,
        (fontStyle & FontStyle.Underline) !== 0 ? "shiki-ul" : undefined,
      ].filter(Boolean) as string[],
    };
  }
}
