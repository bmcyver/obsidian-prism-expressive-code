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
  // builtin: 내장 함수를 타입보다 앞세워 make(), append() 등의 함수 색상 보호
  builtin: ['support.function.builtin', 'support.function', 'support.type', 'support.class'],
  inserted: ['markup.inserted'],
  operator: ['keyword.operator'],
  entity: ['entity.name', 'constant.character.entity'],
  url: ['markup.underline.link'],
  variable: ['variable'],
  keyword: ['keyword', 'storage.type'],
  'class-name': ['entity.name.type.class', 'support.class'],
  function: ['entity.name.function', 'support.function'],
  regex: ['string.regexp'],
  'regex-flags': ['storage.modifier.regex', 'keyword.other.regex'],
  'regex-delimiter': ['punctuation.definition.string.regex', 'punctuation'],
  // important: invalid(오류 빨간색) 오매핑 보정
  important: ['keyword.other.important.css', 'keyword.other', 'keyword'],
  bold: ['strong'],
  italic: ['emphasis'],
  'attr-value': ['string'],
  'special-attr': ['entity.other.attribute-name'],
  'tag-id': ['entity.name.tag'],
  value: ['support.constant.property-value'],
  unit: ['keyword.other.unit'],
  id: ['entity.other.attribute-name.id'],
  class: ['entity.other.attribute-name.class'],
  // pseudo_element, pseudo_class: 하이픈/언더스코어 모두 호환 보정
  'pseudo-element': ['entity.other.attribute-name.pseudo-element'],
  'pseudo-class': ['entity.other.attribute-name.pseudo-class'],
  pseudo_element: ['entity.other.attribute-name.pseudo-element'],
  pseudo_class: ['entity.other.attribute-name.pseudo-class'],
  color: ['constant.other.color'],
  hexcode: ['constant.other.color.rgb-value', 'constant.other.color'],
  // macro & command: outer container Bleed 방지를 위해 meta 계열로 격리
  macro: ['meta.preprocessor.macro', 'meta.preprocessor'],
  'macro-name': ['entity.name.function.preprocessor', 'entity.name.function.macro', 'entity.name.function'],
  command: ['entity.name.function.command', 'entity.name.function', 'support.function', 'meta.command'],
  option: ['meta.argument.option', 'entity.other.attribute-name.option', 'variable.parameter'],
  shebang: ['comment.line.shebang', 'punctuation.definition.comment', 'comment'],
  directive: ['keyword.control.directive', 'keyword.control', 'keyword'],
  'directive-hash': ['punctuation.definition.directive', 'punctuation'],
  include: ['keyword.control.import.include', 'keyword.control.import'],
  'header-name': ['string.quoted.other.lt-gt.include', 'string'],
  style: ['meta.embedded.block.css', 'source.css'],
  script: ['meta.embedded.block.javascript', 'source.js'],
  'language-css': ['meta.embedded.block.css', 'source.css'],
  'language-javascript': ['meta.embedded.block.javascript', 'source.js'],
  'double-colon': ['punctuation.accessor', 'punctuation'],
  namespace: ['entity.name.namespace', 'support.other.namespace'],
  type: ['entity.name.type', 'support.type', 'storage.type'],
  datatype: ['support.type', 'storage.type'],
  lifetime: ['entity.name.type.lifetime', 'storage.modifier.lifetime'],
  // attribute: entity.name.type.class 제거하여 클래스 색상 오염 방지
  attribute: ['meta.attribute', 'entity.other.attribute-name'],
  generics: ['entity.name.type'],
  decorator: ['meta.function.decorator', 'entity.name.function.decorator'],
  'built-in': ['support.function', 'support.type'],
  key: [
    'entity.name.tag.yaml',
    'entity.name.tag',
    'support.type.property-name',
    'variable.other.property',
    'variable.object.property',
    'entity.name.variable',
    'entity.name',
  ],
  atrule: ['keyword.control', 'keyword'],
  title: ['entity.name.section', 'markup.heading'],
  code: ['markup.inline.raw'],
  'code-block': ['markup.raw.block', 'markup.raw'],
  strike: ['markup.strikethrough'],
  strikethrough: ['markup.strikethrough'],
  blockquote: ['markup.quote'],
  list: ['markup.list'],
  link: ['string.other.link'],
  'url-link': ['markup.underline.link', 'string.other.link'],
  environment: ['variable.other.constant'],
  file: ['string'],
  'data-type': ['support.type', 'storage.type'],
  instruction: ['meta.instruction', 'meta'],

  // === 추가: JS/TS 보간 및 JSX ===
  'template-string': ['string.template', 'string.quoted.template', 'string'],
  'template-literal': ['string.template', 'string.quoted.template', 'string'],
  interpolation: ['meta.template.expression'],
  'interpolation-punctuation': ['punctuation.definition.template-expression', 'punctuation'],

  // === 추가: Python f-string & docstring ===
  'f-string': ['string.interpolated', 'string.quoted.fstring', 'string'],
  'format-spec': ['meta.format.specifier', 'storage.type.format'],
  docstring: ['comment.block.documentation', 'comment', 'string.quoted.docstring'],
  'triple-quoted-string': ['comment.block.documentation', 'comment', 'string.quoted.triple', 'string'],

  // === 추가: Java/Kotlin annotation & template-field ===
  annotation: ['storage.type.annotation', 'entity.name.type.annotation'],
  'annotation-punctuation': ['punctuation.definition.annotation', 'punctuation'],
  'template-field': ['meta.template.expression', 'entity.string.template.element'],

  // === 추가: Go package & import ===
  package: ['keyword.other.package', 'keyword'],
  import: ['keyword.control.import', 'keyword'],
  'package-name': ['entity.name.package', 'entity.name.namespace'],
  'import-path': ['string.quoted.double', 'string'],
  null: ['constant.language.null', 'constant.language'],
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
      'directive', 'modifier', 'specifier', 'op-code',
      'import', 'package',
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
      'model', 'namespace', 'module', 'annotation',
    ],
    ['entity.name.type'],
  ],
  [
    [
      'var', 'prop', 'attr', 'param', 'arg',
      // 'field' 제거! (Kotlin template-field가 variable로 잘못 오매핑되는 현상 차단)
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
