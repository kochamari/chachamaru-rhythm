# 09｜一次資料と事実・設計の区別

確認日：2026-09-24。
以下はAPIやサービスの事実確認用。数値・得点・画面配置・譜面生成ルールは本ハンドオフの独自設計。
古い仕様と新しい仕様が衝突した場合、実装時に公式の採用版を確認してDECISIONSへ残す。

## S01 OpenAI｜Using Goals in Codex
goalは検証可能な終了条件を持つ継続作業。上限や停止を無視する機能ではない。

```text
https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex
```

## S02 OpenAI｜Follow a goal / AGENTS.md
/goalと有効化の案内。環境ごとの機能提供は実際のCodexで確認する。

```text
https://learn.chatgpt.com/use-cases/follow-goals
```

## S02b OpenAI｜Custom instructions with AGENTS.md
AGENTSの探索・優先順位・サイズ制限。大量の仕様は別ファイルへ分割して参照させる。

```text
https://learn.chatgpt.com/docs/agent-configuration/agents-md
```

## S03 5of12｜Why did we build a Web Browser for MIDI?
MIDIWebがCore MIDIとWeb側のAPIを橋渡しする構成。今回の実機組合せの保証ではない。

```text
https://5of12.co.uk/journal/why-we-made-midiweb/
```

## S04 W3C｜Web Audio API
音声処理・時刻指定再生・getOutputTimestamp等の規格。ブラウザごとの実装確認は別途必要。

```text
https://www.w3.org/TR/webaudio-1.0/
```

## S05 W3C｜Web MIDI API
MIDI入出力API・イベントの規格。専用ブラウザのpolyfill品質は診断で確認する。

```text
https://www.w3.org/TR/webmidi/
```

## S06 W3C｜Pointer Events
pointerId等のイベントモデル。合成イベントの試験は実指試験の代替ではない。

```text
https://www.w3.org/TR/pointerevents3/
```

## S07 WebKit｜Updates to Storage Policy
Webストレージの容量・保持は無条件に保証されないため元ZIPを保持する設計。

```text
https://webkit.org/blog/14403/updates-to-storage-policy/
```

## S08 Vite｜Deploying a Static Site
GitHub Pagesのbase path、ビルドと公開。採用時に現行ActionsとNode互換条件を確認。

```text
https://vite.dev/guide/static-deploy.html
```

## S09 PixiJS｜Quick Start
PixiJS 8系を使う場合の現行API入口。実際の採用版をlockする。

```text
https://pixijs.com/8.x/guides/getting-started/quick-start
```

## S10 librosa｜beat_track
拍検出API。自動ゲーム譜面や意味的サビの完成を保証するものではない。

```text
https://librosa.org/doc/latest/api/generated/librosa.beat.beat_track.html
```

## S11 Playwright｜Emulation
viewportやtouch等のエミュレーション。iPhone実機/TD-17 USB受信とは区別。

```text
https://playwright.dev/docs/emulation
```

## S12 FFmpeg｜Documentation
音声変換と入出力制御。最終音源から解析する実装を採用。

```text
https://ffmpeg.org/ffmpeg.html
```

## S13 Roland｜TD-17仕様
USB Audioのベンダードライバー条件、Bluetooth入力、MIX IN、ユーザーサンプル。

```text
https://www.roland.com/jp/products/td-17/
```

## S14 Roland｜TD-17: How to Record a Performance
MIDI録音とUSB Audio録音の条件の区別。

```text
https://support.roland.com/hc/en-us/articles/360045192931-TD-17-How-to-Record-a-Performance
```

## S15 GitHub｜What is GitHub Pages?
静的ホスティング。ゲーム本体と私用データを分離する根拠。

```text
https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
```
