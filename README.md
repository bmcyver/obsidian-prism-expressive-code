# Obsidian PrismJS Expressive Code Highlighter

> [!WARNING]
> 이 플러그인은 AI 주도로 개발되었기 때문에 사용 시 주의가 필요합니다.
>
> 번들 크기를 줄이기 위해 `One Dark Pro` 및 `One Light` 테마만 기본 포함하고 있습니다.
> 다른 테마를 사용하고 싶다면, [src/config.ts](./src/config.ts) 파일을 수정해 주세요.

[Shiki Highlighter](https://github.com/mProjectsCode/obsidian-shiki-plugin)를 포크하여 `shikijs` 대신 `prismjs` 기반으로 동작하도록 커스텀 제작된 Obsidian 플러그인입니다.

## 스크린샷

<table>
  <tr>
    <td><img src="./assets/l_1.png" width="100%"></td>
    <td><img src="./assets/l_2.png" width="100%"></td>
  </tr>
  <tr>
    <td><img src="./assets/d_1.png" width="100%"></td>
    <td><img src="./assets/d_2.png" width="100%"></td>
  </tr>
</table>

## 설치 방법

### 1. GitHub Releases를 통한 설치

[GitHub Releases](https://github.com/bmcyver/obsidian-prism-expressive-code/releases/latest) 페이지에서 `main.js`, `manifest.json`, `styles.css` 파일을 다운로드하여 Obsidian 보관소(Vault)의 `.obsidian/plugins/obsidian-prism-expressive-code/` 디렉토리에 저장합니다.

### 2. 소스코드 직접 빌드

```bash
git clone https://github.com/bmcyver/obsidian-prism-expressive-code.git && cd obsidian-prism-expressive-code
pnpm install --frozen-lockfile
pnpm --filter=@expressive-code/core run build
pnpm run build
```

빌드가 완료되면 `dist/` 폴더 내의 `main.js`, `manifest.json`, `styles.css` 파일을 `.obsidian/plugins/obsidian-prism-expressive-code/` 폴더에 복사합니다.

## 라이선스 (Licenses)

- [Shiki Highlighter](https://github.com/mProjectsCode/obsidian-shiki-plugin) 원본 코드는 [MIT License](https://github.com/mProjectsCode/obsidian-shiki-plugin/blob/master/LICENSE)를 따릅니다.
- 본 저장소에서 새로 작성되거나 수정된 코드는 [MIT License](./LICENSE)가 부여됩니다.