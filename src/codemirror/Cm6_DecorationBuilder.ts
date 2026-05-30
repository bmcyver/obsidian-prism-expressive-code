import { Decoration } from '@codemirror/view';
import { type Range } from '@codemirror/state';
import type ShikiPlugin from 'src/main';
import { type ThemedToken } from 'src/prism/InlineHighlighter';
import { LRUCache } from 'src/cache/LRUCache';

const decorationCache = new LRUCache<string, Decoration>(200);

export class Cm6_DecorationBuilder {
	static async buildDecorations(plugin: ShikiPlugin, from: number, to: number, language: string, content: string): Promise<Range<Decoration>[]> {
		if (language === '') {
			return [];
		}

		const highlight = await plugin.highlighter.getHighlightTokens(content, language.toLowerCase());

		if (!highlight) {
			return [];
		}

		const tokens = highlight.tokens;

		const decorations: Range<Decoration>[] = [];

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			const nextToken: ThemedToken | undefined = tokens[i + 1];

			const tokenStyle = plugin.highlighter.inlineHighlighter.getTokenStyle(token);
			const classStr = tokenStyle.classes.join(' ');
			const cacheKey = `${tokenStyle.style}|${classStr}`;

			let dec = decorationCache.get(cacheKey);
			if (!dec) {
				const attrs: Record<string, string> = { style: tokenStyle.style };
				if (classStr) {
					attrs.class = classStr;
				}
				dec = Decoration.mark({ attributes: attrs });
				decorationCache.set(cacheKey, dec);
			}

			decorations.push(dec.range(from + token.offset, nextToken ? from + nextToken.offset : to));
		}

		return decorations;
	}
}
