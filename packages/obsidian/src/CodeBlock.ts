import { type MarkdownPostProcessorContext } from 'obsidian';
import type ShikiPlugin from 'packages/obsidian/src/main';
import { BaseCodeBlock } from 'packages/obsidian/src/BaseCodeBlock';

export class CodeBlock extends BaseCodeBlock {
	cachedMetaString: string;

	constructor(plugin: ShikiPlugin, containerEl: HTMLElement, source: string, language: string, ctx: MarkdownPostProcessorContext) {
		super(plugin, containerEl, source, language, ctx);
		this.cachedMetaString = '';
	}

	private getMetaString(): string {
		const sectionInfo = this.ctx.getSectionInfo(this.containerEl);

		if (sectionInfo === null) {
			return '';
		}

		const lines = sectionInfo.text.split('\n');
		const startLine = lines[sectionInfo.lineStart];

		// regexp to match the text after the code block language
		const regex = new RegExp('^[^`~]*?\\s*(```+|~~~+)' + this.language + ' (.*)', 'g');
		const match = regex.exec(startLine);
		if (match !== null) {
			return match[2];
		} else {
			return '';
		}
	}

	private stripCommonIndentation(source: string): string {
		const lines = source.split('\n');

		// Find the minimum common indentation of non-empty lines
		let minIndent: string | null = null;
		for (const line of lines) {
			if (line.trim() === '') {
				continue;
			}
			const match = /^[ \t]*/.exec(line);
			if (match) {
				const indent = match[0];
				if (minIndent === null || indent.length < minIndent.length) {
					minIndent = indent;
				}
			}
		}

		if (!minIndent || minIndent.length === 0) {
			return source;
		}

		// Strip the common indentation from all lines
		const prefix = minIndent;
		return lines
			.map(line => {
				if (line.startsWith(prefix)) {
					return line.slice(prefix.length);
				}
				return line;
			})
			.join('\n');
	}

	private async render(metaString: string): Promise<void> {
		if (!this.plugin.highlighter?.ec) {
			return;
		}

		// Apply list indentation for Live Preview (Editing View) via CSS variable
		const firstLine = this.source.split('\n')[0] ?? '';
		const match = /^[ \t]*/.exec(firstLine);
		const indent = match ? match[0] : '';
		let spaces = 0;
		let tabs = 0;
		for (const char of indent) {
			if (char === ' ') spaces++;
			else if (char === '\t') tabs++;
		}
		const level = tabs + Math.floor(spaces / 4);

		this.containerEl.classList.add('shiki-code-block');
		if (level > 0) {
			this.containerEl.style.setProperty('--shiki-indent-level', level.toString());
		} else {
			this.containerEl.style.removeProperty('--shiki-indent-level');
		}

		const cleanedSource = this.stripCommonIndentation(this.source);
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
