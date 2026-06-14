import type PrismExpressiveCodePlugin from '../main';
import {
  type MarkdownPostProcessorContext,
  MarkdownRenderChild,
} from 'obsidian';
import {
  extractMetaString,
  stripCommonIndentation,
  calculateListIndentationLevel,
} from '../utils';

export abstract class BaseCodeBlock extends MarkdownRenderChild {
  plugin: PrismExpressiveCodePlugin;
  source: string;
  language: string;
  ctx: MarkdownPostProcessorContext;
  currentFilePath: string;

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
    this.plugin.codeBlockManager.add(this);
  }

  public onunload(): void {
    super.onunload();
    this.plugin.codeBlockManager.remove(this);
    this.containerEl.empty();
  }
}

export class CodeBlock extends BaseCodeBlock {
  cachedMetaString: string;

  constructor(
    plugin: PrismExpressiveCodePlugin,
    containerEl: HTMLElement,
    source: string,
    language: string,
    ctx: MarkdownPostProcessorContext,
  ) {
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

    this.containerEl.classList.add('pec-code-block');
    if (level > 0) {
      this.containerEl.style.setProperty(
        '--pec-indent-level',
        level.toString(),
      );
    } else {
      this.containerEl.style.removeProperty('--pec-indent-level');
    }

    const cleanedSource = stripCommonIndentation(this.source);
    await this.plugin.highlighter.renderWithEc(
      cleanedSource,
      this.language,
      metaString,
      this.containerEl,
    );
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
}

export class InlineCodeBlock extends BaseCodeBlock {
  constructor(
    plugin: PrismExpressiveCodePlugin,
    containerEl: HTMLElement,
    source: string,
    language: string,
    ctx: MarkdownPostProcessorContext,
  ) {
    super(plugin, containerEl, source, language, ctx);
  }

  private async render(): Promise<void> {
    if (!this.plugin.highlighter) {
      return;
    }
    this.containerEl.empty();
    this.containerEl.classList.add('pec-inline');

    const highlight = await this.plugin.highlighter.getHighlightTokens(
      this.source,
      this.language,
    );
    const tokens = highlight?.tokens;
    if (!tokens?.length) {
      return;
    }

    this.plugin.highlighter.inlineHighlighter.renderTokens(
      tokens,
      this.containerEl,
    );
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
}
