import { debounce, loadPrism, Plugin, TFile, type MarkdownPostProcessor } from 'obsidian';
import { CodeBlock } from 'packages/obsidian/src/CodeBlock';
import { createCm6Plugin, SHIKI_INLINE_REGEX } from 'packages/obsidian/src/codemirror/Cm6_ViewPlugin';
import { DEFAULT_SETTINGS, type Settings } from 'packages/obsidian/src/settings/Settings';
import { ShikiSettingsTab } from 'packages/obsidian/src/settings/SettingsTab';
import { filterHighlightAllPlugin, type PrismWithFilterHighlightAll } from 'packages/obsidian/src/PrismPlugin';
import { CodeHighlighter } from 'packages/obsidian/src/Highlighter';
import { InlineCodeBlock } from 'packages/obsidian/src/InlineCodeBlock';
import { OBSIDIAN_THEME_IDENTIFIER } from 'packages/obsidian/src/themes/ThemeMapper';

import 'packages/obsidian/src/styles.css';
import 'virtual:ec-styles.css';
import 'virtual:ec-runtime';

export default class ShikiPlugin extends Plugin {
	highlighter!: CodeHighlighter;
	activeCodeBlocks!: Map<string, (CodeBlock | InlineCodeBlock)[]>;
	settings!: Settings;
	loadedSettings!: Settings;
	activeCm6Plugins = new Set<() => Promise<void>>();

	async updateCm6Plugins(): Promise<void> {
		const promises = Array.from(this.activeCm6Plugins).map(fn => fn());
		await Promise.all(promises);
	}

	codeBlockProcessors: MarkdownPostProcessor[] = [];

	async onload(): Promise<void> {
		await this.loadSettings();
		this.loadedSettings = structuredClone(this.settings);
		this.addSettingTab(new ShikiSettingsTab(this));

		this.highlighter = new CodeHighlighter(this);
		this.activeCodeBlocks = new Map();

		this.app.workspace.onLayoutReady(async () => {
			try {
				await this.highlighter.load();

				this.registerInlineCodeProcessor();
				this.registerCodeBlockProcessors();

				this.registerEditorExtension([createCm6Plugin(this)]);

				await this.registerPrismPlugin();

				// Force rerender any code blocks that were loaded before the highlighter was ready
				for (const [_, codeBlocks] of this.activeCodeBlocks) {
					for (const codeBlock of codeBlocks) {
						void codeBlock.forceRerender();
					}
				}

				void this.updateCm6Plugins();
			} catch (e) {
				console.warn('Failed to initialize Shiki Highlighter in the background.', e);
			}
		});

		// this is a workaround for the fact that obsidian does not rerender the code block
		// when the start line with the language changes, and we need that for the EC meta string
		this.registerEvent(
			this.app.vault.on('modify', async file => {
				// sleep 0 so that the code block context is updated before we rerender
				await sleep(100);

				if (file instanceof TFile) {
					if (this.activeCodeBlocks.has(file.path)) {
						for (const codeBlock of this.activeCodeBlocks.get(file.path)!) {
							void codeBlock.rerenderOnNoteChange();
						}
					}
				}
			}),
		);

		const debouncedReload = debounce(
			() => {
				void this.reloadHighlighter();
			},
			500,
			true,
		);

		this.registerEvent(
			this.app.workspace.on('css-change', () => {
				debouncedReload();
			}),
		);

		this.addCommand({
			id: 'reload-highlighter',
			name: 'Reload highlighter',
			callback: () => {
				void this.reloadHighlighter();
			},
		});
	}

	async reloadHighlighter(): Promise<void> {
		await this.highlighter.unload();

		this.loadedSettings = structuredClone(this.settings);

		await this.highlighter.load();

		const promises: Promise<void>[] = [];
		for (const [_, codeBlocks] of this.activeCodeBlocks) {
			for (const codeBlock of codeBlocks) {
				promises.push(codeBlock.forceRerender());
			}
		}
		await Promise.all(promises);

		await this.updateCm6Plugins();
	}

	async registerPrismPlugin(): Promise<void> {
		const prism = (await loadPrism()) as PrismWithFilterHighlightAll;
		const filterHighlightAll = filterHighlightAllPlugin(prism);
		filterHighlightAll?.reject.addSelector('div.expressive-code pre code');
	}

	registerCodeBlockProcessors(): void {
		const languages = this.highlighter.obsidianSafeLanguageNames();

		for (const language of languages) {
			try {
				this.registerMarkdownCodeBlockProcessor(
					language,
					async (source, el, ctx) => {
						// we need to avoid making the hidden frontmatter code block visible
						if (el.parentElement?.classList.contains('mod-frontmatter')) {
							return;
						}

						const codeBlock = new CodeBlock(this, el, source, language, ctx);

						ctx.addChild(codeBlock);
					},
					1000,
				);
			} catch (e) {
				console.warn(`Failed to register code block processor for ${language}.`, e);
			}
		}
	}

	registerInlineCodeProcessor(): void {
		this.registerMarkdownPostProcessor(async (el, ctx) => {
			const inlineCodes = el.findAll(':not(pre) > code');
			for (const codeElm of inlineCodes) {
				const match = SHIKI_INLINE_REGEX.exec(codeElm.textContent ?? ''); // format: `{lang} code`
				if (!match) {
					continue;
				}

				const codeBlock = new InlineCodeBlock(this, codeElm, match[2], match[1], ctx);

				ctx.addChild(codeBlock);
			}
		});
	}

	onunload(): void {
		void this.highlighter.unload();
	}

	addActiveCodeBlock(codeBlock: CodeBlock | InlineCodeBlock): void {
		const filePath = codeBlock.ctx.sourcePath;

		if (!this.activeCodeBlocks.has(filePath)) {
			this.activeCodeBlocks.set(filePath, [codeBlock]);
		} else {
			this.activeCodeBlocks.get(filePath)!.push(codeBlock);
		}
	}

	removeActiveCodeBlock(codeBlock: CodeBlock | InlineCodeBlock): void {
		const filePath = codeBlock.ctx.sourcePath;

		if (this.activeCodeBlocks.has(filePath)) {
			const list = this.activeCodeBlocks.get(filePath)!;
			const index = list.indexOf(codeBlock);
			if (index !== -1) {
				list.splice(index, 1);
			}
			if (list.length === 0) {
				this.activeCodeBlocks.delete(filePath);
			}
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as Settings;

		// migrate the theme to darkTheme and lightTheme
		if (this.settings.theme !== undefined) {
			this.settings.darkTheme = this.settings.theme;
			this.settings.lightTheme = this.settings.theme;
			this.settings.theme = undefined;
		}

		// Clean up legacy custom folders from settings file
		let legacyCleaned = false;
		if ('customThemeFolder' in this.settings) {
			delete (this.settings as any).customThemeFolder;
			legacyCleaned = true;
		}
		if ('customLanguageFolder' in this.settings) {
			delete (this.settings as any).customLanguageFolder;
			legacyCleaned = true;
		}
		if ('disabledLanguages' in this.settings) {
			delete (this.settings as any).disabledLanguages;
			legacyCleaned = true;
		}

		// Validate and migrate theme settings to one of the 3 supported themes (obsidian-theme, one-dark-pro, one-light)
		const VALID_THEMES = new Set([OBSIDIAN_THEME_IDENTIFIER, 'one-dark-pro', 'one-light']);
		if (!VALID_THEMES.has(this.settings.darkTheme)) {
			this.settings.darkTheme = OBSIDIAN_THEME_IDENTIFIER;
			legacyCleaned = true;
		}
		if (!VALID_THEMES.has(this.settings.lightTheme)) {
			this.settings.lightTheme = OBSIDIAN_THEME_IDENTIFIER;
			legacyCleaned = true;
		}

		if (legacyCleaned) {
			await this.saveSettings();
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
