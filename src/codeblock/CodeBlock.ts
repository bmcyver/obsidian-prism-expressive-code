import type PrismExpressiveCodePlugin from '../main';
import { type MarkdownPostProcessorContext } from 'obsidian';
import { toDom } from 'hast-util-to-dom';
import { BaseCodeBlock } from './BaseCodeBlock';
import {
  extractMetaString,
  stripCommonIndentation,
  calculateListIndentationLevel,
  estimateCodeBlockHeight,
} from './CodeBlockUtils';

export class CodeBlock extends BaseCodeBlock {
  cachedMetaString: string;
  rendered = false;
  private renderedSource = '';
  private renderedMeta = '';

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

    const cleanedSource = stripCommonIndentation(this.source);

    // Early return if already rendered with the exact same content & meta
    if (
      this.rendered &&
      this.renderedSource === cleanedSource &&
      this.renderedMeta === metaString
    ) {
      return;
    }

    const level = calculateListIndentationLevel(this.source);

    // Maintain min-height to prevent container collapse / CLS during async rendering
    const estimatedHeight = estimateCodeBlockHeight(cleanedSource, metaString);
    this.containerEl.style.minHeight = `${estimatedHeight}px`;

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
        this.containerEl.setAttribute('data-indent-level', level.toString());
      } else {
        this.containerEl.style.removeProperty('--pec-indent-level');
        this.containerEl.removeAttribute('data-indent-level');
      }

      const domNode = toDom(result.renderedGroupAst);
      const fragment = createFragment();
      fragment.appendChild(domNode);

      this.containerEl.empty();
      this.containerEl.appendChild(fragment);
      this.containerEl.style.removeProperty('min-height');

      this.renderedSource = cleanedSource;
      this.renderedMeta = metaString;
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
    const estimatedHeight = estimateCodeBlockHeight(
      this.source,
      this.cachedMetaString,
    );
    this.containerEl.style.minHeight = `${estimatedHeight}px`;

    // Render immediately on load, just like the original-plugin
    void this.startRender();
  }

  public onunload(): void {
    super.onunload();
    this.rendered = false;
  }
}
