import { InlineStyleAnnotation, definePlugin, type ExpressiveCodePlugin } from '@expressive-code/core';
import { type HighlighterCore, type ThemedToken } from 'shiki/core';
import { ALIAS_TO_LANG } from './LanguageRegistry';

function isTerminalLanguage(language: string): boolean {
	return ['shellscript', 'shell', 'bash', 'sh', 'zsh', 'nu', 'nushell'].includes(language);
}

export function customPluginShiki(options: { getHighlighter: () => Promise<HighlighterCore> }): ExpressiveCodePlugin {
	const { getHighlighter } = options;

	return definePlugin({
		name: 'Shiki',
		hooks: {
			performSyntaxAnalysis: async ({ codeBlock, styleVariants, config: { logger } }) => {
				const codeLines = codeBlock.getLines();
				let code = codeBlock.code;
				if (isTerminalLanguage(codeBlock.language)) {
					code = code.replace(/<([^>]*[^>\s])>/g, 'X$1X');
				}

				let highlighter: HighlighterCore;
				try {
					highlighter = await getHighlighter();
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					throw new Error(`Failed to load shared syntax highlighter: "${error.message}"`, {
						cause: error,
					});
				}

				const rawLanguage = codeBlock.language;
				const resolvedLanguage = ALIAS_TO_LANG[rawLanguage] ?? rawLanguage;

				const loadedLangs = highlighter.getLoadedLanguages();
				const isLangSupported = loadedLangs.includes(resolvedLanguage);
				const finalLanguage = isLangSupported ? resolvedLanguage : 'txt';

				if (!isLangSupported && codeBlock.language !== 'plaintext' && codeBlock.language !== 'txt') {
					logger.warn(`Language "${codeBlock.language}" is not supported by the essential shiki bundle. Falling back to plaintext.`);
				}

				for (let styleVariantIndex = 0; styleVariantIndex < styleVariants.length; styleVariantIndex++) {
					const theme = styleVariants[styleVariantIndex].theme;

					let themeName = theme.name;
					if (!highlighter.getLoadedThemes().includes(themeName)) {
						themeName = theme.type === 'light' ? 'one-light' : 'one-dark-pro';
					}

					try {
						const tokenLines: ThemedToken[][] = highlighter.codeToTokensBase(code, {
							lang: finalLanguage,
							theme: themeName,
							includeExplanation: false,
						});

						tokenLines.forEach((line: ThemedToken[], lineIndex: number) => {
							let charIndex = 0;
							line.forEach((token: ThemedToken) => {
								const tokenLength = token.content.length;
								const tokenEndIndex = charIndex + tokenLength;
								const fontStyle = token.fontStyle || 0;
								codeLines[lineIndex]?.addAnnotation(
									new InlineStyleAnnotation({
										styleVariantIndex,
										color: token.color || theme.fg,
										bgColor: token.bgColor,
										italic: (fontStyle & 1) === 1,
										bold: (fontStyle & 2) === 2,
										underline: (fontStyle & 4) === 4,
										strikethrough: (fontStyle & 8) === 8,
										inlineRange: {
											columnStart: charIndex,
											columnEnd: tokenEndIndex,
										},
										renderPhase: 'earliest',
									}),
								);
								charIndex = tokenEndIndex;
							});
						});
					} catch (err) {
						const error = err instanceof Error ? err : new Error(String(err));
						throw new Error(
							`Failed to highlight code block with language "${codeBlock.language}" and theme "${theme.name}". Received error: "${error.message}"`,
							{
								cause: error,
							},
						);
					}
				}
			},
		},
	});
}
