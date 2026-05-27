import type ShikiPlugin from 'packages/obsidian/src/main';
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { type EditorState, type Range } from '@codemirror/state';
import { type SyntaxNode } from '@lezer/common';
import { syntaxTree } from '@codemirror/language';
import { Cm6_Util } from 'packages/obsidian/src/codemirror/Cm6_Util';
import { type ThemedToken } from 'shiki';
import { debounce, editorLivePreviewField } from 'obsidian';

export const SHIKI_INLINE_REGEX = /^(.*)\{:([a-zA-Z0-9_\-+#]+)\}$/; // format: `code{:lang}`

enum DecorationUpdateType {
	Insert,
	Remove,
}

type DecorationUpdate = InsertDecoration | RemoveDecoration;

interface InsertDecoration {
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

interface RemoveDecoration {
	type: DecorationUpdateType.Remove;
	from: number;
	to: number;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- not an easily named type
export function createCm6Plugin(plugin: ShikiPlugin) {
	return ViewPlugin.fromClass(
		class Cm6ViewPlugin {
			decorations: DecorationSet;
			view: EditorView;

			pendingDocChanged = false;
			updateFn: () => Promise<void>;

			debouncedDocChangedUpdate: (() => void) & { cancel(): void };
			debouncedViewportUpdate: (() => void) & { cancel(): void };
			debouncedCompositionEndUpdate: (() => void) & { cancel(): void };

			constructor(view: EditorView) {
				this.view = view;
				this.decorations = Decoration.none;
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

			/**
			 * Triggered by codemirror when the view updates.
			 * Depending on the update type, the decorations are either updated or recreated.
			 *
			 * @param update
			 */
			update(update: ViewUpdate): void {
				try {
					this.decorations = this.decorations.map(update.changes);
				} catch (e) {
					// Decorations may have stale positions if the document changed while an async
					// updateWidgets call was in flight. Reset them so the next update can rebuild.
					this.decorations = Decoration.none;
					console.warn('Resetting decorations due to error:', e);
				}

				// we handle doc changes, selection changes, and viewport/scrolling changes here
				if (update.docChanged || update.selectionSet || update.viewportChanged) {
					this.view = update.view;
					this.pendingDocChanged = this.pendingDocChanged || update.docChanged;

					this.debouncedDocChangedUpdate.cancel();
					this.debouncedViewportUpdate.cancel();
					this.debouncedCompositionEndUpdate.cancel();

					if (update.view.composing) {
						// Don't update widgets while composing, it breaks IME input
						return;
					}

					// Debounce to prevent constant re-rendering during fast typing or rapid scrolling
					if (update.docChanged) {
						this.debouncedDocChangedUpdate();
					} else {
						this.debouncedViewportUpdate();
					}
				}
			}

			isLivePreview(state: EditorState): boolean {
				// @ts-ignore some strange private field not being assignable
				return state.field(editorLivePreviewField);
			}

			isCodeBlockNode(node: SyntaxNode): boolean {
				let curr: typeof node | null = node;
				while (curr) {
					if (curr.type.name?.toLowerCase().includes('codeblock')) {
						return true;
					}
					curr = curr.parent;
				}
				return false;
			}

			getExpandedViewportRange(view: EditorView): { from: number; to: number } {
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

			/**
			 * Updates all the widgets by traversing the syntax tree.
			 *
			 * @param view
			 * @param docChanged
			 */
			async updateWidgets(view: EditorView, docChanged: boolean = true): Promise<void> {
				if (view.composing) {
					return;
				}
				let lang = '';
				let state: SyntaxNode[] = [];
				const decorationUpdates: DecorationUpdate[] = [];
				// Capture the state at the time of the syntax tree traversal so we can
				// detect if the document changed while async decoration building was in flight.
				const capturedState = view.state;

				// const t1 = performance.now();

				// We will collect all decorations we need to add, and those we need to remove.
				// We don't mutate `this.decorations` until the very end, to avoid leaving it in a half-state if aborted.

				const newDecorationsList: Range<Decoration>[] = [];
				const removeRanges: { from: number; to: number }[] = [];

				const expandedViewport = this.getExpandedViewportRange(view);

				syntaxTree(view.state).iterate({
					from: expandedViewport.from,
					to: expandedViewport.to,
					enter: nodeRef => {
						const node = nodeRef.node;

						const props: Set<string> = new Set<string>(node.type.name?.split('_'));

						if (props.has('formatting')) {
							return;
						}

						if (props.has('inline-code')) {
							const content = Cm6_Util.getContent(view.state, node.from, node.to);

							if (content.endsWith('}') && plugin.settings.inlineHighlighting) {
								const match = content.match(SHIKI_INLINE_REGEX); // format: `code{:lang}`
								if (match) {
									const hasSelectionOverlap = Cm6_Util.checkSelectionAndRangeOverlap(view.state.selection, node.from - 1, node.to + 1);

									decorationUpdates.push({
										type: DecorationUpdateType.Insert,
										from: node.from,
										to: node.to,
										lang: match[2],
										content: match[1],
										hideLang: this.isLivePreview(view.state) && !hasSelectionOverlap,
										codeStart: node.from,
										codeEnd: node.from + match[1].length,
										hideStart: node.from + match[1].length,
										hideEnd: node.to,
									});
								}
							} else {
								// we don't want to highlight normal inline code blocks, thus we remove any of our decorations
								removeRanges.push({ from: node.from, to: node.to });
							}
							return;
						}

						// if !docChanged, then this change was a selection change.
						// We only care about inline code blocks in this case, so we can skip the rest.
						if (!docChanged) {
							return;
						}

						if (props.has('HyperMD-codeblock') && !props.has('HyperMD-codeblock-begin') && !props.has('HyperMD-codeblock-end')) {
							state.push(node);
							return;
						}

						if (props.has('HyperMD-codeblock-begin')) {
							const content = Cm6_Util.getContent(view.state, node.from, node.to);

							lang = /```\s*(\S+)/.exec(content)?.[1] ?? '';
						}

						if (props.has('HyperMD-codeblock-end')) {
							if (state.length > 0 && lang !== '') {
								const start = state[0].from;
								const end = state[state.length - 1].to;

								decorationUpdates.push({
									type: DecorationUpdateType.Insert,
									from: start,
									to: end,
									lang,
									content: Cm6_Util.getContent(view.state, start, end),
								});
							}

							if (state.length > 0 && lang === '') {
								const start = state[0].from;
								const end = state[state.length - 1].to;

								decorationUpdates.push({
									type: DecorationUpdateType.Remove,
									from: start,
									to: end,
								});
							}

							lang = '';
							state = [];
						}
					},
				});

				// Start all shiki highlights in parallel
				const highlightPromises = decorationUpdates.map(async node => {
					if (node.type === DecorationUpdateType.Remove) {
						return { type: DecorationUpdateType.Remove as const, from: node.from, to: node.to };
					} else {
						const decorations = await this.buildDecorations(node.codeStart ?? node.from, node.codeEnd ?? node.to, node.lang, node.content);
						return { type: DecorationUpdateType.Insert as const, node, decorations };
					}
				});

				const highlightResults = await Promise.all(highlightPromises);

				// If the document changed while we were awaiting, the positions we captured
				// from the syntax tree are stale. Abort to avoid applying out-of-range decorations.
				if (this.view.state !== capturedState || this.view.composing) {
					return;
				}

				for (const result of highlightResults) {
					if (result.type === DecorationUpdateType.Remove) {
						removeRanges.push({ from: result.from, to: result.to });
					} else {
						const { node, decorations } = result;
						removeRanges.push({ from: node.from, to: node.to });
						if (node.hideLang && node.hideStart !== undefined && node.hideEnd !== undefined) {
							// add the decoration that hides the language tag
							decorations.unshift(Decoration.replace({}).range(node.hideStart, node.hideEnd));
						}
						// add the highlight decorations
						newDecorationsList.push(...decorations);
					}
				}

				// Apply all mutations to a local copy first
				let finalDecorations = this.decorations;
				for (const r of removeRanges) {
					finalDecorations = finalDecorations.update({
						filterFrom: r.from,
						filterTo: r.to,
						filter: () => false,
					});
				}

				// Check each new decoration bundle isn't already existing (mimics existsDecorationBetween logic for bulk)
				// We actually don't have existsDecorationBetween for arrays natively, but we can just add them.
				// Wait, `addDecoration` had a check. Let's just add all. It's harmless if we removed them just above.
				if (newDecorationsList.length > 0) {
					// Need to sort them by from, then by to, otherwise CM throws error
					newDecorationsList.sort((a, b) => a.from - b.from || a.to - b.to);
					finalDecorations = finalDecorations.update({
						add: newDecorationsList,
					});
				}

				// Update state synchronously
				this.decorations = finalDecorations;

				if ((removeRanges.length > 0 || newDecorationsList.length > 0) && this.view.state === capturedState) {
					// Use requestAnimationFrame to avoid "Calls to EditorView.update are not allowed while an update is in progress"
					requestAnimationFrame(() => {
						if (this.view.state === capturedState && !this.view.composing) {
							this.view.dispatch(this.view.state.update({}));
						}
					});
				}

				// console.log('Traversed syntax tree in', performance.now() - t1, 'ms');
			}

			/**
			 * Removes all decorations at a given node.
			 *
			 * @param from
			 * @param to
			 */
			removeDecoration(from: number, to: number): void {
				this.decorations = this.decorations.update({
					filterFrom: from,
					filterTo: to,
					filter: (_from3, _to3, _decoration) => {
						return false;
					},
				});
			}

			/**
			 * Adds a widget at a given node if it does not exist yet.
			 *
			 * @param from
			 * @param to
			 * @param newDecorations
			 */
			addDecoration(from: number, to: number, newDecorations: Range<Decoration>[]): void {
				// check if the decoration already exists and only add it if it does not exist
				if (Cm6_Util.existsDecorationBetween(this.decorations, from, to)) {
					return;
				}

				if (newDecorations.length === 0) {
					return;
				}

				this.decorations = this.decorations.update({
					add: newDecorations,
				});
			}

			/**
			 * Builds mark decorations for a given range, laguage and content.
			 *
			 * @param from
			 * @param to
			 * @param language
			 * @param content
			 */
			async buildDecorations(from: number, to: number, language: string, content: string): Promise<Range<Decoration>[]> {
				if (language === '') {
					return [];
				}

				const highlight = await plugin.highlighter.getHighlightTokens(content, language.toLowerCase());

				if (!highlight) {
					return [];
				}

				const tokens = highlight.tokens.flat(1);

				const decorations: Range<Decoration>[] = [];

				for (let i = 0; i < tokens.length; i++) {
					const token = tokens[i];
					const nextToken: ThemedToken | undefined = tokens[i + 1];

					const tokenStyle = plugin.highlighter.getTokenStyle(token);

					decorations.push(
						Decoration.mark({
							attributes: {
								style: tokenStyle.style,
								class: tokenStyle.classes.join(' '),
							},
						}).range(from + token.offset, nextToken ? from + nextToken.offset : to),
					);
				}

				return decorations;
			}

			/**
			 * Triggered by codemirror when the view plugin is destroyed.
			 */
			destroy(): void {
				this.decorations = Decoration.none;
				this.debouncedDocChangedUpdate.cancel();
				this.debouncedViewportUpdate.cancel();
				this.debouncedCompositionEndUpdate.cancel();
				plugin.activeCm6Plugins.delete(this.updateFn);
			}
		},
		{
			decorations: v => v.decorations,
			eventHandlers: {
				compositionend(_event, _view) {
					this.pendingDocChanged = true;
					this.debouncedDocChangedUpdate.cancel();
					this.debouncedViewportUpdate.cancel();
					this.debouncedCompositionEndUpdate.cancel();
					this.debouncedCompositionEndUpdate();
				},
			},
		},
	);
}
