import { ExpressiveCodeEngine } from '@expressive-code/core';
import type ShikiPlugin from 'packages/obsidian/src/main';
import { createHighlighterCore, type HighlighterCore, type LanguageRegistration, type TokensResult, type ThemedToken } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import { ThemeMapper } from 'packages/obsidian/src/themes/ThemeMapper';
import { toDom } from 'hast-util-to-dom';
import { createEcEngineConfig } from 'packages/ec-core/src/Config';
import { ALIAS_TO_LANG, ESSENTIAL_LANGUAGES, ALL_ALIASES } from 'packages/ec-core/src/LanguageRegistry';

// some languages break obsidian's `registerMarkdownCodeBlockProcessor`, so we blacklist them
const LANGUAGE_BLACKLIST = new Set(['c++', 'c#', 'f#', 'mermaid']);

// some languages are considered "special" by shiki.isSpecialLang
const LANGUAGE_SPECIAL = new Set(['plaintext', 'txt', 'text', 'plain', 'ansi']);

export const ESSENTIAL_THEMES = {
	'one-dark-pro': () => import('shiki/themes/one-dark-pro.mjs'),
	'one-light': () => import('shiki/themes/one-light.mjs'),
};

export let sharedHighlighter: HighlighterCore | undefined;

export async function getSharedHighlighter(): Promise<HighlighterCore> {
	if (!sharedHighlighter) {
		throw new Error('Highlighter has not been initialized yet.');
	}
	return sharedHighlighter;
}

export class CodeHighlighter {
	plugin: ShikiPlugin;
	themeMapper: ThemeMapper;

	ec!: ExpressiveCodeEngine;
	ecStyleElement: HTMLElement | undefined;
	supportedLanguages!: string[];
	shiki!: HighlighterCore;
	customThemes: unknown[] = [];
	customLanguages: LanguageRegistration[] = [];
	private tokenCache = new Map<string, TokensResult>();

	constructor(plugin: ShikiPlugin) {
		this.plugin = plugin;
		this.themeMapper = new ThemeMapper(this.plugin);
	}

	async load(): Promise<void> {
		await this.loadEC();
		await this.loadShiki();

		this.supportedLanguages = [...Object.keys(ESSENTIAL_LANGUAGES), ...ALL_ALIASES, ...LANGUAGE_SPECIAL];
	}

	async unload(): Promise<void> {
		this.unloadEC();
		this.unloadShiki();
	}

	async loadEC(): Promise<void> {
		this.ec = new ExpressiveCodeEngine(
			createEcEngineConfig({
				theme: await this.themeMapper.getThemeForEC(),
				settings: this.plugin.loadedSettings,
				usingObsidianTheme: this.themeMapper.usingObsidianTheme(),
				getHighlighter: getSharedHighlighter,
			}),
		);

		if (this.ecStyleElement) {
			this.ecStyleElement.remove();
			this.ecStyleElement = undefined;
		}

		const themeStyles = await this.ec.getThemeStyles();
		this.ecStyleElement = document.head.createEl('style', { text: themeStyles });
	}

	unloadEC(): void {
		if (this.ecStyleElement) {
			this.ecStyleElement.remove();
			this.ecStyleElement = undefined;
		}
	}

	async loadShiki(): Promise<void> {
		this.shiki = await createHighlighterCore({
			themes: Object.values(ESSENTIAL_THEMES),
			langs: Object.values(ESSENTIAL_LANGUAGES),
			engine: createOnigurumaEngine(import('shiki/wasm')),
		});
		sharedHighlighter = this.shiki;
	}

	unloadShiki(): void {
		if (this.shiki) {
			this.shiki.dispose();
		}
		sharedHighlighter = undefined;
		this.tokenCache.clear();
	}

	/**
	 * All languages that are safe to use with Obsidian's `registerMarkdownCodeBlockProcessor`.
	 */
	obsidianSafeLanguageNames(): string[] {
		return this.supportedLanguages.filter(lang => !LANGUAGE_BLACKLIST.has(lang));
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
		if (!this.shiki || !this.supportedLanguages) {
			return undefined;
		}
		const lowerLang = lang.toLowerCase();
		if (!this.obsidianSafeLanguageNames().includes(lowerLang)) {
			return undefined;
		}

		const cacheKey = `${lowerLang}:${code}`;
		if (this.tokenCache.has(cacheKey)) {
			return this.tokenCache.get(cacheKey);
		}

		const resolved = ALIAS_TO_LANG[lowerLang] ?? lowerLang;

		const result = this.shiki.codeToTokens(code, {
			lang: resolved,
			theme: this.themeMapper.getThemeIdentifier(),
		});

		if (this.tokenCache.size > 100) {
			const firstKey = this.tokenCache.keys().next().value;
			if (firstKey) {
				this.tokenCache.delete(firstKey);
			}
		}
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
