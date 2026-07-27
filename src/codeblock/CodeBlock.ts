import type PrismExpressiveCodePlugin from '../main';
import {
  type MarkdownPostProcessorContext,
  MarkdownRenderChild,
} from 'obsidian';
import { toDom } from 'hast-util-to-dom';
import {
  extractMetaString,
  stripCommonIndentation,
  calculateListIndentationLevel,
  estimateCodeBlockHeight,
} from './CodeBlockUtils';

export class CodeBlock extends MarkdownRenderChild {
  plugin: PrismExpressiveCodePlugin;
  source: string;
  language: string;
  ctx: MarkdownPostProcessorContext;
  currentFilePath: string;
  isLoaded = false;

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
    super(containerEl);

    this.plugin = plugin;
    this.source = source;
    this.language = language;
    this.ctx = ctx;
    this.currentFilePath = ctx.sourcePath;

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

    // Maintain min-height and set estimated height CSS variable to prevent CLS / scroll jitter
    const estimatedHeight = estimateCodeBlockHeight(cleanedSource, metaString);
    this.containerEl.style.minHeight = `${estimatedHeight}px`;
    this.containerEl.style.setProperty(
      '--pec-estimated-height',
      `${estimatedHeight}px`,
    );

    const win = this.containerEl.ownerDocument?.defaultView || window;
    const isPrintMode = win.matchMedia('print').matches;

    const props: Record<string, unknown> = {};
    if (isPrintMode) {
      props.wrap = true;
    }

    const result = await this.plugin.highlighter.ec.render({
      code: cleanedSource,
      language: this.language,
      meta: metaString,
      props,
    });

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
    this.isLoaded = true;
    this.plugin.codeBlockManager.add(this);

    // Estimate height to prevent Cumulative Layout Shift (CLS)
    const estimatedHeight = estimateCodeBlockHeight(
      this.source,
      this.cachedMetaString,
    );
    this.containerEl.style.minHeight = `${estimatedHeight}px`;
    this.containerEl.style.setProperty(
      '--pec-estimated-height',
      `${estimatedHeight}px`,
    );

    // Render immediately on load, just like the original-plugin
    void this.startRender();
  }

  public onunload(): void {
    super.onunload();
    this.isLoaded = false;
    this.plugin.codeBlockManager.remove(this);
    this.containerEl.empty();
    this.rendered = false;
  }
}
