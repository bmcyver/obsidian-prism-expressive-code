import { InlineStyleAnnotation, definePlugin, type ExpressiveCodePlugin } from '@expressive-code/core';

import { flattenTokens, getStyleForPrismTypes, type FlatToken } from './PrismUtils';

export function customPluginPrism(options: { getPrism: () => any }): ExpressiveCodePlugin {
	const { getPrism } = options;

	return definePlugin({
		name: 'Prism',
		hooks: {
			performSyntaxAnalysis: async ({ codeBlock, styleVariants, config: { logger } }) => {
				const codeLines = codeBlock.getLines();
				const code = codeBlock.code;

				let prism: any;
				try {
					prism = getPrism();
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
				const lowerLang = rawLanguage.toLowerCase();
				const grammar = prism.languages[lowerLang];

				const finalGrammar = grammar || prism.languages.plaintext || prism.languages.text;
				const prismTokens = prism.tokenize(code, finalGrammar);
				const flatTokens = flattenTokens(prismTokens);
				const lines: FlatToken[][] = [[]];

				// Split flat tokens into lines once (outside of theme variants loop)
				for (let t = 0; t < flatTokens.length; t++) {
					const token = flatTokens[t];
					const content = token.content;

					if (content.indexOf('\n') === -1) {
						if (content.length > 0) {
							lines[lines.length - 1].push({
								content,
								types: token.types,
								typeKey: token.typeKey,
							});
						}
					} else {
						const parts = content.split('\n');
						for (let i = 0; i < parts.length; i++) {
							if (i > 0) {
								lines.push([]);
							}
							if (parts[i].length > 0) {
								lines[lines.length - 1].push({
									content: parts[i],
									types: token.types,
									typeKey: token.typeKey,
								});
							}
						}
					}
				}

				for (let styleVariantIndex = 0; styleVariantIndex < styleVariants.length; styleVariantIndex++) {
					const theme = styleVariants[styleVariantIndex].theme;

					// Annotate each line
					lines.forEach((line: FlatToken[], lineIndex: number) => {
						let charIndex = 0;
						line.forEach((token: FlatToken) => {
							const tokenLength = token.content.length;
							const tokenEndIndex = charIndex + tokenLength;
							const style = getStyleForPrismTypes(theme, token.types, token.typeKey, lowerLang);

							codeLines[lineIndex]?.addAnnotation(
								new InlineStyleAnnotation({
									styleVariantIndex,
									color: style.color || theme.fg,
									italic: (style.fontStyle! & 1) === 1,
									bold: (style.fontStyle! & 2) === 2,
									underline: (style.fontStyle! & 4) === 4,
									strikethrough: (style.fontStyle! & 8) === 8,
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
