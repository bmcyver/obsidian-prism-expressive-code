import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { getPrism } from './prismUtils';
import { flattenTokens } from './tokenizer';
import {
  getStyleForPrismTypes,
  getThemeDefaultFg,
  FontStyle,
  type ThemeLike,
} from './scopeMapping';
import { LANGUAGE_ALIASES } from '../config';

let currentLoadedTheme: ThemeLike | null = null;

export function setCm6Theme(theme: ThemeLike | null): void {
  currentLoadedTheme = theme;
}

/**
 * Live Preview / Editing view 상에서 PrismJS 및 Expressive Code 테마 색상을 이용해
 * 토큰 색상 꼬임 없이 100% 라인 정확도로 하이라이팅하는 CodeMirror 6 Extension
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
  const theme = currentLoadedTheme;
  const defaultFg = getThemeDefaultFg(theme);

  let inCodeBlock = false;
  let codeBlockLang = '';
  let blockLines: { text: string; from: number }[] = [];

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const trimmed = line.text.trim();

    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        const afterFence = trimmed.slice(3).trim();
        const langMatch = afterFence.split(/\s+/)[0] || '';
        let lang = langMatch.toLowerCase();
        codeBlockLang = LANGUAGE_ALIASES[lang] ?? lang;
        blockLines = [];
      } else {
        inCodeBlock = false;
        if (codeBlockLang && blockLines.length > 0) {
          const grammar =
            prism.languages[codeBlockLang] ??
            prism.languages.plaintext ??
            prism.languages.text;

          if (grammar) {
            // 개별 라인 단위 토큰화 (화면 보임 범위 밖 라인은 토큰화/데코레이션 생성 스킵하여 성능 극대화)
            for (const bLine of blockLines) {
              const lineTo = bLine.from + bLine.text.length;
              if (lineTo < minVisibleFrom || bLine.from > maxVisibleTo) {
                continue;
              }
              if (bLine.text.length === 0) continue;

              const lineTokens = prism.tokenize(bLine.text, grammar);
              const flatTokens = flattenTokens(lineTokens);

              let charOffset = 0;
              for (const token of flatTokens) {
                const tokenLen = token.content.length;
                if (tokenLen > 0) {
                  const tokenFrom = bLine.from + charOffset;
                  const tokenTo = tokenFrom + tokenLen;

                  if (
                    tokenFrom >= minVisibleFrom &&
                    tokenTo <= maxVisibleTo &&
                    tokenFrom < tokenTo &&
                    tokenTo <= doc.length
                  ) {
                    let styleCss = '';
                    if (theme) {
                      const style = getStyleForPrismTypes(
                        theme,
                        token.types,
                        token.typeKey,
                        codeBlockLang,
                      );
                      const colorToUse = style.color || defaultFg;
                      if (colorToUse) {
                        styleCss += `color: ${colorToUse} !important;`;
                      }
                      if (style.fontStyle) {
                        if ((style.fontStyle & FontStyle.Italic) !== 0) {
                          styleCss += 'font-style: italic;';
                        }
                        if ((style.fontStyle & FontStyle.Bold) !== 0) {
                          styleCss += 'font-weight: bold;';
                        }
                        if ((style.fontStyle & FontStyle.Underline) !== 0) {
                          styleCss += 'text-decoration: underline;';
                        }
                      }
                    }

                    const tokenClasses = token.types
                      .map((t) => `token ${t}`)
                      .join(' ');

                    builder.add(
                      tokenFrom,
                      tokenTo,
                      Decoration.mark({
                        class: `cm-prism-token ${tokenClasses}`,
                        attributes: styleCss ? { style: styleCss } : undefined,
                      }),
                    );
                  }
                }
                charOffset += tokenLen;
              }
            }
          }
        }
        blockLines = [];
      }
    } else if (inCodeBlock) {
      blockLines.push({ text: line.text, from: line.from });
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
