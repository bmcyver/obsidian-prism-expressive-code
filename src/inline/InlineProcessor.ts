import type PrismExpressiveCodePlugin from '../main';
import { InlineCodeBlock } from './InlineCodeBlock';
import { INLINE_CODE_REGEX } from './InlineParser';

export class InlineProcessor {
  plugin: PrismExpressiveCodePlugin;

  constructor(plugin: PrismExpressiveCodePlugin) {
    this.plugin = plugin;
  }

  public register(): void {
    this.plugin.registerMarkdownPostProcessor(async (el, ctx) => {
      const inlineCodes = el.findAll(':not(pre) > code');
      for (const codeElm of inlineCodes) {
        const match = INLINE_CODE_REGEX.exec(codeElm.textContent ?? '');
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
