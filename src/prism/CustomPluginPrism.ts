import { InlineStyleAnnotation, definePlugin, type ExpressiveCodePlugin } from '@expressive-code/core';

import { flattenTokens, getStyleForPrismTypes, LANGUAGE_ALIASES, splitTokensIntoLines, FontStyle, type FlatToken } from './PrismUtils';
import type * as Prism from 'prismjs';
export function customPluginPrism(): ExpressiveCodePlugin {

	return definePlugin({
		name: 'Prism',
		hooks: {
			performSyntaxAnalysis: async ({ codeBlock, styleVariants }) => {
				const codeLines = codeBlock.getLines();
				const code = codeBlock.code;

				let prism: typeof Prism | undefined;
				try {
					prism = (window as unknown as { Prism: typeof Prism }).Prism;
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					throw new Error(`Failed to load shared Prism syntax highlighter: "${error.message}"`, {
						cause: error,
					});
				}

				if (!prism) {
					return;
				}

				const rawLanguage = codeBlock.language;
				let lowerLang = rawLanguage.toLowerCase();
				lowerLang = LANGUAGE_ALIASES[lowerLang] ?? lowerLang;
				const grammar = prism.languages[lowerLang];

				const finalGrammar = grammar ?? prism.languages.plaintext ?? prism.languages.text;
				const prismTokens = prism.tokenize(code, finalGrammar);
				const flatTokens = flattenTokens(prismTokens);
				
				// Split flat tokens into lines once (outside of theme variants loop)
				const lines = splitTokensIntoLines(flatTokens);

				for (let styleVariantIndex = 0; styleVariantIndex < styleVariants.length; styleVariantIndex++) {
					const theme = styleVariants[styleVariantIndex].theme;

					// Annotate each line
					lines.forEach((line: FlatToken[], lineIndex: number) => {
						let charIndex = 0;
						line.forEach((token: FlatToken) => {
							const tokenLength = token.content.length;
							const tokenEndIndex = charIndex + tokenLength;
							const style = getStyleForPrismTypes(theme, token.types, token.typeKey, lowerLang);

							const fs = style.fontStyle ?? FontStyle.None;

							codeLines[lineIndex]?.addAnnotation(
								new InlineStyleAnnotation({
									styleVariantIndex,
									color: style.color ?? theme.fg,
									italic: (fs & FontStyle.Italic) !== 0,
									bold: (fs & FontStyle.Bold) !== 0,
									underline: (fs & FontStyle.Underline) !== 0,
									strikethrough: (fs & FontStyle.Strikethrough) !== 0,
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
				}
			},
		},
	});
}
