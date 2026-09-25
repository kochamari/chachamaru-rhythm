# 06｜受け入れ基準
この一覧を `reports/acceptance.json` へ複製し、実行した検証のstatus/evidenceを更新する。
元の契約を緩和して合格にしない。自動判定だけでは見た目・実機を証明しない。
- implementation：必須。unit/integration/Python/browserの実施証拠。
- visual：必須。実際のスクリーンショットを開いて評価。画像枚数だけでPASSにしない。
- device：未接続ならNOT_RUNのまま残し、残りの開発は継続。
- deployment：公開許可/設定が無い時はPENDINGとして分離。

## 合格の意味
IMPLEMENTATION全PASS＋VISUAL全PASS＝ローカル初版実装完了。
H群未実施なら「実機未検証」を併記。D群未実施なら「公開前」を併記。
実装不足をハードウェア不在のせいにしてNOT_RUNへ移さない。

## 実ブラウザ証拠
Chromium/WebKitはデスクトップ実行のブラウザ試験。
iPhoneのviewport設定やMIDI mockはiOS/USB実機試験ではない（S11）。
screenshotsは本番画面を使い、showcaseの合成場面にはその旨をファイル名/metadataに記録。
full play-throughをshowcaseの結果画面だけで代用しない。
audio auditionができない場合、波形・再生成功と「人が音を聴いた評価」を区別する。

## Gate一覧

| ID | 種別 | 完成条件 | 検証 |
|---|---|---|---|
| U01 | implementation | ±45msは良、±46msは可、±90msは可、±91msは対象外 | engine-casesの境界全例 |
| U02 | implementation | 色違いは消費せず、期限内の正しい色でヒット可能 | wrong-color→correct→score |
| U03 | implementation | 同色候補が二つある時は時刻が早い未処理noteを優先 | 密集ノートのmatcher試験 |
| U04 | implementation | 同じイベントidは一回だけ、同じpayloadの別idは別打撃 | duplicate-idとrapid-hit試験 |
| U05 | implementation | 大音符は正しい1打で完了、二打目ボーナスなし | large weight/second-hit試験 |
| U06 | implementation | 連打は[start,end)、1入力1加算、長押しは連打しない | start/end境界とpad長押し |
| U07 | implementation | 全良のbaseScoreがちょうど1,000,000、連打点を分離 | 重み混在の整数計算 |
| U08 | implementation | コンボ・最大コンボ・FC・全良・ゲージが仕様通り | 良可不可の配列と結果 |
| U09 | implementation | 80ms配送猶予は判定窓を広げない | timely event/delayed receipt対比 |
| U10 | implementation | 後続ヒットが先に届いても確定順のコンボが壊れない | nextCommitIndex/drain試験 |
| U11 | implementation | 遅すぎる配送は確定結果を改変せずtimingUnstable | deadline超過ケース |
| U12 | implementation | Note Off/velocity0/CC/Active Sensingを打撃にしない | MIDI byte列のtable-driven試験 |
| U13 | implementation | 20ms間隔の同noteを勝手に間引かない | rapid MIDI fixture |
| U14 | implementation | MIDIハンドラ再登録と再接続で二重発火しない | connect/disconnectを5回 |
| U15 | implementation | 2本以上のpointer、cancel、指置きっぱなしが独立 | InputRouterの複数pointer試験 |
| U16 | implementation | キーボードrepeatとフォーム入力で打撃が出ない | keydown/input focus |
| U17 | implementation | Event.timeStampのnormal/epoch/zero/invalidのfallback | ClockBridge/timeOrigin試験 |
| U18 | implementation | getOutputTimestampあり/なしで補正が二重適用されない | ClockBridge式の数値検証 |
| U19 | implementation | audioDelay/inputLag/visualAdvance/chartOffsetの符号が正しい | 正負100msのgolden計算 |
| U20 | implementation | 30/60/120fps及び一時的frame欠落で論理結果が一致 | 同一入力replay比較 |
| U21 | implementation | 8分の仮時計で先頭・中間・末尾のtargetに累積ズレなし | fake-clock長時間試験 |
| U22 | implementation | pause/resume/retryでsource二重再生・古いonendedなし | AudioEngine lifecycle mock |
| U23 | implementation | count-in中に得点/不可が増えず、0ms noteを救済 | timeline状態遷移 |
| U24 | implementation | AUTO/練習/mixed/unstableが通常最高記録を書換えない | RecordRepository試験 |
| U25 | implementation | min/missing APIでもタッチ版の起動を妨げない | capability fallback試験 |
| U27 | implementation | 電子ドラムを叩くと電子ドラム用の画面へ切替、準備画面はスネアでも開始 | E2E（MIDI入力の模擬） |
| U28 | implementation | 音ズレ合わせが遅れを測り、出力ごとに保存・切替できる | Unit（計算）＋E2E（150ms遅れの打撃） |
| P01 | implementation | 付属diagnostic-packをschema+semantic+SHA検証できる | 正fixture |
| P02 | implementation | future schemaVersion、NaN相当、負時刻、不明kindを拒否 | 不正JSON fixture |
| P03 | implementation | note順序/ID重複/roll競合/空譜面/曲末超過を拒否 | semantic fixture |
| P04 | implementation | ZIP traversal/未知path/重複entry/symlink/展開超過を拒否 | 悪意ZIP fixture |
| P05 | implementation | audio/chart hash不一致で取込せず既存曲保持 | corrupt fixture |
| P06 | implementation | 失敗/取消/容量不足で取込をrollback | mock IndexedDB/QuotaExceededError |
| P07 | implementation | 同じ曲再取込の重複排除とrevision置換が動く | duplicate/update試験 |
| P08 | implementation | ブラウザのreload後に曲・設定・最高記録が残る | IndexedDB E2E |
| P09 | implementation | DB migration/曲削除が別曲や共有Blobを消さない | migration/refcount試験 |
| P10 | implementation | 設定/記録backupをexport→importして復元 | roundtrip |
| P11 | implementation | SWなしでも起動とローカル曲再生が成立 | capability injection |
| P12 | implementation | private音源をuploadするnetwork requestが出ない | requestログとpublic audit |
| M01 | implementation | Mac Studioを一つのコマンドで起動できる | npm run studio + health |
| M02 | implementation | 音源投入→解析→3難易度→ZIPまで実データが流れる | test fixtureのend-to-end |
| M03 | implementation | 元音源を変更せず最終音源を解析してSHA一致 | before/after hashとtemp |
| M04 | implementation | 同seedで同じ譜面を生成し難易度制約を満たす | generator snapshots |
| M05 | implementation | 拍解析失敗時も手動BPM/先頭拍で続行できる | 無音/低confidence fixture |
| M06 | implementation | サビ候補が未確認と表示され手動修正できる | section edit test |
| M07 | implementation | note追加削除移動色サイズ変更undo/redoが動く | timeline command tests |
| M08 | implementation | offset/snap/小節loop/AUTO試聴が同じデータへ反映 | editor-player roundtrip |
| M09 | implementation | 編集自動保存とrevision衝突409処理 | project API tests |
| M10 | implementation | cancel/ffmpeg失敗/容量過大で復旧し原曲を保持 | failure injections |
| M11 | implementation | 外部Origin/不正Host/tokenなし/任意pathを拒否 | API security tests |
| M12 | implementation | Studioのexportをプレイヤーが取込・完走できる | actual exported ZIP→browser |
| E01 | implementation | デモでHome→Library→Play→Result→Retryを完走 | ChromiumとWebKit |
| E02 | implementation | タッチ操作から採点まで本番経路が接続 | pointer event browser test |
| E03 | implementation | 模擬MIDIからMIDI Learn→演奏→切断pauseが動く | requestMIDIAccess mock |
| E04 | implementation | 横/縦/resizeで画面が壊れず残留入力なし | 956x440/844x390/440x956 |
| E05 | implementation | 非表示→復帰で勝手に演奏再開しない | visibility event |
| E06 | implementation | 通常/サビ/100combo/FC/全良演出が仕様イベントから動く | demo＋showcase |
| E07 | implementation | 未知routeや曲ID、decode失敗でエラー回復できる | negative navigation |
| E08 | implementation | /と/test-repo/でassets/SW/hash routesを読める | base path E2E |
| E09 | implementation | オリジナル64秒デモは3難易度、normalは100combo到達可能 | asset manifest/auto replay |
| E10 | implementation | 20回retryでもnode/listener等が単調増殖しない | instrumented lifecycle counters |
| E11 | implementation | npm run verifyとnpm run test:e2eが非skipで成功 | 実際のexit codeとlog |
| E12 | implementation | runtime uncaught exception/unhandled rejectionがない | console/pageerror collection |
| V01 | visual | 犬が赤柴・立ち耳・巻き尾・緑スカーフで一貫している | referenceとHome/Playを目視 |
| V02 | visual | 犬の頭・脚・尾が独立して動き、静止画bounceだけではない | animationの複数時刻画像/動画 |
| V03 | visual | レーンが一本右→左、譜面と判定位置を大型演出が覆わない | Playing/chorus/combo画像 |
| V04 | visual | タッチ打面が4つで親指領域を確保し文字が読める | 横/縦スクリーンショット |
| V05 | visual | 通常→サビ→FCで見た目の段階差がはっきりある | 3状態の比較 |
| V06 | visual | タイトル・選曲・結果・Studioが未接続の仮画面でない | 全screenを実操作 |
| V07 | visual | 指定8画像以上を実ブラウザから保存し切れ重なりを修正 | reports/screenshots |
| V08 | visual | 参考画像の全面貼付・絵文字代用・本家抽出素材がない | asset provenance/visual review |
| H01 | device | 実機iPhoneでMIDIWebを開き機種/OS/app版を記録 | 実機診断ログ |
| H02 | device | TD-17 GENERIC/ケーブルでスネアとフロアを別登録 | 実打撃・ノート受信 |
| H03 | device | 複数指の同時/交互タッチが継続して取れる | 実指テスト |
| H04 | device | 曲再生中にTD-17入力と演奏判定が継続する | 一曲完走 |
| H05 | device | ZIP選択/decode/保存/アプリ完全終了後の復元 | MIDIWeb実機 |
| H06 | device | 出力経路ごとに音・表示・判定の補正を確認 | 内蔵/BT/有線の使用経路のみ |
| H07 | device | BT再接続や経路変更で音ズレを再確認 | 使用経路に応じて実施 |
| H08 | device | USB切断/再接続でpauseし二重入力にならない | 実機抜き差し |
| H09 | device | 画面回転/ロック/別アプリ移動から安全復帰 | iOS実操作 |
| H10 | device | 連続10分以上で発熱/frame時間/音切れを記録 | 計測方法付きログ |
| H11 | device | 完全offline起動の可否を実測し表示と整合 | ネット断→アプリ再起動 |
| H12 | device | 曲先頭/中盤/末尾で同期と打感をユーザーが確認 | 1曲試遊メモ |
| D01 | deployment | 公開先と公開名についてユーザー許可が明確 | 指定remote/公開条件 |
| D02 | deployment | tracked files/distのprivate混入検査が成功 | audit:public出力 |
| D03 | deployment | GitHub Actions経由でPagesへ実際にdeploy成功 | run URLとdeployment status |
| D04 | deployment | 公開URLを開きデモとassetsとhash routeを確認 | 公開先browser確認 |
