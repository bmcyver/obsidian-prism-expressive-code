import { type MarkdownPostProcessorContext } from 'obsidian';

export const INLINE_CODE_REGEX = /^(.*)\{:([a-zA-Z0-9_\-+#]+)\}$/; // format: `code{:lang}`

export class LRUCache<K, V> {
  private max: number;
  private cache: Map<K, V>;

  constructor(max = 100) {
    this.max = Math.max(1, max);
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key: K, val: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.max) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, val);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

function getLineAt(text: string, lineIndex: number): string | undefined {
  let startIdx = 0;
  for (let i = 0; i < lineIndex; i++) {
    const nextNewline = text.indexOf('\n', startIdx);
    if (nextNewline === -1) {
      return undefined;
    }
    startIdx = nextNewline + 1;
  }
  const endIdx = text.indexOf('\n', startIdx);
  if (endIdx === -1) {
    return text.slice(startIdx);
  }
  return text.slice(startIdx, endIdx);
}

export function extractMetaString(
  ctx: MarkdownPostProcessorContext,
  containerEl: HTMLElement,
  language: string,
): string {
  const sectionInfo = ctx.getSectionInfo(containerEl);

  if (sectionInfo === null) {
    return '';
  }

  const startLine = getLineAt(sectionInfo.text, sectionInfo.lineStart);
  if (startLine === undefined) return '';

  const trimmed = startLine.trim();
  // Find where the block starts (either ``` or ~~~)
  let markerIdx = trimmed.indexOf('```');
  let markerLength = 3;
  if (markerIdx === -1) {
    markerIdx = trimmed.indexOf('~~~');
  }
  if (markerIdx === -1) {
    return '';
  }

  // Count if there are more than 3 backticks/tildes
  const markerChar = trimmed[markerIdx];
  if (markerChar) {
    while (trimmed[markerIdx + markerLength] === markerChar) {
      markerLength++;
    }
  }

  const afterMarker = trimmed.slice(markerIdx + markerLength).trimStart();
  const lowerAfterMarker = afterMarker.toLowerCase();
  const lowerLanguage = language.toLowerCase();

  if (lowerAfterMarker.startsWith(lowerLanguage)) {
    const afterLang = afterMarker.slice(lowerLanguage.length);
    // There must be a space after the language name to have metadata
    if (afterLang.startsWith(' ')) {
      return afterLang.trimStart();
    }
  }

  return '';
}

export function stripCommonIndentation(source: string): string {
  const lines = source.split('\n');

  // Find the minimum common indentation of non-empty lines
  let minIndent: string | null = null;
  for (const line of lines) {
    if (line.trim() === '') {
      continue;
    }
    const match = /^[ \t]*/.exec(line);
    if (match) {
      const indent = match[0];
      if (minIndent === null || indent.length < minIndent.length) {
        minIndent = indent;
      }
    }
  }

  if (!minIndent || minIndent.length === 0) {
    return source;
  }

  // Strip the common indentation from all lines
  const prefix = minIndent;
  return lines
    .map((line) => {
      if (line.startsWith(prefix)) {
        return line.slice(prefix.length);
      }
      return line;
    })
    .join('\n');
}

export function calculateListIndentationLevel(source: string): number {
  const firstLine = source.split('\n')[0] ?? '';
  const match = /^[ \t]*/.exec(firstLine);
  const indent = match ? match[0] : '';
  let spaces = 0;
  let tabs = 0;
  for (const char of indent) {
    if (char === ' ') spaces++;
    else if (char === '\t') tabs++;
  }
  return tabs + Math.floor(spaces / 4);
}
