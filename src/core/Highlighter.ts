import {
  ExpressiveCodeEngine,
  ExpressiveCodeTheme,
  type ExpressiveCodeEngineConfig,
  type ExpressiveCodeThemeInput,
} from '@expressive-code/core';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginFrames } from '@expressive-code/plugin-frames';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import { pluginTextMarkers } from '@expressive-code/plugin-text-markers';
import { toDom } from 'hast-util-to-dom';
import {
  type MarkdownPostProcessorContext,
  MarkdownRenderChild,
  TFile,
} from 'obsidian';
import type * as Prism from 'prismjs';

import type PrismExpressiveCodePlugin from '../main';
import {
  clearStyleCache,
  customPluginPrism,
  InlineHighlighter,
  LANGUAGE_ALIASES,
  LANGUAGE_BLACKLIST,
  type TokensResult,
} from '../prism/PrismHighlighter';
import { getECTheme, ThemeMapper } from '../themes/ThemeManager';
import {
  calculateListIndentationLevel,
  extractMetaString,
  INLINE_CODE_REGEX,
  stripCommonIndentation,
} from '../utils';

export interface ThemeRegistration {
  name: string;
  displayName?: string;
  type?: string;
  colors: Record<string, string>;
  tokenColors: unknown[];
  settings?: unknown[];
  semanticHighlighting?: boolean;
}

export interface EcSettingsProps {
  preferThemeColors: boolean;
  ecDefaultShowLineNumbers: boolean;
  ecDefaultWrap: boolean;
  ecDefaultFrame: 'code' | 'terminal' | 'none' | 'auto';
  ecDefaultCollapseStyle:
    | 'github'
    | 'collapsible-start'
    | 'collapsible-end'
    | 'collapsible-auto';
}

export interface EcConfigInput {
  theme: ThemeRegistration;
  settings: EcSettingsProps;
}

export interface CssVariableThemeBundle {
  theme: ThemeRegistration;
  restoreCssVariables: (css: string) => string;
}

export const EC_VIRTUAL_SETTINGS: EcSettingsProps = {
  preferThemeColors: true,
  ecDefaultShowLineNumbers: false,
  ecDefaultWrap: false,
  ecDefaultFrame: 'auto',
  ecDefaultCollapseStyle: 'collapsible-auto',
};

export function createCssVariableThemeBundle(
  theme: ThemeRegistration,
): CssVariableThemeBundle {
  const cssVarToPlaceholder = new Map<string, string>();
  let placeholderCounter = 0;

  const toPlaceholder = (value: string): string => {
    if (!value.trim().startsWith('var(')) {
      return value;
    }

    const existing = cssVarToPlaceholder.get(value);
    if (existing) {
      return existing;
    }

    // Start offset at 0xE00000 to prevent conflicts with black (#000000) or other very common colors
    const colorInt = 0xe00000 + placeholderCounter;
    const placeholder = `#${colorInt.toString(16).toUpperCase()}`;
    placeholderCounter += 1;
    cssVarToPlaceholder.set(value, placeholder);
    return placeholder;
  };

  const mapThemeTokenColor = <
    T extends { settings?: { foreground?: string; background?: string } },
  >(
    token: T,
  ): T => {
    if (!token.settings) {
      return token;
    }

    return {
      ...token,
      settings: {
        ...token.settings,
        foreground: token.settings.foreground
          ? toPlaceholder(token.settings.foreground)
          : token.settings.foreground,
        background: token.settings.background
          ? toPlaceholder(token.settings.background)
          : token.settings.background,
      },
    };
  };

  const mappedTheme: ThemeRegistration = {
    ...theme,
    colors: Object.fromEntries(
      Object.entries(theme.colors ?? {}).map(([key, value]) => [
        key,
        toPlaceholder(value),
      ]),
    ),
    tokenColors: (theme.tokenColors ?? []).map(
      mapThemeTokenColor as (value: unknown) => unknown,
    ),
  };

  return {
    theme: mappedTheme,
    restoreCssVariables: (css: string): string => {
      let output = css;
      for (const [cssVar, placeholder] of cssVarToPlaceholder) {
        output = output.replaceAll(placeholder, cssVar);
      }
      return output;
    },
  };
}

export function createEcEngineConfig(
  input: EcConfigInput,
): ExpressiveCodeEngineConfig {
  const useThemeColors = input.settings.preferThemeColors;

  return {
    themes: [
      new ExpressiveCodeTheme(
        input.theme as unknown as ExpressiveCodeThemeInput,
      ),
    ],
    plugins: [
      customPluginPrism(),
      pluginCollapsibleSections(),
      pluginTextMarkers(),
      pluginLineNumbers(),
      pluginFrames(),
    ].filter(Boolean),
    styleOverrides: getECTheme(useThemeColors),
    minSyntaxHighlightingColorContrast: 0,
    themeCssRoot: 'div.expressive-code',
    defaultProps: {
      showLineNumbers: input.settings.ecDefaultShowLineNumbers,
      wrap: input.settings.ecDefaultWrap,
      frame: input.settings.ecDefaultFrame,
      collapseStyle: input.settings.ecDefaultCollapseStyle,
    },
  };
}
>>>>>>> subagent-Core-Code-Consolidation-Specialist-FileCombiner-85e56821

export class CodeHighlighter {
  plugin: PrismExpressiveCodePlugin;
  themeMapper: ThemeMapper;
  inlineHighlighter: InlineHighlighter;

  ec!: ExpressiveCodeEngine;
  ecStyleElements = new Map<Document, HTMLStyleElement>();
  supportedLanguages!: string[];
  safeLanguagesSet!: Set<string>;

  customThemes: unknown[] = [];
  private safeLanguagesArray: string[] = [];

  constructor(plugin: PrismExpressiveCodePlugin) {
    this.plugin = plugin;
    this.themeMapper = new ThemeMapper(this.plugin);
    this.inlineHighlighter = new InlineHighlighter(this.themeMapper);
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
        'plaintext',
        'txt',
        'text',
        'plain',
        'ansi',
      ]),
    );
    this.safeLanguagesSet = new Set(
      this.supportedLanguages.filter((lang) => !LANGUAGE_BLACKLIST.has(lang)),
    );
    this.safeLanguagesArray = Array.from(this.safeLanguagesSet);

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
      // eslint-disable-next-line obsidianmd/no-forbidden-elements
      const styleEl = doc.head.createEl('style', {
        text: themeStyles,
      });
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

  async getHighlightTokens(
    code: string,
    lang: string,
  ): Promise<TokensResult | undefined> {
    const prism = (window as unknown as { Prism: typeof Prism }).Prism;
    return this.inlineHighlighter.getHighlightTokens(
      code,
      lang,
      prism,
      this.safeLanguagesSet,
      this.supportedLanguages,
    );
  }
}

export abstract class BaseCodeBlock extends MarkdownRenderChild {
  plugin: PrismExpressiveCodePlugin;
  source: string;
  language: string;
  ctx: MarkdownPostProcessorContext;
  currentFilePath: string;

  constructor(
    plugin: PrismExpressiveCodePlugin,
    containerEl: HTMLElement,
    source: string,
    language: string,
    ctx: MarkdownPostProcessorContext,
  ) {
    super(containerEl);

    this.plugin = plugin;
    this.source = source;
    this.language = language;
    this.ctx = ctx;
    this.currentFilePath = ctx.sourcePath;
  }

  public abstract rerenderOnNoteChange(): Promise<void>;
  public abstract forceRerender(): Promise<void>;

  public onload(): void {
    super.onload();
    this.plugin.codeBlockManager.add(this);
  }

  public onunload(): void {
    super.onunload();
    this.plugin.codeBlockManager.remove(this);
    this.containerEl.empty();
  }
}

export class CodeBlock extends BaseCodeBlock {
  cachedMetaString: string;

  constructor(
    plugin: PrismExpressiveCodePlugin,
    containerEl: HTMLElement,
    source: string,
    language: string,
    ctx: MarkdownPostProcessorContext,
  ) {
    super(plugin, containerEl, source, language, ctx);
    this.cachedMetaString = '';
  }

  private getMetaString(): string {
    return extractMetaString(this.ctx, this.containerEl, this.language);
  }

  private async render(metaString: string): Promise<void> {
    if (!this.plugin.highlighter?.ec) {
      return;
    }

    // Apply list indentation for Live Preview (Editing View) via CSS variable
    const level = calculateListIndentationLevel(this.source);

    this.containerEl.classList.add('pec-code-block');
    if (level > 0) {
      this.containerEl.style.setProperty(
        '--pec-indent-level',
        level.toString(),
      );
    } else {
      this.containerEl.style.removeProperty('--pec-indent-level');
    }

    const cleanedSource = stripCommonIndentation(this.source);
    await this.plugin.highlighter.renderWithEc(
      cleanedSource,
      this.language,
      metaString,
      this.containerEl,
    );
  }

  public async rerenderOnNoteChange(): Promise<void> {
    // compare the new meta string to the cached one
    // only rerender if they are different, to avoid unnecessary work
    // since the meta string is likely to be the same most of the time
    // and if the code block content changes obsidian will rerender for us
    const newMetaString = this.getMetaString();
    if (newMetaString !== this.cachedMetaString) {
      this.cachedMetaString = newMetaString;
      await this.render(newMetaString);
    }
  }

  public async forceRerender(): Promise<void> {
    await this.render(this.cachedMetaString);
  }

  public onload(): void {
    super.onload();
    this.cachedMetaString = this.getMetaString();
    void this.render(this.cachedMetaString);
  }
}

export class InlineCodeBlock extends BaseCodeBlock {
  constructor(
    plugin: PrismExpressiveCodePlugin,
    containerEl: HTMLElement,
    source: string,
    language: string,
    ctx: MarkdownPostProcessorContext,
  ) {
    super(plugin, containerEl, source, language, ctx);
  }

  private async render(): Promise<void> {
    if (!this.plugin.highlighter) {
      return;
    }
    this.containerEl.empty();
    this.containerEl.classList.add('pec-inline');

    const highlight = await this.plugin.highlighter.getHighlightTokens(
      this.source,
      this.language,
    );
    const tokens = highlight?.tokens;
    if (!tokens?.length) {
      return;
    }

    this.plugin.highlighter.inlineHighlighter.renderTokens(
      tokens,
      this.containerEl,
    );
  }

  public async rerenderOnNoteChange(): Promise<void> {
    // noop for inline code blocks
  }

  public async forceRerender(): Promise<void> {
    await this.render();
  }

  public onload(): void {
    super.onload();
    void this.render();
  }
}

export class CodeBlockManager {
  plugin: PrismExpressiveCodePlugin;
  activeCodeBlocks: Map<string, Set<BaseCodeBlock>>;

  constructor(plugin: PrismExpressiveCodePlugin) {
    this.plugin = plugin;
    this.activeCodeBlocks = new Map();
  }

  public registerEvents(): void {
    this.plugin.registerEvent(
      this.plugin.app.metadataCache.on('changed', (file) => {
        if (file instanceof TFile) {
          if (this.activeCodeBlocks.has(file.path)) {
            for (const codeBlock of this.activeCodeBlocks.get(file.path)!) {
              void codeBlock.rerenderOnNoteChange();
            }
          }
        }
      }),
    );

    this.plugin.registerEvent(
      this.plugin.app.vault.on('rename', (file, oldPath) => {
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
  }

  public add(codeBlock: BaseCodeBlock): void {
    const filePath = codeBlock.currentFilePath;

    if (!this.activeCodeBlocks.has(filePath)) {
      this.activeCodeBlocks.set(filePath, new Set([codeBlock]));
    } else {
      this.activeCodeBlocks.get(filePath)!.add(codeBlock);
    }
  }

  public remove(codeBlock: BaseCodeBlock): void {
    const filePath = codeBlock.currentFilePath;

    if (this.activeCodeBlocks.has(filePath)) {
      const set = this.activeCodeBlocks.get(filePath)!;
      set.delete(codeBlock);
      if (set.size === 0) {
        this.activeCodeBlocks.delete(filePath);
      }
    }
  }

  public async forceRerenderAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const codeBlocks of this.activeCodeBlocks.values()) {
      for (const codeBlock of codeBlocks) {
        promises.push(codeBlock.forceRerender());
      }
    }
    await Promise.all(promises);
  }
}

export class MarkdownProcessorRegistry {
  plugin: PrismExpressiveCodePlugin;

  constructor(plugin: PrismExpressiveCodePlugin) {
    this.plugin = plugin;
  }

  public registerProcessors(): void {
    this.registerCodeBlockProcessors();
    this.registerInlineCodeProcessor();
  }

  private registerCodeBlockProcessors(): void {
    const languages = this.plugin.highlighter.obsidianSafeLanguageNames();

    for (const language of languages) {
      try {
        this.plugin.registerMarkdownCodeBlockProcessor(
          language,
          async (source, el, ctx) => {
            // we need to avoid making the hidden frontmatter code block visible
            if (el.parentElement?.classList.contains('mod-frontmatter')) {
              return;
            }

            const codeBlock = new CodeBlock(
              this.plugin,
              el,
              source,
              language,
              ctx,
            );

            ctx.addChild(codeBlock);
          },
          1000,
        );
      } catch (e) {
        console.warn(
          `Failed to register code block processor for ${language}.`,
          e,
        );
      }
    }
  }

  private registerInlineCodeProcessor(): void {
    this.plugin.registerMarkdownPostProcessor(async (el, ctx) => {
      const inlineCodes = el.findAll(':not(pre) > code');
      for (const codeElm of inlineCodes) {
        const match = INLINE_CODE_REGEX.exec(codeElm.textContent ?? ''); // format: `code{:lang}`
        if (!match || !match[1] || !match[2]) {
          continue;
        }

        const codeBlock = new InlineCodeBlock(
          this.plugin,
          codeElm,
          match[1],
          match[2],
          ctx,
        );

        ctx.addChild(codeBlock);
      }
    });
  }
}
