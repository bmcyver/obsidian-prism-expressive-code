import { type MarkdownPostProcessorContext } from 'obsidian';

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
  if (source.length === 0) return source;

  // Fast path: if source doesn't start with space/tab and contains no tab/space after newline, skip split
  if (
    source[0] !== ' ' &&
    source[0] !== '\t' &&
    !source.includes('\n ') &&
    !source.includes('\n\t')
  ) {
    return source;
  }

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
  const newlineIdx = source.indexOf('\n');
  const firstLine = newlineIdx === -1 ? source : source.slice(0, newlineIdx);
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

export function estimateCodeBlockHeight(
  source: string,
  metaString?: string,
): number {
  const cleaned = stripCommonIndentation(source);
  const lineCount = cleaned.length === 0 ? 1 : cleaned.split('\n').length;
  const hasMetaOrTitle = Boolean(metaString && metaString.trim().length > 0);
  const headerHeight = hasMetaOrTitle ? 36 : 0;
  const paddingAndBorders = 28;
  const lineHeight = 20;
  return Math.round(lineCount * lineHeight + paddingAndBorders + headerHeight);
}
