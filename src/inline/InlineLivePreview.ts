import {
  type Range,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { debounce } from 'obsidian';
import type PrismExpressiveCodePlugin from '../main';
import { LRUCache } from '../utils/LRUCache';
import { type ThemedToken } from './InlineHighlighter';
import { SyntaxTreeParser, DecorationUpdateType } from './InlineParser';

import { cacheManager } from '../utils/CacheManager';

const decorationCache = cacheManager.register(new LRUCache<string, Decoration>(1000));

const HIDE_REPLACE_DECORATION = Decoration.replace({});

export class DecorationBuilder {
  static async buildDecorations(
    plugin: PrismExpressiveCodePlugin,
    view: EditorView,
    from: number,
    to: number,
    language: string,
    content: string,
  ): Promise<Range<Decoration>[]> {
    if (language === '') {
      return [];
    }

    const highlight = await plugin.inlineHighlighter.getHighlightTokens(
      content,
      language.toLowerCase(),
    );

    if (!highlight) {
      return [];
    }

    const tokens = highlight.tokens;
    const doc = view.state.doc;
    const docLength = doc.length;
    const decorations: Range<Decoration>[] = [];

    const clampedFrom = Math.max(0, Math.min(docLength, from));
    const clampedTo = Math.max(clampedFrom, Math.min(docLength, to));

    if (clampedFrom >= clampedTo) {
      return [];
    }

    // Pre-fetch line boundaries once for the target slice range [clampedFrom, clampedTo]
    const startLine = doc.lineAt(clampedFrom);
    const endLine = doc.lineAt(clampedTo);

    const lineRanges: { from: number; to: number }[] = [];
    if (startLine.number === endLine.number) {
      lineRanges.push({ from: startLine.from, to: startLine.to });
    } else {
      let curLineNum = startLine.number;
      while (curLineNum <= endLine.number) {
        const line = doc.line(curLineNum);
        lineRanges.push({ from: line.from, to: line.to });
        curLineNum++;
      }
    }

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;
      const nextToken: ThemedToken | undefined = tokens[i + 1];

      const tokenStyle =
        plugin.inlineHighlighter.getTokenStyle(token);
      const classStr = tokenStyle.classes.join(' ');
      const cacheKey = `${tokenStyle.style}|${classStr}`;

      let dec = decorationCache.get(cacheKey);
      if (!dec) {
        const attrs: Record<string, string> = { style: tokenStyle.style };
        if (classStr) {
          attrs.class = classStr;
        }
        dec = Decoration.mark({ attributes: attrs });
        decorationCache.set(cacheKey, dec);
      }

      const rawTokenFrom = from + token.offset;
      const rawTokenTo = nextToken ? from + nextToken.offset : to;

      const tokenFrom = Math.max(0, Math.min(docLength, rawTokenFrom));
      const tokenTo = Math.max(tokenFrom, Math.min(docLength, rawTokenTo));

      if (tokenFrom >= tokenTo) continue;

      if (lineRanges.length === 1) {
        // Single line code slice fast-path: push directly without line splitting loop
        decorations.push(dec.range(tokenFrom, tokenTo));
      } else {
        // Multi-line code slice: split across pre-fetched line boundaries
        let pos = tokenFrom;
        let lineIdx = 0;
        while (lineIdx < lineRanges.length) {
          const curRange = lineRanges[lineIdx];
          if (!curRange || curRange.to >= pos) break;
          lineIdx++;
        }
        while (pos < tokenTo && lineIdx < lineRanges.length) {
          const curRange = lineRanges[lineIdx];
          if (!curRange) break;
          const lineEnd = Math.min(tokenTo, curRange.to);
          if (pos < lineEnd) {
            decorations.push(dec.range(pos, lineEnd));
          }
          pos = curRange.to + 1;
          lineIdx++;
        }
      }
    }

    return decorations;
  }
}

export const updateDecorationsEffect = StateEffect.define<DecorationSet>();

export const pecDecorationsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(updateDecorationsEffect)) {
        decorations = e.value;
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function createLivePreviewPlugin(
  plugin: PrismExpressiveCodePlugin,
): Extension {
  const viewPlugin = ViewPlugin.fromClass(
    class Cm6ViewPlugin {
      view: EditorView;
      isDestroyed = false;
      generation = 0;

      pendingDocChanged = false;
      updateFn: () => Promise<void>;

      debouncedDocChangedUpdate: (() => void) & { cancel(): void };
      debouncedViewportUpdate: (() => void) & { cancel(): void };
      debouncedCompositionEndUpdate: (() => void) & { cancel(): void };

      createDebouncedUpdate(delay: number) {
        return debounce(
          () => {
            const docChanged = this.pendingDocChanged;
            this.pendingDocChanged = false;
            void this.updateWidgets(this.view, docChanged);
          },
          delay,
          true,
        );
      }

      constructor(view: EditorView) {
        this.view = view;
        void this.updateWidgets(view);

        this.updateFn = (): Promise<void> => {
          return this.updateWidgets(this.view);
        };
        plugin.activeCm6Plugins.add(this.updateFn);

        this.debouncedDocChangedUpdate = this.createDebouncedUpdate(300);
        this.debouncedViewportUpdate = this.createDebouncedUpdate(250);
        this.debouncedCompositionEndUpdate = this.createDebouncedUpdate(100);
      }

      cancelAllDebounces(): void {
        this.debouncedDocChangedUpdate.cancel();
        this.debouncedViewportUpdate.cancel();
        this.debouncedCompositionEndUpdate.cancel();
      }

      update(update: ViewUpdate): void {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged
        ) {
          this.view = update.view;
          this.pendingDocChanged = this.pendingDocChanged || update.docChanged;

          // When viewport updates during scroll (without doc changes), bump generation to cancel in-flight async operations
          if (update.viewportChanged && !update.docChanged) {
            this.generation++;
          }

          this.cancelAllDebounces();

          if (update.view.composing) {
            return;
          }

          if (update.docChanged) {
            this.debouncedDocChangedUpdate();
          } else {
            this.debouncedViewportUpdate();
          }
        }
      }

      async updateWidgets(
        view: EditorView,
        docChanged: boolean = true,
      ): Promise<void> {
        if (view.composing || this.isDestroyed) {
          return;
        }

        const currentGen = ++this.generation;
        const capturedState = view.state;
        const newDecorationsList: Range<Decoration>[] = [];
        const removeRanges: { from: number; to: number }[] = [];

        const existingDecorations = view.state.field(pecDecorationsField, false);
        const decorationUpdates = SyntaxTreeParser.getDecorationUpdates(
          view,
          plugin,
          docChanged,
          existingDecorations,
        );

        const highlightPromises = decorationUpdates.map(async (node) => {
          if (node.type === DecorationUpdateType.Remove) {
            return {
              type: DecorationUpdateType.Remove as const,
              from: node.from,
              to: node.to,
            };
          } else {
            const decorations = await DecorationBuilder.buildDecorations(
              plugin,
              view,
              node.codeStart ?? node.from,
              node.codeEnd ?? node.to,
              node.lang,
              node.content,
            );
            return {
              type: DecorationUpdateType.Insert as const,
              node,
              decorations,
            };
          }
        });

        const highlightResults = await Promise.all(highlightPromises);

        if (
          this.generation !== currentGen ||
          this.view.state !== capturedState ||
          this.view.composing ||
          this.isDestroyed
        ) {
          return;
        }

        for (const result of highlightResults) {
          if (result.type === DecorationUpdateType.Remove) {
            removeRanges.push({ from: result.from, to: result.to });
          } else {
            const { node, decorations } = result;
            removeRanges.push({ from: node.from, to: node.to });
            if (
              node.hideLang &&
              node.hideStart !== undefined &&
              node.hideEnd !== undefined
            ) {
              decorations.unshift(
                HIDE_REPLACE_DECORATION.range(node.hideStart, node.hideEnd),
              );
            }
            newDecorationsList.push(...decorations);
          }
        }

        let finalDecorations =
          this.view.state.field(pecDecorationsField, false) ?? Decoration.none;

        if (removeRanges.length > 0) {
          removeRanges.sort((a, b) => a.from - b.from);
          const firstRange = removeRanges[0];
          const minFrom = firstRange ? firstRange.from : 0;
          const maxTo = Math.max(...removeRanges.map((r) => r.to));

          finalDecorations = finalDecorations.update({
            filterFrom: minFrom,
            filterTo: maxTo,
            filter: (from, to) => {
              for (let i = 0; i < removeRanges.length; i++) {
                const r = removeRanges[i];
                if (r && from <= r.to && to >= r.from) {
                  return false;
                }
              }
              return true;
            },
          });
        }

        if (newDecorationsList.length > 0) {
          newDecorationsList.sort((a, b) => {
            const diff = a.from - b.from;
            return diff !== 0 ? diff : a.to - b.to;
          });
          finalDecorations = finalDecorations.update({
            add: newDecorationsList,
          });
        }

        if (
          (removeRanges.length > 0 || newDecorationsList.length > 0) &&
          this.generation === currentGen &&
          this.view.state === capturedState &&
          !this.view.composing &&
          !this.isDestroyed
        ) {
          this.view.dispatch({
            effects: updateDecorationsEffect.of(finalDecorations),
          });
        }
      }

      destroy(): void {
        this.isDestroyed = true;
        this.generation++;
        this.cancelAllDebounces();
        plugin.activeCm6Plugins.delete(this.updateFn);
      }
    },
    {
      eventHandlers: {
        compositionend(_event, _view) {
          this.pendingDocChanged = true;
          this.cancelAllDebounces();
          this.debouncedCompositionEndUpdate();
        },
      },
    },
  );

  return [pecDecorationsField, viewPlugin];
}
