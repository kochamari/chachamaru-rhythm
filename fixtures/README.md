# 開発用の自作データ

- `diagnostic.wav`: `scripts/create-demo.py` で合成した4秒の診断用リズム。市販曲のサンプルを含まない。
- `diagnostic-pack.zip`: 上記音源を通常のMac StudioパイプラインでAAC-LC化・解析・3難易度生成して書き出した正例。SHA・schema・意味検証の対象。
- `demo-project.json`: 自作64秒「ひまわり囃子」の編集操作用データ。公開用ZIPは `web/public/original-demo/himawari.zip`。

悪いパス、SHA不一致、重複ID、容量超過等の不正fixtureはテスト内で正例から生成する。ユーザー提供音源・動画・画像はfixtureに含めない。
