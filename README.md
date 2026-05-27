# Shiki Highlighter

[Shiki Highlighter](https://github.com/mProjectsCode/obsidian-shiki-plugin)을 기반으로 한국어 환경 최적화 및 성능 개선에 초점을 두고 수정된 플러그인입니다.

## Build
```zsh
pnpm install --frozen-lockfile
pnpm run build
```

## Note
- 성능 최적화를 위해 `one dark pro` 및 `one light` 테마만 포함하고 있습니다. 다른 테마를 사용하고 싶다면 [ThemeRegistry.ts](./packages/obsidian/src/themes/ThemeRegistry.ts) 파일을 수정해주세요.
- 성능 최적화를 위해 일부 언어만 번들링하고 있습니다. 언어를 추가하고 싶다면 [LanguageRegistry.ts](./packages/ec-core/src/LanguageRegistry.ts) 파일을 수정해주세요.

## Licenses
- [Shiki Highlighter](https://github.com/mProjectsCode/obsidian-shiki-plugin)은 [MIT License](https://github.com/mProjectsCode/obsidian-shiki-plugin/blob/master/LICENSE)로 라이선스가 부여됩니다.
- [Shiki Highlighter](https://github.com/mProjectsCode/obsidian-shiki-plugin)에서 수정된 부분은 [MIT License](./LICENSE)로 라이선스가 부여됩니다.