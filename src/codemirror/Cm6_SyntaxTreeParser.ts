import { type EditorView } from "@codemirror/view";
import { type EditorState } from "@codemirror/state";
import { type SyntaxNode } from "@lezer/common";
import { syntaxTree } from "@codemirror/language";
import { editorLivePreviewField } from "obsidian";
import { Cm6_Util } from "src/codemirror/Cm6_Util";
import type ShikiPlugin from "src/main";
import { SHIKI_INLINE_REGEX } from "src/utils/constants";

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

export class Cm6_SyntaxTreeParser {
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
          isCode = name.toLowerCase().includes("codeblock");
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
    plugin: ShikiPlugin,
    docChanged: boolean,
  ): DecorationUpdate[] {
    let lang = "";
    let beginLineEndOffset = -1;
    let state: SyntaxNode[] = [];
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
          props = new Set<string>(nodeName ? nodeName.split("_") : []);
          nodePropsCache.set(nodeName, props);
        }

        if (props.has("formatting")) {
          return;
        }

        if (props.has("inline-code")) {
          const content = Cm6_Util.getContent(view.state, node.from, node.to);

          if (content.endsWith("}") && plugin.settings.inlineHighlighting) {
            const match = content.match(SHIKI_INLINE_REGEX); // format: `code{:lang}`
            if (match && match[1] && match[2]) {
              const hasSelectionOverlap =
                Cm6_Util.checkSelectionAndRangeOverlap(
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
          props.has("HyperMD-codeblock") &&
          !props.has("HyperMD-codeblock-begin") &&
          !props.has("HyperMD-codeblock-end")
        ) {
          if (lang !== "") {
            if (beginLineEndOffset === -1 || node.from > beginLineEndOffset) {
              state.push(node);
            }
          }
          return;
        }

        if (props.has("HyperMD-codeblock-begin")) {
          const content = Cm6_Util.getContent(view.state, node.from, node.to);

          lang = /```\s*(\S+)/.exec(content)?.[1] ?? "";
          try {
            beginLineEndOffset = view.state.doc.lineAt(node.from).to;
          } catch {
            beginLineEndOffset = -1;
          }
          state = [];
        }

        if (props.has("HyperMD-codeblock-end")) {
          if (state.length > 0 && lang !== "") {
            const firstState = state[0];
            const lastState = state[state.length - 1];
            if (firstState && lastState) {
              const start = view.state.doc.lineAt(firstState.from).from;
              const end = view.state.doc.lineAt(lastState.to).to;

              decorationUpdates.push({
                type: DecorationUpdateType.Insert,
                from: start,
                to: end,
                lang,
                content: Cm6_Util.getContent(view.state, start, end),
              });
            }
          }

          if (state.length > 0 && lang === "") {
            const firstState = state[0];
            const lastState = state[state.length - 1];
            if (firstState && lastState) {
              const start = view.state.doc.lineAt(firstState.from).from;
              const end = view.state.doc.lineAt(lastState.to).to;

              decorationUpdates.push({
                type: DecorationUpdateType.Remove,
                from: start,
                to: end,
              });
            }
          }

          lang = "";
          state = [];
          beginLineEndOffset = -1;
        }
      },
    });

    return decorationUpdates;
  }
}
