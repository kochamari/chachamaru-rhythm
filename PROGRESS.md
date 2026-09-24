# 実装進捗

CP0: 仕様を分割し、空のリポジトリから実装開始。私用音源は _private に隔離。公開・外部送信は行わない。

CP1: TypeScript strictの独立エンジン、時計・入力・ZIP検証・IndexedDB・バックアップを実装。92 unitテストが成功。
CP2: 自作64秒「ひまわり囃子」、3難易度、選曲→演奏→結果→リトライ、4打面、MIDI Learn、診断を接続。
CP3: ローカルFastAPI、最終音源からのlibrosa解析、編集、500ms自動保存、履歴、ZIP書出しを実装。Python24テスト成功。指定曲の私用パックを作成。
CP4: 生成夕景＋独立SVGリグ。Home/Library/実演奏のスクリーンショットを開き、レーンと入力領域の視認性を確認。
CP5: Chromium/WebKitを検証。数値入力のフォーカス再入、WebKitのBlob保存停止、表示の縦横比、Service Workerのscopeを修正。保存失敗や音声時計異常からの回復も確認。
CP6: Unit98件、Python26件、E2E28件が全件成功（skip0/flaky0）。npm run verify 成功。指定曲212.416秒を本番画面で全曲AUTO演奏し、100万点を確認。元音源不変・私用ZIPのSHAも再照合。
CP7: Home、Library、Playing、サビ100combo、MIDI、縦画面、全良、Studioと複数アニメーション時刻を保存して目視。reports/acceptance.json と DELIVERY.md に証拠を記録。ローカル初版完成。DEVICE=NOT_RUN、DEPLOYMENT=PENDING。

CP8: ユーザーがGitHub管理とPages公開を依頼。公開先を kochamari/chachamaru-rhythm とし、main更新時の検証・自動配信を準備。ゲーム本体と自作デモ曲が対象。私用音源・ZIP・参考資料・ローカル診断記録はGitと配信物から除外。

CP9: GitHub Pages公開成功。https://kochamari.github.io/chachamaru-rhythm/ はログイン不要で応答200。Actions run 35947393755 でUbuntu/Chromium 14件・Apple Silicon macOS/WebKit 14件、型・lint・Unit98件・Python26件・公開素材検査が成功。公開URLの新規Chromeでデモ64秒を停止なし・166良・100万点で完走。通常Chromeの時計警告後も再開して完走。私用ZIPの取込・再読み込み保存・演奏開始、440×956表示を確認。DEVICE=NOT_RUN、DEPLOYMENT=PASS。

CP10: ユーザーが4候補から選んだ手描きアニメ調にちゃちゃまるを更新。組み込みimage_genで同じ顔・色の透過パーツを作り、ホーム・選曲・演奏・仲間・結果へ統一して反映。頭・耳・前後脚・尾・スカーフの独立動作と瞬き、ドン／カッ別のバチ振りを維持。スマホ縦画面の余白も調整。npm run verifyとChromium/WebKitの全28件が成功（skip 0、flaky 0）。画像・生成プロンプト・公開許可とSHAを記録。GitHub Actions run 35951712507でも両ブラウザの検証・素材検査・Pages配信が成功。公開画像のSHA-256がローカルの採用素材と一致。通常Chromeの公開ホーム・選曲画面でも新しい絵柄を目視し、既存の私用パックが残っていることを確認。
