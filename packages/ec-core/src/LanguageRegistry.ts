export interface LanguageDefinition {
	id: string;
	import: () => Promise<any>;
	aliases: string[];
}

export const LANGUAGES: LanguageDefinition[] = [
	{ id: 'diff', import: () => import('shiki/langs/diff.mjs'), aliases: [] },
	{ id: 'html', import: () => import('shiki/langs/html.mjs'), aliases: [] },
	{ id: 'css', import: () => import('shiki/langs/css.mjs'), aliases: [] },
	{ id: 'javascript', import: () => import('shiki/langs/javascript.mjs'), aliases: ['js'] },
	{ id: 'typescript', import: () => import('shiki/langs/typescript.mjs'), aliases: ['ts'] },
	{ id: 'jsx', import: () => import('shiki/langs/jsx.mjs'), aliases: [] },
	{ id: 'tsx', import: () => import('shiki/langs/tsx.mjs'), aliases: [] },
	{ id: 'python', import: () => import('shiki/langs/python.mjs'), aliases: ['py'] },
	{ id: 'rust', import: () => import('shiki/langs/rust.mjs'), aliases: ['rs'] },
	{ id: 'go', import: () => import('shiki/langs/go.mjs'), aliases: [] },
	{ id: 'c', import: () => import('shiki/langs/c.mjs'), aliases: [] },
	{ id: 'cpp', import: () => import('shiki/langs/cpp.mjs'), aliases: ['c++', 'cc'] },
	{ id: 'csharp', import: () => import('shiki/langs/csharp.mjs'), aliases: ['c#', 'cs'] },
	{ id: 'java', import: () => import('shiki/langs/java.mjs'), aliases: [] },
	{ id: 'kotlin', import: () => import('shiki/langs/kotlin.mjs'), aliases: ['kt', 'kts'] },
	{ id: 'swift', import: () => import('shiki/langs/swift.mjs'), aliases: [] },
	{ id: 'ruby', import: () => import('shiki/langs/ruby.mjs'), aliases: ['rb'] },
	{ id: 'php', import: () => import('shiki/langs/php.mjs'), aliases: [] },
	{ id: 'bash', import: () => import('shiki/langs/bash.mjs'), aliases: ['sh', 'shell', 'zsh'] },
	{ id: 'powershell', import: () => import('shiki/langs/powershell.mjs'), aliases: ['ps', 'ps1'] },
	{ id: 'json', import: () => import('shiki/langs/json.mjs'), aliases: [] },
	{ id: 'yaml', import: () => import('shiki/langs/yaml.mjs'), aliases: ['yml'] },
	{ id: 'toml', import: () => import('shiki/langs/toml.mjs'), aliases: [] },
	{ id: 'xml', import: () => import('shiki/langs/xml.mjs'), aliases: [] },
	{ id: 'sql', import: () => import('shiki/langs/sql.mjs'), aliases: [] },
	{ id: 'solidity', import: () => import('shiki/langs/solidity.mjs'), aliases: ['sol'] },
	{ id: 'markdown', import: () => import('shiki/langs/markdown.mjs'), aliases: ['md'] },
];

export const ESSENTIAL_LANGUAGES: Record<string, () => Promise<any>> = {};
export const ALIAS_TO_LANG: Record<string, string> = {};
export const ALL_ALIASES: string[] = [];

for (const lang of LANGUAGES) {
	ESSENTIAL_LANGUAGES[lang.id] = lang.import;
	for (const alias of lang.aliases) {
		ALIAS_TO_LANG[alias] = lang.id;
		ALL_ALIASES.push(alias);
	}
}
