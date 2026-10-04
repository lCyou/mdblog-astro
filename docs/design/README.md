# デザイン（案B「man ページ」）

ブログのリデザインで作ったデザインファイルです。キャンバスの元データ:
https://claude.ai/artifact/SWRwx16uNEjiNGDGv65dvK

| ファイル | 内容 |
|---|---|
| `Home` / `Blog` / `About` / `Post` | デスクトップ版（幅 1440px） |
| `M*` | スマホ版（幅 390px） |
| `*Dark` | ダーク版（ライト版を `theme="dark"` で読み込んだもの） |
| `canvas.json` | キャンバス上の配置 |

`.dc.html` はキャンバスエディタ用の形式なので、ブラウザで直接開いても崩れます。
見た目はキャンバスで確認してください。

## 実装との対応

| デザイン | 実装 |
|---|---|
| 色・フォント | `src/styles/global.css`（`:root` がライト、`html.dark` がダーク） |
| ヘッダー（man ページ風の1行 + ナビ） | `src/components/Header.astro` |
| ステータスライン（デスクトップのみ） | `src/components/StatusLine.astro` |
| フッター | `src/components/Footer.astro` |
| Home の ASCII アート | `src/components/AsciiGreeting.astro`（時間帯で DAWN / NOON / DUSK / VOID） |
| 記事一覧（月ごと） | `src/components/PostList.astro` |
| 記事ページ | `src/layouts/MarkdownPostLayout.astro` |

## 色トークン

| トークン | ライト | ダーク |
|---|---|---|
| `--bg` | `#f7f2e2` | `#1c1b18` |
| `--card` | `#fbf8ee` | `#24231f` |
| `--text` | `#2f2d28` | `#e8e2cc` |
| `--body` | `#46443c` | `#cfc8b0` |
| `--muted` | `#6b685d` | `#9c967f` |
| `--rule` | `#ddd5bb` | `#3a3830` |
| `--accent` | `#a8452f` | `#e8916f` |

フォントは英数字が IBM Plex Mono、日本語が M PLUS 1 Code（どちらも Google Fonts）。
