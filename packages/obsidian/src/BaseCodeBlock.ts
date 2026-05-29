import { type MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
import type ShikiPlugin from 'packages/obsidian/src/main';

export abstract class BaseCodeBlock extends MarkdownRenderChild {
	plugin: ShikiPlugin;
	source: string;
	language: string;
	ctx: MarkdownPostProcessorContext;
	currentFilePath: string;

	constructor(plugin: ShikiPlugin, containerEl: HTMLElement, source: string, language: string, ctx: MarkdownPostProcessorContext) {
		super(containerEl);

		this.plugin = plugin;
		this.source = source;
		this.language = language;
		this.ctx = ctx;
		this.currentFilePath = ctx.sourcePath;
	}

	public abstract rerenderOnNoteChange(): Promise<void>;
	public abstract forceRerender(): Promise<void>;

	public onload(): void {
		super.onload();
		this.plugin.addActiveCodeBlock(this);
	}

	public onunload(): void {
		super.onunload();
		this.plugin.removeActiveCodeBlock(this);
		this.containerEl.empty();
	}
}
