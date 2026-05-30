# Obsidian Prismjs Expressive Code Highlighter

[Shiki Highlighter](https://github.com/mProjectsCode/obsidian-shiki-plugin)을 기반으로 하는 플러그인으로, Shikijs 대신 옵시디언에 내장된 Prismjs 하이라이터를 활용하여 코드 블록을 렌더링합니다. 또한, Shikijs의 테마 시스템을 사용하여 다양한 테마를 지원합니다.

## Build
```zsh
pnpm install
pnpm run build
```

## Note
- 번들 크기를 줄이기 위해 `one dark pro` 및 `one light` 테마만 기본 포함하고 있습니다. 추가 테마를 원하실 경우 [ThemeRegistry.ts](./src/themes/ThemeRegistry.ts) 파일을 수정해주세요.
- 실제 코드 하이라이팅은 `shiki` 원본과 약간의 차이가 있을 수 있습니다.
- 번들 사이즈는 약 500kB 이하로 가볍게 유지됩니다.

## Licenses
- [Shiki Highlighter](https://github.com/mProjectsCode/obsidian-shiki-plugin) 원본 코드는 [MIT License](https://github.com/mProjectsCode/obsidian-shiki-plugin/blob/master/LICENSE)를 따릅니다.
- 본 저장소에서 수정 및 재작성된 코드는 [MIT License](./LICENSE)가 부여됩니다.