import { Decoration } from '@codemirror/view';
import { type Range } from '@codemirror/state';
import type ShikiPlugin from 'src/main';
import { type ThemedToken } from 'src/prism/InlineHighlighter';

export class Cm6_DecorationBuilder {
	static async buildDecorations(plugin: ShikiPlugin, from: number, to: number, language: string, content: string): Promise<Range<Decoration>[]> {
		if (language === '') {
			return [];
		}

		const highlight = await plugin.highlighter.getHighlightTokens(content, language.toLowerCase());

		if (!highlight) {
			return [];
		}

		const tokens = highlight.tokens.flat(1);

		const decorations: Range<Decoration>[] = [];

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			const nextToken: ThemedToken | undefined = tokens[i + 1];

			const tokenStyle = plugin.highlighter.inlineHighlighter.getTokenStyle(token);

			decorations.push(
				Decoration.mark({
					attributes: {
						style: tokenStyle.style,
						class: tokenStyle.classes.join(' '),
					},
				}).range(from + token.offset, nextToken ? from + nextToken.offset : to),
			);
		}

		return decorations;
	}
}
