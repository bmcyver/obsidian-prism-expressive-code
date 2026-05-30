import type ShikiPlugin from 'src/main';
import { CodeBlock } from 'src/code-blocks/CodeBlock';
import { InlineCodeBlock } from 'src/code-blocks/InlineCodeBlock';
import { SHIKI_INLINE_REGEX } from 'src/utils/constants';

export class MarkdownProcessorRegistry {
	plugin: ShikiPlugin;

	constructor(plugin: ShikiPlugin) {
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

						const codeBlock = new CodeBlock(this.plugin, el, source, language, ctx);

						ctx.addChild(codeBlock);
					},
					1000,
				);
			} catch (e) {
				console.warn(`Failed to register code block processor for ${language}.`, e);
			}
		}
	}

	private registerInlineCodeProcessor(): void {
		this.plugin.registerMarkdownPostProcessor(async (el, ctx) => {
			const inlineCodes = el.findAll(':not(pre) > code');
			for (const codeElm of inlineCodes) {
				const match = SHIKI_INLINE_REGEX.exec(codeElm.textContent ?? ''); // format: `code{:lang}`
				if (!match) {
					continue;
				}

				const codeBlock = new InlineCodeBlock(this.plugin, codeElm, match[1], match[2], ctx);

				ctx.addChild(codeBlock);
			}
		});
	}
}
