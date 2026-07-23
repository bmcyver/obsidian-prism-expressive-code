import { ExpressiveCodeEngine } from '@expressive-code/core';

import type PrismExpressiveCodePlugin from '../main';
import { getPrism } from '../prism/getPrism';
import {
  LANGUAGE_ALIASES,
  LANGUAGE_BLACKLIST,
  LANGUAGE_SPECIAL,
} from '../prism/constants';
import { clearStyleCache } from '../prism/scopeMapping';
import { type ThemeMapper } from '../themes/ThemeMapper';
import { createEcEngineConfig } from '../config';

export class CodeBlockHighlighter {
  plugin: PrismExpressiveCodePlugin;
  themeMapper: ThemeMapper;

  ec!: ExpressiveCodeEngine;
  ecStyleElements = new Map<Document, HTMLStyleElement>();
  supportedLanguages!: string[];
  safeLanguagesSet!: Set<string>;

  private safeLanguagesArray: string[] = [];

  constructor(plugin: PrismExpressiveCodePlugin, themeMapper: ThemeMapper) {
    this.plugin = plugin;
    this.themeMapper = themeMapper;
  }

  async load(): Promise<void> {
    const prism = getPrism();
    if (!prism) {
      return;
    }

    const loadedPrismLangs = Object.keys(prism.languages).filter(
      (key) => typeof prism.languages[key] === 'object',
    );
    this.supportedLanguages = Array.from(
      new Set([
        ...loadedPrismLangs,
        ...Object.keys(LANGUAGE_ALIASES),
        ...LANGUAGE_SPECIAL,
      ]),
    );
    this.safeLanguagesSet = new Set(
      this.supportedLanguages.filter((lang) => !LANGUAGE_BLACKLIST.has(lang)),
    );
    this.safeLanguagesArray = Array.from(this.safeLanguagesSet);

    this.plugin.inlineHighlighter.initialize(this.safeLanguagesSet);

    this.ec = new ExpressiveCodeEngine(
      createEcEngineConfig({
        theme: await this.themeMapper.getThemeForEC(),
        settings: this.plugin.loadedSettings,
      }),
    );

    this.clearAllStyles();

    const docs = this.getAllDocuments();
    for (const doc of docs) {
      await this.injectStyles(doc);
    }
  }

  private getAllDocuments(): Set<Document> {
    const docs = new Set<Document>();
    if (typeof activeDocument !== 'undefined') {
      docs.add(activeDocument);
    }
    if (this.plugin.app.workspace.containerEl?.ownerDocument) {
      docs.add(this.plugin.app.workspace.containerEl.ownerDocument);
    }
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view?.containerEl?.ownerDocument) {
        docs.add(leaf.view.containerEl.ownerDocument);
      }
    });
    return docs;
  }

  public async injectStyles(doc: Document): Promise<void> {
    if (!this.ec) return;
    try {
      const themeStyles = await this.ec.getThemeStyles();
      let styleEl = doc.getElementById(
        'pec-theme-styles',
      ) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = (
          doc as Document & {
            win: Window & { createEl: (tag: string) => HTMLStyleElement };
          }
        ).win.createEl('style');
        styleEl.id = 'pec-theme-styles';
        doc.head.appendChild(styleEl);
      }
      if (styleEl.textContent !== themeStyles) {
        styleEl.textContent = themeStyles;
      }
      this.ecStyleElements.set(doc, styleEl);
    } catch (e) {
      console.warn('Failed to inject Expressive Code styles into document', e);
    }
  }

  public removeStyles(doc: Document): void {
    const styleEl = this.ecStyleElements.get(doc);
    if (styleEl) {
      styleEl.remove();
      this.ecStyleElements.delete(doc);
    }
  }

  private clearAllStyles(): void {
    for (const styleEl of this.ecStyleElements.values()) {
      styleEl.remove();
    }
    this.ecStyleElements.clear();
  }

  async unload(): Promise<void> {
    this.clearAllStyles();
    clearStyleCache();
  }

  /**
   * All languages that are safe to use with Obsidian's `registerMarkdownCodeBlockProcessor`.
   */
  obsidianSafeLanguageNames(): string[] {
    return this.safeLanguagesArray;
  }
}
