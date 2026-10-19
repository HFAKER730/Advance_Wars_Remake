/**
 * Minimal 2D canvas shim + PNG encoder for headless art verification.
 *
 * The game's art modules only use fillRect, polygon fill, 1px stroke,
 * save/restore/translate/scale, globalAlpha and same-size drawImage. This
 * shim covers exactly those, so a sprite can be rasterized in Node and
 * inspected as a PNG without adding an npm dependency.
 *
 * Not a general canvas implementation: no transforms on fillRect beyond
 * translate/scale, no gradients, no text.
 */
import zlib from "node:zlib";

function parseColor(value) {
  if (typeof value !== "string") throw new Error(`unsupported fill: ${value}`);
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3)
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
        255,
      ];
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      255,
    ];
  }
  const rgba = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgba) {
    const parts = rgba[1].split(",").map((part) => Number(part.trim()));
    return [parts[0], parts[1], parts[2], Math.round((parts[3] ?? 1) * 255)];
  }
  throw new Error(`unsupported fill: ${value}`);
}

export class Context2D {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
    this.fillStyle = "#000000";
    this.strokeStyle = "#000000";
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.filter = "none";
    this.#stack = [];
    this.tx = 0;
    this.ty = 0;
    this.sx = 1;
    this.sy = 1;
    this.path = [];
    this.clipRect = null;
  }

  #stack;

  save() {
    this.#stack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      globalAlpha: this.globalAlpha,
      filter: this.filter,
      tx: this.tx,
      ty: this.ty,
      sx: this.sx,
      sy: this.sy,
      clipRect: this.clipRect,
    });
  }

  restore() {
    const state = this.#stack.pop();
    if (!state) return;
    Object.assign(this, state);
  }

  translate(x, y) {
    this.tx += x;
    this.ty += y;
  }

  scale(x, y) {
    this.sx *= x;
    this.sy *= y;
  }

  clearRect(x, y, w, h) {
    const previous = this.fillStyle;
    this.fillStyle = "rgba(0,0,0,0)";
    this.#rect(x, y, w, h, [0, 0, 0, 0], true);
    this.fillStyle = previous;
  }

  fillRect(x, y, w, h) {
    const [r, g, b, a] = parseColor(this.fillStyle);
    this.#rect(x, y, w, h, [r, g, b, a]);
  }

  #rect(x, y, w, h, rgba, replace = false) {
    const x0 = Math.round(this.tx + x * this.sx);
    const y0 = Math.round(this.ty + y * this.sy);
    const x1 = Math.round(this.tx + (x + w) * this.sx);
    const y1 = Math.round(this.ty + (y + h) * this.sy);
    const alpha = (rgba[3] / 255) * this.globalAlpha;
    for (let py = Math.max(Math.min(y0, y1), this.clipRect?.y0 ?? 0); py < Math.min(Math.max(y0, y1), this.clipRect?.y1 ?? this.height); py++) {
      if (py < 0 || py >= this.height) continue;
      for (let px = Math.max(Math.min(x0, x1), this.clipRect?.x0 ?? 0); px < Math.min(Math.max(x0, x1), this.clipRect?.x1 ?? this.width); px++) {
        if (px < 0 || px >= this.width) continue;
        const offset = (py * this.width + px) * 4;
        if (replace || alpha >= 1) {
          this.data[offset] = rgba[0];
          this.data[offset + 1] = rgba[1];
          this.data[offset + 2] = rgba[2];
          this.data[offset + 3] = Math.round(alpha * 255);
          continue;
        }
        const dstA = this.data[offset + 3] / 255;
        const outA = alpha + dstA * (1 - alpha);
        if (outA === 0) continue;
        for (let c = 0; c < 3; c++)
          this.data[offset + c] = Math.round(
            (rgba[c] * alpha + this.data[offset + c] * dstA * (1 - alpha)) / outA,
          );
        this.data[offset + 3] = Math.round(outA * 255);
      }
    }
  }

  beginPath() {
    this.path = [];
  }

  moveTo(x, y) {
    this.path.push([this.tx + x * this.sx, this.ty + y * this.sy]);
  }

  lineTo(x, y) {
    this.path.push([this.tx + x * this.sx, this.ty + y * this.sy]);
  }

  /** Path rectangle, as the combat scene uses to clip each half of the stage. */
  rect(x, y, w, h) {
    this.path.push(
      [this.tx + x * this.sx, this.ty + y * this.sy],
      [this.tx + (x + w) * this.sx, this.ty + y * this.sy],
      [this.tx + (x + w) * this.sx, this.ty + (y + h) * this.sy],
      [this.tx + x * this.sx, this.ty + (y + h) * this.sy],
    );
  }

  /** Axis-aligned clip over the current path's bounding box. */
  clip() {
    if (this.path.length < 3) {
      this.clipRect = null;
      return;
    }
    const xs = this.path.map((point) => point[0]);
    const ys = this.path.map((point) => point[1]);
    this.clipRect = {
      x0: Math.max(Math.round(Math.min(...xs)), this.clipRect?.x0 ?? 0),
      x1: Math.min(Math.round(Math.max(...xs)), this.clipRect?.x1 ?? this.width),
      y0: Math.max(Math.round(Math.min(...ys)), this.clipRect?.y0 ?? 0),
      y1: Math.min(Math.round(Math.max(...ys)), this.clipRect?.y1 ?? this.height),
    };
  }

  closePath() {
    if (this.path.length > 1) this.path.push([...this.path[0]]);
  }

  fill() {
    if (this.path.length < 3) return;
    const [r, g, b] = parseColor(this.fillStyle);
    const alpha = (parseColor(this.fillStyle)[3] / 255) * this.globalAlpha;
    const ys = this.path.map((p) => p[1]);
    for (let row = Math.ceil(Math.min(...ys)); row < Math.max(...ys); row++) {
      const hits = [];
      for (let i = 0; i < this.path.length - 1; i++) {
        const a = this.path[i];
        const c = this.path[i + 1];
        if ((a[1] <= row + 0.5 && c[1] > row + 0.5) || (c[1] <= row + 0.5 && a[1] > row + 0.5))
          hits.push(a[0] + ((row + 0.5 - a[1]) * (c[0] - a[0])) / (c[1] - a[1]));
      }
      hits.sort((m, n) => m - n);
      for (let i = 0; i + 1 < hits.length; i += 2) {
        const x0 = Math.ceil(hits[i] - 0.5);
        const x1 = Math.ceil(hits[i + 1] - 0.5);
        if (x1 <= x0) continue;
        // Reuse the rect blitter without transform (coordinates are absolute).
        const save = { tx: this.tx, ty: this.ty, sx: this.sx, sy: this.sy };
        this.tx = 0;
        this.ty = 0;
        this.sx = 1;
        this.sy = 1;
        this.#rect(x0, row, x1 - x0, 1, [r, g, b, Math.round(alpha * 255)]);
        Object.assign(this, save);
      }
    }
  }

  stroke() {
    if (this.path.length < 2) return;
    const [r, g, b] = parseColor(this.strokeStyle);
    const alpha = (parseColor(this.strokeStyle)[3] / 255) * this.globalAlpha;
    const half = Math.max(0, Math.floor(this.lineWidth / 2));
    for (let i = 0; i < this.path.length - 1; i++) {
      const [x0, y0] = this.path[i];
      const [x1, y1] = this.path[i + 1];
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const steps = Math.max(dx, dy);
      for (let s = 0; s <= steps; s++) {
        const t = steps === 0 ? 0 : s / steps;
        const px = Math.round(x0 + (x1 - x0) * t) - half;
        const py = Math.round(y0 + (y1 - y0) * t) - half;
        const save = { tx: this.tx, ty: this.ty, sx: this.sx, sy: this.sy };
        this.tx = 0;
        this.ty = 0;
        this.sx = 1;
        this.sy = 1;
        this.#rect(px, py, 1 + half * 2, 1 + half * 2, [r, g, b, Math.round(alpha * 255)]);
        Object.assign(this, save);
      }
    }
  }

  /** Same-size blit only; the art code never scales an offscreen sprite. */
  drawImage(source, dx, dy) {
    for (let y = 0; y < source.height; y++)
      for (let x = 0; x < source.width; x++) {
        const offset = (y * source.width + x) * 4;
        if (source.data[offset + 3] === 0) continue;
        const save = { tx: this.tx, ty: this.ty, sx: this.sx, sy: this.sy };
        this.tx = 0;
        this.ty = 0;
        this.sx = 1;
        this.sy = 1;
        this.#rect(
          dx + x,
          dy + y,
          1,
          1,
          [
            source.data[offset],
            source.data[offset + 1],
            source.data[offset + 2],
            source.data[offset + 3],
          ],
        );
        Object.assign(this, save);
      }
  }

  getImageData() {
    return { width: this.width, height: this.height, data: this.data };
  }
}

export function createCanvas(width, height) {
  const ctx = new Context2D(width, height);
  return {
    width,
    height,
    get data() {
      return ctx.data;
    },
    getContext: () => ctx,
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, payload) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), payload]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Encode an RGBA buffer as a PNG. `scale` is nearest-neighbour upscaling. */
export function encodePng(data, width, height, scale = 1) {
  const outWidth = width * scale;
  const outHeight = height * scale;
  const raw = Buffer.alloc(outHeight * (outWidth * 4 + 1));
  let cursor = 0;
  for (let y = 0; y < outHeight; y++) {
    raw[cursor++] = 0;
    for (let x = 0; x < outWidth; x++) {
      const source = ((Math.floor(y / scale) * width) + Math.floor(x / scale)) * 4;
      raw[cursor++] = data[source];
      raw[cursor++] = data[source + 1];
      raw[cursor++] = data[source + 2];
      raw[cursor++] = data[source + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(outWidth, 0);
  ihdr.writeUInt32BE(outHeight, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Composite a sprite onto a larger sheet at (x, y). */
export function blit(sheet, sprite, x, y) {
  for (let row = 0; row < sprite.height; row++)
    for (let col = 0; col < sprite.width; col++) {
      const from = (row * sprite.width + col) * 4;
      if (sprite.data[from + 3] === 0) continue;
      const to = ((y + row) * sheet.width + (x + col)) * 4;
      if (to < 0 || to >= sheet.data.length) continue;
      sheet.data[to] = sprite.data[from];
      sheet.data[to + 1] = sprite.data[from + 1];
      sheet.data[to + 2] = sprite.data[from + 2];
      sheet.data[to + 3] = 255;
    }
}
