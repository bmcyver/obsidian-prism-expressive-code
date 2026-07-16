export interface FlatToken {
  content: string;
  types: string[];
  typeKey: string;
}

export interface PrismTokenLike {
  type: string;
  content: string | PrismTokenLike | (string | PrismTokenLike)[];
  alias?: string | string[];
}

export function flattenTokens(
  tokens: (string | PrismTokenLike)[],
  parentTypes: string[] = [],
  result: FlatToken[] = [],
): FlatToken[] {
  for (const token of tokens) {
    if (typeof token === 'string') {
      result.push({
        content: token,
        types: parentTypes,
        typeKey: parentTypes.join(','),
      });
    } else {
      const currentTypes = [...parentTypes];
      if (token.alias) {
        if (Array.isArray(token.alias)) {
          currentTypes.push(...token.alias);
        } else {
          currentTypes.push(token.alias);
        }
      }
      currentTypes.push(token.type);

      if (typeof token.content === 'string') {
        result.push({
          content: token.content,
          types: currentTypes,
          typeKey: currentTypes.join(','),
        });
      } else if (Array.isArray(token.content)) {
        flattenTokens(token.content, currentTypes, result);
      } else {
        flattenTokens([token.content], currentTypes, result);
      }
    }
  }
  return result;
}

export function splitTokensIntoLines(flatTokens: FlatToken[]): FlatToken[][] {
  const lines: FlatToken[][] = [[]];
  for (const token of flatTokens) {
    const content = token.content;

    if (!content.includes('\n')) {
      if (content.length > 0) {
        const lastLine = lines[lines.length - 1];
        if (lastLine) {
          lastLine.push(token);
        }
      }
    } else {
      const parts = content.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          lines.push([]);
        }
        const part = parts[i];
        if (part && part.length > 0) {
          const lastLine = lines[lines.length - 1];
          if (lastLine) {
            lastLine.push({
              ...token,
              content: part,
            });
          }
        }
      }
    }
  }
  return lines;
}
