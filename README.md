# ちゃちゃまる太鼓の達人

ひまわりをつけた赤柴ちゃちゃまると遊ぶ、2色・1レーンのリズムゲームです。右から流れる音符に合わせてドンとカッを叩きます。叩くほどお祭りゲージがたまり、仲間の柴犬（黒柴・白柴・胡麻柴…）が踊りに加わり、サビでは夜祭りに変わります。

**アプリを改善するAI・開発者へ:** [引き継ぎガイド](docs/AI_HANDOFF.md) に、目的・構成・コードの案内・起動方法・変更時の注意点をまとめています。まず [AGENTS.md](AGENTS.md) と合わせて読んでください。

## ブラウザで遊ぶ

[ゲームを開く](https://kochamari.github.io/chachamaru-rhythm/#/songs) · [GitHub](https://github.com/kochamari/chachamaru-rhythm)

ログイン不要で遊べます。公開版には自作のオリジナル曲4曲（各3難易度）を収録しています。

| 曲 | テンポ | 特徴 |
| --- | --- | --- |
| ひまわり囃子 | 120 BPM | 笛と締太鼓の祭囃子。はじめての1曲に |
| ちゃちゃまる音頭 | 100 BPM | 跳ねるリズムの盆踊り。手拍子つき |
| 夕焼けしっぽ | 140 BPM | 和の音色が入ったポップス |
| 花火ラッシュ | 172 BPM | 速い曲。連打で花火が上がる |

手元の曲パックは「曲を追加」から読み込めます。取り込んだ音源・譜面はそのブラウザに保存され、GitHubへ送信されません。iPhoneでは共有メニューの「ホーム画面に追加」で全画面のアプリとして起動できます。

## Macで開く

`Start Game.command` をダブルクリックすると曲一覧を開きます。
音源から譜面を作る・編集するときは、Macの「ちゃちゃまる譜面工房」アプリを開きます（Launchpad・Spotlight・Dockから）。ゲームの譜面工房の画面にある「Macの譜面工房を開く」ボタンからも起動できます（初回はブラウザの確認で「開く」）。アプリは譜面工房を裏で起動して http://127.0.0.1:8787/#/studio を開きます。アプリは `npm run mac-app`（`scripts/install-mac-app.sh`）で `~/Applications` に作ります。フォルダを移動したら作り直してください。裏の譜面工房を止めるときは `npm run studio -- --stop`。

ターミナルで使うときは `Start Studio.command`（終了は Control+C）。どちらも、別のフォルダ（以前の版など）の譜面工房が同じポート8787で動いていると、それを開かずに案内を表示します。

この環境ではローカルURLは `http://127.0.0.1:8787/`。他のアプリがポートを使用中のときは、起動ログのURLを使います。初回のmacOS確認は必要な場合があります。

## 操作

| 入力 | ドン | カッ | 一時停止 |
| --- | --- | --- | --- |
| キーボード | F / J | D / K | Escape |
| タッチ | 画面下の太鼓の面（中央の2つ） | 太鼓のふち（左右の端） | 右上のⅡ |
| 電子ドラム | 登録したスネア | 登録したフロアタム | 右上のⅡ |

メニューも太鼓で操作できます。カッ（D・K／↑↓、フロアタム）で選ぶ、ドン（F・J／Enter、スネア）で決定、Escapeで戻る。選曲中は曲のサビが試聴で流れます。難易度の★は譜面の密度から出した目安、王冠はクリア（銀）・フルコンボ（金）・全良（虹）です。

大音符も正しい色の1打で完了します。黄色い連打は区間内で自由に叩けます。AUTO・練習・途中で入力方式を変えた記録は通常ベストに入りません。

電子ドラムは「設定 → MIDI接続を許可 → 入力ポート → このパッドを覚える → 1回叩く → 登録」。MIDIを利用できないブラウザでも、タッチとキーボードで遊べます。本体のキットや音色は変更しません。

## 曲をiPhoneへ移す

いちばん早い方法：Macの譜面工房の画面へMP3・M4A・WAVをドラッグ＆ドロップするだけです（いくつでも）。3難易度の譜面を作り、`曲名_ちゃちゃまる.zip` を保存し、このMacのゲームにもすぐ追加します。曲名・アーティストは音源のタグ（なければファイル名）を使います。できたZIPを Files / iCloud / AirDrop などで自分のiPhoneへ移し、ゲームの「曲を追加」から取り込みます。

譜面を直してから書き出すときは：
1. 譜面工房の「＋ 音源を追加」で曲名を決めて追加する（ドロップで作った曲は「譜面を編集」から）。
2. 自動下書きを試聴し、音符・拍・タイミング・サビ区間を調整する。
3. 「iPhone用 ZIP書き出し」で曲パックを保存し、同じようにiPhoneへ移す。

公開WebプレイヤーはGitHub Pagesで配信しています。Macを起動しなくても上のURLから開けます。市販曲パックは公開用ビルドに入りません。

ブラウザごとに曲の保存先は異なります。保存が永久に保証されるものではないので、元ZIPを保管してください。設定・記録はJSONバックアップで移せます。

## 譜面工房

3難易度は自動下書きです。曲の拍を検出し、拍の分割位置のうち実際に音が立ち上がる所に音符を置きます。低い打撃（キック・ベース）はドン、明るい打撃（スネア・手拍子）はカッになり、同じ響きの小節は同じリズムにそろえます。速い曲の半分テンポ、跳ねるリズム（スウィング）、拍検出の遅れ（約30ms）も自動で補正します。原曲のドラムを完全に採譜するものではないので、試聴して調整してください。盛り上がり区間は音量を使った候補で、未確認と表示します。

波形をクリックして再生位置を移動し、D / Kで追加、ドラッグで移動、Shift＋クリックで複数選択。Deleteで削除。← →で5ms、Alt＋← →で1ms動かせます。⌘Z / ⌘Shift Zで100操作まで戻せます。

音源はローカルのFFmpegでAAC-LCへ変換し、最終音源をデコードしてlibrosaで解析します。原曲は上書きしません。データは `_private/studio/` に保存されます。保存先は環境変数 `CHACHA_DATA` で指定可能です。APIはloopbackのみにバインドし、外部Originとtokenなしのアクセスを拒否します。

## 開発環境

Node 24以降の互換版、Python 3.12以降、npm。Mac版の固定解析ライブラリはApple Siliconを対象にしています。

```sh
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r studio/requirements.lock
npx playwright install chromium webkit
npm run doctor
npm run dev
```

FFmpegはプロジェクトのPython依存 `imageio-ffmpeg`、ffprobeはnpm依存に同梱されたものを使います。Linuxではシステムffprobeも利用できます。固定依存は `package-lock.json` と `studio/requirements.lock`。

同梱曲は `scripts/compose/` の合成エンジンで作っています（録音素材は不使用）。譜面を先に書き、合奏の太鼓がその譜面を演奏するので、音符と音が必ず一致します。作り直す場合：

```sh
.venv/bin/python -m scripts.compose.build            # 全曲
.venv/bin/python -m scripts.compose.build himawari   # 1曲だけ
```

`web/public/original-demo/` のZIPと `catalog.json`、`assets/manifest.json` のSHA-256が更新されます。曲を作り直したら `scripts/compose/build.py` のrevisionを上げると、既に遊んでいる人のブラウザでも新しい版に置き換わります。

```sh
npm run verify
npm run test:e2e
npm run build
npm run preview
```

`verify` は型・lint・unit・Python・本番ビルド・公開素材検査を順に実行し、失敗を非0終了で返します。実機確認は `docs/08_DEVICE_CHECK.md` を参照してください。

## GitHub Pagesへの公開

GitHub Pagesのリポジトリ配下には `BASE_PATH=/repository-name/ npm run build` を使用します。hash routingとService Workerのscopeも同じbaseに従います。公開対象は `dist/` のみ。

`.github/workflows/pages.yml` は `main` のアプリ更新で自動実行します。型・lint・unit・Python・Chromium/WebKitのE2E・公開素材検査が成功したビルドを配信します。Actionsから手動でも実行できます。文書だけの変更では再配信しません。

CIはChromiumをUbuntu、WebKitをmacOSで実行します。WebKitはOSの音声処理に依存するため、Safariを対象とする検証にはmacOSを使用します。両ブラウザの全試験が配信の必須条件です。

サイトとリポジトリは公開です。URLを共有した相手はログインせずに遊べますが、URLを知っている人だけに閲覧を制限する仕組みはありません。

`_private/`、参考動画・画像、市販音源、私用ZIP、ブラウザ診断結果をGitに追加しないでください。公開素材は独自背景・キャラクター・効果音・デモ曲のみです。
