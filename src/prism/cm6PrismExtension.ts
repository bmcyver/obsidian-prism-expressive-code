import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { getPrism } from './prismUtils';
import { flattenTokens, splitTokensIntoLines } from './tokenizer';
import { LANGUAGE_ALIASES } from '../config';

/**
 * Live Preview / Editing view 상에서 PrismJS 전체 블록 단위 토큰화 기반으로
 * Reading 모드(Expressive Code)와 100% 동일하게 하이라이팅을 제공하는 CodeMirror 6 Extension
 */
function createPrismDecorations(view: EditorView): DecorationSet {
  const prism = getPrism();
  if (!prism || !prism.languages) return Decoration.none;

  const visibleRanges = view.visibleRanges;
  if (visibleRanges.length === 0) return Decoration.none;

  const minVisibleFrom = Math.max(0, visibleRanges[0]!.from - 500);
  const maxVisibleTo = Math.min(
    view.state.doc.length,
    visibleRanges[visibleRanges.length - 1]!.to + 500,
  );

  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  interface BlockLine {
    text: string;
    from: number;
  }

  interface CodeBlockInfo {
    lang: string;
    lines: BlockLine[];
  }

  const codeBlocks: CodeBlockInfo[] = [];
  let inCodeBlock = false;
  let currentLang = '';
  let currentLines: BlockLine[] = [];

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const trimmed = line.text.trim();

    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        const afterFence = trimmed.slice(3).trim();
        const langMatch = afterFence.split(/\s+/)[0] || '';
        const lang = langMatch.toLowerCase();
        currentLang = LANGUAGE_ALIASES[lang] ?? lang;
        currentLines = [];
      } else {
        inCodeBlock = false;
        if (currentLang && currentLines.length > 0) {
          codeBlocks.push({
            lang: currentLang,
            lines: currentLines,
          });
        }
        currentLines = [];
      }
    } else if (inCodeBlock) {
      currentLines.push({ text: line.text, from: line.from });
    } else if (line.from > maxVisibleTo) {
      // 바깥 영역이고 코드블록 안이 아닌 경우에만 빠른 종료
      break;
    }
  }

  // 파일 끝까지 닫는 펜스가 없는 코드블록 처리
  if (inCodeBlock && currentLang && currentLines.length > 0) {
    codeBlocks.push({
      lang: currentLang,
      lines: currentLines,
    });
  }

  for (const block of codeBlocks) {
    const grammar =
      prism.languages[block.lang] ??
      prism.languages.plaintext ??
      prism.languages.text;

    if (!grammar) continue;

    // Reading 모드(CustomPluginPrism)와 동일하게 전체 블록 코드를 한 번에 토큰화
    const fullCode = block.lines.map((l) => l.text).join('\n');
    const prismTokens = prism.tokenize(fullCode, grammar);
    const flatTokens = flattenTokens(prismTokens);
    const lineTokensArray = splitTokensIntoLines(flatTokens);

    for (
      let lineIdx = 0;
      lineIdx < block.lines.length && lineIdx < lineTokensArray.length;
      lineIdx++
    ) {
      const bLine = block.lines[lineIdx]!;
      const lineTokens = lineTokensArray[lineIdx];
      if (!lineTokens) continue;

      const lineTo = bLine.from + bLine.text.length;
      if (lineTo < minVisibleFrom || bLine.from > maxVisibleTo) {
        continue;
      }

      let charOffset = 0;
      for (const token of lineTokens) {
        const tokenLen = token.content.length;
        if (tokenLen > 0) {
          const tokenFrom = bLine.from + charOffset;
          const tokenTo = tokenFrom + tokenLen;

          if (
            tokenFrom >= minVisibleFrom &&
            tokenTo <= maxVisibleTo &&
            tokenFrom < tokenTo &&
            tokenTo <= doc.length &&
            token.types.length > 0
          ) {
            const tokenClasses = ['token', ...token.types].join(' ');

            builder.add(
              tokenFrom,
              tokenTo,
              Decoration.mark({
                class: `cm-prism-token ${tokenClasses}`,
              }),
            );
          }
        }
        charOffset += tokenLen;
      }
    }
  }

  return builder.finish();
}

export const prismCm6Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = createPrismDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = createPrismDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
