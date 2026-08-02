import type PrismExpressiveCodePlugin from '../main';
import { CodeBlock } from './CodeBlock';

/**
 * Expressive Code 지원 언어들에 대해 Obsidian 마크다운 코드블록 프로세서를 등록합니다.
 */
export function registerCodeBlockProcessors(
  plugin: PrismExpressiveCodePlugin,
): void {
  const languages = plugin.highlighter.obsidianSafeLanguageNames();

  for (const language of languages) {
    try {
      plugin.registerMarkdownCodeBlockProcessor(
        language,
        async (source, el, ctx) => {
          if (el.parentElement?.classList.contains('mod-frontmatter')) {
            return;
          }

          const codeBlock = new CodeBlock(plugin, el, source, language, ctx);
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
