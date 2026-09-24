# 独自素材の出所

背景は組み込みimage_genで新規生成し、元画像PNGを残したまま `web/public/original-assets/festival.webp` に保存。参考画像・動画・音源は画像生成へ送っていない。

生成プロンプト:

> Use case: illustration-story. Asset type: wide panoramic background for an original Japanese festival rhythm game. Create a gorgeous warm painterly illustrated Japanese village at late golden sunset, terracotta tiled roofs and wooden traditional shopfronts in the middle distance, a welcoming open flat festival square along the lower third, tiny red and golden lanterns strung across the sky at the top, layers of soft blue-teal mountains, warm apricot sky, a few sunflowers and tall grasses framing the very edges in the foreground. Rich illustrated picture-book brushwork, delicate ink contour, Japanese artisan aesthetic, coherent warm honey, vermilion, dark teal, cream palette. Landscape 16:9 composition, center remains open for a separately animated dog and drum. No animals, no people, no characters, no writing, no UI, no logos, no watermark. This is a new original artwork, not an edit of any attached image.

ちゃちゃまるは、ユーザーが選んだ独自のアニメ調イラストを透過パーツ化し、`web/src/render/Character.ts` のSVGリグで組み立てて動かす。公式のゲーム画像・顔・ロゴを抽出していない。詳細と生成プロンプトは下記。

音楽「ひまわり囃子」は `scripts/create-demo.py` の独自五音階フレーズ・和音・ベース・合成打楽器。既存曲・サンプル音源・声を使用していない。64秒 / 120 BPM / 32小節。効果音はWeb Audioによる独自合成。

公開用ファイルのSHA-256は `assets/manifest.json` に固定し、ビルド時に検査する。OSフォントを使用し、第三者フォントやCDNを読み込まない。

## ちゃちゃまる・アニメ調（2026-09-24）

ユーザーが4候補から、バチを上げている手描きアニメ調の案を選択。組み込み `image_gen` で新規生成した基準絵を参照し、同じ顔・色・輪郭の透過パーツアトラスを生成。ユーザー提供の参考画像・動画・音源は送信していない。CLI・外部有料APIは使用していない。

公開素材: `web/public/original-assets/chachamaru-anime-v1.png`（1254 × 1254、RGBA）。画像自体は生成出力をそのまま保存。`web/src/render/character-rig.ts` がSVGのviewBoxで各部位を切り出して描画し、`Character.ts` が胴・頭・耳左右・前脚左右・後脚左右・巻き尾・スカーフを独立して動かす。目は開閉2枚の絵を切り替える。

### 採用した基準絵のプロンプト

```text
Use case: illustration-story. Create one original design candidate for Chachamaru, a charming red Shiba Inu mascot for a Japanese rhythm game. The user will compare four distinctly different illustration styles and select one. This image is ONE candidate only, no comparison grid. Portrait full-body character centered on a clean warm ivory background with generous breathing room, a small shadow at feet. Chachamaru has reddish tan fur, cream muzzle/cheeks/chest/paws, upright triangular ears, a curled tail, a deep green karakusa scarf with little ivory vine curls, and one sunflower at the dog's right neck (viewer left). Sitting happily behind a modest small red wooden taiko drum, two front paws holding short wooden drumsticks. Show the entire silhouette, paws, tail and ears. The character must feel lovable, expressive, beautifully designed and unmistakably a Shiba. No logos, no letters, no labels, no writing, no watermark. No glossy 3D, no photorealistic fur, no giant doll-like glass eyeballs, no plastic toy look.
STYLE C — EXPRESSIVE HAND-DRAWN 2D ANIME MASCOT. A polished original Japanese animated film character model, three-quarter view, friendly plump Shiba with bouncy silhouette, clean beautifully tapered dark sepia ink outlines, small angular fur tufts, warm orange and cream flat cel shading with exactly two shadow tones. Chubby rounded cheeks, short triangular ears, small shiny black expressive dog eyes, thick cute cream bean eyebrows, playful little open smile and pink tongue. 2 heads tall, big fluffy tail visibly curled up behind. One paw raised joyfully holding its drumstick, other ready over drum, energetic invitation to play. Charming squash-and-stretch potential, carefully designed paws, coherent anatomy, tasteful little blush. Warm daytime animation colors. No watercolor texture, no 3D rendering, no thick generic mascot logo outline, no human-like eyes or giant irises.
```

### 透過パーツ生成のプロンプト

入力は上記で新規生成した基準絵のみ。

```text
Use case: precise-object-edit / animation asset preparation.
Input image: the USER-SELECTED original Chachamaru Shiba mascot. Preserve this exact character: hand-drawn 2D animation style, tapered dark brown ink contours, golden apricot orange fur, cream muzzle and fluffy cheeks, small black oval dog eyes with a single tiny white highlight, two large cream oval eyebrow spots, big delighted smile with pink tongue and tiny pointed teeth, triangular ears, chunky curl tail, dark forest-green ivory karakusa scarf, sunflower ON VIEWER RIGHT as shown. Keep this precise face, fur tufts, color palette, flat cel-shading and little blush marks. Do not make it 3D or glossy. No watercolor restyling.

Create ONE square high-resolution transparent PNG CUTOUT PUPPET ATLAS. Exactly 4 columns and 4 rows of equal invisible cells. Each cell contains one isolated component centered, filling about 80% of the cell, generous transparent gutters. No grid lines, no labels, no letters, no background, no painted checkerboard, no cast shadows. The cells contain disconnected sprite parts for assembly, NOT a complete dog. Rounded hidden ends on limbs for overlap. Consistent front-facing/slight-three-quarter perspective of the reference. Beautiful fully finished ink and cel-colored edges, high readability at small sizes.

Row 1 left to right:
1. Whole furry HEAD AND FACE ONLY with OPEN EYES, preserve exactly the reference face, joyful smile and cream cheeks; no ears, no scarf, no neck, no body. Complete fluffy rounded forehead where ears can be attached behind.
2. EXACT SAME HEAD in exactly the SAME POSITION, shape and scale, identical muzzle and mouth, but both eyes CLOSED in happy tiny curved strokes for a blink. No ears, no scarf, no body.
3. Only the VIEWER LEFT EAR, entire orange triangle ear with peach and cream inner fluff, softly rounded hidden attachment root.
4. Only the VIEWER RIGHT EAR, same design matching its orientation in the reference.

Row 2 left to right:
1. Only the plump compact TORSO, orange sides and large fluffy cream chest and belly, rounded top stump and rump, no limbs/head/scarf/tail/drum.
2. Only the large FLUFFY CURLED TAIL, as in the reference, orange spiral and cream upper edge, complete rounded attachment end.
3. Only the green karakusa MAIN SCARF BAND, curved cloth crescent with delicate cream curls, no flower, no knot ends, no fur.
4. Only the green karakusa KNOT AND DANGLING CLOTH ENDS, separate isolated accessory.

Row 3 left to right:
1. Only the VIEWER LEFT FRONT ARM WITH ONE WOODEN DRUMSTICK, short orange arm and cream gripping paw, stick pointing diagonally upward LEFT. Full stick, paw and upper arm with rounded shoulder root. Not raised vertically: a relaxed ready-to-play pose that will be animated to lift.
2. Only the VIEWER RIGHT FRONT ARM WITH ONE WOODEN DRUMSTICK, short arm and cream gripping paw, stick pointing diagonally upward RIGHT. Entire part; relaxed ready-to-play pose.
3. Only the VIEWER LEFT HIND LEG AND FOOT: short chunky orange thigh and big cream three-toed foot, whole isolated leg with rounded furry hidden root.
4. Only the VIEWER RIGHT HIND LEG AND FOOT, matching design and perspective.

Row 4 left to right:
1. COMPLETE RED TAIKO DRUM WITH ITS WOODEN STAND, exactly the reference simple cel-shaded warm red barrel, ivory shallow ellipse top, black tacks and side rope loops. No animal or sticks.
2. Only the SUNFLOWER PIN with two little dark green leaves, same yellow petal and brown center ink design as reference.
3. VIEWER LEFT FRONT ARM AND CREAM PAW, short chunky arm, same as row 3 cell 1 but NO STICK, for waving/dancing.
4. VIEWER RIGHT FRONT ARM AND CREAM PAW, same as row 3 cell 2 but NO STICK.

Exactly 16 isolated parts, true transparent background, keep every component inside its own invisible equal cell. No duplicate complete characters or miniature assembly example. This is faithful production asset separation of the chosen character, not a new design.
```
