# 実装仕様索引 v1.0
本書は一括実装の完成条件。**コードを書くための仕様であり、ゲーム実装そのものではない。**

## 成果物
A. GitHub Pagesで動くiPhone向け2色リズムゲーム。
B. Macでローカル動作する、曲投入→解析→譜面編集→ZIP出力のStudio。
C. 自作デモ曲・完成ビジュアル・アニメーション・診断・自動試験・公開ビルド。

## 仕様の優先順位
ユーザーの最新の明示指示 > 本書の固定条件 > JSON schema > 領域仕様 > fixtures > 実装上の都合。
`AGENTS.md`は作業方法。`docs/00_PRODUCT.md`は何を作るか。
数値を変える場合、旧仕様・理由・新仕様・テスト変更をDECISIONSへ残す。黙って緩和しない。
固定条件や完成ゲートの変更は軽微な設計判断に含めない。

## 範囲
- MUST：P0全機能。初版の一括実装に含む。
- SHOULD：対応APIがある環境で実装し、無い場合は指定のフォールバックを実装。
- LATER：今回は作らない。追加してP0を遅らせない。
- DEVICE：実機でのみ判定。未実施を自動合格にしない。
大音符はP0だが1打で完了する補助ルール。風船・分岐・キックはLATER。
「原作に忠実」は遊びの骨格・レーンの読みやすさ・リズム感を指し、他社素材の転用を指さない。

## 読み順
全員：00_PRODUCT、06_ACCEPTANCE。
フロント：01_UI_ART、02_ENGINE。
データ：03_PACK_STORAGE、schemas。
Mac：04_STUDIO、05_ARCHITECTURE。
実行・終了：07_EXECUTION、08_DEVICE_CHECK。
API等の事実の参照先：09_SOURCES。

## 初版で採用する既定値
ruleset `chacha-v1`、時間は整数milliseconds、通常速度1.0、
良±45ms／可±90ms、ミス確定猶予80ms、ゲージ初期0・クリア70、
横画面基準1280×720、ノート到達時間1.8秒、画面下カッ/ドン/ドン/カッ、
コンボ10/50/100/以後100ごと、通常打音と演出音の個別音量。
これらは独自仕様。市販ゲームの数値を調査・再現したという意味ではない。

## リファレンス
`_private/reference/character-world.jpg`：赤柴・唐草スカーフ・ひまわり・和風の夕景。
`_private/reference/gameplay-20s.png`／`gameplay-50s.png`：提供動画のゲーム領域。
参考画面の操作ボタン、広告、敵、ライフ制、横移動は採用しない。
画像は直接Webへ配布しない。見た目を参考に独自素材を制作する。

## 検証の4軸
IMPLEMENTATION=PASS/FAIL/BLOCKED
VISUAL=PASS/FAIL/NOT_RUN
DEVICE=PASS/FAIL/NOT_RUN
DEPLOYMENT=PASS/PENDING/NOT_REQUESTED
実装と視覚ゲートがPASSなら「ローカル初版実装完了」と報告できる。
それだけで「iPhone＋TD-17動作保証」「公開済み」と報告してはいけない。
