# threads-autopost

Threads（@masato_eishin）向けの転職・面接ノウハウのカルーセル投稿（4枚組）を、1日4本分 Slack DM に届ける。投稿は本人が手動で行う。

現在の運用は **Slack送信**（`slack.yml`）。Threads API での自動投稿（`post.yml`）は無効化中。

| 役割 | 仕組み |
|---|---|
| Slack送信（JST 7:50／11:50／16:50／19:50） | GitHub Actions `.github/workflows/slack.yml` → `scripts/send-slack.mjs` |
| （無効）Threads自動投稿 | GitHub Actions `.github/workflows/post.yml` → `scripts/post.mjs` |
| トークン延長（毎週月曜） | GitHub Actions `.github/workflows/refresh-token.yml` |
| 原稿の補充（毎週） | Claude のクラウド定期実行（ルーティン）が `GENERATE.md` に従って追加 |

- 原稿：`data/posts.json`（上から順に投稿）
- 送信済み記録：`data/sent.json`（手動予約済みの分は `sentAt: "manual"`）
- 送信開始日時：`data/config.json` の `startAt` より前は送らない
- 画像：`posts/<id>/1〜4.png`（1080×1350）。Threads API は画像の公開URLが必要なため、このリポジトリは public
- 画像の描画：`node scripts/render.mjs`（`--force` で全再描画）
- 投稿内容の確認：`node scripts/post.mjs --dry-run`

## Secrets

| 名前 | 内容 |
|---|---|
| `SLACK_BOT_TOKEN` | Slack ボットトークン（xoxb-） |
| `SLACK_USER_ID` | 送信先の Slack ユーザーID |
| `THREADS_ACCESS_TOKEN` | Threads の長期アクセストークン（60日。毎週自動延長） |
| `THREADS_USER_ID` | Threads のユーザーID |
| `GH_PAT` | このリポジトリの Secrets を書き換えられる fine-grained token（トークン自動延長用） |

## 止めたいとき

GitHub の Actions タブで「Slack 投稿素材の送信」を Disable workflow にする。
