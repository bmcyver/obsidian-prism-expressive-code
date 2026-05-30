import { ExpressiveCodeEngine } from '@expressive-code/core';
import type ShikiPlugin from 'src/main';
import { loadPrism } from 'obsidian';
import { ThemeMapper } from 'src/themes/ThemeMapper';
import { toDom } from 'hast-util-to-dom';
import { createEcEngineConfig } from 'src/core/Config';
import { LANGUAGE_BLACKLIST } from 'src/languages/LanguageRegistry';
import { clearStyleCache, LANGUAGE_ALIASES } from 'src/prism/PrismUtils';
import { InlineHighlighter } from 'src/prism/InlineHighlighter';

export class CodeHighlighter {
	plugin: ShikiPlugin;
	themeMapper: ThemeMapper;
	inlineHighlighter: InlineHighlighter;

	ec!: ExpressiveCodeEngine;
	ecStyleElement: HTMLElement | undefined;
	supportedLanguages!: string[];
	safeLanguagesSet!: Set<string>;
	prism!: any;
	customThemes: unknown[] = [];
	private safeLanguagesArray: string[] = [];

	constructor(plugin: ShikiPlugin) {
		this.plugin = plugin;
		this.themeMapper = new ThemeMapper(this.plugin);
		this.inlineHighlighter = new InlineHighlighter(this.themeMapper);
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
		this.inlineHighlighter.clearCache();
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

	async getHighlightTokens(code: string, lang: string) {
		return this.inlineHighlighter.getHighlightTokens(code, lang, this.prism, this.safeLanguagesSet, this.supportedLanguages);
	}
}
