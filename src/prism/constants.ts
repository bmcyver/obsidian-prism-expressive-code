export const LANGUAGE_BLACKLIST = new Set(['c++', 'c#', 'f#', 'mermaid']);

export const LANGUAGE_SPECIAL = new Set([
  'plaintext',
  'txt',
  'text',
  'plain',
  'ansi',
]);

export const LANGUAGE_ALIASES: Record<string, string> = {
  zsh: 'bash',
  asm: 'nasm',
};
