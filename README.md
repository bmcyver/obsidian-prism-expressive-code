# Obsidian Prismjs Expressive Code Highlighter

> [!WARNING]
> 이 플러그인은 AI 주도로 개발되었기 때문에 사용시 주의가 필요합니다.
>
> 번들 크기를 줄이기 위해 `one dark pro` 및 `one light` 테마만 포함하고 있습니다.
> 다른 테마를 사용하고 싶다면, [src/themes/definitions.ts](./src/themes/definitions.ts) 파일을 수정해주세요.


[Shiki Highlighter](https://github.com/mProjectsCode/obsidian-shiki-plugin)을 포크하여 `shikijs`가 아닌 `prismjs`에서 동작하도록 수정된 플러그인입니다.
또한, IME 및 렌더링 최적화를 통해 UI가 프리징 하는 현상들을 해결하였습니다.

## How to install

### 1. Github Releases

[Github Releases](https://github.com/bmcyver/obsidian-all-in-one-toolkit/releases/latest) 에서 `main.js`, `manifest.json`, `styles.css`를 다운로드 받고 `.obsidian/plugins/obsidian-prism-expressive-code`에 저장합니다.

### 2. Build from source

```bash
git clone https://github.com/bmcyver/obsidian-prism-expressive-code.git && cd obsidian-prism-expressive-code
pnpm install --frozen-lockfile
pnpm --filter=@expressive-code/core run build
pnpm run build
```

를 실행한 뒤 `dist`의 `main.js`, `manifest.json`, `styles.css`를 `.obsidian/plugins/obsidian-prism-expressive-code`에 저장합니다.


## Licenses
- [Shiki Highlighter](https://github.com/mProjectsCode/obsidian-shiki-plugin) 원본 코드는 [MIT License](https://github.com/mProjectsCode/obsidian-shiki-plugin/blob/master/LICENSE)를 따릅니다.
- 본 저장소에서 새로 작성 또는 수정된 코드는 [MIT License](./LICENSE)가 부여됩니다.