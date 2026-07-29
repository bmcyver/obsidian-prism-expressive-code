import { PluginSettingTab, Setting } from 'obsidian';
import type PrismExpressiveCodePlugin from '../main';
import { THEME_DISPLAY_NAMES } from '../themes/definitions';
import { FrameType, CollapseStyle } from './types';

export class PrismExpressiveCodeSettingTab extends PluginSettingTab {
  plugin: PrismExpressiveCodePlugin;

  constructor(plugin: PrismExpressiveCodePlugin) {
    super(plugin.app, plugin);

    this.plugin = plugin;
  }

  getSettingDefinitions(): [] {
    return [];
  }

  display(): void {
    this.containerEl.empty();

    const themes = THEME_DISPLAY_NAMES;

    new Setting(this.containerEl).setName('Highlighter Control').setHeading();

    new Setting(this.containerEl)
      .setName('Reload Highlighter Engine')
      .setDesc(
        'Applies setting changes immediately by reloading the Expressive Code engine.',
      )
      .addButton((button) => {
        button
          .setCta()
          .setButtonText('Reload Highlighter')
          .onClick(async () => {
            button.setDisabled(true);
            await this.plugin.reloadHighlighter();
            button.setDisabled(false);
          });
      });

    new Setting(this.containerEl).setName('Code Block Defaults').setHeading();

    new Setting(this.containerEl)
      .setName('Show line numbers')
      .setDesc(
        'Controls whether line numbers are shown by default on code blocks.',
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.ecDefaultShowLineNumbers)
          .onChange(async (value) => {
            this.plugin.settings.ecDefaultShowLineNumbers = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(this.containerEl)
      .setName('Wrap lines')
      .setDesc('Controls whether code block lines wrap by default.')
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.ecDefaultWrap)
          .onChange(async (value) => {
            this.plugin.settings.ecDefaultWrap = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(this.containerEl)
      .setName('Frame style')
      .setDesc('Controls the default frame type for code blocks.')
      .addDropdown((dropdown) => {
        dropdown.addOptions({
          [FrameType.Code]: 'Code',
          [FrameType.Terminal]: 'Terminal',
          [FrameType.None]: 'None',
          [FrameType.Auto]: 'Auto',
        });
        dropdown
          .setValue(this.plugin.settings.ecDefaultFrame)
          .onChange(async (value) => {
            this.plugin.settings.ecDefaultFrame = value as FrameType;
            await this.plugin.saveSettings();
          });
      });

    new Setting(this.containerEl)
      .setName('Collapse style')
      .setDesc('Controls how collapsible code sections behave and are styled.')
      .addDropdown((dropdown) => {
        dropdown.addOptions({
          [CollapseStyle.Github]: 'GitHub (non-recollapsible)',
          [CollapseStyle.CollapsibleStart]: 'Collapsible Start',
          [CollapseStyle.CollapsibleEnd]: 'Collapsible End',
          [CollapseStyle.CollapsibleAuto]: 'Collapsible Auto',
        });
        dropdown
          .setValue(this.plugin.settings.ecDefaultCollapseStyle)
          .onChange(async (value) => {
            this.plugin.settings.ecDefaultCollapseStyle =
              value as CollapseStyle;
            await this.plugin.saveSettings();
          });
      });

    new Setting(this.containerEl).setName('Themes & Appearance').setHeading();

    new Setting(this.containerEl)
      .setName('Dark theme')
      .setDesc(
        "The syntax theme for code blocks when Obsidian's base color scheme is dark.",
      )
      .addDropdown((dropdown) => {
        dropdown.addOptions(themes);
        dropdown
          .setValue(this.plugin.settings.darkTheme)
          .onChange(async (value) => {
            this.plugin.settings.darkTheme = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(this.containerEl)
      .setName('Light theme')
      .setDesc(
        "The syntax theme for code blocks when Obsidian's base color scheme is light.",
      )
      .addDropdown((dropdown) => {
        dropdown.addOptions(themes);
        dropdown
          .setValue(this.plugin.settings.lightTheme)
          .onChange(async (value) => {
            this.plugin.settings.lightTheme = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(this.containerEl)
      .setName('Prefer theme background colors')
      .setDesc(
        'When enabled, prefers native theme background colors over Obsidian CSS variables.',
      )
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.preferThemeColors)
          .onChange(async (value) => {
            this.plugin.settings.preferThemeColors = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
