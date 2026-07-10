import {
  type EditorState,
  type EditorSelection,
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
import { type SyntaxNode } from '@lezer/common';
import { syntaxTree } from '@codemirror/language';
import { editorLivePreviewField, debounce } from 'obsidian';
import type PrismExpressiveCodePlugin from '../main';
import { INLINE_CODE_REGEX, LRUCache } from '../utils';
import { type ThemedToken } from '../prism/PrismHighlighter';

export class EditorUtil {
  /**
   * Checks if two ranges overlap.
   *
   * @param fromA
   * @param toA
   * @param fromB
   * @param toB
   */
  static checkRangeOverlap(
    fromA: number,
    toA: number,
    fromB: number,
    toB: number,
  ): boolean {
    return fromA <= toB && fromB <= toA;
  }

  /**
   * Checks if editor selection and the given range overlap.
   *
   * @param selection
   * @param from
   * @param to
   */
  static checkSelectionAndRangeOverlap(
    selection: EditorSelection,
    from: number,
    to: number,
  ): boolean {
    for (const range of selection.ranges) {
      if (EditorUtil.checkRangeOverlap(range.from, range.to, from, to)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets the editor content of a given range.
   *
   * @param state
   * @param from
   * @param to
   */
  static getContent(state: EditorState, from: number, to: number): string {
    return state.sliceDoc(from, to);
  }
}

export enum DecorationUpdateType {
  Insert,
  Remove,
}

export type DecorationUpdate = InsertDecoration | RemoveDecoration;

export interface InsertDecoration {
  type: DecorationUpdateType.Insert;
  from: number;
  to: number;
  lang: string;
  content: string;
  hideLang?: boolean;
  codeStart?: number;
  codeEnd?: number;
  hideStart?: number;
  hideEnd?: number;
}

export interface RemoveDecoration {
  type: DecorationUpdateType.Remove;
  from: number;
  to: number;
}

const nodePropsCache = new Map<string, Set<string>>();
const isCodeBlockCache = new Map<string, boolean>();

export class SyntaxTreeParser {
  static isLivePreview(state: EditorState): boolean {
    // @ts-ignore some strange private field not being assignable
    return state.field(editorLivePreviewField);
  }

  static getCodeBlockNode(node: SyntaxNode): SyntaxNode | null {
    let curr: typeof node | null = node;
    while (curr) {
      const name = curr.type.name;
      if (name) {
        let isCode = isCodeBlockCache.get(name);
        if (isCode === undefined) {
          isCode = name.toLowerCase().includes('codeblock');
          isCodeBlockCache.set(name, isCode);
        }
        if (isCode) return curr;
      }
      curr = curr.parent;
    }
    return null;
  }

  static getExpandedViewportRange(view: EditorView): {
    from: number;
    to: number;
  } {
    let from = view.viewport.from;
    let to = view.viewport.to;

    const tree = syntaxTree(view.state);
    if (!tree) {
      return { from, to };
    }

    // Resolve node at the start of viewport and find if it's within a code block
    const startNode = tree.resolveInner(from, 1);
    const startCodeBlock = this.getCodeBlockNode(startNode);
    if (startCodeBlock) {
      from = Math.max(0, startCodeBlock.from);
    }

    // Resolve node at the end of viewport and find if it's within a code block
    const endNode = tree.resolveInner(to, -1);
    const endCodeBlock = this.getCodeBlockNode(endNode);
    if (endCodeBlock) {
      to = Math.min(view.state.doc.length, endCodeBlock.to);
    }

    return { from, to };
  }

  static getDecorationUpdates(
    view: EditorView,
    plugin: PrismExpressiveCodePlugin,
    docChanged: boolean,
  ): DecorationUpdate[] {
    let lang = '';
    let beginLineEndOffset = -1;
    let codeBlockNodes: SyntaxNode[] = [];
    const decorationUpdates: DecorationUpdate[] = [];

    const expandedViewport = this.getExpandedViewportRange(view);

    syntaxTree(view.state).iterate({
      from: expandedViewport.from,
      to: expandedViewport.to,
      enter: (nodeRef) => {
        const node = nodeRef.node;
        const nodeName = node.type.name;
        let props = nodePropsCache.get(nodeName);
        if (!props) {
          props = new Set<string>(nodeName ? nodeName.split('_') : []);
          nodePropsCache.set(nodeName, props);
        }

        if (props.has('formatting')) {
          return;
        }

        if (props.has('inline-code')) {
          const content = EditorUtil.getContent(view.state, node.from, node.to);

          if (content.endsWith('}') && plugin.settings.inlineHighlighting) {
            const match = content.match(INLINE_CODE_REGEX); // format: `code{:lang}`
            if (match && match[1] && match[2]) {
              const hasSelectionOverlap =
                EditorUtil.checkSelectionAndRangeOverlap(
                  view.state.selection,
                  node.from - 1,
                  node.to + 1,
                );

              decorationUpdates.push({
                type: DecorationUpdateType.Insert,
                from: node.from,
                to: node.to,
                lang: match[2],
                content: match[1],
                hideLang:
                  this.isLivePreview(view.state) && !hasSelectionOverlap,
                codeStart: node.from,
                codeEnd: node.from + match[1].length,
                hideStart: node.from + match[1].length,
                hideEnd: node.to,
              });
            }
          } else {
            // we don't want to highlight normal inline code blocks, thus we remove any of our decorations
            decorationUpdates.push({
              type: DecorationUpdateType.Remove,
              from: node.from,
              to: node.to,
            });
          }
          return;
        }

        // if !docChanged, then this change was a selection change.
        // We only care about inline code blocks in this case, so we can skip the rest.
        if (!docChanged) {
          return;
        }

        if (
          props.has('HyperMD-codeblock') &&
          !props.has('HyperMD-codeblock-begin') &&
          !props.has('HyperMD-codeblock-end')
        ) {
          if (lang !== '') {
            if (beginLineEndOffset === -1 || node.from > beginLineEndOffset) {
              codeBlockNodes.push(node);
            }
          }
          return;
        }

        if (props.has('HyperMD-codeblock-begin')) {
          const content = EditorUtil.getContent(view.state, node.from, node.to);

          // Support both backticks (```) and tildes (~~~) code blocks
          lang = /^(?:`{3,}|~{3,})\s*(\S+)/.exec(content)?.[1] ?? '';
          try {
            beginLineEndOffset = view.state.doc.lineAt(node.from).to;
          } catch {
            beginLineEndOffset = -1;
          }
          codeBlockNodes = [];
        }

        if (props.has('HyperMD-codeblock-end')) {
          if (codeBlockNodes.length > 0 && lang !== '') {
            const firstNode = codeBlockNodes[0];
            const lastNode = codeBlockNodes[codeBlockNodes.length - 1];
            if (firstNode && lastNode) {
              const start = view.state.doc.lineAt(firstNode.from).from;
              const end = view.state.doc.lineAt(lastNode.to).to;

              decorationUpdates.push({
                type: DecorationUpdateType.Insert,
                from: start,
                to: end,
                lang,
                content: EditorUtil.getContent(view.state, start, end),
              });
            }
          }

          if (codeBlockNodes.length > 0 && lang === '') {
            const firstNode = codeBlockNodes[0];
            const lastNode = codeBlockNodes[codeBlockNodes.length - 1];
            if (firstNode && lastNode) {
              const start = view.state.doc.lineAt(firstNode.from).from;
              const end = view.state.doc.lineAt(lastNode.to).to;

              decorationUpdates.push({
                type: DecorationUpdateType.Remove,
                from: start,
                to: end,
              });
            }
          }

          lang = '';
          codeBlockNodes = [];
          beginLineEndOffset = -1;
        }
      },
    });

    return decorationUpdates;
  }
}

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
