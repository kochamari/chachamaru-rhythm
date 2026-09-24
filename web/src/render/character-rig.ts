// Rectangles address the untouched image_gen atlas. SVG viewports crop its
// transparent parts at render time, so every view uses the same decoded image.
export const CHARACTER_ATLAS = `${import.meta.env.BASE_URL}original-assets/chachamaru-anime-v1.png`;
const SIZE = 1254;
type Rect = readonly [number, number, number, number];
const regions = {
 head: [10, 38, 314, 278], blink: [329, 38, 311, 278],
 earLeft: [689, 37, 212, 273], earRight: [984, 42, 224, 270],
 torso: [20, 329, 318, 299], tail: [350, 328, 277, 301],
 band: [635, 385, 312, 199], scarf: [964, 404, 271, 187],
 armLeft: [20, 630, 272, 278], armRight: [333, 630, 272, 278],
 footLeft: [660, 628, 242, 282], footRight: [982, 628, 238, 282],
 drum: [12, 920, 322, 290], flower: [368, 954, 258, 218],
 pawLeft: [647, 959, 257, 247], pawRight: [972, 959, 262, 247],
} satisfies Record<string, Rect>;

export function sprite(part: keyof typeof regions, x: number, y: number, width: number): string {
 const [sx, sy, sw, sh] = regions[part];
 return `<svg x="${x}" y="${y}" width="${width}" height="${width * sh / sw}" viewBox="${sx} ${sy} ${sw} ${sh}" overflow="hidden" aria-hidden="true"><image href="${CHARACTER_ATLAS}" width="${SIZE}" height="${SIZE}"/></svg>`;
}
