# 独自素材の出所

背景は組み込みimage_genで新規生成し、元画像PNGを残したまま `web/public/original-assets/festival.webp` に保存。参考画像・動画・音源は画像生成へ送っていない。

生成プロンプト:

> Use case: illustration-story. Asset type: wide panoramic background for an original Japanese festival rhythm game. Create a gorgeous warm painterly illustrated Japanese village at late golden sunset, terracotta tiled roofs and wooden traditional shopfronts in the middle distance, a welcoming open flat festival square along the lower third, tiny red and golden lanterns strung across the sky at the top, layers of soft blue-teal mountains, warm apricot sky, a few sunflowers and tall grasses framing the very edges in the foreground. Rich illustrated picture-book brushwork, delicate ink contour, Japanese artisan aesthetic, coherent warm honey, vermilion, dark teal, cream palette. Landscape 16:9 composition, center remains open for a separately animated dog and drum. No animals, no people, no characters, no writing, no UI, no logos, no watermark. This is a new original artwork, not an edit of any attached image.

ちゃちゃまるは `web/src/render/Character.ts` の独自SVGパーツ。胴・頭・耳左右・前脚左右・後脚左右・巻き尾・スカーフを別グループで動かす。公式のゲーム画像・顔・ロゴを抽出していない。

音楽「ひまわり囃子」は `scripts/create-demo.py` の独自五音階フレーズ・和音・ベース・合成打楽器。既存曲・サンプル音源・声を使用していない。64秒 / 120 BPM / 32小節。効果音はWeb Audioによる独自合成。

公開用ファイルのSHA-256は `assets/manifest.json` に固定し、ビルド時に検査する。OSフォントを使用し、第三者フォントやCDNを読み込まない。
