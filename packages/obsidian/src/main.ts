import { debounce, loadPrism, Plugin, TFile } from 'obsidian';
import { createCm6Plugin, SHIKI_INLINE_REGEX } from 'packages/obsidian/src/codemirror/Cm6_ViewPlugin';
import { DEFAULT_SETTINGS, type Settings } from 'packages/obsidian/src/settings/Settings';
import { ShikiSettingsTab } from 'packages/obsidian/src/settings/SettingsTab';
import { filterHighlightAllPlugin, type PrismWithFilterHighlightAll } from 'packages/obsidian/src/PrismPlugin';
import { CodeHighlighter } from 'packages/obsidian/src/Highlighter';
import { CodeBlock } from 'packages/obsidian/src/CodeBlock';
import { InlineCodeBlock } from 'packages/obsidian/src/InlineCodeBlock';
import { BaseCodeBlock } from 'packages/obsidian/src/BaseCodeBlock';
import { VALID_THEME_IDS } from 'packages/obsidian/src/themes/ThemeRegistry';

import 'packages/obsidian/src/styles.css';
import 'virtual:ec-styles.css';
import 'virtual:ec-runtime';

export default class ShikiPlugin extends Plugin {
	highlighter!: CodeHighlighter;
	activeCodeBlocks!: Map<string, Set<BaseCodeBlock>>;
	settings!: Settings;
	loadedSettings!: Settings;
	activeCm6Plugins = new Set<() => Promise<void>>();
	lastDarkMode = false;

	async updateCm6Plugins(): Promise<void> {
		const promises = Array.from(this.activeCm6Plugins).map(fn => fn());
		await Promise.all(promises);
	}

	async onload(): Promise<void> {
		await this.loadSettings();
		this.loadedSettings = structuredClone(this.settings);
		this.addSettingTab(new ShikiSettingsTab(this));

		this.highlighter = new CodeHighlighter(this);
		this.activeCodeBlocks = new Map();
		this.lastDarkMode = this.app.isDarkMode();

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
			this.app.metadataCache.on('changed', file => {
				if (file instanceof TFile) {
					if (this.activeCodeBlocks.has(file.path)) {
						for (const codeBlock of this.activeCodeBlocks.get(file.path)!) {
							void codeBlock.rerenderOnNoteChange();
						}
					}
				}
			}),
		);

		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile) {
					if (this.activeCodeBlocks.has(oldPath)) {
						const blocks = this.activeCodeBlocks.get(oldPath)!;
						this.activeCodeBlocks.delete(oldPath);
						this.activeCodeBlocks.set(file.path, blocks);
						for (const block of blocks) {
							block.currentFilePath = file.path;
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
				const currentDarkMode = this.app.isDarkMode();
				if (currentDarkMode !== this.lastDarkMode) {
					this.lastDarkMode = currentDarkMode;
					debouncedReload();
				}
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
		this.lastDarkMode = this.app.isDarkMode();
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
				const match = SHIKI_INLINE_REGEX.exec(codeElm.textContent ?? ''); // format: `code{:lang}`
				if (!match) {
					continue;
				}

				const codeBlock = new InlineCodeBlock(this, codeElm, match[1], match[2], ctx);

				ctx.addChild(codeBlock);
			}
		});
	}

	onunload(): void {
		void this.highlighter.unload();
	}

	addActiveCodeBlock(codeBlock: BaseCodeBlock): void {
		const filePath = codeBlock.currentFilePath;

		if (!this.activeCodeBlocks.has(filePath)) {
			this.activeCodeBlocks.set(filePath, new Set([codeBlock]));
		} else {
			this.activeCodeBlocks.get(filePath)!.add(codeBlock);
		}
	}

	removeActiveCodeBlock(codeBlock: BaseCodeBlock): void {
		const filePath = codeBlock.currentFilePath;

		if (this.activeCodeBlocks.has(filePath)) {
			const set = this.activeCodeBlocks.get(filePath)!;
			set.delete(codeBlock);
			if (set.size === 0) {
				this.activeCodeBlocks.delete(filePath);
			}
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as Settings;

		let needsSave = false;
		if (!VALID_THEME_IDS.has(this.settings.darkTheme)) {
			this.settings.darkTheme = 'one-dark-pro';
			needsSave = true;
		}
		if (!VALID_THEME_IDS.has(this.settings.lightTheme)) {
			this.settings.lightTheme = 'one-light';
			needsSave = true;
		}

		if (needsSave) {
			await this.saveSettings();
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
