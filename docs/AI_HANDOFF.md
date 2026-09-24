# 他のAI・開発者向け引き継ぎガイド

このリポジトリは、赤柴の「ちゃちゃまる」と好きな曲を叩いて遊ぶ、2色・1レーンのリズムゲームです。既に動くアプリがあり、GitHub Pagesで公開しています。改善するときは、現在の機能と保存済みデータを引き継いでください。

- 公開ゲーム: <https://kochamari.github.io/chachamaru-rhythm/>
- リポジトリ: <https://github.com/kochamari/chachamaru-rhythm>
- 現在の構成: 静的Webプレイヤー ＋ Macで動かすローカル譜面工房（Studio）。
- 公開版には自作の64秒デモ「ひまわり囃子」と3難易度を同梱。ユーザーの曲は手元のZIPを読み込む。
- このガイドの更新日: 2026-09-24。最新の差分はGit履歴、検証結果はGitHub Actionsも確認する。

## 最初に読むもの

1. [README](../README.md): 遊び方、起動、曲の移し方、開発コマンド。
2. [AGENTS.md](../AGENTS.md): 作業時のルール。
3. このガイド: 全体像と変更箇所の目安。
4. [docs/00_PRODUCT.md](00_PRODUCT.md) と [docs/05_ARCHITECTURE.md](05_ARCHITECTURE.md): 製品仕様と責務分担。
5. 変更対象の仕様・コード・テスト。[DECISIONS.md](DECISIONS.md) に実装上の理由、[PROGRESS.md](../PROGRESS.md) に変更の記録がある。

`SPEC.md` と `GOAL.txt` は初版の要求資料です。現在のユーザーの指示を優先し、過去の「公開前」「公開保留」などを現在の状態と取り違えないでください。既存の公開先は上記のGitHub Pagesです。ローカル専用の `DELIVERY.md` や `reports/` がcloneに無くても正常です。

## どんなアプリか

Home → 曲一覧 → 難易度・操作方法 → 演奏 → 結果 → 再挑戦、という流れです。音符は右から左へ流れ、左の判定位置で赤の「ドン」・青の「カッ」を叩きます。F/Jがドン、D/Kがカッ。タッチは4打面、MIDIはスネアとフロアタムをLearnで登録します。

大小の音符、黄色い連打、良・可・不可、コンボ、ゲージ、全良／フルコンボ、AUTO、練習、一時停止と再開、遅延設定、曲パック取込・書出し、設定と記録のバックアップがあります。途中の操作方式変更・AUTO・練習・配送遅延のある結果は通常ベストと分離します。

ちゃちゃまるは独自の赤柴キャラクター。ユーザーが選んだ**手描きアニメ調の顔、クリーム色の眉、緑の唐草スカーフ、ひまわり**を使います。左右の手は**順手**でバチを握ります。身体各部の動き、コンボのジャンプ、サビや結果の演出を維持してください。公式作品のキャラクター・ロゴ・音声を流用しません。

ユーザーが依頼していない対戦・ランキング・アカウント・クラウド同期・多レーン化は追加しないでください。名称は `web/src/app/brand.ts`、文言や画面の詳細は [UI仕様](01_UI_ART.md) を参照します。

## WebプレイヤーとStudioの違い

| 対象 | 実行場所 | 役割・データ |
| --- | --- | --- |
| Webプレイヤー | GitHub Pages／ローカルのブラウザ | 曲ZIPを読み込み、演奏する。曲・設定・結果をそのブラウザのIndexedDBに保存。ログイン不要 |
| Studio UI | `#/studio`（ローカル／公開版） | 波形・拍・譜面・サビ区間を編集。自動保存、undo/redo、ZIP書出し。公開版では既存ZIPを読み込んでブラウザ内で編集 |
| Studio API | Macのloopback FastAPI | 音源をAAC-LC化し、最終音源をlibrosaで解析、3難易度の下書きを作る |

GitHub Pagesは静的配信で、Python解析APIをホストしていません。公開サイトだけで元音源から解析できるとは案内しないでください。ローカルStudioで作ったZIPを自分の端末へ移し、公開プレイヤーへ取り込む構成です。公開版Studioでは既存ZIPの編集をブラウザ内に保存できます。自動生成譜面は編集前提の下書きで、原曲の演奏を完全に採譜したものではありません。

市販曲・私用音源・参考動画や画像・Studioプロジェクトは `_private/` に置き、Git・`web/public/`・`dist/`・外部AIサービスへ送信しません。公開配信は自作／公開用素材だけです。`assets/manifest.json` が素材の出所・SHA-256の許可リストで、`npm run audit:public` が配信物全体を検査します。新しい公開素材は出所とハッシュも追加してください。

## コードの案内

| 変更したいこと | 主なファイル |
| --- | --- |
| Home・曲一覧・結果・hash routing | `web/src/main.ts`, `web/src/styles.css` |
| 色・タイトル・共通UI | `web/src/app/brand.ts`, `web/src/app/ui.ts`, `web/src/app/store.ts` |
| 演奏の状態遷移・開始／停止／終了 | `web/src/game/Session.ts` |
| 判定・得点・コンボ・ゲージ | `web/src/game/Engine.ts`, `tests/unit/engine.test.ts`, [判定仕様](02_ENGINE.md) |
| 音源時計・補正・打音 | `web/src/audio/AudioEngine.ts`, `ClockBridge.ts`, `tests/unit/audio.test.ts` |
| キー・タッチ・MIDI入力 | `web/src/input/InputRouter.ts`, `web/src/screens/Settings.ts` |
| レーン・音符・演出 | `web/src/render/Renderer.ts`（PixiJS） |
| キャラクター・接続位置・アニメ | `web/src/render/Character.ts`, `character-rig.ts`, `character.css`（DOM SVG） |
| 曲ZIPの検証・取込 | `web/src/packs/`, `web/src/workers/zip.worker.ts`, [保存仕様](03_PACK_STORAGE.md) |
| ブラウザ保存・ベスト記録 | `web/src/storage/Database.ts`, `tests/unit/storage-editor.test.ts` |
| Studioの画面・編集履歴 | `web/src/screens/Studio.ts`, `web/src/studio/` |
| 解析・API・ZIP生成 | `studio/chacha_studio/`, `tests/python/`, [Studio仕様](04_STUDIO.md) |
| 型とファイル形式 | `contracts/public-types.ts`, `schemas/manifest.schema.json`, `schemas/chart.schema.json` |
| 公開・キャッシュ・CI | `web/vite.config.ts`, `scripts/service-worker.mjs`, `.github/workflows/` |

`Engine` はDOM・音声・描画を持たない純粋な判定層です。入力と音源時計を `Session` が結び、結果を `Renderer` とUIへ渡します。UIの修正のために判定処理を描画側へ移さないでください。

## 壊しやすい点

- 時刻は整数msを基本にし、AudioContextの秒とは明示変換する。rAFの積算を曲時計にしない。
- 良は±45ms、可は±90ms。80msの配送猶予は入力到着の救済で、判定窓を±170msにするものではない。既存テストを消したり数値を緩めて通さない。ルールを変える依頼があればrulesetと記録の互換性も扱う。
- 大音符は正しい色の1打で完了。1打でtapとrollの両方を加点しない。重複イベント、古いrun、遅延確定順は既存テストで保護している。
- ZIPは型／パス／サイズ／SHAを検証してから保存する。保存形式変更では既存IndexedDBを壊さず、旧データの読込み・移行を考える。WebKit対策で音源をArrayBuffer＋MIME保存する理由は [DECISIONS.md](DECISIONS.md) にある。
- キャラの顔と体は `chachamaru-anime-v1.png`、順手の腕は `chachamaru-overhand-v1.png`。SVGのローカル関節座標で回転し、部位へCSS transformを重ねない。全身が同じbody変換に追従し、太鼓は逆変換で接地する。腕の元画像上の肩・手首位置を接続する。手首の位置、描画順、バチの長い側が面に届くことを連続コマと実画面で確認する。transform値が変わるだけでは見た目の合格にしない。
- `BASE_PATH` とService Workerのscopeを合わせる。先頭 `/assets` の決め打ちを避ける。保存曲を残したまま更新できるよう、見た目の更新確認のためにIndexedDBを消さない。
- `__TEST__` や `web/src/testing/showcase.ts` はテスト／開発用。公開ビルドへ診断hookや固定結果を混ぜない。

## cloneから起動・検証

CIと合わせるならNode 24とPython 3.13を使います。固定依存は `package-lock.json` と `studio/requirements.lock`。macOSはApple Siliconを対象に検証しています。

```sh
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r studio/requirements.lock
npx playwright install chromium webkit
npm run doctor
npm run dev
```

Viteは `http://127.0.0.1:5173/`。プレイヤーはデモだけで検証できます。Studioも使う場合は別ターミナルで `npm run studio` を起動します。こちらは本番ビルドを作り、通常 `http://127.0.0.1:8787/#/studio` で動きます。使用中なら別ポートを選ぶので、Viteから編集する場合はそのポートに `STUDIO_API` を合わせて再起動してください。

```sh
npm run verify
npm run test:e2e
BASE_PATH=/chachamaru-rhythm/ npm run build
npm run audit:public
```

`verify` は型・lint・Unit・Python・本番ビルド・公開素材検査を行います。E2Eはローカルサーバーを起動し、ChromiumとWebKitで実施します。依存・ブラウザをインストールしてから実行してください。テストデータは自作デモ／診断fixtureを使い、ユーザーの曲は不要です。

見た目の変更はHome・選曲・演奏・結果と横／縦の表示を開いて確認します。腕の回帰試験は `tests/e2e/visual.spec.ts` のV03で、1440／1124／440px幅、打撃・ジャンプ・サビなどの肩／手首の接続と太鼓への到達を測ります。ブラウザ試験に合格しても、iPhone実機、TD-17、Bluetoothの打感・長時間安定性の確認済みとはしません。実機手順は [docs/08_DEVICE_CHECK.md](08_DEVICE_CHECK.md)。

## GitHubへ反映するとき

変更の目的・触った範囲・検証結果を説明できる単位でcommitします。別AIと同時に作業するときは個別branchを使い、最新mainの差分を確認してから取り込みます。保存データや未commitの他者の変更を巻き戻さないでください。

`main` のアプリ変更はPages workflowを起動します。UbuntuのChromiumとApple Silicon macOSのWebKitの検証に成功した後、`dist/` をPagesへ配信します。文書のみの変更は再配信しません。ローカルbuild成功・Actions成功・公開URLで新版を見たことは別々に確認します。古い画面が残る場合はService Workerの更新を確認し、保存曲の削除で解決しないでください。

完了時は [PROGRESS.md](../PROGRESS.md) を更新し、ローカルの `DELIVERY.md` に詳細を記録します。新しい環境では作成して構いません。`reports/`、`output/`、`DELIVERY.md` は通常Git対象外です。公開する引き継ぎ情報はこのガイド・README・docsへ記載し、私用ファイル名や端末の個人情報を含めないでください。

現在の未確認項目は実機iPhone／TD-17と無線音声の打感です。WebKitの音声系CIはmacOSで実行しており、Linux WebKitで同じ音声動作を確認したとは扱いません。詳しい実装判断は [DECISIONS.md](DECISIONS.md)、素材の生成方法は [ASSET_PROMPTS.md](ASSET_PROMPTS.md) を参照してください。


### 直近の検証で残した観察

関節修正commit `311eb58` は [再検証・公開run](https://github.com/kochamari/chachamaru-rhythm/actions/runs/35955687869) で両ブラウザの全30試験と配信が成功しました。[先行run](https://github.com/kochamari/chachamaru-rhythm/actions/runs/35955076260) ではWebKitの既存Studio試聴テスト1件で「試聴」から「停止」へ切り替わらず失敗。音源取得はHTTP 200で、同一コード・同一条件の再実行では成功しています。原因は未確定です。再発時は `tests/e2e/studio.spec.ts` の試聴開始と `web/src/screens/Studio.ts` のHTMLAudioElementの状態を調べ、合格条件を緩めないでください。
