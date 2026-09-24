# ちゃちゃまる太鼓の達人

ひまわりをつけた赤柴ちゃちゃまると遊ぶ、2色・1レーンのリズムゲームです。右から流れる音符に合わせてドンとカッを叩きます。

## ブラウザで遊ぶ

[ゲームを開く](https://kochamari.github.io/chachamaru-rhythm/#/songs) · [GitHub](https://github.com/kochamari/chachamaru-rhythm)

ログイン不要で遊べます。公開版には自作曲「ひまわり囃子」の3難易度を収録しています。手元の曲パックは「曲を追加」から読み込めます。取り込んだ音源・譜面はそのブラウザに保存され、GitHubへ送信されません。

## Macで開く

`Start Game.command` をダブルクリックすると曲一覧を開きます。
音源から譜面を作る・編集するときは `Start Studio.command` を開いてください。終了は起動したターミナルで Control+C。

この環境ではローカルURLは `http://127.0.0.1:8787/`。他のアプリがポートを使用中のときは、起動ログのURLを使います。初回のmacOS確認は必要な場合があります。

## 操作

| 入力 | ドン | カッ | 一時停止 |
| --- | --- | --- | --- |
| キーボード | F / J | D / K | Escape |
| タッチ | 中央の2打面 | 左右の外側の打面 | 右上のⅡ |
| 電子ドラム | 登録したスネア | 登録したフロアタム | 右上のⅡ |

大音符も正しい色の1打で完了します。黄色い連打は区間内で自由に叩けます。AUTO・練習・途中で入力方式を変えた記録は通常ベストに入りません。

電子ドラムは「設定 → MIDI接続を許可 → 入力ポート → このパッドを覚える → 1回叩く → 登録」。MIDIを利用できないブラウザでも、タッチとキーボードで遊べます。本体のキットや音色は変更しません。

## 曲をiPhoneへ移す

1. Macの譜面工房で音源を追加する。
2. 自動下書きを試聴し、音符・拍・タイミング・サビ区間を調整する。
3. 「iPhone用 ZIP書き出し」で曲パックを保存する。
4. Files / iCloud / AirDropなどで自分のiPhoneへ移す。
5. ゲームの「曲を追加」からZIPを選んで取り込む。

公開WebプレイヤーはGitHub Pagesで配信します。Macを起動しなくても上のURLから開けます。市販曲パックは公開用ビルドに入りません。

ブラウザごとに曲の保存先は異なります。保存が永久に保証されるものではないので、元ZIPを保管してください。設定・記録はJSONバックアップで移せます。

## 譜面工房

3難易度は音源の拍・アクセントから作る自動下書きです。原曲のドラムをそのまま採譜するものではありません。盛り上がり区間は音量を使った候補で、未確認と表示します。

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

CIはChromiumをUbuntu、WebKitをmacOSで実行します。WebKitはOSの音声処理に依存するため、Safariを対象とする検証にはmacOSを使用します。全28件のブラウザ試験が配信の必須条件です。

サイトとリポジトリは公開です。URLを共有した相手はログインせずに遊べますが、URLを知っている人だけに閲覧を制限する仕組みはありません。

`_private/`、参考動画・画像、市販音源、私用ZIP、ブラウザ診断結果をGitに追加しないでください。公開素材は独自背景・キャラクター・効果音・デモ曲のみです。
