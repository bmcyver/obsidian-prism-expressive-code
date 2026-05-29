import { ExpressiveCodeEngine } from '@expressive-code/core';
import type ShikiPlugin from 'packages/obsidian/src/main';
import { loadPrism } from 'obsidian';
import { ThemeMapper } from 'packages/obsidian/src/themes/ThemeMapper';
import { toDom } from 'hast-util-to-dom';
import { createEcEngineConfig } from 'packages/ec-core/src/Config';
import { LANGUAGE_BLACKLIST } from 'packages/obsidian/src/languages/LanguageRegistry';

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

import { flattenTokens, getStyleForPrismTypes, clearStyleCache, LANGUAGE_ALIASES, type FlatToken } from 'packages/ec-core/src/PrismUtils';
import { LRUCache } from 'packages/ec-core/src/LRUCache';

function convertToThemedTokens(code: string, flatTokens: FlatToken[], theme: any, lang?: string): ThemedToken[][] {
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

export class CodeHighlighter {
	plugin: ShikiPlugin;
	themeMapper: ThemeMapper;

	ec!: ExpressiveCodeEngine;
	ecStyleElement: HTMLElement | undefined;
	supportedLanguages!: string[];
	safeLanguagesSet!: Set<string>;
	prism!: any;
	customThemes: unknown[] = [];
	private tokenCache = new LRUCache<string, TokensResult>(1000);
	private safeLanguagesArray: string[] = [];

	constructor(plugin: ShikiPlugin) {
		this.plugin = plugin;
		this.themeMapper = new ThemeMapper(this.plugin);
	}

	async load(): Promise<void> {
		this.prism = await loadPrism();

		const loadedPrismLangs = Object.keys(this.prism.languages).filter(key => typeof this.prism.languages[key] === 'object');
		this.supportedLanguages = Array.from(new Set([...loadedPrismLangs, ...Object.keys(LANGUAGE_ALIASES), 'plaintext', 'txt', 'text', 'plain', 'ansi']));
		this.safeLanguagesSet = new Set(this.supportedLanguages.filter(lang => !LANGUAGE_BLACKLIST.has(lang)));
		this.safeLanguagesArray = Array.from(this.safeLanguagesSet);

		this.ec = new ExpressiveCodeEngine(
			createEcEngineConfig({
				theme: await this.themeMapper.getThemeForEC(),
				settings: this.plugin.loadedSettings,
				getPrism: () => this.prism,
			}),
		);

		if (this.ecStyleElement) {
			this.ecStyleElement.remove();
		}
		const themeStyles = await this.ec.getThemeStyles();
		this.ecStyleElement = document.head.createEl('style', { text: themeStyles });
	}

	async unload(): Promise<void> {
		if (this.ecStyleElement) {
			this.ecStyleElement.remove();
			this.ecStyleElement = undefined;
		}
		this.tokenCache.clear();
		clearStyleCache();
	}

	/**
	 * All languages that are safe to use with Obsidian's `registerMarkdownCodeBlockProcessor`.
	 */
	obsidianSafeLanguageNames(): string[] {
		return this.safeLanguagesArray;
	}

	/**
	 * Highlights code with EC and renders it to the passed container element.
	 */
	async renderWithEc(code: string, language: string, meta: string, container: HTMLElement): Promise<void> {
		if (!this.ec) {
			return;
		}
		const result = await this.ec.render({
			code,
			language,
			meta,
		});

		container.empty();
		container.append(toDom(this.themeMapper.fixAST(result.renderedGroupAst)));
	}

	async getHighlightTokens(code: string, lang: string): Promise<TokensResult | undefined> {
		if (!this.prism || !this.supportedLanguages) {
			return undefined;
		}
		let lowerLang = lang.toLowerCase();
		lowerLang = LANGUAGE_ALIASES[lowerLang] || lowerLang;
		if (!this.safeLanguagesSet.has(lowerLang)) {
			return undefined;
		}

		const cacheKey = `${lowerLang}:${code}`;
		const cached = this.tokenCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		const grammar = this.prism.languages[lowerLang];
		if (!grammar) {
			return undefined;
		}

		const prismTokens = this.prism.tokenize(code, grammar);
		const flatTokens = flattenTokens(prismTokens);
		const theme = await this.themeMapper.getThemeForEC();
		const themedTokens = convertToThemedTokens(code, flatTokens, theme, lowerLang);

		const result = {
			tokens: themedTokens,
		};

		this.tokenCache.set(cacheKey, result);

		return result;
	}

	renderTokens(tokens: ThemedToken[], parent: HTMLElement): void {
		for (const token of tokens) {
			this.tokenToSpan(token, parent);
		}
	}

	tokenToSpan(token: ThemedToken, parent: HTMLElement): void {
		const tokenStyle = this.getTokenStyle(token);
		parent.createSpan({
			text: token.content,
			cls: tokenStyle.classes.join(' '),
			attr: { style: tokenStyle.style },
		});
	}

	getTokenStyle(token: ThemedToken): { style: string; classes: string[] } {
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
