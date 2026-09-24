# 05｜実装構成・公開・コマンド
これは作成すべき構成。ハンドオフZIPにはまだゲームコードは入っていない。

## 1. 技術選択
TypeScript strict、Vite、PixiJS 8系の互換版（WebGL優先）、
Web Audio、Web MIDI、Pointer Events、IndexedDB(idb)、fflate、Ajv、
Vitest、Playwright。MacはPython＋FastAPI＋librosa＋FFmpeg。
Canvas/WebGLが本体、HTML/CSSはメニューとフォーム。React/Unity/Three.jsを新規必須にしない。
Nodeは採用Viteのenginesを満たす現行の安定版。実際に使ったNode/npm/Python版をdoctorに記録。
Node24とPython3.12を初期候補にし、既存の互換環境があれば不要な変更をしない。
Pixi v7/v8のAPIを混ぜない。依存は最初の動作確認後にlockfile固定。S08/S09参照。

## 2. 作成するtree
```text
AGENTS.md / SPEC.md / GOAL.txt
package.json / package-lock.json / tsconfig*.json
web/
  index.html / vite.config.ts
  public/original-demo/
  public/original-assets/
  src/
    app/{router,store,brand,capabilities}.ts
    screens/{Home,Library,Import,Play,Result,Settings,Diagnostics,Studio}.ts
    game/{Session,Engine,Scoring,ChartIndex,Replay}.ts
    audio/{AudioEngine,ClockBridge,Calibration}.ts
    input/{InputRouter,TouchAdapter,KeyboardAdapter,MidiAdapter,MidiLearn}.ts
    render/{Renderer,Lane,Notes,Stage,Character,Effects,Layout}.ts
    packs/{ManifestValidator,SemanticValidator,ZipImporter,PackExporter}.ts
    storage/{Database,SongRepository,RecordRepository,Backup}.ts
    studio/{Timeline,Waveform,Commands,ApiClient}.ts
    workers/{zip,hash}.worker.ts
    testing/{fixtures,showcase,testHook}.ts
studio/
  pyproject.toml / lockfile
  chacha_studio/{server,jobs,transcode,analysis,generator,project,export,cli}.py
schemas/ / contracts/ / fixtures/
assets/manifest.json
scripts/{doctor,verify,audit-public,studio}.mjs
tests/{unit,integration,e2e,python}/
reports/ / docs/
.github/workflows/{ci,pages}.yml
_private/      # NEVER TRACK / NEVER DEPLOY
```

## 3. モジュール責務
Engineは純粋な時刻付き入力→結果。DOM/Pixi/AudioContext/IndexedDBをimportしない。
AudioEngineだけが音源ノードの生成破棄。ClockBridgeだけが時計の変換。
InputAdapterは生入力→HitEvent。採点はしない。
RendererはGameSnapshot＋EffectEventを読む。得点やnote状態を書き換えない。
Storageは結果を保存するが得点を再計算しない。
Studio generatorはschemaに従うchartを作る。Web renderer専用座標を保存しない。
この境界はunit testで依存逆転が保てるようにする。

## 4. 公開TypeScript契約
`contracts/public-types.ts`を参照。型をそのままコピーするかschemaから整合して生成。
所有権：
- SongPackageは不変データ。
- GameSessionは1runの可変状態を所有する。
- GameSnapshotはrendererへ渡す読み取り専用。
- resultイベントは1runにつき一度。
- exporterは有効なpackだけを返す。無効chartを黙って修正しない。

## 5. rootコマンドの契約
| command | 実施する内容 |
|---|---|
| npm run doctor | OS/CPU/RAM/Node/Python/FFmpeg/browser/deps、各検証可否を表示。秘密は出力しない |
| npm run dev | Web開発サーバー。既定localhost、公開LAN bindは勝手にしない |
| npm run studio | MacローカルAPI＋Studio画面起動。権限不足を明示 |
| npm run typecheck | strict tsc |
| npm run lint | ESLint等。生成物/privateを除外 |
| npm run test:unit | エンジン/時計/入力/保存/schema/semanticの試験 |
| npm run test:python | 解析/生成/ZIP/API境界のpytest |
| npm run test:e2e | Chromium＋WebKitのbrowser導線とスクリーンショット |
| npm run build | 本番dist生成。privateを入れない |
| npm run preview | distをローカルで確認 |
| npm run audit:public | trackedとdistの許可素材/秘密/私用ファイル混入検査 |
| npm run verify | typecheck→lint→test:unit→test:python→build→audit:publicの失敗を伝播 |

verifyで依存不足の工程を黙ってskipしない。BLOCKEDを非0終了とreportへ。
Python testを「ファイルが無ければ成功」にしない。
最初の依存導入は別途案内/自動化してよい。verifyの中で勝手に有料ダウンロードをしない。

## 6. 再現と試験hook
test build限定でseed/clock/input injection/state snapshotを提供。
productionのwindowへ汎用任意実行hookを露出しない。
E2Eの一部は同じ本番InputRouterへ合成イベントを流す。
trustedな実タッチ/USBをシミュレートできたと称さない。
testsは自作diagnostic fixtureと64秒demoを使用。J-POPをCI fixtureにしない。
長曲同期は仮時計8分＋先頭/中間/末尾のクリック配置で試す。

## 7. GitHub Pages
Vite baseはrepository subpathを環境変数から設定。先頭"/assets"固定は禁止。S08。
hash routingで直接reload可能。root "/"と"/test-repo/"の両方を自動試験。
Service Workerもbaseとscopeを合わせ、別プロジェクトまで支配しない。
GitHub Actionsでnpm ci→verify→E2E→dist artifact。
pages deploymentは権限を限定し、公式の現行Actionsを確認して版/SHAを固定。
未知の公開先へ自動作成・pushしない。既存remoteとユーザー許可が明確な時だけ操作。
それ以外はworkflowとdistと手順まで作りDEPLOYMENT=PENDING。
「Pages用build成功」と「公開URLで動作確認済み」は別のstatus。

## 8. セキュリティとプライバシー
private音源を外部AI、ログ収集、Git、ブラウザの第三者CDNへ送らない。
runtime dependenciesはbundle。外部script/CDN/fontへ依存しない。
配布するフォントファイルは権利確認されたもののみ。ここではOSフォントを既定にする。
メインの公開ページはremote MIDI出力、カメラ、マイク権限を要求しない。
自動採譜のためにPC全体のMusicフォルダを無差別走査しない。
