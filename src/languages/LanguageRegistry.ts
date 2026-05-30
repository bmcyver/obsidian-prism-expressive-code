// some languages break obsidian's `registerMarkdownCodeBlockProcessor`, so we blacklist them
export const LANGUAGE_BLACKLIST = new Set(['c++', 'c#', 'f#', 'mermaid']);

// some languages are considered special
export const LANGUAGE_SPECIAL = new Set(['plaintext', 'txt', 'text', 'plain', 'ansi']);
