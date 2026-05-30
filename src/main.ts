import { debounce, loadPrism, Plugin } from 'obsidian';
import { createCm6Plugin } from 'src/codemirror/Cm6_ViewPlugin';
import { DEFAULT_SETTINGS, type Settings } from 'src/settings/Settings';
import { ShikiSettingsTab } from 'src/settings/SettingsTab';
import { filterHighlightAllPlugin, type PrismWithFilterHighlightAll } from 'src/core/PrismPlugin';
import { CodeHighlighter } from 'src/core/Highlighter';
import { VALID_THEME_IDS } from 'src/themes/ThemeRegistry';
import { CodeBlockManager } from 'src/managers/CodeBlockManager';
import { MarkdownProcessorRegistry } from 'src/managers/MarkdownProcessorRegistry';

import 'src/styles.css';
import 'virtual:ec-styles.css';
import 'virtual:ec-runtime';

export default class ShikiPlugin extends Plugin {
	highlighter!: CodeHighlighter;
	codeBlockManager!: CodeBlockManager;
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
		this.codeBlockManager = new CodeBlockManager(this);
		this.codeBlockManager.registerEvents();
		
		this.lastDarkMode = this.app.isDarkMode();

		this.app.workspace.onLayoutReady(async () => {
			try {
				await loadPrism();
				await this.highlighter.load();

				const processorRegistry = new MarkdownProcessorRegistry(this);
				processorRegistry.registerProcessors();

				this.registerEditorExtension([createCm6Plugin(this)]);

				await this.registerPrismPlugin();

				// Force rerender any code blocks that were loaded before the highlighter was ready
				void this.codeBlockManager.forceRerenderAll();

				void this.updateCm6Plugins();
			} catch (e) {
				console.warn('Failed to initialize Shiki Highlighter in the background.', e);
			}
		});

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

		await this.codeBlockManager.forceRerenderAll();

		await this.updateCm6Plugins();
	}

	async registerPrismPlugin(): Promise<void> {
		const prism = (window as unknown as { Prism: PrismWithFilterHighlightAll }).Prism;
		const filterHighlightAll = filterHighlightAllPlugin(prism);
		filterHighlightAll?.reject.addSelector('div.expressive-code pre code');
	}

	onunload(): void {
		void this.highlighter.unload();
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
