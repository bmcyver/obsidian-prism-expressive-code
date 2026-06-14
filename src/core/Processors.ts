import type PrismExpressiveCodePlugin from '../main';
import { TFile } from 'obsidian';
import { type BaseCodeBlock, CodeBlock, InlineCodeBlock } from './CodeBlocks';
import { INLINE_CODE_REGEX } from '../utils';

export class CodeBlockManager {
  plugin: PrismExpressiveCodePlugin;
  activeCodeBlocks: Map<string, Set<BaseCodeBlock>>;

  constructor(plugin: PrismExpressiveCodePlugin) {
    this.plugin = plugin;
    this.activeCodeBlocks = new Map();
  }

  public registerEvents(): void {
    this.plugin.registerEvent(
      this.plugin.app.metadataCache.on('changed', (file) => {
        if (file instanceof TFile) {
          if (this.activeCodeBlocks.has(file.path)) {
            for (const codeBlock of this.activeCodeBlocks.get(file.path)!) {
              void codeBlock.rerenderOnNoteChange();
            }
          }
        }
      }),
    );

    this.plugin.registerEvent(
      this.plugin.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile) {
          if (this.activeCodeBlocks.has(oldPath)) {
            const blocks = this.activeCodeBlocks.get(oldPath)!;
            this.activeCodeBlocks.delete(oldPath);
            this.activeCodeBlocks.set(file.path, blocks);
            for (const block of blocks) {
              block.currentFilePath = file.path;
            }
          }
        }
      }),
    );
  }

  public add(codeBlock: BaseCodeBlock): void {
    const filePath = codeBlock.currentFilePath;

    if (!this.activeCodeBlocks.has(filePath)) {
      this.activeCodeBlocks.set(filePath, new Set([codeBlock]));
    } else {
      this.activeCodeBlocks.get(filePath)!.add(codeBlock);
    }
  }

  public remove(codeBlock: BaseCodeBlock): void {
    const filePath = codeBlock.currentFilePath;

    if (this.activeCodeBlocks.has(filePath)) {
      const set = this.activeCodeBlocks.get(filePath)!;
      set.delete(codeBlock);
      if (set.size === 0) {
        this.activeCodeBlocks.delete(filePath);
      }
    }
  }

  public async forceRerenderAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const codeBlocks of this.activeCodeBlocks.values()) {
      for (const codeBlock of codeBlocks) {
        promises.push(codeBlock.forceRerender());
      }
    }
    await Promise.all(promises);
  }
}

export class MarkdownProcessorRegistry {
  plugin: PrismExpressiveCodePlugin;

  constructor(plugin: PrismExpressiveCodePlugin) {
    this.plugin = plugin;
  }

  public registerProcessors(): void {
    this.registerCodeBlockProcessors();
    this.registerInlineCodeProcessor();
  }

  private registerCodeBlockProcessors(): void {
    const languages = this.plugin.highlighter.obsidianSafeLanguageNames();

    for (const language of languages) {
      try {
        this.plugin.registerMarkdownCodeBlockProcessor(
          language,
          async (source, el, ctx) => {
            // we need to avoid making the hidden frontmatter code block visible
            if (el.parentElement?.classList.contains('mod-frontmatter')) {
              return;
            }

            const codeBlock = new CodeBlock(
              this.plugin,
              el,
              source,
              language,
              ctx,
            );

            ctx.addChild(codeBlock);
          },
          1000,
        );
      } catch (e) {
        console.warn(
          `Failed to register code block processor for ${language}.`,
          e,
        );
      }
    }
  }

  private registerInlineCodeProcessor(): void {
    this.plugin.registerMarkdownPostProcessor(async (el, ctx) => {
      const inlineCodes = el.findAll(':not(pre) > code');
      for (const codeElm of inlineCodes) {
        const match = INLINE_CODE_REGEX.exec(codeElm.textContent ?? ''); // format: `code{:lang}`
        if (!match || !match[1] || !match[2]) {
          continue;
        }

        const codeBlock = new InlineCodeBlock(
          this.plugin,
          codeElm,
          match[1],
          match[2],
          ctx,
        );

        ctx.addChild(codeBlock);
      }
    });
  }
}
