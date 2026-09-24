# 04｜Mac Studio：解析・編集・書き出し
ユーザーが毎回CLIを使う設計にしない。CLIは自動試験・Codex用に残す。

## 1. 起動とデータ
rootで `npm run studio` → loopbackサーバー起動 → ローカルブラウザを開く。
この操作をまとめた `Start Studio.command` を生成し、2回目以後はダブルクリックで使えるようにする。
初回のmacOS権限/依存導入は環境依存。chmodやGatekeeper回避を勝手に広範囲変更しない。
データ保存先：`~/Music/ChachamaruPacks/`を既定とし、ユーザー指定で変更可能。
リポジトリのpublicやsrc内へprivate音源を置かない。iCloudへはユーザーが保存/移動する。
原曲は上書きせずcopyで処理。Logicプロジェクトを自動探索・改変しない。
公開版Studioに解析ボタンがあっても、Macで動作するAPIがあるように偽装しない。
公開ページでは「Mac版Studioを起動」と説明。ブラウザ単独のZIP編集は可能にしてよい。

## 2. 画面
デスクトップ基準1440×900、左220pxにプロジェクト/曲情報、中央に波形と譜面、
右280pxに選択ノート/難易度/解析警告、下80pxに再生と書き出し。
上部：音源を追加、保存、かんたん/ふつう/むずかしい切替、iPhone用ZIP書き出し。
中央timeline：波形、beat/downbeat、2色ノート、chorus区間、playhead。
ノート追加はD=don、K=ka、Delete=削除。input欄入力中はshortcutを発火しない。
Macでの試遊は同一プレイヤー/同一判定コードを使う。別の仮プレビューでごまかさない。

## 3. 処理パイプライン
STAGED → TRANSCODING → ANALYZING → GENERATING → REVIEW_READY → EXPORTING → EXPORTED。
error/cancelから安全に戻せる。重い処理は1job、子processの停止とtemp cleanupを実装。

1. ffprobeで音声トラック、duration、ch、sampleRateを確認。
2. 最終配布音源を作る。既定AAC-LC/m4a、44.1kHz、stereo、192kbps。
   強制的な冒頭無音除去・テンポ変更・音量正規化は既定off。原音は変更しない。
   元がmonoならmonoのまま可。WAV診断はPCM16で保存。
3. **作成済みの最終配布音源を**再デコードして解析用mono22.05kHz PCMへ。
4. SHA-256を計算し、librosaでonset strength、beat候補、RMS等を計算。
5. beatTimesMs/区間候補/波形ピーク/診断情報を保存。
6. 同じbeat列から3難易度の下書きを決定論的に生成。
7. ユーザーに「自動下書き・要試聴」を表示し、編集可能にする。
8. validationしてZIPへ。音源は再エンコードし直さない。

Python依存はpyproject＋lockへ固定。librosaの実際のreturn型と採用版を確認（S10）。
librosa+FFmpegが通常経路。Logicや巨大な機械学習モデルの導入を必須にしない。

## 4. 拍解析の初期アルゴリズム
analysis sr=22050、hop_length=256を初期値。
onset envelope→beat tracker。beat frameをtimeMsへ変換。
global BPMはUIの参考値。runtimeはbeat時刻そのものを保存・使用。
倍/半分BPM候補を表示し、1/2・2倍ボタンでユーザーが選べる。
拍候補が少ない/間隔の変動が大きい/無音が長い場合は警告を表示。
信頼度はheuristicラベル(low/medium/high)。科学的な正解確率として%表示しない。
失敗しても任意BPM、最初の拍ms、4拍/小節による手動gridを作れる。
テンポ固定でない曲は手動区間補正または直接beat移動を許す。固定BPMで押し切らない。

サビは「盛り上がり候補」としてenergy上位のまとまった8〜32秒区間を最大3つ提案。
歌詞内容・意味的サビを理解できたと称さない。候補はconfirmed=false。
手動で開始/終了を変更し、確認ボタンでtrueにできる。
demo曲は作曲時に明示したsectionを使い、確実に演出を見せる。

## 5. 自動譜面生成の規則
ドラムのスネア検出をdonへ、フロア検出をkaへ直接対応させる方式ではない。
2色音ゲーとしての拍・アクセント・短い反復フレーズを作る。

候補時刻：
- easy：拍の頭を基本、明瞭な裏拍を限定採用。
- normal：拍と1/2分割。小節末に短い同色3打を許す。
- hard：拍、1/2、1/4分割。長い無休の16分連打は作らない。
- 実際の隣接beat間を分割する。曲全体を単一BPMで丸めない。

制約（設計既定）：
| 難易度 | 目標平均密度 | 最小間隔 | ka比率目安 | 速い束の上限 |
|---|---:|---:|---:|---:|
| easy | 0.8〜1.8打/秒 | 180ms | 10〜20% | 3打 |
| normal | 1.5〜3.2打/秒 | 105ms | 15〜30% | 5打 |
| hard | 2.5〜5.0打/秒 | 75ms | 20〜40% | 8打 |

曲の音楽性で目標密度に達しなくても水増ししない。最小間隔はhard limit。
2小節モチーフを作り、次の2小節で再利用/末尾だけ変化。毎音ランダム色変更をしない。
donを骨格、kaをフレーズ境界/アクセントに置く。高速なdon-ka交互を上限付きにする。
速い束は最大8打後に少なくとも1/2拍の休みを入れる。easyではさらに簡素。
密度を落とす時はフレーズのまとまりを残し、独立ランダム削除だけにしない。
原曲全体が静かな区間には休みを入れる。
最初のnoteは原則800ms以後、末尾は音源終了300ms前まで。
largeは目立つ強拍に限定、全tapの10%以下、連打束に連続配置しない。
rollは明確な4拍程度の区間候補だけ。tapとの±90ms競合を作らない。
seed=音源hash+generatorVersion+difficulty。ランダムを使う箇所はseed固定。
再生成は既存編集を上書きする前にUI確認。元の編集版をrevisionとして残す。

## 6. 編集の必須操作
音源再生/停止/小節ループ、波形zoom/水平pan、playhead移動、AUTO試聴。
ノート追加/削除/drag移動/色変更/大音符切替、複数選択、undo/redo最低100操作。
snap=off/1/4/1/8/1/16、左右矢印±5ms、Alt併用±1ms。
全譜面offset±1/5/10ms、テンポ/先頭拍の修正、サビ開始/終了/確認。
選択範囲のdon↔ka変更、密度警告、曲末超過・roll重なりの可視化。
Studioのseek/loop中はpractice扱い。プレイヤーの最高記録に混ぜない。
速度変更はLATER。まず通常速度の同期を確実にする。
編集後500ms debounceでプロジェクト保存。書出時も保存完了を待つ。

## 7. ローカルAPI契約
同一originのFastAPI＋静的Studio画面。127.0.0.1:8787を初期候補、使用済みなら別portを表示。
GET /api/health → {ok,apiVersion,ffmpeg,analysisAvailable}
GET /api/session → {csrfToken}（same-origin/loopbackのみ）
POST /api/jobs（multipart audio + title + artist）→202 {jobId}
GET /api/jobs/:id → {status,progress,message,error?,projectId?}
DELETE /api/jobs/:id → cancel
GET /api/projects/:id → project（編集用データ。任意filesystem pathは返さない）
PUT /api/projects/:id → validateして保存。revisionによる楽観ロック、不一致409
POST /api/projects/:id/generate → {difficulty,options}、非同期job
POST /api/projects/:id/export → validate→{exportId}
GET /api/exports/:id → authenticated ZIP download
GET /api/projects/:id/audio → private audio。same-origin/token検証。
mediaタグへtokenをqueryで公開せず、認証fetch→Blob URLを用いる。

ホスト127.0.0.1/localhostのみ、外部Origin拒否、CORS wildcard禁止。
起動ごとの乱数token、変更操作にheader token必要。session tokenを公開HTMLへ固定しない。
shell=Falseのsubprocess引数配列、外部URL入力禁止、projectId→管理下dirへ限定。
APIから任意ファイルread/write、任意コマンド実行、外部URL fetchを提供しない。
uploadサイズとjob数を制限。privateデータをGitHub Actionsへ送らない。

## 8. Logic
Smart Tempo等の補助は任意。ユーザーが手動で用意した音源/ステムを使ってよい。
ただし提供されていないComputer Useを仮定せず、通常パイプラインの完成を先に進める。
Logicが開けないことを初版全体のblockerにしない。
最初のgoalで追加の有料音源・プラグイン購入はしない。
