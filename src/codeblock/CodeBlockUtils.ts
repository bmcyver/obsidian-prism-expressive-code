import {
  type MarkdownPostProcessorContext,
  type MarkdownSectionInformation,
} from 'obsidian';

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
  existingSectionInfo?: MarkdownSectionInformation | null,
): string {
  const sectionInfo =
    existingSectionInfo !== undefined
      ? existingSectionInfo
      : ctx.getSectionInfo(containerEl);

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

export function stripFenceIndentation(
  source: string,
  fenceIndent: string,
): string {
  if (!source || !fenceIndent) return source;

  const lines = source.split('\n');
  let fenceSpaces = 0;
  for (const char of fenceIndent) {
    if (char === ' ') fenceSpaces += 1;
    else if (char === '\t') fenceSpaces += 4;
  }

  if (fenceSpaces === 0) return source;

  return lines
    .map((line) => {
      if (line.trim().length === 0) return '';
      if (line.startsWith(fenceIndent)) {
        return line.slice(fenceIndent.length);
      }
      let stripped = 0;
      let idx = 0;
      while (idx < line.length && stripped < fenceSpaces) {
        if (line[idx] === ' ') {
          stripped += 1;
          idx++;
        } else if (line[idx] === '\t') {
          if (stripped + 4 <= fenceSpaces) {
            stripped += 4;
            idx++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      return line.slice(idx);
    })
    .join('\n');
}

export function stripCommonIndentation(
  source: string,
  fenceIndent: string = '',
): string {
  if (!source) return source;
  if (fenceIndent) {
    return stripFenceIndentation(source, fenceIndent);
  }
  return source;
}

export interface FenceIndentationInfo {
  level: number;
  indent: string;
}

export function extractFenceIndentationInfo(
  ctx: MarkdownPostProcessorContext,
  containerEl: HTMLElement,
  source: string = '',
  existingSectionInfo?: MarkdownSectionInformation | null,
): FenceIndentationInfo {
  const sectionInfo =
    existingSectionInfo !== undefined
      ? existingSectionInfo
      : ctx.getSectionInfo(containerEl);
  if (!sectionInfo) return { level: 0, indent: '' };

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
        const level = tabs + Math.floor(spaces / 4);
        return { level, indent };
      }
    }
  }

  return { level: 0, indent: '' };
}

export function extractFenceIndentationLevel(
  ctx: MarkdownPostProcessorContext,
  containerEl: HTMLElement,
  source: string = '',
): number {
  return extractFenceIndentationInfo(ctx, containerEl, source).level;
}

export function estimateCodeBlockHeight(
  source: string,
  metaString?: string,
  fenceIndent: string = '',
): number {
  const cleaned = stripCommonIndentation(source, fenceIndent);
  const lineCount = cleaned.length === 0 ? 1 : cleaned.split('\n').length;
  const hasMetaOrTitle = Boolean(metaString && metaString.trim().length > 0);
  const headerHeight = hasMetaOrTitle ? 36 : 0;
  const paddingAndBorders = 28;
  const lineHeight = 20;
  return Math.round(lineCount * lineHeight + paddingAndBorders + headerHeight);
}
