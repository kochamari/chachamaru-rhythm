# 03｜曲パック・保存・安全性
機械的な構造はschemas/manifest.schema.jsonとchart.schema.jsonを使用する。
そこに書けない整合性条件は本書のsemantic validationで検証する。schemaだけで全検証済みにしない。

## 1. ZIP構造
```text
manifest.json
audio/song.m4a     # 又はsong.mp3 / song.wav。音源は一つ。
charts/easy.json
charts/normal.json
charts/hard.json
art/cover.webp    # 任意。png/jpgも可。無ければゲーム側で表紙生成。
```
通常の.zip拡張子。独自拡張子や自動的なアプリ起動は必須にしない。
上位ディレクトリをZIP内に挟まない。
manifestはUTF-8 JSON。音源ファイルと各chartのSHA-256を持つ。manifest自身の再帰hashは不要。
SHAは破損/取り違え検出用で、著作権・作者・安全性の証明ではない。
音源が変わるとSHAも変わる。勝手に別の曲を代用して再生しない。

## 2. 時刻の決まり
全timeMsは最終パック音源をデコードした先頭が0。負のnoteは禁止。
chart.offsetMsを加えた実時刻が0..durationMsに収まること。
WAV/MP3/M4Aを別ファイルへ変換した後に「同じ曲だから同じタイミング」と仮定しない。
Studioでは最終配布音源を先に確定し、そのデコード結果を解析する。
異なるデコーダによる差を疑う場合は診断クリックと曲先頭/中盤/末尾で確認する。
曲の版違い（live、MV、album、無音カット）は取り違え警告の対象。

## 3. semantic validation
- packId/revision/chartId/note.idの必要範囲内での一意性。
- manifest.chartsのchartId/difficulty/pathと各chart本文が一致。
- SHAが実際の内容と一致。大小文字はschemaに従いlowercase固定。
- beatTimesMsが厳密昇順で0以上duration未満。downbeatIndicesが有効・昇順。
- sectionsのstart<end、duration内。同じkindを含め相互に重複させない。
- 全noteが厳密昇順。同時刻の2ノート・複数レーンはv1では拒否する。
- 大音符はtapのみ。rollにcolor/sizeを付けない。
- roll.start<roll.end。roll同士は重ねない。
- tapの時刻を[roll.start-90, roll.end+90]へ置かない。境界も禁止。
- chart内に少なくとも1つのtapがある。空譜面は保存不可。
- durationと音源の実デコード長との差が100ms超ならエラー/再生成案内。
- ノートIDと曲名などをHTMLとして解釈しない。textContentを使う。

## 4. リソース制限（初版の設計上限）
圧縮ZIP96MiB、実展開総量160MiB、ファイル数16、
音源80MiB、cover2MiB、manifest2MiB、chart各8MiB、notes各20,000、
音源最大480秒、最大2ch、sampleRateは44.1k/48k。
長い音源はStudio側で容量とメモリの警告。容量を理由なく増やしてクラッシュさせない。
展開サイズのメタデータだけを信頼せず、実際に展開したbytesにも制限。
圧縮比だけでrejectしない（無音WAV等は高圧縮が正常）。実サイズ/件数/CPU取消で守る。
WAV以外は拡張子だけでなくMIME/コンテナ・decode成功を確認する。
一曲ずつ解凍・hash・保存し、大量のarraybufferコピーを並列保持しない。
decode時は44.1/48kのFloat32がファイルより大きいことを考慮し、一曲しか保持しない。

## 5. 不正ZIPの扱い
allowlistのパス以外のJS/HTML/SVG/実行ファイル/隠しファイルはreject。
許すパスは上の構造だけ。../、絶対path、backslash、drive名、NUL、重複entryをreject。
ZIP symlink、暗号化ZIP、ネストZIPもreject。特別扱いで実行しない。
file名はASCII限定、タイトル/作者の文字列は日本語可。
cancelとエラー後に途中の曲レコードが残らない。既存曲は壊さない。

## 6. IndexedDB
DB名 chachamaru-rhythm、初期schemaVersion1。
stores:
- songs: key packId, manifest/revision/importedAt
- blobs: key sha256, Blob/type/bytes（音源と画像）
- charts: key [packId,chartId], JSON/hash
- settings: key name, value
- records: compound key [packId,chartId,audioHash,chartHash,ruleset,inputMode]
- runs: runId、結果、任意の短い診断ログ

検証・hash・decode確認を終えてから書込transactionを開始。
transaction中に外部fetchや長いawait処理を挟まない。
新規取込はatomic。同じpackId+revision+hashなら重複登録せず案内。
同packIdの異なるrevision/hashは「置換する/別曲として読み込む/取消」のUI。
原音Blobをchartごとに3重保存しない。
削除時に参照されなくなったblobだけ消す。無関係の曲・記録を消さない。
DB migrationはバージョン単位、失敗時にDB全削除で逃げない。

## 7. バックアップ
曲は元ZIPをFiles/iCloud等に保管。ブラウザ保存が永久だとは書かない（S07）。
設定/記録はJSONでexport/import。schemaVersion、保存日、互換条件を持つ。
settingsバックアップに音源・MIDI機器の個人識別情報を不要に含めない。
storage.estimate/persistが使える時だけ表示/要求。失敗してもゲームは動く。
容量不足は「曲を削除する/元ZIPを保持して再試行」へ案内。

## 8. オフラインとアップデート
Service Worker利用可ならapp shellと公開自作素材をversion付きでcache。
private曲はIndexedDBを使い、GitHubへfetchしない。
SWが無い場合は「起動にはネットが必要、取込済み曲はローカル再生」と明示。
更新版SWは演奏中skipWaitingを強制しない。曲終了後に適用確認。
old cache削除は自分のprefixだけ。IndexedDBまで消さない。
異なるブラウザ間、Safariのホーム画面とMIDIWebで保存領域が共有されると仮定しない。

## 9. 公開の境界
許可された静的なgame code、独自素材、オリジナルデモのみをdistへ出す。
`_private/`, 入力音源, ステム, Logic projects, reference画像, ユーザーZIPを除外。
.gitignoreは補助。tracked filesとdistを別々にallowlist検査。
ファイル名だけでなく公開asset manifestのshaと出所の整合性を確認。
外部解析/analytics/広告/エラー自動送信なし。曲をネットへPOSTしない。
GitHubのURLが非公開だと仮定しない。公開リポジトリには秘密情報を置かない。
