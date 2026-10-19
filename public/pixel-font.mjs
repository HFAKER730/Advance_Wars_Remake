/**
 * A tiny fixed-grid bitmap font for canvas HUD text.
 *
 * Native canvas text is antialiased and hinting-dependent, so the same number
 * looks different at every scale and never lines up with the pixel grid. These
 * glyphs are 3×5 rectangles drawn with `fillRect`: at any integer `scale` each
 * stroke lands on a whole number of device pixels, which is what makes the
 * numbers read like the GBA-era HUD instead of a web font shrunk down.
 *
 * Only the characters the HUD actually prints are implemented. Missing glyphs
 * render as a hollow box so a typo is visible rather than silent.
 */
const GLYPHS = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "/": ["001", "001", "010", "100", "100"],
  "-": ["000", "000", "111", "000", "000"],
  "+": ["000", "010", "111", "010", "000"],
  ".": ["000", "000", "000", "000", "010"],
  ":": ["000", "010", "000", "010", "000"],
  " ": ["000", "000", "000", "000", "000"],
};

const GLYPH_WIDTH = 3;
const GLYPH_HEIGHT = 5;
const FALLBACK = ["111", "101", "101", "101", "111"];

function glyphFor(character) {
  return GLYPHS[character] ?? FALLBACK;
}

/** Width in logical pixels, including the gap between glyphs. */
export function pixelTextWidth(text, scale = 1, spacing = 1) {
  const characters = [...String(text)];
  if (!characters.length) return 0;
  return (
    (characters.length * GLYPH_WIDTH + (characters.length - 1) * spacing) *
    scale
  );
}

export function pixelTextHeight(scale = 1) {
  return GLYPH_HEIGHT * scale;
}

/**
 * Paints `text` with its top-left corner at `x,y` (or centered/right-aligned
 * on `x`). `outline` draws the glyph once in the given colour one scale-step
 * around the glyph, which reads as the hard 1px border used by the GBA HUD and
 * stays crisp because every offset is an integer multiple of the scale.
 */
export function paintPixelText(
  ctx,
  text,
  x,
  y,
  {
    scale = 1,
    color = "#fff9e8",
    align = "left",
    outline = null,
    spacing = 1,
  } = {},
) {
  const characters = [...String(text)];
  if (!characters.length) return;
  const step = (GLYPH_WIDTH + spacing) * scale;
  const width = pixelTextWidth(text, scale, spacing);
  let originX = Math.round(x);
  if (align === "center") originX = Math.round(x - width / 2);
  else if (align === "right") originX = Math.round(x - width);
  const originY = Math.round(y);

  const paint = (offsetX, offsetY, fill) => {
    ctx.fillStyle = fill;
    characters.forEach((character, index) => {
      const rows = glyphFor(character);
      const cellX = originX + index * step + offsetX;
      for (let row = 0; row < GLYPH_HEIGHT; row++) {
        for (let column = 0; column < GLYPH_WIDTH; column++) {
          if (rows[row][column] !== "1") continue;
          ctx.fillRect(
            cellX + column * scale,
            originY + row * scale + offsetY,
            scale,
            scale,
          );
        }
      }
    });
  };

  if (outline) {
    paint(-scale, 0, outline);
    paint(scale, 0, outline);
    paint(0, -scale, outline);
    paint(0, scale, outline);
  }
  paint(0, 0, color);
}
