import { ExpressiveCodeEngine } from '@expressive-code/core';
import { toDom } from 'hast-util-to-dom';
import type * as Prism from 'prismjs';

import type PrismExpressiveCodePlugin from '../main';
import {
  clearStyleCache,
  LANGUAGE_ALIASES,
  LANGUAGE_BLACKLIST,
  LANGUAGE_SPECIAL,
} from '../prism/PrismUtils';
import { type ThemeMapper } from '../themes/ThemeManager';
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
    const prism = (window as unknown as { Prism?: typeof Prism }).Prism;
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
    this.removeStyles(doc);
    try {
      const themeStyles = await this.ec.getThemeStyles();
      const creator = doc as unknown as { createElement(tagName: 'style'): HTMLStyleElement };
      const styleEl = creator['createElement']('style');
      styleEl.textContent = themeStyles;
      doc.head.appendChild(styleEl);
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

  /**
   * Highlights code with EC and renders it to the passed container element.
   */
  async renderWithEc(
    code: string,
    language: string,
    meta: string,
    container: HTMLElement,
  ): Promise<void> {
    if (!this.ec) {
      return;
    }
    const result = await this.ec.render({
      code,
      language,
      meta,
    });

    container.empty();
    container.append(toDom(result.renderedGroupAst));
  }
}
