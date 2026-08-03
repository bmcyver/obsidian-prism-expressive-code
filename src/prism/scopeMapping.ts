import { LRUCache, cacheManager } from '../utils/cache';

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
  colors?: Record<string, string>;
  fg?: string;
}

export function getThemeDefaultFg(theme: ThemeLike | null): string | undefined {
  if (!theme) return undefined;
  if (theme.fg) return theme.fg;
  if (theme.colors) {
    const color =
      theme.colors['editor.foreground'] ?? theme.colors['foreground'];
    if (color) return color;
  }
  const settings = theme.tokenColors ?? theme.settings;
  if (settings) {
    for (const item of settings) {
      if (!item.scope && item.settings?.foreground) {
        return item.settings.foreground;
      }
    }
  }
  return undefined;
}

// ============================================================================
// 1. 일반 언어 통합 Scope 매핑 (General Prism -> TextMate Scope Mapping)
// ============================================================================

/** 주석, 리터럴, 변수, 함수 등 기본 공통 토큰 매핑 */
const COMMON_SCOPE_MAP: Record<string, string[]> = {
  comment: ['comment'],
  prolog: ['comment'],
  cdata: ['comment'],
  doctype: ['keyword.other.doctype', 'meta.tag.metadata', 'keyword'],
  punctuation: ['punctuation', 'meta.brace'],
  delimiter: ['punctuation.definition', 'punctuation'],
  string: ['string'],
  char: ['string.char'],
  number: ['constant.numeric'],
  boolean: ['constant.language.boolean'],
  constant: ['constant'],
  symbol: ['constant.other.symbol'],
  null: ['constant.language.null', 'constant.language'],
  keyword: ['keyword', 'storage.type'],
  modifier: ['storage.modifier', 'keyword.other'],
  operator: ['keyword.operator'],
  builtin: [
    'support.function.builtin',
    'support.function',
    'support.type',
    'support.class',
  ],
  variable: ['variable'],
  parameter: ['variable.parameter', 'variable.other.argument', 'variable'],
  'function-arg': ['variable.parameter', 'variable'],
  property: [
    'support.type.property-name',
    'variable.other.property',
    'support.type.property-name.css',
  ],
  'property-access': ['variable.other.property', 'support.type.property-name'],
  function: ['entity.name.function', 'support.function'],
  'class-name': ['entity.name.type.class', 'support.class'],
  type: ['entity.name.type', 'support.type', 'storage.type'],
  datatype: ['support.type', 'storage.type'],
  namespace: [
    'entity.name.namespace',
    'storage.type.namespace',
    'support.other.namespace',
  ],
  entity: ['entity.name', 'constant.character.entity'],
  key: [
    'entity.name.tag.yaml',
    'entity.name.tag',
    'support.type.property-name',
    'variable.other.property',
    'variable.object.property',
    'entity.name.variable',
    'entity.name',
  ],
};

/** HTML, CSS, Web 관련 토큰 매핑 */
const WEB_SCOPE_MAP: Record<string, string[]> = {
  tag: ['entity.name.tag'],
  'tag-id': ['entity.name.tag'],
  'attr-name': ['entity.other.attribute-name'],
  'attr-value': ['string'],
  'special-attr': ['entity.other.attribute-name'],
  selector: ['meta.selector'],
  id: ['entity.other.attribute-name.id'],
  class: ['entity.other.attribute-name.class'],
  'pseudo-element': ['entity.other.attribute-name.pseudo-element'],
  'pseudo-class': ['entity.other.attribute-name.pseudo-class'],
  pseudo_element: ['entity.other.attribute-name.pseudo-element'],
  pseudo_class: ['entity.other.attribute-name.pseudo-class'],
  color: ['constant.other.color'],
  hexcode: ['constant.other.color.rgb-value', 'constant.other.color'],
  unit: ['keyword.other.unit'],
  atrule: ['keyword.control', 'keyword'],
  important: ['keyword.other.important.css', 'keyword.other', 'keyword'],
  value: ['support.constant.property-value'],
  style: ['meta.embedded.block.css', 'source.css'],
  script: ['meta.embedded.block.javascript', 'source.js'],
  'language-css': ['meta.embedded.block.css', 'source.css'],
  'language-javascript': ['meta.embedded.block.javascript', 'source.js'],
};

/** 마크다운 및 서식 관련 토큰 매핑 */
const MARKDOWN_SCOPE_MAP: Record<string, string[]> = {
  title: ['entity.name.section', 'markup.heading'],
  code: ['markup.inline.raw'],
  'code-block': ['markup.raw.block', 'markup.raw'],
  strike: ['markup.strikethrough', 'markup.strikethrough.markdown'],
  strikethrough: ['markup.strikethrough', 'markup.strikethrough.markdown'],
  blockquote: ['markup.quote'],
  list: ['markup.list'],
  link: ['string.other.link'],
  'url-link': ['markup.underline.link', 'string.other.link'],
  url: ['markup.underline.link'],
  bold: ['markup.bold', 'markup.bold.markdown', 'strong'],
  italic: ['markup.italic', 'markup.italic.markdown', 'emphasis'],
  deleted: ['markup.deleted'],
  inserted: ['markup.inserted'],
  table: ['markup.other'],
  'table-header': ['entity.name.section', 'markup.heading'],
  'table-data': ['markup.raw'],
  hr: ['punctuation.definition.thematic-break', 'keyword.operator'],
  coord: ['meta.diff.header', 'punctuation.definition.range.diff'],
};

/** 고급 언어 구조체, 패키지, 문자열 템플릿 매핑 */
const ADVANCED_SCOPE_MAP: Record<string, string[]> = {
  macro: [
    'entity.name.function.macro',
    'entity.name.function',
    'support.function.macro',
    'meta.preprocessor',
  ],
  'macro-name': [
    'entity.name.function.macro',
    'entity.name.function',
    'support.function',
  ],
  command: [
    'entity.name.function.command',
    'entity.name.function',
    'support.function',
    'meta.command',
  ],
  option: [
    'meta.argument.option',
    'entity.other.attribute-name.option',
    'variable.parameter',
  ],
  shebang: [
    'comment.line.shebang',
    'punctuation.definition.comment',
    'comment',
  ],
  directive: ['keyword.control.directive', 'keyword.control', 'keyword'],
  'directive-hash': ['punctuation.definition.directive', 'punctuation'],
  include: ['keyword.control.import.include', 'keyword.control.import'],
  'header-name': ['string.quoted.other.lt-gt.include', 'string'],
  package: ['keyword.other.package', 'keyword'],
  import: ['keyword.control.import', 'keyword'],
  'package-name': ['entity.name.package', 'entity.name.namespace'],
  'import-path': ['string.quoted.double', 'string'],
  regex: ['string.regexp'],
  'regex-flags': ['storage.modifier.regex', 'keyword.other.regex'],
  'regex-delimiter': ['punctuation.definition.string.regex', 'punctuation'],
  'template-string': ['string.template', 'string.quoted.template', 'string'],
  'template-literal': ['string.template', 'string.quoted.template', 'string'],
  interpolation: ['meta.template.expression'],
  'interpolation-punctuation': [
    'punctuation.definition.template-expression',
    'punctuation',
  ],
  'f-string': ['string.interpolated', 'string.quoted.fstring', 'string'],
  'format-spec': ['meta.format.specifier', 'storage.type.format'],
  docstring: [
    'comment.block.documentation',
    'comment',
    'string.quoted.docstring',
  ],
  'triple-quoted-string': [
    'comment.block.documentation',
    'comment',
    'string.quoted.triple',
    'string',
  ],
  'annotation-punctuation': [
    'punctuation.definition.annotation',
    'punctuation',
  ],
  'template-field': [
    'meta.template.expression',
    'entity.string.template.element',
  ],
  lifetime: ['entity.name.type.lifetime', 'storage.modifier.lifetime'],
  attribute: ['meta.attribute', 'entity.other.attribute-name'],
  generics: ['entity.name.type'],
  decorator: [
    'entity.name.function.decorator',
    'meta.decorator',
    'entity.name.function',
  ],
  annotation: [
    'entity.name.type.annotation',
    'storage.type.annotation',
    'entity.name.type',
    'entity.name.function',
  ],
  'doctype-tag': ['entity.name.tag', 'keyword'],
  'built-in': ['support.function', 'support.type'],
  environment: ['variable.other.constant'],
  file: ['string'],
  'data-type': ['support.type', 'storage.type'],
  instruction: [
    'keyword.operator.assembly',
    'entity.name.function.instruction',
    'keyword.control',
    'keyword',
  ],
  register: [
    'variable.parameter.register',
    'variable.other.register',
    'variable.language',
    'variable',
  ],
  label: ['entity.name.label', 'entity.name.section', 'entity.name.function'],
  'file-descriptor': ['constant.numeric.file-descriptor', 'constant.numeric'],
  prefix: ['keyword.operator.prefix', 'keyword'],
  subroutine: ['entity.name.function', 'support.function'],
  'double-colon': ['punctuation.accessor', 'punctuation'],
};

/** 전체 통합 Prism -> TextMate Scope 테이블 */
export const PRISM_TO_SCOPE_MAP: Record<string, string[]> = {
  ...COMMON_SCOPE_MAP,
  ...WEB_SCOPE_MAP,
  ...MARKDOWN_SCOPE_MAP,
  ...ADVANCED_SCOPE_MAP,
};

// ============================================================================
// 2. 언어별 격리(Isolated) Scope 매핑 (Language-Specific Overrides)
// ============================================================================
export const LANGUAGE_SPECIFIC_SCOPE_MAPS: Record<
  string,
  Record<string, string[]>
> = {
  http: {
    'header-name': ['keyword.control', 'keyword', 'support.type.property-name'],
    'header-value': ['string', 'string.unquoted', 'variable.other.property'],
    'request-target': [
      'string.other.link',
      'markup.underline.link',
      'variable.parameter',
    ],
    'http-version': ['keyword.other', 'keyword', 'constant.language'],
    'status-code': ['constant.numeric', 'constant.language'],
    'reason-phrase': ['string', 'entity.name.type'],
    'request-line': ['meta.request.http'],
    'response-status': ['meta.response.http'],
  },
};

interface AnalyzedRule {
  ruleScope: string;
  foreground?: string;
  fontStyle?: string;
}

interface IndexedTheme {
  scopeBuckets: Map<string, AnalyzedRule[]>;
  allRules: AnalyzedRule[];
}

const themeIndexMap = new WeakMap<ThemeLike, IndexedTheme>();

function getOrCreateIndexedTheme(theme: ThemeLike): IndexedTheme {
  let indexed = themeIndexMap.get(theme);
  if (indexed) return indexed;

  const settings = theme.settings ?? theme.tokenColors ?? [];
  const scopeBuckets = new Map<string, AnalyzedRule[]>();
  const allRules: AnalyzedRule[] = [];

  for (const rule of settings) {
    if (!rule || !rule.scope || !rule.settings) continue;
    const ruleScopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope];

    for (const rawScope of ruleScopes) {
      if (!rawScope) continue;
      const trimmed = rawScope.trim();
      if (!trimmed) continue;

      const dotIdx = trimmed.indexOf('.');
      const rootSegment = dotIdx === -1 ? trimmed : trimmed.slice(0, dotIdx);

      const analyzed: AnalyzedRule = {
        ruleScope: trimmed,
        foreground: rule.settings.foreground,
        fontStyle: rule.settings.fontStyle,
      };
      allRules.push(analyzed);

      let bucket = scopeBuckets.get(rootSegment);
      if (!bucket) {
        bucket = [];
        scopeBuckets.set(rootSegment, bucket);
      }
      bucket.push(analyzed);
    }
  }

  indexed = { scopeBuckets, allRules };
  themeIndexMap.set(theme, indexed);
  return indexed;
}

export function getColorForScopes(
  theme: ThemeLike,
  scopes: string[],
): { color?: string; fontStyle?: string } | undefined {
  if (!theme) return undefined;

  const indexedTheme = getOrCreateIndexedTheme(theme);
  let bestMatch: { color?: string; fontStyle?: string } | undefined = undefined;
  let bestScore = -1;

  for (const targetScope of scopes) {
    if (!targetScope) continue;

    const dotIdx = targetScope.indexOf('.');
    const rootSegment =
      dotIdx === -1 ? targetScope : targetScope.slice(0, dotIdx);

    const candidateRules =
      indexedTheme.scopeBuckets.get(rootSegment) ?? indexedTheme.allRules;

    for (const rule of candidateRules) {
      if (!rule) continue;
      const ruleScope = rule.ruleScope;

      if (targetScope === ruleScope) {
        const score = ruleScope.length * 2 + 10;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            color: rule.foreground,
            fontStyle: rule.fontStyle,
          };
        }
      } else if (targetScope.startsWith(ruleScope + '.')) {
        const score = ruleScope.length * 2;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            color: rule.foreground,
            fontStyle: rule.fontStyle,
          };
        }
      } else if (ruleScope.startsWith(targetScope + '.')) {
        const score = targetScope.length * 2 - 1;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            color: rule.foreground,
            fontStyle: rule.fontStyle,
          };
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
      'keyword',
      'control',
      'statement',
      'operator',
      'atrule',
      'directive',
      'modifier',
      'specifier',
      'op-code',
      'opcode',
      'instruction',
      'syscall',
      'import',
      'package',
    ],
    ['keyword'],
  ],
  [
    [
      'number',
      'digit',
      'boolean',
      'null',
      'constant',
      'symbol',
      'float',
      'int',
      'file-descriptor',
    ],
    ['constant'],
  ],
  [
    [
      'func',
      'method',
      'macro',
      'proc',
      'handler',
      'call',
      'command',
      'subroutine',
    ],
    ['entity.name.function'],
  ],
  [
    [
      'class',
      'type',
      'struct',
      'enum',
      'interface',
      'model',
      'namespace',
      'module',
      'annotation',
    ],
    ['entity.name.type'],
  ],
  [
    [
      'var',
      'prop',
      'attr',
      'param',
      'arg',
      'register',
      'reg',
      'key',
      'property',
      'identifier',
      'label',
    ],
    ['variable'],
  ],
  [
    [
      'punctuation',
      'bracket',
      'brace',
      'paren',
      'delimiter',
      'comma',
      'colon',
      'semi',
      'accessor',
      'dot',
    ],
    ['punctuation'],
  ],
];

export function getScopesForPrismType(type: string, lang?: string): string[] {
  const lowerLang = lang?.toLowerCase();

  // 1. 특정 언어 전용 오버라이드 매핑 확인
  if (lowerLang && LANGUAGE_SPECIFIC_SCOPE_MAPS[lowerLang]) {
    const langMap = LANGUAGE_SPECIFIC_SCOPE_MAPS[lowerLang];
    if (langMap && langMap[type]) {
      return langMap[type];
    }
  }

  // 2. 통합 일반 매핑 확인
  const mapped = PRISM_TO_SCOPE_MAP[type];
  if (mapped) return mapped;

  // 3. 키워드 기반 Fallback 패턴 확인
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

const styleCache = cacheManager.register(
  new LRUCache<string, { color?: string; fontStyle?: FontStyle }>(2000),
);

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
    const mappedScopes = getScopesForPrismType(type, lowerLang);

    let style: { color?: string; fontStyle?: string } | undefined;
    if (lowerLang) {
      const scopesWithLang = mappedScopes.map(
        (scope) => `${scope}.${lowerLang}`,
      );
      style = getColorForScopes(theme, scopesWithLang);
    }
    if (!style || (!style.color && !style.fontStyle)) {
      style = getColorForScopes(theme, mappedScopes);
    }
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
