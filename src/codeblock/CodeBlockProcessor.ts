import type PrismExpressiveCodePlugin from '../main';
import { CodeBlock } from './CodeBlock';

export class CodeBlockProcessor {
  plugin: PrismExpressiveCodePlugin;

  constructor(plugin: PrismExpressiveCodePlugin) {
    this.plugin = plugin;
  }

  public register(): void {
    const languages = this.plugin.highlighter.obsidianSafeLanguageNames();

    for (const language of languages) {
      try {
        this.plugin.registerMarkdownCodeBlockProcessor(
          language,
          async (source, el, ctx) => {
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
}
