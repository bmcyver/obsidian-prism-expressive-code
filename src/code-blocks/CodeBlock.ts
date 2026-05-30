import { type MarkdownPostProcessorContext } from 'obsidian';
import type ShikiPlugin from 'src/main';
import { BaseCodeBlock } from 'src/code-blocks/BaseCodeBlock';
import { extractMetaString, stripCommonIndentation, calculateListIndentationLevel } from 'src/utils/markdownUtils';

export class CodeBlock extends BaseCodeBlock {
	cachedMetaString: string;

	constructor(plugin: ShikiPlugin, containerEl: HTMLElement, source: string, language: string, ctx: MarkdownPostProcessorContext) {
		super(plugin, containerEl, source, language, ctx);
		this.cachedMetaString = '';
	}

	private getMetaString(): string {
		return extractMetaString(this.ctx, this.containerEl, this.language);
	}

	private async render(metaString: string): Promise<void> {
		if (!this.plugin.highlighter?.ec) {
			return;
		}

		// Apply list indentation for Live Preview (Editing View) via CSS variable
		const level = calculateListIndentationLevel(this.source);

		this.containerEl.classList.add('shiki-code-block');
		if (level > 0) {
			this.containerEl.style.setProperty('--shiki-indent-level', level.toString());
		} else {
			this.containerEl.style.removeProperty('--shiki-indent-level');
		}

		const cleanedSource = stripCommonIndentation(this.source);
		await this.plugin.highlighter.renderWithEc(cleanedSource, this.language, metaString, this.containerEl);
	}

	public async rerenderOnNoteChange(): Promise<void> {
		// compare the new meta string to the cached one
		// only rerender if they are different, to avoid unnecessary work
		// since the meta string is likely to be the same most of the time
		// and if the code block content changes obsidian will rerender for us
		const newMetaString = this.getMetaString();
		if (newMetaString !== this.cachedMetaString) {
			this.cachedMetaString = newMetaString;
			await this.render(newMetaString);
		}
	}

	public async forceRerender(): Promise<void> {
		await this.render(this.cachedMetaString);
	}

	public onload(): void {
		super.onload();
		this.cachedMetaString = this.getMetaString();
		void this.render(this.cachedMetaString);
	}

	public onunload(): void {
		super.onunload();
		this.containerEl.innerText = 'unloaded shiki code block';
	}
}
