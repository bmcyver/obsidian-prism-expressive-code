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
  source: string = '',
): string {
  const sectionInfo = ctx.getSectionInfo(containerEl);

  if (sectionInfo === null) {
    return '';
  }

  // Find the first non-empty line of the code block's source to uniquely identify this block
  const firstSourceLine =
    source
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0) || '';

  // Scan lines from lineStart to lineEnd to find the fence marker for THIS specific block
  for (let i = sectionInfo.lineStart; i <= sectionInfo.lineEnd; i++) {
    const line = getLineAt(sectionInfo.text, i);
    if (line === undefined) break;

    const trimmed = line.trim();
    let markerIdx = trimmed.indexOf('```');
    let markerLength = 3;
    if (markerIdx === -1) {
      markerIdx = trimmed.indexOf('~~~');
    }

    if (markerIdx !== -1) {
      const markerChar = trimmed[markerIdx]!;
      while (trimmed[markerIdx + markerLength] === markerChar) {
        markerLength++;
      }

      // Check if the next line after this fence marker matches our code block's source
      const nextLine = getLineAt(sectionInfo.text, i + 1)?.trim() || '';
      const isNextLineFence =
        nextLine.startsWith('```') || nextLine.startsWith('~~~');

      const isMatch =
        firstSourceLine.length > 0
          ? nextLine === firstSourceLine
          : isNextLineFence || nextLine === '';

      if (isMatch) {
        const afterMarker = trimmed.slice(markerIdx + markerLength).trimStart();
        const spaceIdx = afterMarker.indexOf(' ');
        if (spaceIdx !== -1) {
          return afterMarker.slice(spaceIdx + 1).trim();
        }
        return '';
      }
    }
  }

  return '';
}

export function stripCommonIndentation(source: string): string {
  return source;
}

export function extractFenceIndentationLevel(
  ctx: MarkdownPostProcessorContext,
  containerEl: HTMLElement,
  source: string = '',
): number {
  const sectionInfo = ctx.getSectionInfo(containerEl);
  if (!sectionInfo) return 0;

  const firstSourceLine =
    source
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0) || '';

  for (let i = sectionInfo.lineStart; i <= sectionInfo.lineEnd; i++) {
    const line = getLineAt(sectionInfo.text, i);
    if (line === undefined) break;

    const trimmed = line.trim();
    let markerIdx = trimmed.indexOf('```');
    if (markerIdx === -1) {
      markerIdx = trimmed.indexOf('~~~');
    }

    if (markerIdx !== -1) {
      const nextLine = getLineAt(sectionInfo.text, i + 1)?.trim() || '';
      const isNextLineFence =
        nextLine.startsWith('```') || nextLine.startsWith('~~~');

      const isMatch =
        firstSourceLine.length > 0
          ? nextLine === firstSourceLine
          : isNextLineFence || nextLine === '';

      if (isMatch) {
        // Calculate indentation level of the code fence line itself
        const match = /^[ \t]*/.exec(line);
        const indent = match ? match[0] : '';
        let spaces = 0;
        let tabs = 0;
        for (const char of indent) {
          if (char === ' ') spaces++;
          else if (char === '\t') tabs++;
        }
        return tabs + Math.floor(spaces / 4);
      }
    }
  }

  return 0;
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
