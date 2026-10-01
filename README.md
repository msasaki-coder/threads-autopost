# threads-autopost

Threads（@masato_eishin）へ、転職・面接ノウハウのカルーセル投稿（4枚組）を1日4本自動投稿する。

| 役割 | 仕組み |
|---|---|
| 投稿（JST 8:00／12:00／17:00／20:00） | GitHub Actions `.github/workflows/post.yml` → `scripts/post.mjs` |
| トークン延長（毎週月曜） | GitHub Actions `.github/workflows/refresh-token.yml` |
| 原稿の補充（毎週） | Claude のクラウド定期実行（ルーティン）が `GENERATE.md` に従って追加 |

- 原稿：`data/posts.json`（上から順に投稿）
- 投稿済み記録：`data/posted.json`
- 画像：`posts/<id>/1〜4.png`（1080×1350）。Threads API は画像の公開URLが必要なため、このリポジトリは public
- 画像の描画：`node scripts/render.mjs`（`--force` で全再描画）
- 投稿内容の確認：`node scripts/post.mjs --dry-run`

## Secrets

| 名前 | 内容 |
|---|---|
| `THREADS_ACCESS_TOKEN` | Threads の長期アクセストークン（60日。毎週自動延長） |
| `THREADS_USER_ID` | Threads のユーザーID |
| `GH_PAT` | このリポジトリの Secrets を書き換えられる fine-grained token（トークン自動延長用） |

## 止めたいとき

GitHub の Actions タブで「Threads 定時投稿」を Disable workflow にする。
