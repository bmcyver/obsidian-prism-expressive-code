export const LANGUAGE_ALIASES: Record<string, string> = {
	zsh: 'bash',
};

// A mapping from Prism token types to TextMate scopes for theme matching
export const PRISM_TO_SCOPE_MAP: Record<string, string[]> = {
	// Standard core tokens
	comment: ['comment'],
	prolog: ['comment'],
	doctype: ['comment'],
	cdata: ['comment'],
	punctuation: ['punctuation', 'meta.brace'],
	property: ['support.type.property-name', 'variable.other.property', 'support.type.property-name.css'],
	tag: ['entity.name.tag'],
	boolean: ['constant.language.boolean'],
	number: ['constant.numeric'],
	constant: ['constant'],
	symbol: ['constant.other.symbol'],
	deleted: ['markup.deleted'],
	selector: ['meta.selector'],
	'attr-name': ['entity.other.attribute-name'],
	string: ['string'],
	char: ['string.char'],
	builtin: ['support.type', 'support.class', 'support.function'],
	inserted: ['markup.inserted'],
	operator: ['keyword.operator'],
	entity: ['entity.name', 'constant.character.entity'],
	url: ['markup.underline.link'],
	variable: ['variable'],
	keyword: ['keyword', 'storage.type'],
	'class-name': ['entity.name.type.class', 'support.class'],
	function: ['entity.name.function', 'support.function'],
	regex: ['string.regexp'],
	important: ['invalid'],
	bold: ['strong'],
	italic: ['emphasis'],

	// HTML / XML / Markup specific
	'attr-value': ['string'],
	'special-attr': ['entity.other.attribute-name'],
	'tag-id': ['entity.name.tag'],

	// CSS / SCSS / LESS specific
	value: ['support.constant.property-value'],
	unit: ['keyword.other.unit'],
	id: ['entity.other.attribute-name.id'],
	class: ['entity.other.attribute-name.class'],
	pseudo_element: ['entity.other.attribute-name.pseudo-element'],
	pseudo_class: ['entity.other.attribute-name.pseudo-class'],
	color: ['constant.other.color'],

	// C / C++ / Objective-C specific
	macro: ['entity.name.function.macro', 'support.function.macro', 'entity.name.function'],
	directive: ['keyword.control.directive', 'keyword.control', 'keyword'],
	'directive-hash': ['punctuation.definition.directive', 'punctuation'],
	'double-colon': ['punctuation.accessor', 'punctuation'],
	namespace: ['entity.name.namespace', 'support.other.namespace'],
	type: ['entity.name.type', 'support.type', 'storage.type'],

	// Rust specific
	lifetime: ['entity.name.type.lifetime', 'storage.modifier.lifetime'],
	attribute: ['meta.attribute', 'entity.name.type.class'],
	generics: ['entity.name.type'],

	// Python specific
	decorator: ['meta.function.decorator', 'entity.name.function.decorator'],
	'built-in': ['support.function', 'support.type'],

	// JSON / YAML / TOML data formats
	key: ['support.type.property-name', 'variable.other.property', 'entity.name.tag'],
	atrule: ['keyword.control', 'keyword'],

	// Markdown specific
	title: ['entity.name.section', 'markup.heading'],
	code: ['markup.inline.raw'],
	blockquote: ['markup.quote'],
	list: ['markup.list'],
	link: ['string.other.link'],

	// Shell / Bash specific
	command: ['entity.name.function', 'support.function'],
	environment: ['variable.other.constant'],
	file: ['string'],

	// SQL specific
	'data-type': ['support.type', 'storage.type'],
};

export function getColorForScopes(theme: any, scopes: string[]): { color?: string; fontStyle?: string } | undefined {
	if (!theme) return undefined;
	const settings = theme.settings || theme.tokenColors;
	if (!settings) return undefined;

	let bestMatch: { color?: string; fontStyle?: string } | undefined = undefined;
	let bestScore = -1;

	for (const rule of settings) {
		if (!rule.scope || !rule.settings) continue;
		const ruleScopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
		for (const ruleScope of ruleScopes) {
			for (const targetScope of scopes) {
				if (targetScope === ruleScope) {
					// Exact match: highest score
					const score = ruleScope.length * 2 + 10;
					if (score > bestScore) {
						bestScore = score;
						bestMatch = {
							color: rule.settings.foreground,
							fontStyle: rule.settings.fontStyle,
						};
					}
				} else if (targetScope.startsWith(ruleScope + '.')) {
					// Target (e.g. comment.line) is more specific than rule (e.g. comment)
					const score = ruleScope.length * 2;
					if (score > bestScore) {
						bestScore = score;
						bestMatch = {
							color: rule.settings.foreground,
							fontStyle: rule.settings.fontStyle,
						};
					}
				} else if (ruleScope.startsWith(targetScope + '.')) {
					// Rule (e.g. comment.line) is more specific than target (e.g. comment)
					// This allows generic Prism tokens to match specific theme rules
					const score = targetScope.length * 2 - 1;
					if (score > bestScore) {
						bestScore = score;
						bestMatch = {
							color: rule.settings.foreground,
							fontStyle: rule.settings.fontStyle,
						};
					}
				}
			}
		}
	}
	return bestMatch;
}

export function getScopesForPrismType(type: string): string[] {
	if (PRISM_TO_SCOPE_MAP[type]) {
		return PRISM_TO_SCOPE_MAP[type];
	}

	const lower = type.toLowerCase();
	if (lower.includes('comment') || lower.includes('prolog') || lower.includes('doctype') || lower.includes('cdata')) {
		return ['comment'];
	}
	if (lower.includes('string') || lower.includes('char') || lower.includes('value') || lower.includes('literal') || lower.includes('url')) {
		return ['string'];
	}
	if (
		lower.includes('keyword') ||
		lower.includes('control') ||
		lower.includes('statement') ||
		lower.includes('operator') ||
		lower.includes('atrule') ||
		lower.includes('directive') ||
		lower.includes('modifier') ||
		lower.includes('specifier') ||
		lower.includes('op-code') ||
		lower.includes('instruction')
	) {
		return ['keyword'];
	}
	if (
		lower.includes('number') ||
		lower.includes('digit') ||
		lower.includes('boolean') ||
		lower.includes('null') ||
		lower.includes('constant') ||
		lower.includes('symbol') ||
		lower.includes('float') ||
		lower.includes('int')
	) {
		return ['constant'];
	}
	if (
		lower.includes('func') ||
		lower.includes('method') ||
		lower.includes('macro') ||
		lower.includes('proc') ||
		lower.includes('handler') ||
		lower.includes('call') ||
		lower.includes('command')
	) {
		return ['entity.name.function'];
	}
	if (
		lower.includes('class') ||
		lower.includes('type') ||
		lower.includes('struct') ||
		lower.includes('enum') ||
		lower.includes('interface') ||
		lower.includes('model') ||
		lower.includes('namespace') ||
		lower.includes('module')
	) {
		return ['entity.name.type'];
	}
	if (
		lower.includes('var') ||
		lower.includes('prop') ||
		lower.includes('attr') ||
		lower.includes('param') ||
		lower.includes('arg') ||
		lower.includes('field') ||
		lower.includes('key') ||
		lower.includes('property') ||
		lower.includes('identifier') ||
		lower.includes('label')
	) {
		return ['variable'];
	}
	if (
		lower.includes('punctuation') ||
		lower.includes('bracket') ||
		lower.includes('brace') ||
		lower.includes('paren') ||
		lower.includes('delimiter') ||
		lower.includes('comma') ||
		lower.includes('colon') ||
		lower.includes('semi') ||
		lower.includes('accessor') ||
		lower.includes('dot')
	) {
		return ['punctuation'];
	}

	return [type];
}

const styleCache = new Map<string, { color?: string; fontStyle?: number }>();

export function getStyleForPrismTypes(theme: any, types: string[], typeKey: string, lang?: string): { color?: string; fontStyle?: number } {
	const cacheKey = `${theme.name || theme.type || ''}:${typeKey}:${lang || ''}`;
	const cached = styleCache.get(cacheKey);
	if (cached) return cached;

	let color: string | undefined = undefined;
	let fontStyleNum = 0;
	let hasColor = false;
	let hasFontStyle = false;

	const lowerLang = lang?.toLowerCase();

	// Iterate from right to left (most specific/leaf type to least specific/parent type)
	for (let i = types.length - 1; i >= 0; i--) {
		const type = types[i];
		const mappedScopes = getScopesForPrismType(type);

		const scopesWithLang: string[] = [];
		if (lowerLang) {
			for (const scope of mappedScopes) {
				scopesWithLang.push(`${scope}.${lowerLang}`);
			}
		}
		const targetScopes = [...scopesWithLang, ...mappedScopes];

		const style = getColorForScopes(theme, targetScopes);
		if (style) {
			if (!hasColor && style.color) {
				color = style.color;
				hasColor = true;
			}
			if (!hasFontStyle && style.fontStyle) {
				const fs = style.fontStyle.toLowerCase();
				if (fs.includes('italic')) fontStyleNum |= 1;
				if (fs.includes('bold')) fontStyleNum |= 2;
				if (fs.includes('underline')) fontStyleNum |= 4;
				if (fs.includes('strikethrough')) fontStyleNum |= 8;
				hasFontStyle = true;
			}
			if (hasColor && hasFontStyle) {
				break;
			}
		}
	}

	const result = {
		color,
		fontStyle: fontStyleNum,
	};
	styleCache.set(cacheKey, result);
	return result;
}

export interface FlatToken {
	content: string;
	types: string[];
	typeKey: string;
}

export function flattenTokens(tokens: any[], parentTypes: string[] = [], result: FlatToken[] = []): FlatToken[] {
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (typeof token === 'string') {
			result.push({
				content: token,
				types: parentTypes,
				typeKey: parentTypes.join(','),
			});
		} else {
			// To ensure actual type overrides aliases (fallbacks), place aliases before the actual type.
			// Priority: parent types -> aliases -> actual type (most specific, checked first in reverse search)
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
