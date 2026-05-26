import { PluginSettingTab, Setting, Platform, Notice, normalizePath } from 'obsidian';
import type ShikiPlugin from 'packages/obsidian/src/main';
import { OBSIDIAN_THEME_IDENTIFIER } from 'packages/obsidian/src/themes/ThemeMapper';
import { CollapseStyle, FrameType } from 'packages/obsidian/src/settings/Settings';

export class ShikiSettingsTab extends PluginSettingTab {
	plugin: ShikiPlugin;

	constructor(plugin: ShikiPlugin) {
		super(plugin.app, plugin);

		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

		const themes = {
			[OBSIDIAN_THEME_IDENTIFIER]: 'Obsidian built-in (both)',
			'one-dark-pro': 'One Dark Pro (dark)',
			'one-light': 'One Light (light)',
		};

		new Setting(this.containerEl).setName('All setting changes require a reload of the highlighter').addButton(button => {
			button
				.setCta()
				.setButtonText('Reload Highlighter')
				.onClick(async () => {
					button.setDisabled(true);
					await this.plugin.reloadHighlighter();
					button.setDisabled(false);
				});
		});

		new Setting(this.containerEl)
			.setName('Inline Syntax Highlighting')
			.setDesc('Enables syntax highlighting for inline code blocks via `{lang} code`.')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.inlineHighlighting).onChange(async value => {
					this.plugin.settings.inlineHighlighting = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl).setName('EC defaults').setHeading();

		new Setting(this.containerEl)
			.setName('Show line numbers')
			.setDesc('Controls whether line numbers are shown by default.')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.ecDefaultShowLineNumbers).onChange(async value => {
					this.plugin.settings.ecDefaultShowLineNumbers = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl)
			.setName('Wrap')
			.setDesc('Controls whether code block lines wrap by default.')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.ecDefaultWrap).onChange(async value => {
					this.plugin.settings.ecDefaultWrap = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl)
			.setName('Frame')
			.setDesc('Controls the default frame type for code blocks.')
			.addDropdown(dropdown => {
				dropdown.addOptions({
					[FrameType.Code]: 'Code',
					[FrameType.Terminal]: 'Terminal',
					[FrameType.None]: 'None',
					[FrameType.Auto]: 'Auto',
				});
				dropdown.setValue(this.plugin.settings.ecDefaultFrame).onChange(async value => {
					this.plugin.settings.ecDefaultFrame = value as FrameType;
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl)
			.setName('Collapse style')
			.setDesc('Controls how collapsible sections behave and are styled.')
			.addDropdown(dropdown => {
				dropdown.addOptions({
					[CollapseStyle.Github]: 'GitHub (non-recollapsible)',
					[CollapseStyle.CollapsibleStart]: 'Collapsible Start',
					[CollapseStyle.CollapsibleEnd]: 'Collapsible End',
					[CollapseStyle.CollapsibleAuto]: 'Collapsible Auto',
				});
				dropdown.setValue(this.plugin.settings.ecDefaultCollapseStyle).onChange(async value => {
					this.plugin.settings.ecDefaultCollapseStyle = value as CollapseStyle;
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl).setName('Theme').setHeading();

		new Setting(this.containerEl)
			.setName('Dark theme')
			.setDesc("The theme for code blocks when Obsidian's base color scheme is dark.")
			.addDropdown(dropdown => {
				dropdown.addOptions(themes);
				dropdown.setValue(this.plugin.settings.darkTheme).onChange(async value => {
					this.plugin.settings.darkTheme = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl)
			.setName('Light theme')
			.setDesc("The theme for code blocks when Obsidian's base color scheme is light.")
			.addDropdown(dropdown => {
				dropdown.addOptions(themes);
				dropdown.setValue(this.plugin.settings.lightTheme).onChange(async value => {
					this.plugin.settings.lightTheme = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(this.containerEl)
			.setName('Prefer theme colors')
			.setDesc('When enabled the plugin will prefer theme colors over CSS variables for things like the code block background.')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.preferThemeColors).onChange(async value => {
					this.plugin.settings.preferThemeColors = value;
					await this.plugin.saveSettings();
				});
			});
	}
}
