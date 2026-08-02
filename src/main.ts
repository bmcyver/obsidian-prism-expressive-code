import { debounce, loadPrism, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type Settings } from './settings/types';
import { PrismExpressiveCodeSettingTab } from './settings/SettingsTab';
import { CodeBlockHighlighter } from './codeblock/CodeBlockHighlighter';
import { CodeBlockManager } from './codeblock/CodeBlockManager';
import { registerCodeBlockProcessors } from './codeblock/CodeBlockProcessor';
import { clearThemeCache } from './themes/ThemeMapper';
import { VALID_THEME_IDS } from './config';
import {
  registerPrismHook,
  unregisterPrismHook,
  filterExpressiveCodeElements,
} from './prism/prismUtils';

import { cacheManager } from './utils/cache';

import 'src/styles.css';
import 'virtual:ec-styles.css';
import 'virtual:ec-runtime';

export default class PrismExpressiveCodePlugin extends Plugin {
  highlighter!: CodeBlockHighlighter;
  codeBlockManager!: CodeBlockManager;
  declare settings: Settings;
  loadedSettings!: Settings;
  activeCm6Plugins = new Set<() => Promise<void>>();
  lastDarkMode = false;

  async updateCm6Plugins(): Promise<void> {
    const promises = Array.from(this.activeCm6Plugins).map((fn) => fn());
    await Promise.all(promises);
  }

  async onload(): Promise<void> {
    await this.loadSettings();
    this.loadedSettings = structuredClone(this.settings);
    this.addSettingTab(new PrismExpressiveCodeSettingTab(this));

    this.highlighter = new CodeBlockHighlighter(this);
    this.codeBlockManager = new CodeBlockManager(this);
    this.codeBlockManager.registerEvents();

    this.lastDarkMode = this.app.isDarkMode();

    this.app.workspace.onLayoutReady(async () => {
      try {
        await loadPrism();
        await this.highlighter.load();

        registerCodeBlockProcessors(this);

        await this.registerPrismPlugin();

        // Force rerender any code blocks that were loaded before the highlighter was ready
        void this.codeBlockManager.forceRerenderAll();

        void this.updateCm6Plugins();
      } catch (e) {
        console.warn(
          'Failed to initialize Expressive Code Highlighter in the background.',
          e,
        );
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

    this.registerEvent(
      this.app.workspace.on('window-open', (winInfo) => {
        const win = (winInfo as unknown as { win: Window }).win || winInfo;
        if (win && win.document) {
          void this.highlighter.injectStyles(win.document);
          win.addEventListener('unload', () => {
            this.highlighter.removeStyles(win.document);
          });
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
    clearThemeCache();
    cacheManager.clearAllCaches();

    this.loadedSettings = structuredClone(this.settings);

    await this.highlighter.load();

    await this.codeBlockManager.forceRerenderAll();

    await this.updateCm6Plugins();
  }

  async registerPrismPlugin(): Promise<void> {
    registerPrismHook(filterExpressiveCodeElements);
  }

  unregisterPrismPlugin(): void {
    unregisterPrismHook(filterExpressiveCodeElements);
  }

  onunload(): void {
    this.unregisterPrismPlugin();
    void this.highlighter.unload();
    cacheManager.clearAllCaches();
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData(),
    ) as Settings;

    if (this.validateSettings()) {
      await this.saveSettings();
    }
  }

  private validateSettings(): boolean {
    let needsSave = false;
    if (!VALID_THEME_IDS.has(this.settings.darkTheme)) {
      this.settings.darkTheme = 'one-dark-pro';
      needsSave = true;
    }
    if (!VALID_THEME_IDS.has(this.settings.lightTheme)) {
      this.settings.lightTheme = 'one-light';
      needsSave = true;
    }
    return needsSave;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
