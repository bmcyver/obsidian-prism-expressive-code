import { type MarkdownPostProcessorContext } from 'obsidian';
import type ShikiPlugin from 'packages/obsidian/src/main';
import { BaseCodeBlock } from 'packages/obsidian/src/BaseCodeBlock';

export class InlineCodeBlock extends BaseCodeBlock {
	constructor(plugin: ShikiPlugin, containerEl: HTMLElement, source: string, language: string, ctx: MarkdownPostProcessorContext) {
		super(plugin, containerEl, source, language, ctx);
	}

	private async render(): Promise<void> {
		if (!this.plugin.highlighter?.prism) {
			return;
		}
		this.containerEl.empty();
		this.containerEl.classList.add('shiki-inline');

		const highlight = await this.plugin.highlighter.getHighlightTokens(this.source, this.language);
		const tokens = highlight?.tokens.flat(1);
		if (!tokens?.length) {
			return;
		}

		this.plugin.highlighter.renderTokens(tokens, this.containerEl);
	}

	public async rerenderOnNoteChange(): Promise<void> {
		// noop for inline code blocks
	}

	public async forceRerender(): Promise<void> {
		await this.render();
	}

	public onload(): void {
		super.onload();
		void this.render();
	}

	public onunload(): void {
		super.onunload();
		this.containerEl.innerText = 'unloaded shiki inline code block';
	}
}
