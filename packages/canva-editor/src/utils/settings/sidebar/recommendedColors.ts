// Derives an on-vibe recommended palette from the colours already present in the design.
// Rather than sampling pixels (which risks CORS-tainting the canvas), we read the colours the
// template already uses and extend them harmonically — tints/shades, a complementary accent, and
// tasteful neutrals — so the suggestions feel drawn from the certificate's own mood.

type RGB = { r: number; g: number; b: number };

function parseColor(input: string): RGB | null {
  if (!input) return null;
  const s = input.trim();
  const hex = s.match(/^#?([0-9a-f]{6})$/i) || s.match(/^#?([0-9a-f]{3})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  const rgb = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3] };
  return null;
}

const toHex = ({ r, g, b }: RGB) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

function rgbToHsl({ r, g, b }: RGB) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

const hsl = (h: number, s: number, l: number) => toHex(hslToRgb(h, s, l));

/**
 * @param documentColors colours already used in the design (rgb()/hex strings)
 * @returns up to 12 recommended hex colours, most on-theme first
 */
export function recommendPalette(documentColors: string[]): string[] {
  const parsed = documentColors.map(parseColor).filter((c): c is RGB => !!c).map((c) => ({ rgb: c, ...rgbToHsl(c) }));

  // Pick the most "characterful" chromatic seed: prefer saturated, mid-light colours.
  const chromatic = parsed.filter((c) => c.s > 0.15 && c.l > 0.12 && c.l < 0.9);
  chromatic.sort((a, b) => b.s * (1 - Math.abs(0.5 - b.l)) - a.s * (1 - Math.abs(0.5 - a.l)));

  const out: string[] = [];
  const push = (hex: string) => {
    const k = hex.toLowerCase();
    if (!out.some((o) => o.toLowerCase() === k)) out.push(hex);
  };

  if (chromatic.length > 0) {
    const seed = chromatic[0];
    // seed, a light tint, a deep shade
    push(hsl(seed.h, Math.min(1, seed.s), seed.l));
    push(hsl(seed.h, Math.max(0.25, seed.s * 0.8), Math.min(0.92, seed.l + 0.28)));
    push(hsl(seed.h, Math.min(1, seed.s * 1.05), Math.max(0.16, seed.l - 0.24)));
    // complementary accent
    push(hsl(seed.h + 180, Math.min(1, Math.max(0.4, seed.s)), 0.5));
    // analogous pair
    push(hsl(seed.h + 30, Math.min(1, seed.s), Math.min(0.7, seed.l + 0.05)));
    // a second seed if the design has another distinct hue
    const second = chromatic.find((c) => Math.abs(c.h - seed.h) > 40);
    if (second) {
      push(hsl(second.h, Math.min(1, second.s), second.l));
      push(hsl(second.h, Math.max(0.25, second.s * 0.8), Math.min(0.92, second.l + 0.25)));
    }
  }

  // Tasteful neutrals grounded in the CertiFlow palette so certificates stay elegant.
  ['#0B1B3A', '#4A4A4A', '#8A8578', '#E7E2D9', '#FBF9F5', '#B48A5A'].forEach(push);

  return out.slice(0, 12);
}
