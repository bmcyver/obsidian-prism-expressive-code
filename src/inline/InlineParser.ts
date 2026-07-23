import { type EditorState, type EditorSelection } from '@codemirror/state';
import { type EditorView, type DecorationSet } from '@codemirror/view';
import { type SyntaxNode } from '@lezer/common';
import { syntaxTree } from '@codemirror/language';
import { editorLivePreviewField } from 'obsidian';
import type PrismExpressiveCodePlugin from '../main';

export const INLINE_CODE_REGEX = /^(.*)\{:([a-zA-Z0-9_\-+#]+)\}$/; // format: `code{:lang}`

export class EditorUtil {
  /**
   * Checks if two ranges overlap.
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
    return Boolean(
      (state.field as (field: unknown) => boolean)(editorLivePreviewField),
    );
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

    // Limit maximum lookback / lookahead bounds (e.g. 5,000 characters)
    // to prevent freezing when viewport hits a massive 10,000+ line code block.
    const MAX_LOOK_BOUND = 5000;
    const minAllowedFrom = Math.max(0, from - MAX_LOOK_BOUND);
    const maxAllowedTo = Math.min(view.state.doc.length, to + MAX_LOOK_BOUND);

    // Resolve node at the start of viewport and find if it's within a code block
    const startNode = tree.resolveInner(from, 1);
    const startCodeBlock = this.getCodeBlockNode(startNode);
    if (startCodeBlock) {
      from = Math.max(minAllowedFrom, startCodeBlock.from);
    }

    // Resolve node at the end of viewport and find if it's within a code block
    const endNode = tree.resolveInner(to, -1);
    const endCodeBlock = this.getCodeBlockNode(endNode);
    if (endCodeBlock) {
      to = Math.min(maxAllowedTo, endCodeBlock.to);
    }

    return { from, to };
  }

  private static getNodesRange(
    state: EditorState,
    nodes: SyntaxNode[],
  ): { start: number; end: number } | null {
    const firstNode = nodes[0];
    const lastNode = nodes[nodes.length - 1];
    if (firstNode && lastNode) {
      try {
        const start = state.doc.lineAt(firstNode.from).from;
        const end = state.doc.lineAt(lastNode.to).to;
        return { start, end };
      } catch {
        return null;
      }
    }
    return null;
  }

  private static isRangeDecorated(
    existingDecorations: DecorationSet | undefined,
    from: number,
    to: number,
  ): boolean {
    if (!existingDecorations) return false;
    let found = false;
    existingDecorations.between(from, to, () => {
      found = true;
      return false; // stop iteration once found
    });
    return found;
  }

  private static handleInlineCode(
    node: SyntaxNode,
    state: EditorState,
    plugin: PrismExpressiveCodePlugin,
    decorationUpdates: DecorationUpdate[],
    docChanged: boolean,
    existingDecorations?: DecorationSet,
  ): void {
    const content = EditorUtil.getContent(state, node.from, node.to);

    if (content.endsWith('}') && plugin.settings.inlineHighlighting) {
      const match = content.match(INLINE_CODE_REGEX); // format: `code{:lang}`
      if (match && match[1] && match[2]) {
        // If doc didn't change and range is already decorated, skip re-processing to eliminate scroll lag
        if (
          !docChanged &&
          this.isRangeDecorated(existingDecorations, node.from, node.to)
        ) {
          return;
        }

        const hasSelectionOverlap = EditorUtil.checkSelectionAndRangeOverlap(
          state.selection,
          node.from - 1,
          node.to + 1,
        );

        decorationUpdates.push({
          type: DecorationUpdateType.Insert,
          from: node.from,
          to: node.to,
          lang: match[2],
          content: match[1],
          hideLang: this.isLivePreview(state) && !hasSelectionOverlap,
          codeStart: node.from,
          codeEnd: node.from + match[1].length,
          hideStart: node.from + match[1].length,
          hideEnd: node.to,
        });
      }
    } else {
      // we don't want to highlight normal inline code blocks, thus we remove any of our decorations
      if (this.isRangeDecorated(existingDecorations, node.from, node.to)) {
        decorationUpdates.push({
          type: DecorationUpdateType.Remove,
          from: node.from,
          to: node.to,
        });
      }
    }
  }

  private static handleCodeBlockEnd(
    state: EditorState,
    lang: string,
    codeBlockNodes: SyntaxNode[],
    decorationUpdates: DecorationUpdate[],
    docChanged: boolean,
    existingDecorations?: DecorationSet,
  ): void {
    if (codeBlockNodes.length === 0) return;

    const range = this.getNodesRange(state, codeBlockNodes);
    if (!range) return;

    if (lang !== '') {
      // If doc didn't change and range is already decorated, skip re-parsing Prism tokens during scroll
      if (
        !docChanged &&
        this.isRangeDecorated(existingDecorations, range.start, range.end)
      ) {
        return;
      }

      decorationUpdates.push({
        type: DecorationUpdateType.Insert,
        from: range.start,
        to: range.end,
        lang,
        content: EditorUtil.getContent(state, range.start, range.end),
      });
    } else {
      if (this.isRangeDecorated(existingDecorations, range.start, range.end)) {
        decorationUpdates.push({
          type: DecorationUpdateType.Remove,
          from: range.start,
          to: range.end,
        });
      }
    }
  }

  static getDecorationUpdates(
    view: EditorView,
    plugin: PrismExpressiveCodePlugin,
    docChanged: boolean,
    existingDecorations?: DecorationSet,
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
          this.handleInlineCode(
            node,
            view.state,
            plugin,
            decorationUpdates,
            docChanged,
            existingDecorations,
          );
          return;
        }

        // If !docChanged, then this change was a selection change or viewport scroll.
        // We only care about inline code blocks in this case, so we can skip full code block parsing.
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
          this.handleCodeBlockEnd(
            view.state,
            lang,
            codeBlockNodes,
            decorationUpdates,
            docChanged,
            existingDecorations,
          );
          lang = '';
          codeBlockNodes = [];
          beginLineEndOffset = -1;
        }
      },
    });

    return decorationUpdates;
  }
}
