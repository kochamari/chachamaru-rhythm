# 08｜実機チェック（コードだけでは合格にしない）
このファイルは初版開発を止めるゲートではなく、実機保証を分離する記録。

## 診断画面の表示
機種・OS・ブラウザ版（取得不能なら手入力）、build commit、画面サイズ、
AudioContext state/sampleRate、clock mode、音声routeプロフィール、
Web MIDI有無・port名・active port、note/channel/velocity/receipt/timeStamp、
pointerIdとpad、DB書込可否、storage quota推定、SW/Wake Lock/fullscreen可否。
USB入力を受信しても、音源再生・保存・オフラインを全部確認済みにしない。

## 最短チェックの順
1. 取込不要の自作デモをiPhoneで再生。4padを交互・同時に触る。消音スイッチをオンにしても曲と打音が鳴るか（`navigator.audioSession`対応版のみ）。共有メニューの「ホーム画面に追加」で全画面起動も確認。
2. diagnosticsで短いZIPを取込。再読み込み後も存在するか確認。
3. TD-17をGENERICに設定したうえでUSB接続。実際に採用した設定を記録する。
4. MIDI Learnでスネア→don、フロアタム→ka。受信数と反応を確認。
5. デモを流しながら叩く。Web打音はMIDI時既定mute、TD-17側の音を使用。メニューもパッドだけで操作できるか（フロアタム＝移動、スネア＝決定）。
6. USBを一度外す→pause→つなぎ直す→明示再開。二重入力が無いか確認。
7. 曲音声の使用経路（iPhone内蔵/BT→TD-17/別の有線）で補正。
8. 通常画面・サビ・100combo演出を含む1曲を完走。先頭/中間/末尾を比較。
9. ブラウザ完全終了、再起動、曲保存とネット断時の挙動を記録。
10. 10分連続で発熱、fps間隔、音切れ、入力の取りこぼし感を記録。

## 音声について
本設計ではTD-17のUSBをMIDI用とし、iPhone→TD-17の曲音声は別経路。
GENERIC/VENDORと音声経路はRolandの現行資料（S13/S14）で再確認する。USB音声対応を推測しない。
パッドから本体が出す音はTD-17のキット設定次第。MIDIのdon割当だけで本体音色は変わらない。
BTでの固定offset調整は経路遅延やその揺れ自体を消す機能ではない。
校正結果には人のタップの揺れも入る。受信counterだけで物理遅延0msと報告しない。

## 結果記録
date/device/OS/browser version/TD-17 mode/cable/output route/build を必須。
各HゲートはPASS/FAIL/NOT_RUN。使用しない音声経路を測定したことにしない。
MIDIWeb Browserの作者はCore MIDI橋渡しの設計を公開している（S03）。
それは当該iPhone+TD-17+ケーブル+アプリ版の動作保証とは別。
