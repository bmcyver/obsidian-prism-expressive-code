import type ShikiPlugin from 'src/main';
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { type Range } from '@codemirror/state';
import { debounce } from 'obsidian';
import { Cm6_SyntaxTreeParser, DecorationUpdateType } from 'src/codemirror/Cm6_SyntaxTreeParser';
import { Cm6_DecorationBuilder } from 'src/codemirror/Cm6_DecorationBuilder';

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

			update(update: ViewUpdate): void {
				try {
					this.decorations = this.decorations.map(update.changes);
				} catch (e) {
					this.decorations = Decoration.none;
					console.warn('Resetting decorations due to error:', e);
				}

				if (update.docChanged || update.selectionSet || update.viewportChanged) {
					this.view = update.view;
					this.pendingDocChanged = this.pendingDocChanged || update.docChanged;

					this.debouncedDocChangedUpdate.cancel();
					this.debouncedViewportUpdate.cancel();
					this.debouncedCompositionEndUpdate.cancel();

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

			async updateWidgets(view: EditorView, docChanged: boolean = true): Promise<void> {
				if (view.composing) {
					return;
				}

				const capturedState = view.state;
				const newDecorationsList: Range<Decoration>[] = [];
				const removeRanges: { from: number; to: number }[] = [];

				const decorationUpdates = Cm6_SyntaxTreeParser.getDecorationUpdates(view, plugin, docChanged);

				const highlightPromises = decorationUpdates.map(async node => {
					if (node.type === DecorationUpdateType.Remove) {
						return { type: DecorationUpdateType.Remove as const, from: node.from, to: node.to };
					} else {
						const decorations = await Cm6_DecorationBuilder.buildDecorations(plugin, node.codeStart ?? node.from, node.codeEnd ?? node.to, node.lang, node.content);
						return { type: DecorationUpdateType.Insert as const, node, decorations };
					}
				});

				const highlightResults = await Promise.all(highlightPromises);

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
							decorations.unshift(Decoration.replace({}).range(node.hideStart, node.hideEnd));
						}
						newDecorationsList.push(...decorations);
					}
				}

				let finalDecorations = this.decorations;
				for (const r of removeRanges) {
					finalDecorations = finalDecorations.update({
						filterFrom: r.from,
						filterTo: r.to,
						filter: () => false,
					});
				}

				if (newDecorationsList.length > 0) {
					newDecorationsList.sort((a, b) => a.from - b.from || a.to - b.to);
					finalDecorations = finalDecorations.update({
						add: newDecorationsList,
					});
				}

				this.decorations = finalDecorations;

				if ((removeRanges.length > 0 || newDecorationsList.length > 0) && this.view.state === capturedState) {
					requestAnimationFrame(() => {
						if (this.view.state === capturedState && !this.view.composing) {
							this.view.dispatch(this.view.state.update({}));
						}
					});
				}
			}

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
