# 07｜一つのgoalで進める実行計画
これは「ユーザーに毎回許可を求める段階分割」ではない。Codex内部のチェックポイント。
実機診断が未実施でも他の作業は進める。診断ページだけで止まらない。

## CP0：現状確認と安全な土台
workspace/既存変更/依存/利用可能ツールを確認。既存コードがあれば読む。
gitignoreと公開境界を先に作る。参考資料をpublicへ移さない。
PROGRESS、DECISIONS、compatibilityの初期値を作る。
schemataとcontractsを確認し、開発依存とlockを整備。
完了証拠：doctor出力、spec一覧、schemaの正負fixture試験。

## CP1：純粋なコアとデータ
Engine/Scoring/Replay/validators/InputRouter/clockの式を実装してunitを先に通す。
StorageとZIP取込を作りdiagnostic-packをroundtrip。
画面の仮図形はこの内部段階だけ認める。
完了証拠：U/P群の関連テスト。実機待ちにしない。

## CP2：一曲を最後まで遊べる導線
AudioEngine、4pad、keyboard、MIDI Learn、全screen、pause/retry/resultsを接続。
オリジナル64秒デモを作る。独自の五音階メロディ、bass、打楽器、コードで構成。
BPM120、4/4、32小節を初期設計：
0〜8秒intro、8〜24秒verse、24〜40秒chorus、40〜48秒bridge、48〜64秒final chorus。
normalは100tap以上、明瞭なdon/ka、大音符とrollを含める。
demoタイトル「ひまわり囃子」。既存曲のメロディを転用しない。
解析fixtureのクリックだけを完成版demoの代わりにしない。
完了証拠：自動演奏の完走＋実操作の入力経路＋結果保存。

## CP3：Mac Studioを端から端まで
ローカルAPI、解析worker、下書きgenerator、timeline editor、保存、ZIP export。
生音源→最終audio→解析→編集→ZIP→Web取込を実際に通す。
音源未提供なら自作demoを使う。J-POPが無いだけで停止しない。
完了証拠：M群、出力ZIP、browserで取込した結果。

## CP4：参考に沿った完成ビジュアル
背景、独立した犬のrig、太鼓、ノーツ、全演出、各screenを仕上げる。
利用可能な素材生成手段を確認し、追加課金不要の範囲で制作。
単なるCSSカード/丸/絵文字の試作から卒業させる。
8種類以上のscreenを撮影→開く→referenceと比較→修正。
完了証拠：V群、素材出所一覧、演出場面の比較。

## CP5：互換性・負荷・公開ビルド
端末API不在のfallback、実機用診断、ストレージ回復、base path、
CI、Pages workflow、private混入audit、README、Start Studio.command。
verify+E2Eを全実行。失敗を直す。
実機が使えるならH群を実施。使えないならNOT_RUNを残す。
公開許可と認証がある場合のみD群。無ければ準備完了まで。

## 継続ルール
各CPで「何が動く/何を試した/次は何か」をPROGRESSへ10〜20行程度で追記。
ユーザーから返信がないことを、次のCPへ進まない理由にしない。
同じ失敗を3回繰り返したら原因と仮説を整理し、代替策/切り分けを行う。
実現できないAPIは指定fallbackへ。P0の機能そのものを消して代替にしない。
固定目標を満たすまで検証と修正を続けるが、利用枠や安全境界を突破しない。

## 停止を認める条件
全実装/視覚ゲートのPASS、又は本当の権限/依存/予算/環境のblocker。
ハードウェア不在・公開権限不在だけなら、関連ゲートを分離し他は完了させる。
追加購入、OS権限、未知の公開先が必須になった箇所だけユーザー操作として残す。

## 最終DELIVERY
1. IMPLEMENTATION/VISUAL/DEVICE/DEPLOYMENTのstatus。
2. ユーザーが開く方法（WebとMac Studio）。
3. 実行済みコマンドとexit code、test数、ログ。
4. screenshotsと比較所見。
5. 非公開にした場所とpublic audit。
6. 実機で残る具体的手順。
7. 未完了がある場合は再開promptと優先順位。
「完璧」「確実」「本家同一」など証拠以上の表現で締めない。
