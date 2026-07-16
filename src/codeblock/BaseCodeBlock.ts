import type PrismExpressiveCodePlugin from '../main';
import {
  type MarkdownPostProcessorContext,
  MarkdownRenderChild,
} from 'obsidian';

export abstract class BaseCodeBlock extends MarkdownRenderChild {
  plugin: PrismExpressiveCodePlugin;
  source: string;
  language: string;
  ctx: MarkdownPostProcessorContext;
  currentFilePath: string;
  isLoaded = false;

  constructor(
    plugin: PrismExpressiveCodePlugin,
    containerEl: HTMLElement,
    source: string,
    language: string,
    ctx: MarkdownPostProcessorContext,
  ) {
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
    this.isLoaded = true;
    this.plugin.codeBlockManager.add(this);
  }

  public onunload(): void {
    super.onunload();
    this.isLoaded = false;
    this.plugin.codeBlockManager.remove(this);
    this.containerEl.empty();
  }
}
