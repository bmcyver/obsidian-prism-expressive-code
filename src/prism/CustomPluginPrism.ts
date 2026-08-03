import {
  ExpressiveCodeAnnotation,
  definePlugin,
  type ExpressiveCodePlugin,
  type AnnotationRenderOptions,
  type ExpressiveCodeInlineRange,
} from '@expressive-code/core';
import { h } from '@expressive-code/core/hast';

import { flattenTokens, splitTokensIntoLines } from './tokenizer';
import { LANGUAGE_ALIASES } from '../config';
import { getPrism } from './prismUtils';
import type * as Prism from 'prismjs';

export class PrismClassAnnotation extends ExpressiveCodeAnnotation {
  tokenClasses: string[];

  constructor({
    types,
    inlineRange,
  }: {
    types: string[];
    inlineRange: ExpressiveCodeInlineRange;
  }) {
    super({ inlineRange, renderPhase: 'earliest' });
    this.tokenClasses = ['token', ...types];
  }

  render({ nodesToTransform }: AnnotationRenderOptions) {
    const className = this.tokenClasses.join(' ');
    return nodesToTransform.map((node) =>
      h('span', { class: className }, node),
    );
  }
}

export function customPluginPrism(): ExpressiveCodePlugin {
  return definePlugin({
    name: 'Prism',
    hooks: {
      performSyntaxAnalysis: async ({ codeBlock }) => {
        const codeLines = codeBlock.getLines();
        const code = codeBlock.code;

        let prism: typeof Prism | undefined;
        try {
          prism = getPrism();
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          throw new Error(
            `Failed to load shared Prism syntax highlighter: "${error.message}"`,
            {
              cause: err,
            },
          );
        }

        if (!prism || !prism.languages) {
          return;
        }

        const rawLanguage = codeBlock.language;
        let lowerLang = rawLanguage.toLowerCase();
        lowerLang = LANGUAGE_ALIASES[lowerLang] ?? lowerLang;
        const grammar = prism.languages[lowerLang];

        const finalGrammar =
          grammar ?? prism.languages.plaintext ?? prism.languages.text;
        if (!finalGrammar) return;
        const prismTokens = prism.tokenize(code, finalGrammar);
        const flatTokens = flattenTokens(prismTokens);

        const lines = splitTokensIntoLines(flatTokens);

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];
          if (!line) continue;

          let charIndex = 0;
          for (const token of line) {
            const tokenLength = token.content.length;
            const tokenEndIndex = charIndex + tokenLength;

            if (token.types.length > 0) {
              codeLines[lineIndex]?.addAnnotation(
                new PrismClassAnnotation({
                  types: token.types,
                  inlineRange: {
                    columnStart: charIndex,
                    columnEnd: tokenEndIndex,
                  },
                }),
              );
            }

            charIndex = tokenEndIndex;
          }
        }
      },
    },
  });
}
