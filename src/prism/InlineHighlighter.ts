import { flattenTokens, getStyleForPrismTypes, LANGUAGE_ALIASES, type FlatToken } from 'src/prism/PrismUtils';
import { LRUCache } from 'src/cache/LRUCache';
import { type ThemeMapper } from 'src/themes/ThemeMapper';

export interface ThemedToken {
	content: string;
	color?: string;
	bgColor?: string;
	fontStyle?: number;
	offset: number;
}

export interface TokensResult {
	tokens: ThemedToken[][];
}

export class InlineHighlighter {
	private themeMapper: ThemeMapper;
	private tokenCache = new LRUCache<string, TokensResult>(1000);

	constructor(themeMapper: ThemeMapper) {
		this.themeMapper = themeMapper;
	}

	public clearCache(): void {
		this.tokenCache.clear();
	}

	public async getHighlightTokens(code: string, lang: string, prism: any, safeLanguagesSet: Set<string>, supportedLanguages: string[]): Promise<TokensResult | undefined> {
		if (!prism || !supportedLanguages) {
			return undefined;
		}
		let lowerLang = lang.toLowerCase();
		lowerLang = LANGUAGE_ALIASES[lowerLang] || lowerLang;
		if (!safeLanguagesSet.has(lowerLang)) {
			return undefined;
		}

		const cacheKey = `${lowerLang}:${code}`;
		const cached = this.tokenCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		const grammar = prism.languages[lowerLang];
		if (!grammar) {
			return undefined;
		}

		const prismTokens = prism.tokenize(code, grammar);
		const flatTokens = flattenTokens(prismTokens);
		const theme = await this.themeMapper.getThemeForEC();
		const themedTokens = this.convertToThemedTokens(flatTokens, theme, lowerLang);

		const result = {
			tokens: themedTokens,
		};

		this.tokenCache.set(cacheKey, result);

		return result;
	}

	private convertToThemedTokens(flatTokens: FlatToken[], theme: any, lang?: string): ThemedToken[][] {
		const lines: ThemedToken[][] = [[]];
		let currentOffset = 0;

		for (let t = 0; t < flatTokens.length; t++) {
			const token = flatTokens[t];
			const content = token.content;
			const style = getStyleForPrismTypes(theme, token.types, token.typeKey, lang);

			if (content.indexOf('\n') === -1) {
				if (content.length > 0) {
					lines[lines.length - 1].push({
						content,
						color: style.color || theme.fg || 'var(--shiki-code-normal)',
						fontStyle: style.fontStyle,
						offset: currentOffset,
					} as any);
				}
				currentOffset += content.length;
			} else {
				const parts = content.split('\n');
				for (let i = 0; i < parts.length; i++) {
					const part = parts[i];
					if (i > 0) {
						lines.push([]);
					}
					if (part.length > 0) {
						lines[lines.length - 1].push({
							content: part,
							color: style.color || theme.fg || 'var(--shiki-code-normal)',
							fontStyle: style.fontStyle,
							offset: currentOffset,
						} as any);
					}
					currentOffset += part.length;
					if (i < parts.length - 1) {
						currentOffset += 1;
					}
				}
			}
		}

		return lines;
	}

	public renderTokens(tokens: ThemedToken[], parent: HTMLElement): void {
		for (const token of tokens) {
			this.tokenToSpan(token, parent);
		}
	}

	public tokenToSpan(token: ThemedToken, parent: HTMLElement): void {
		const tokenStyle = this.getTokenStyle(token);
		parent.createSpan({
			text: token.content,
			cls: tokenStyle.classes.join(' '),
			attr: { style: tokenStyle.style },
		});
	}

	public getTokenStyle(token: ThemedToken): { style: string; classes: string[] } {
		const fontStyle = token.fontStyle ?? 0;

		return {
			style: `color: ${token.color}`,
			classes: [
				(fontStyle & 1) !== 0 ? 'shiki-italic' : undefined,
				(fontStyle & 2) !== 0 ? 'shiki-bold' : undefined,
				(fontStyle & 4) !== 0 ? 'shiki-ul' : undefined,
			].filter(Boolean) as string[],
		};
	}
}
