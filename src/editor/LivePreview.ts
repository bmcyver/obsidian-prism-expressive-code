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
import { LRUCache } from '../utils';
import { type ThemedToken } from '../prism/InlineHighlighter';
import { SyntaxTreeParser, DecorationUpdateType } from './Parser';

const decorationCache = new LRUCache<string, Decoration>(200);

export class DecorationBuilder {
  static async buildDecorations(
    plugin: PrismExpressiveCodePlugin,
    from: number,
    to: number,
    language: string,
    content: string,
  ): Promise<Range<Decoration>[]> {
    if (language === '') {
      return [];
    }

    const highlight = await plugin.highlighter.getHighlightTokens(
      content,
      language.toLowerCase(),
    );

    if (!highlight) {
      return [];
    }

    const tokens = highlight.tokens;

    const decorations: Range<Decoration>[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;
      const nextToken: ThemedToken | undefined = tokens[i + 1];

      const tokenStyle =
        plugin.highlighter.inlineHighlighter.getTokenStyle(token);
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

      decorations.push(
        dec.range(
          from + token.offset,
          nextToken ? from + nextToken.offset : to,
        ),
      );
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

      pendingDocChanged = false;
      updateFn: () => Promise<void>;

      debouncedDocChangedUpdate: (() => void) & { cancel(): void };
      debouncedViewportUpdate: (() => void) & { cancel(): void };
      debouncedCompositionEndUpdate: (() => void) & { cancel(): void };

      constructor(view: EditorView) {
        this.view = view;
        void this.updateWidgets(view);

        this.updateFn = (): Promise<void> => {
          return this.updateWidgets(this.view);
        };
        plugin.activeCm6Plugins.add(this.updateFn);

        this.debouncedDocChangedUpdate = debounce(
          () => {
            const docChanged = this.pendingDocChanged;
            this.pendingDocChanged = false;
            void this.updateWidgets(this.view, docChanged);
          },
          300,
          true,
        );

        this.debouncedViewportUpdate = debounce(
          () => {
            const docChanged = this.pendingDocChanged;
            this.pendingDocChanged = false;
            void this.updateWidgets(this.view, docChanged);
          },
          150,
          true,
        );

        this.debouncedCompositionEndUpdate = debounce(
          () => {
            const docChanged = this.pendingDocChanged;
            this.pendingDocChanged = false;
            void this.updateWidgets(this.view, docChanged);
          },
          100,
          true,
        );
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
        if (view.composing) {
          return;
        }

        const capturedState = view.state;
        const newDecorationsList: Range<Decoration>[] = [];
        const removeRanges: { from: number; to: number }[] = [];

        const decorationUpdates = SyntaxTreeParser.getDecorationUpdates(
          view,
          plugin,
          docChanged,
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
                Decoration.replace({}).range(node.hideStart, node.hideEnd),
              );
            }
            newDecorationsList.push(...decorations);
          }
        }

        let finalDecorations =
          this.view.state.field(pecDecorationsField, false) ?? Decoration.none;
        for (const r of removeRanges) {
          finalDecorations = finalDecorations.update({
            filterFrom: r.from,
            filterTo: r.to,
            filter: () => false,
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
          this.view.state === capturedState &&
          !this.isDestroyed
        ) {
          window.requestAnimationFrame(() => {
            if (
              this.view.state === capturedState &&
              !this.view.composing &&
              !this.isDestroyed
            ) {
              this.view.dispatch({
                effects: updateDecorationsEffect.of(finalDecorations),
              });
            }
          });
        }
      }

      destroy(): void {
        this.isDestroyed = true;
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
