import { LRUCache } from '../utils/LRUCache';

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

export const PRISM_TO_SCOPE_MAP: Record<string, string[]> = {
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
  'attr-value': ['string'],
  'special-attr': ['entity.other.attribute-name'],
  'tag-id': ['entity.name.tag'],
  value: ['support.constant.property-value'],
  unit: ['keyword.other.unit'],
  id: ['entity.other.attribute-name.id'],
  class: ['entity.other.attribute-name.class'],
  pseudo_element: ['entity.other.attribute-name.pseudo-element'],
  pseudo_class: ['entity.other.attribute-name.pseudo-class'],
  color: ['constant.other.color'],
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
  lifetime: ['entity.name.type.lifetime', 'storage.modifier.lifetime'],
  attribute: ['meta.attribute', 'entity.name.type.class'],
  generics: ['entity.name.type'],
  decorator: ['meta.function.decorator', 'entity.name.function.decorator'],
  'built-in': ['support.function', 'support.type'],
  key: [
    'support.type.property-name',
    'variable.other.property',
    'entity.name.tag',
  ],
  atrule: ['keyword.control', 'keyword'],
  title: ['entity.name.section', 'markup.heading'],
  code: ['markup.inline.raw'],
  blockquote: ['markup.quote'],
  list: ['markup.list'],
  link: ['string.other.link'],
  command: ['entity.name.function', 'support.function'],
  environment: ['variable.other.constant'],
  file: ['string'],
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
          const score = ruleScope.length * 2 + 10;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              color: rule.settings.foreground,
              fontStyle: rule.settings.fontStyle,
            };
          }
        } else if (targetScope.startsWith(ruleScope + '.')) {
          const score = ruleScope.length * 2;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              color: rule.settings.foreground,
              fontStyle: rule.settings.fontStyle,
            };
          }
        } else if (ruleScope.startsWith(targetScope + '.')) {
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

/**
 * Fallback patterns: if a Prism token type isn't in PRISM_TO_SCOPE_MAP,
 * we check if its lowercased name contains any of these keywords.
 */
const FALLBACK_SCOPE_PATTERNS: [string[], string[]][] = [
  [['comment', 'prolog', 'doctype', 'cdata'], ['comment']],
  [['string', 'char', 'value', 'literal', 'url'], ['string']],
  [
    [
      'keyword', 'control', 'statement', 'operator', 'atrule',
      'directive', 'modifier', 'specifier', 'op-code', 'instruction',
    ],
    ['keyword'],
  ],
  [
    [
      'number', 'digit', 'boolean', 'null', 'constant',
      'symbol', 'float', 'int',
    ],
    ['constant'],
  ],
  [
    ['func', 'method', 'macro', 'proc', 'handler', 'call', 'command'],
    ['entity.name.function'],
  ],
  [
    [
      'class', 'type', 'struct', 'enum', 'interface',
      'model', 'namespace', 'module',
    ],
    ['entity.name.type'],
  ],
  [
    [
      'var', 'prop', 'attr', 'param', 'arg', 'field',
      'key', 'property', 'identifier', 'label',
    ],
    ['variable'],
  ],
  [
    [
      'punctuation', 'bracket', 'brace', 'paren', 'delimiter',
      'comma', 'colon', 'semi', 'accessor', 'dot',
    ],
    ['punctuation'],
  ],
];

export function getScopesForPrismType(type: string): string[] {
  const mapped = PRISM_TO_SCOPE_MAP[type];
  if (mapped) return mapped;

  const lower = type.toLowerCase();
  for (const [keywords, scopes] of FALLBACK_SCOPE_PATTERNS) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return scopes;
    }
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
