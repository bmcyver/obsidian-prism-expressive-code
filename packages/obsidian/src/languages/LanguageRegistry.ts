import { ESSENTIAL_LANGUAGES, ALL_ALIASES } from 'packages/ec-core/src/LanguageRegistry';

// some languages break obsidian's `registerMarkdownCodeBlockProcessor`, so we blacklist them
export const LANGUAGE_BLACKLIST = new Set(['c++', 'c#', 'f#', 'mermaid']);

// some languages are considered "special" by shiki.isSpecialLang
export const LANGUAGE_SPECIAL = new Set(['plaintext', 'txt', 'text', 'plain', 'ansi']);

export const SUPPORTED_LANGUAGES = [
	...Object.keys(ESSENTIAL_LANGUAGES),
	...ALL_ALIASES,
	...LANGUAGE_SPECIAL,
];

export function getObsidianSafeLanguages(): string[] {
	return SUPPORTED_LANGUAGES.filter(lang => !LANGUAGE_BLACKLIST.has(lang));
}
