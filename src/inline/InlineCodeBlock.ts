import type PrismExpressiveCodePlugin from '../main';
import { type MarkdownPostProcessorContext } from 'obsidian';
import { BaseCodeBlock } from '../codeblock/BaseCodeBlock';

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
    if (!this.plugin.inlineHighlighter) {
      return;
    }
    this.containerEl.empty();
    this.containerEl.classList.add('pec-inline');

    const highlight = await this.plugin.inlineHighlighter.getHighlightTokens(
      this.source,
      this.language,
    );
    const tokens = highlight?.tokens;
    if (!tokens?.length) {
      return;
    }

    this.plugin.inlineHighlighter.renderTokens(
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
