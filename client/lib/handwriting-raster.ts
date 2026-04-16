import type { HandwritingStrokeBundle } from "@shared/handwriting";

/**
 * Rasterize stroke bundle to a PNG data URL (white background, dark strokes).
 * Downscales so the longest side is at most `maxSide` px for API size limits.
 */
export function handwritingStrokesToPngDataUrl(bundle: HandwritingStrokeBundle, maxSide = 1024): string {
  const lines = bundle.lines;
  if (!lines.length) return "";

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const line of lines) {
    for (const [x, y] of line.points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const pad = 18;
  const wRaw = Math.max(1, maxX - minX + pad * 2);
  const hRaw = Math.max(1, maxY - minY + pad * 2);
  const scale = Math.min(1, maxSide / Math.max(wRaw, hRaw));
  const w = Math.max(1, Math.ceil(wRaw * scale));
  const h = Math.max(1, Math.ceil(hRaw * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = Math.max(1.25, 2 * scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const tx = (x: number, y: number): [number, number] => [
    (x - minX + pad) * scale,
    (y - minY + pad) * scale,
  ];

  for (const line of lines) {
    const pts = line.points;
    if (pts.length < 2) continue;
    ctx.beginPath();
    const [x0, y0] = tx(pts[0]![0], pts[0]![1]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < pts.length; i++) {
      const [lx, ly] = tx(pts[i]![0], pts[i]![1]);
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
  }

  return canvas.toDataURL("image/png");
}
