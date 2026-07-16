import type PrismExpressiveCodePlugin from '../main';
import { type MarkdownPostProcessorContext } from 'obsidian';
import { toDom } from 'hast-util-to-dom';
import { BaseCodeBlock } from './BaseCodeBlock';
import {
  extractMetaString,
  stripCommonIndentation,
  calculateListIndentationLevel,
} from './CodeBlockUtils';

export class CodeBlock extends BaseCodeBlock {
  cachedMetaString: string;
  rendered = false;

  constructor(
    plugin: PrismExpressiveCodePlugin,
    containerEl: HTMLElement,
    source: string,
    language: string,
    ctx: MarkdownPostProcessorContext,
  ) {
    super(plugin, containerEl, source, language, ctx);
    this.cachedMetaString = this.getMetaString();
  }

  private getMetaString(): string {
    return extractMetaString(this.ctx, this.containerEl, this.language);
  }

  public async startRender(): Promise<void> {
    if (this.rendered) return;
    await this.render(this.cachedMetaString);
  }

  private async render(metaString: string): Promise<void> {
    if (!this.plugin.highlighter?.ec) {
      return;
    }

    const level = calculateListIndentationLevel(this.source);
    const cleanedSource = stripCommonIndentation(this.source);

    const result = await this.plugin.highlighter.ec.render({
      code: cleanedSource,
      language: this.language,
      meta: metaString,
    });

    const win = this.containerEl.ownerDocument?.defaultView || window;
    win.requestAnimationFrame(() => {
      if (!this.isLoaded) return;

      this.containerEl.classList.add('pec-code-block');
      if (level > 0) {
        this.containerEl.style.setProperty(
          '--pec-indent-level',
          level.toString(),
        );
      } else {
        this.containerEl.style.removeProperty('--pec-indent-level');
      }

      this.containerEl.empty();
      this.containerEl.append(toDom(result.renderedGroupAst));
      this.containerEl.style.removeProperty('min-height');
      this.rendered = true;
    });
  }

  public async rerenderOnNoteChange(): Promise<void> {
    const newMetaString = this.getMetaString();
    if (newMetaString !== this.cachedMetaString) {
      this.cachedMetaString = newMetaString;
      if (this.rendered) {
        await this.render(newMetaString);
      }
    }
  }

  public async forceRerender(): Promise<void> {
    if (this.rendered) {
      await this.render(this.cachedMetaString);
    } else {
      await this.startRender();
    }
  }

  public onload(): void {
    super.onload();
    
    // Estimate height to prevent Cumulative Layout Shift (CLS)
    const lineCount = this.source.split('\n').length;
    const estimatedHeight = lineCount * 22.5 + 50;
    this.containerEl.style.minHeight = `${estimatedHeight}px`;

    // Render immediately on load, just like the original-plugin
    void this.startRender();
  }

  public onunload(): void {
    super.onunload();
    this.rendered = false;
  }
}
