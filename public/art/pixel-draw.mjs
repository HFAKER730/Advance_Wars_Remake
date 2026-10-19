/**
 * Shared pixel primitives for the faction art module.
 *
 * The frozen artwork in `unit-art.mjs` keeps its own private copies; this
 * module exists so new air, sea and faction-kit painters share one rasterizer
 * without editing already-approved art.
 */

export function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export function poly(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

export function line(ctx, points, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/**
 * Scanline fill of an arbitrary polygon at integer pixel rows. Every row is
 * filled between edge crossings, which is what keeps flat armour faces crisp
 * at 1× instead of leaving antialiased half-pixels.
 */
export function face(ctx, points, color) {
  const ys = points.map((p) => p[1]);
  for (let row = Math.ceil(Math.min(...ys)); row < Math.max(...ys); row++) {
    const hits = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((a[1] <= row + 0.5 && b[1] > row + 0.5) || (b[1] <= row + 0.5 && a[1] > row + 0.5))
        hits.push(a[0] + ((row + 0.5 - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const start = Math.ceil(hits[i] - 0.5);
      box(ctx, start, row, Math.ceil(hits[i + 1] - 0.5) - start, 1, color);
    }
  }
}

/** Small rivet / bolt cluster used to mark welded versus cast armour. */
export function rivets(ctx, xs, ys, color, size = 1) {
  for (const x of xs) for (const y of ys) box(ctx, x, y, size, size, color);
}

/** Faction insignia: a two-tone bar with a notch, drawn where a hull allows. */
export function insignia(ctx, x, y, w, h, style, layout = "bars") {
  box(ctx, x, y, w, h, style.paintShade);
  if (layout === "bars") {
    box(ctx, x + 1, y + 1, w - 2, h - 2, style.accent);
    box(ctx, x + 1, y + Math.floor(h / 2), w - 2, 1, style.paintShade);
  } else if (layout === "chevron") {
    for (let i = 0; i < w - 2; i++) {
      const t = Math.floor(i / 2) % 2;
      box(ctx, x + 1 + i, y + 1 + t, 1, Math.max(1, h - 2 - t * 2), style.accent);
    }
  } else {
    box(ctx, x + 1, y + 1, w - 2, h - 2, style.accent);
    box(ctx, x + 1, y + 1, 1, h - 2, style.paintShade);
  }
}
