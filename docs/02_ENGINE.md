# 02｜判定・入力・時計
ここに書く計算式は今回の独自仕様。市販品の内部実装の主張ではない。
出典S04/S05/S06はAPIの存在・基本的意味。具体的な補正設計は本書の設計判断。

## 1. データと単位
pack/chartの時刻は整数ms、音源の最終デコード開始を0。
AudioContextのAPIだけsec。境界で明示変換する。timeMsとsecondsを混用しない。
Tap={id,kind:"tap",timeMs,color:"don"|"ka",size:"normal"|"large"}
Roll={id,kind:"roll",timeMs,endMs}
chart.offsetMsは全イベントへ同じだけ加算。正は音源に対して譜面を後へ。
入力=HitEvent（contracts/public-types.ts）。idは受信ごとに一意、同じ物理payloadでも別打撃は別id。

## 2. 判定窓
delta=inputSongMs-(note.timeMs+chart.offsetMs)。
abs(delta)<=45: great（良）
45<abs(delta)<=90: ok（可）
未命中のtapは遅い側90msを越えても即ミスにせず、後述80msの配送猶予後にmiss（不可）。
「90ms+80msまで遅れて叩いても可」ではない。**判定窓は90msのまま。猶予はイベント配送用。**

入力処理：
1. runId、状態、イベントid、有限な時刻を検証。duplicate idは無視。
2. unresolvedな同色tapのうち判定窓内で最も時刻が早いものを1つだけ選ぶ。
3. あれば解決。無ければ有効roll内の1打として扱う。
4. それも無ければ空打ち。打音とpad feedbackのみ。コンボ/点数/不可を直接変えない。
色違いはノートを消費しない。正しい色で期限内に再度叩ける。
最も近い次ノートを先に取って古い同色ノートを飛ばす実装にしない。
1入力でtapとrollを同時に得点させない。

## 3. 遅れて配送される入力と確定順序
deliveryGraceMs=80。現在のaudibleSongMs > target+90+80 でmiss確定。
受信時刻がこの確定期限を過ぎたイベントで、確定済み結果を改変しない。
古い入力はdiagnosticsへ記録し、そのrunをtimingUnstableにする。実機の完全補償とは呼ばない。
各tapに pending/resolved(outcome) を持たせる。
入力時のring・打音は即時でよい。得点/コンボ/ゲージはchart内tap順に確定する。
`nextCommitIndex`より前が未確定なら後続結果は保留し、連続して確定可能になった時にdrain。
これで「後のヒットが先に加点→前の遅いミスで誤った最終combo」を避ける。
drainで複数のコンボ節目が出ても視覚は最大1つ、数値結果は全部正しく更新。
結果再現は同一chart・設定・受信順とtimestamp付き入力ログに対して決定的にする。
逆順配送を無制限に正しく救済できると主張しない。80ms越えはログで検知。

## 4. 得点
tap重みw：normal1、large2。全tapの重み合計W。W>0を必須とする。
resolvedGreatWeight=G、resolvedOkWeight=O。
baseScore=floor(1_000_000*(2*G+O)/(2*W))。
floatの足し算を毎ノート丸めるのでなく整数の累積比率から計算。全良は必ず1,000,000。
rollBonus=100*有効rollHitCount。total=baseScore+rollBonus。コンボ倍率は初版なし。
「精度」=(良の個数+0.5*可の個数)/tap総個数。大音符も精度・コンボは1ノート。
AUTO/練習/mixed/timingUnstableは通常記録を更新しない。

combo：良可で+1、不可で0、rollで変えない。maxComboを更新。
FC=不可0かつ全tap解決、全良=可0かつ不可0かつ全tap解決。
連打0でもFC/全良を阻害しない。
clearゲージ：初期0、良+120*w/W、可+60*w/W、不可-240*w/W。
各tapの確定時に0〜100へclamp。終了時70以上でclear。
初期から満タン、またはミスなしでもクリア不可となるバグをテストする。
これらは独自バランス。調整時はruleset versionを更新して記録を分離。

## 5. 入力adapter
Touch:
- pointerdownで発火。指が残っていても別pointerIdを処理。
- pointerup/cancelで解除。primaryのみを扱わない。clickの重複購読禁止。
- pointermoveで隣padへ滑らせても自動追加打撃にしない。
- 各padが独立した状態、pointerId→padの対応。押下中の押しっぱなし連打は禁止。
- 停止/回転/非表示でclear。PC mouseは左buttonのみ。
Keyboard:
- code KeyF/KeyJ don、KeyD/KeyK ka。repeat=trueは無視。
- input/textarea/contenteditableへtyping中は発火しない。
MIDI:
- navigator.requestMIDIAccess({sysex:false})をユーザー操作から呼ぶ。
- API不在/拒否/ports0を別の日本語メッセージで説明。
- 1ポートだけactive。接続時に旧listenerを必ずremove。
- data.length>=3、(status & 0xF0)===0x90、velocity>0だけhit。
- channel=status & 0x0F。note/velocity 0..127の異常値は拒否。
- velocity0、Note Off、CC、pitch bend、Active Sensingは打撃にしない。
- learn候補を画面表示→登録の流れ。USB/BTの重複受信はactive portの固定で避ける。
- 全ノートに50ms/100ms debounceを適用しない。20ms違いの正当な打撃も受理。
- velocity閾値は既定1。ゴースト抑制は手動任意、初期の勝手なフィルター禁止。
- 接続が切れたらpause、復帰時にportを再選択又は同一候補を示す。勝手に再開しない。
- MIDI送信、Program Change、キット書換えはこのアプリではしない。

## 6. 時計の対応付け
performance時計p(ms)、AudioContext時計a(sec)を混同しない。
ClockBridge.sample()で対応のペアを得る。
A: getOutputTimestampのcontextTime/performanceTimeが有限・単調・現時刻付近なら、
  aOut(p)=pair.contextTime+(p-pair.performanceTime)/1000。
B: 使えない時は currentTime と performance.now の近接sampleで対応させる。
  これはaudio-render clock近似であり、audible clockとして完全とはしない。
baseLatency/outputLatencyをAへ追加加算しない。Bでも値を盲信して二重補正しない。
A/Bの選択をdiagnosticsへ表示。run途中で方式を自動変更しない。

sourceの開始Audio時刻a0、再開/seekの音源位置s0(ms)。
audioDelayMs=その方式で取り切れない残余の出力遅延（正なら聞こえる音は後）。
T(p)=s0+1000*(aOut(p)-a0)-audioDelayMs。
inputLagMs=イベントtimestampが実打撃より遅い分（正なら差し引く）。
inputSongMs=T(pEvent-inputLagMs)。
visualSongMs=T(performance.now())+visualAdvanceMs。
正のvisualAdvanceMsはノート表示を前へ進める（判定円到達が早くなる）。
正のchart.offsetMsは全譜面を後へずらす（音源自体は変えない）。
これらの符号をボタン文言と数値例でテストする。

timestamp:
- Event.timeStampがperformance基準として妥当なら採用。
- epoch相当ならtimeOriginを引いて妥当性確認。
- 明らかに未来、ゼロ固定、古すぎる、非有限ならreceiptPerformanceMsを使用しdegraded表示。
- 入力経路ごとにtimestampModeとfallback回数を記録。
- receiptとの差を「イベント配送遅延」と呼び、パッドの物理遅延と混同しない。

描画：
speedPxPerSec=(laneRight-hitX)/travelSeconds（既定1.8）。
x=hitX+((targetMs-visualSongMs)/1000)*speedPxPerSec。
rAFは再描画の契機だけ。`songTime += delta`を真の曲時計にしない。
tempo変化でもイベントの絶対時刻を使用。背景の拍だけbeatMarkersから補間。
小節線もbeatMarkers。BPM1個を曲全体へ当てて長曲をズラさない。

## 7. 校正UI
profiles: phone-speaker / td17-bluetooth / td17-wired / custom。
audioDelayMs -100..500、visualAdvanceMs -200..200、inputLagMs -100..150（1ms step）。
数値欄と±5/±1ボタン、既定値へ戻す、プロフィール複製。
「曲の音に対して判定円が早い/遅い」を独立して調整可能にする。
任意の16打タップ校正：最初4打除外、残りの中央値とMADを表示し、補正候補として提示。
それで音声遅延と人間の反応と入力遅延を一意に分離できたとは説明しない。
Bluetooth再接続後は設定プロフィール再確認を促す。無線の揺れは固定offsetで消えない。

## 8. 再生と復帰
AudioContextは初回「開始」のuser gestureで作成/resume。BGMは1曲だけdecode。
count-inは2秒。a0=sampled currentTime+2.0、BufferSource.start(a0,offsetSec)。
COUNT_IN→PLAYINGの切替はaudible timelineが保存したs0に到達した時。
currentTimeがa0を過ぎたという条件だけで、出力遅延のある端末を早くPLAYINGにしない。
0msのノートもカウントイン後の正しい位置で叩ける。
BGM sourceは再利用しない。restart/pauseのたびに旧source stop/disconnect、generation id更新。
onendedは古いgenerationなら無視。テストで二重再生/古い終了イベントを検出。
pauseで現在のaudible位置を保存、stop、入力受付停止、余計なmiss確定を止める。
再開はその位置から新source＋count-in。既に確定したnoteを再得点しない。
OS音声停止、visibility hidden、MIDI切断、WebGL contextlostでpause。
OSから戻っただけで大音量再生しない。ユーザーの再開タップを必要とする。
Bluetoothで既にバッファされた物理出力まで即停止できると保証しない。
