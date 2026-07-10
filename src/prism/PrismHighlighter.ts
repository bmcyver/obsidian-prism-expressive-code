import {
  InlineStyleAnnotation,
  definePlugin,
  type ExpressiveCodePlugin,
} from '@expressive-code/core';
import type * as Prism from 'prismjs';
import { type ThemeMapper } from '../themes/ThemeManager';
import { LRUCache } from '../utils';

// some languages break obsidian's `registerMarkdownCodeBlockProcessor`, so we blacklist them
export const LANGUAGE_BLACKLIST = new Set(['c++', 'c#', 'f#', 'mermaid']);

// some languages are considered special
export const LANGUAGE_SPECIAL = new Set([
  'plaintext',
  'txt',
  'text',
  'plain',
  'ansi',
]);

export const LANGUAGE_ALIASES: Record<string, string> = {
  zsh: 'bash',
  asm: 'nasm',
};

export interface ThemeSetting {
  scope?: string | string[];
  settings?: {
    foreground?: string;
    fontStyle?: string;
  };
}

export interface ThemeLike {
  name?: string;
  type?: string;
  settings?: ThemeSetting[];
  tokenColors?: ThemeSetting[];
  fg?: string;
}

// A mapping from Prism token types to TextMate scopes for theme matching
export const PRISM_TO_SCOPE_MAP: Record<string, string[]> = {
  // Standard core tokens
  comment: ['comment'],
  prolog: ['comment'],
  doctype: ['comment'],
  cdata: ['comment'],
  punctuation: ['punctuation', 'meta.brace'],
  property: [
    'support.type.property-name',
    'variable.other.property',
    'support.type.property-name.css',
  ],
  tag: ['entity.name.tag'],
  boolean: ['constant.language.boolean'],
  number: ['constant.numeric'],
  constant: ['constant'],
  symbol: ['constant.other.symbol'],
  deleted: ['markup.deleted'],
  selector: ['meta.selector'],
  'attr-name': ['entity.other.attribute-name'],
  string: ['string'],
  char: ['string.char'],
  builtin: ['support.type', 'support.class', 'support.function'],
  inserted: ['markup.inserted'],
  operator: ['keyword.operator'],
  entity: ['entity.name', 'constant.character.entity'],
  url: ['markup.underline.link'],
  variable: ['variable'],
  keyword: ['keyword', 'storage.type'],
  'class-name': ['entity.name.type.class', 'support.class'],
  function: ['entity.name.function', 'support.function'],
  regex: ['string.regexp'],
  important: ['invalid'],
  bold: ['strong'],
  italic: ['emphasis'],

  // HTML / XML / Markup specific
  'attr-value': ['string'],
  'special-attr': ['entity.other.attribute-name'],
  'tag-id': ['entity.name.tag'],

  // CSS / SCSS / LESS specific
  value: ['support.constant.property-value'],
  unit: ['keyword.other.unit'],
  id: ['entity.other.attribute-name.id'],
  class: ['entity.other.attribute-name.class'],
  pseudo_element: ['entity.other.attribute-name.pseudo-element'],
  pseudo_class: ['entity.other.attribute-name.pseudo-class'],
  color: ['constant.other.color'],

  // C / C++ / Objective-C specific
  macro: [
    'entity.name.function.macro',
    'support.function.macro',
    'entity.name.function',
  ],
  directive: ['keyword.control.directive', 'keyword.control', 'keyword'],
  'directive-hash': ['punctuation.definition.directive', 'punctuation'],
  'double-colon': ['punctuation.accessor', 'punctuation'],
  namespace: ['entity.name.namespace', 'support.other.namespace'],
  type: ['entity.name.type', 'support.type', 'storage.type'],

  // Rust specific
  lifetime: ['entity.name.type.lifetime', 'storage.modifier.lifetime'],
  attribute: ['meta.attribute', 'entity.name.type.class'],
  generics: ['entity.name.type'],

  // Python specific
  decorator: ['meta.function.decorator', 'entity.name.function.decorator'],
  'built-in': ['support.function', 'support.type'],

  // JSON / YAML / TOML data formats
  key: [
    'support.type.property-name',
    'variable.other.property',
    'entity.name.tag',
  ],
  atrule: ['keyword.control', 'keyword'],

  // Markdown specific
  title: ['entity.name.section', 'markup.heading'],
  code: ['markup.inline.raw'],
  blockquote: ['markup.quote'],
  list: ['markup.list'],
  link: ['string.other.link'],

  // Shell / Bash specific
  command: ['entity.name.function', 'support.function'],
  environment: ['variable.other.constant'],
  file: ['string'],

  // SQL specific
  'data-type': ['support.type', 'storage.type'],
};

export function getColorForScopes(
  theme: ThemeLike,
  scopes: string[],
): { color?: string; fontStyle?: string } | undefined {
  if (!theme) return undefined;
  const settings = theme.settings ?? theme.tokenColors;
  if (!settings) return undefined;

  let bestMatch: { color?: string; fontStyle?: string } | undefined = undefined;
  let bestScore = -1;

  for (const rule of settings) {
    if (!rule.scope || !rule.settings) continue;
    const ruleScopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
    for (const ruleScope of ruleScopes) {
      for (const targetScope of scopes) {
        if (targetScope === ruleScope) {
          // Exact match: highest score
          const score = ruleScope.length * 2 + 10;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              color: rule.settings.foreground,
              fontStyle: rule.settings.fontStyle,
            };
          }
        } else if (targetScope.startsWith(ruleScope + '.')) {
          // Target (e.g. comment.line) is more specific than rule (e.g. comment)
          const score = ruleScope.length * 2;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              color: rule.settings.foreground,
              fontStyle: rule.settings.fontStyle,
            };
          }
        } else if (ruleScope.startsWith(targetScope + '.')) {
          // Rule (e.g. comment.line) is more specific than target (e.g. comment)
          // This allows generic Prism tokens to match specific theme rules
          const score = targetScope.length * 2 - 1;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              color: rule.settings.foreground,
              fontStyle: rule.settings.fontStyle,
            };
          }
        }
      }
    }
  }
  return bestMatch;
}

export function getScopesForPrismType(type: string): string[] {
  if (PRISM_TO_SCOPE_MAP[type]) {
    return PRISM_TO_SCOPE_MAP[type];
  }

  const lower = type.toLowerCase();
  if (
    lower.includes('comment') ||
    lower.includes('prolog') ||
    lower.includes('doctype') ||
    lower.includes('cdata')
  ) {
    return ['comment'];
  }
  if (
    lower.includes('string') ||
    lower.includes('char') ||
    lower.includes('value') ||
    lower.includes('literal') ||
    lower.includes('url')
  ) {
    return ['string'];
  }
  if (
    lower.includes('keyword') ||
    lower.includes('control') ||
    lower.includes('statement') ||
    lower.includes('operator') ||
    lower.includes('atrule') ||
    lower.includes('directive') ||
    lower.includes('modifier') ||
    lower.includes('specifier') ||
    lower.includes('op-code') ||
    lower.includes('instruction')
  ) {
    return ['keyword'];
  }
  if (
    lower.includes('number') ||
    lower.includes('digit') ||
    lower.includes('boolean') ||
    lower.includes('null') ||
    lower.includes('constant') ||
    lower.includes('symbol') ||
    lower.includes('float') ||
    lower.includes('int')
  ) {
    return ['constant'];
  }
  if (
    lower.includes('func') ||
    lower.includes('method') ||
    lower.includes('macro') ||
    lower.includes('proc') ||
    lower.includes('handler') ||
    lower.includes('call') ||
    lower.includes('command')
  ) {
    return ['entity.name.function'];
  }
  if (
    lower.includes('class') ||
    lower.includes('type') ||
    lower.includes('struct') ||
    lower.includes('enum') ||
    lower.includes('interface') ||
    lower.includes('model') ||
    lower.includes('namespace') ||
    lower.includes('module')
  ) {
    return ['entity.name.type'];
  }
  if (
    lower.includes('var') ||
    lower.includes('prop') ||
    lower.includes('attr') ||
    lower.includes('param') ||
    lower.includes('arg') ||
    lower.includes('field') ||
    lower.includes('key') ||
    lower.includes('property') ||
    lower.includes('identifier') ||
    lower.includes('label')
  ) {
    return ['variable'];
  }
  if (
    lower.includes('punctuation') ||
    lower.includes('bracket') ||
    lower.includes('brace') ||
    lower.includes('paren') ||
    lower.includes('delimiter') ||
    lower.includes('comma') ||
    lower.includes('colon') ||
    lower.includes('semi') ||
    lower.includes('accessor') ||
    lower.includes('dot')
  ) {
    return ['punctuation'];
  }

  return [type];
}

export enum FontStyle {
  NotSet = -1,
  None = 0,
  Italic = 1,
  Bold = 2,
  Underline = 4,
  Strikethrough = 8,
}

const styleCache = new LRUCache<
  string,
  { color?: string; fontStyle?: FontStyle }
>(2000);

export function clearStyleCache(): void {
  styleCache.clear();
}

export function getStyleForPrismTypes(
  theme: ThemeLike,
  types: string[],
  typeKey: string,
  lang?: string,
): { color?: string; fontStyle?: FontStyle } {
  const cacheKey = `${theme.name ?? theme.type ?? ''}:${typeKey}:${lang ?? ''}`;
  const cached = styleCache.get(cacheKey);
  if (cached) return cached;

  let color: string | undefined = undefined;
  let fontStyleNum: FontStyle = FontStyle.None;
  let hasColor = false;
  let hasFontStyle = false;

  const lowerLang = lang?.toLowerCase();

  // Iterate from right to left (most specific/leaf type to least specific/parent type)
  for (let i = types.length - 1; i >= 0; i--) {
    const type = types[i];
    if (!type) continue;
    const mappedScopes = getScopesForPrismType(type);

    const scopesWithLang: string[] = [];
    if (lowerLang) {
      for (const scope of mappedScopes) {
        scopesWithLang.push(`${scope}.${lowerLang}`);
      }
    }
    const targetScopes = [...scopesWithLang, ...mappedScopes];

    const style = getColorForScopes(theme, targetScopes);
    if (style) {
      if (!hasColor && style.color) {
        color = style.color;
        hasColor = true;
      }
      if (!hasFontStyle && style.fontStyle) {
        const fs = style.fontStyle.toLowerCase();
        if (fs.includes('italic')) fontStyleNum |= FontStyle.Italic;
        if (fs.includes('bold')) fontStyleNum |= FontStyle.Bold;
        if (fs.includes('underline')) fontStyleNum |= FontStyle.Underline;
        if (fs.includes('strikethrough'))
          fontStyleNum |= FontStyle.Strikethrough;
        hasFontStyle = true;
      }
      if (hasColor && hasFontStyle) {
        break;
      }
    }
  }

  const result = {
    color,
    fontStyle: fontStyleNum,
  };
  styleCache.set(cacheKey, result);
  return result;
}

export interface FlatToken {
  content: string;
  types: string[];
  typeKey: string;
}

export interface PrismTokenLike {
  type: string;
  content: string | PrismTokenLike | (string | PrismTokenLike)[];
  alias?: string | string[];
}

export function flattenTokens(
  tokens: (string | PrismTokenLike)[],
  parentTypes: string[] = [],
  result: FlatToken[] = [],
): FlatToken[] {
  for (const token of tokens) {
    if (typeof token === 'string') {
      result.push({
        content: token,
        types: parentTypes,
        typeKey: parentTypes.join(','),
      });
    } else {
      // To ensure actual type overrides aliases (fallbacks), place aliases before the actual type.
      // Priority: parent types -> aliases -> actual type (most specific, checked first in reverse search)
      const currentTypes = [...parentTypes];
      if (token.alias) {
        if (Array.isArray(token.alias)) {
          currentTypes.push(...token.alias);
        } else {
          currentTypes.push(token.alias);
        }
      }
      currentTypes.push(token.type);

      if (typeof token.content === 'string') {
        result.push({
          content: token.content,
          types: currentTypes,
          typeKey: currentTypes.join(','),
        });
      } else if (Array.isArray(token.content)) {
        flattenTokens(token.content, currentTypes, result);
      } else {
        flattenTokens([token.content], currentTypes, result);
      }
    }
  }
  return result;
}

export function splitTokensIntoLines(flatTokens: FlatToken[]): FlatToken[][] {
  const lines: FlatToken[][] = [[]];
  for (const token of flatTokens) {
    const content = token.content;

    if (!content.includes('\n')) {
      if (content.length > 0) {
        const lastLine = lines[lines.length - 1];
        if (lastLine) {
          lastLine.push(token);
        }
      }
    } else {
      const parts = content.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          lines.push([]);
        }
        const part = parts[i];
        if (part && part.length > 0) {
          const lastLine = lines[lines.length - 1];
          if (lastLine) {
            lastLine.push({
              ...token,
              content: part,
            });
          }
        }
      }
    }
  }
  return lines;
}

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

export function customPluginPrism(): ExpressiveCodePlugin {
  return definePlugin({
    name: 'Prism',
    hooks: {
      performSyntaxAnalysis: async ({ codeBlock, styleVariants }) => {
        const codeLines = codeBlock.getLines();
        const code = codeBlock.code;

        let prism: typeof Prism | undefined;
        try {
          prism = (window as unknown as { Prism: typeof Prism }).Prism;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          throw new Error(
            `Failed to load shared Prism syntax highlighter: "${error.message}"`,
            {
              cause: err,
            },
          );
        }

        if (!prism) {
          return;
        }

        const rawLanguage = codeBlock.language;
        let lowerLang = rawLanguage.toLowerCase();
        lowerLang = LANGUAGE_ALIASES[lowerLang] ?? lowerLang;
        const grammar = prism.languages[lowerLang];

        const finalGrammar =
          grammar ?? prism.languages.plaintext ?? prism.languages.text;
        if (!finalGrammar) return;
        const prismTokens = prism.tokenize(code, finalGrammar);
        const flatTokens = flattenTokens(prismTokens);

        // Split flat tokens into lines once (outside of theme variants loop)
        const lines = splitTokensIntoLines(flatTokens);

        for (
          let styleVariantIndex = 0;
          styleVariantIndex < styleVariants.length;
          styleVariantIndex++
        ) {
          const variant = styleVariants[styleVariantIndex];
          if (!variant) continue;
          const theme = variant.theme;

          // Annotate each line
          lines.forEach((line: FlatToken[], lineIndex: number) => {
            let charIndex = 0;
            line.forEach((token: FlatToken) => {
              const tokenLength = token.content.length;
              const tokenEndIndex = charIndex + tokenLength;
              const style = getStyleForPrismTypes(
                theme,
                token.types,
                token.typeKey,
                lowerLang,
              );

              const fs = style.fontStyle ?? FontStyle.None;

              codeLines[lineIndex]?.addAnnotation(
                new InlineStyleAnnotation({
                  styleVariantIndex,
                  color: style.color ?? theme.fg,
                  italic: (fs & FontStyle.Italic) !== 0,
                  bold: (fs & FontStyle.Bold) !== 0,
                  underline: (fs & FontStyle.Underline) !== 0,
                  strikethrough: (fs & FontStyle.Strikethrough) !== 0,
                  inlineRange: {
                    columnStart: charIndex,
                    columnEnd: tokenEndIndex,
                  },
                  renderPhase: 'earliest',
                }),
              );
              charIndex = tokenEndIndex;
            });
          });
        }
      },
    },
  });
}
