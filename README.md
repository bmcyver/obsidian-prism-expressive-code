# Obsidian Prismjs Expressive Code Highlighter

[Shiki Highlighter](https://github.com/mProjectsCode/obsidian-shiki-plugin)을 참고하여 Obsidian에서 Prismjs를 활용한 코드 하이라이팅을 제공하는 플러그인입니다.

## Build
```zsh
pnpm install
pnpm run build
```

## Note
- 번들 크기를 줄이기 위해 `one dark pro` 및 `one light` 테마만 기본 포함하고 있습니다. 추가 테마를 원하실 경우 [ThemeManager.ts](./src/themes/ThemeManager.ts) 파일을 수정해주세요.
- 번들 사이즈는 약 300kB 이하로 가볍게 유지됩니다.


## Licenses
- [Shiki Highlighter](https://github.com/mProjectsCode/obsidian-shiki-plugin) 원본 코드는 [MIT License](https://github.com/mProjectsCode/obsidian-shiki-plugin/blob/master/LICENSE)를 따릅니다.
- 본 저장소에서 수정 및 재작성된 코드는 [MIT License](./LICENSE)가 부여됩니다.