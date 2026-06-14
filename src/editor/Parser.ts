import { type EditorState, type EditorSelection } from '@codemirror/state';
import { type EditorView } from '@codemirror/view';
import { type SyntaxNode } from '@lezer/common';
import { syntaxTree } from '@codemirror/language';
import { editorLivePreviewField } from 'obsidian';
import type PrismExpressiveCodePlugin from '../main';
import { INLINE_CODE_REGEX } from '../utils';

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

  static isCodeBlockNode(node: SyntaxNode): boolean {
    let curr: typeof node | null = node;
    while (curr) {
      const name = curr.type.name;
      if (name) {
        let isCode = isCodeBlockCache.get(name);
        if (isCode === undefined) {
          isCode = name.toLowerCase().includes('codeblock');
          isCodeBlockCache.set(name, isCode);
        }
        if (isCode) return true;
      }
      curr = curr.parent;
    }
    return false;
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

    // Expand from backwards to include the beginning of any intersecting code blocks
    while (from > 0) {
      const line = view.state.doc.lineAt(from);
      const node = tree.resolveInner(line.from, 1);
      if (!this.isCodeBlockNode(node)) {
        break;
      }
      from = Math.max(0, line.from - 1);
    }

    // Expand to forwards to include the end of any intersecting code blocks
    const docLength = view.state.doc.length;
    while (to < docLength) {
      const line = view.state.doc.lineAt(to);
      const node = tree.resolveInner(line.to, -1);
      if (!this.isCodeBlockNode(node)) {
        break;
      }
      to = Math.min(docLength, line.to + 1);
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
