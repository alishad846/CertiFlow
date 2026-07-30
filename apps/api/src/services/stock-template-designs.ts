// Editable editor documents for the ready-made (stock) certificate designs.
//
// The old stock templates shipped as flat PNG backgrounds, so their border/lines/seal were
// baked into the image and could not be edited. Here we re-author each design as a real Canva
// editor document: a coloured RootLayer plus individually selectable Shape layers (border frame,
// divider lines, a seal circle) and Text layers (title, name placeholder, body, signature/date).
// Cloning a stock design now opens the editor with every element movable, restyleable and deletable.
//
// The document is written in the editor's readable (unpacked) shape — an array of one page whose
// `layers` map is keyed by layer id, each layer carrying `type.resolvedName` + `props` + `child`
// + `parent`. `unpack()` passes this shape through unchanged on load (same contract as
// apps/web/src/lib/editor-document.ts buildBackgroundDocument).

// The editor stores every design PACKED: object keys are minified to short codes and reversed on
// load via unpack() (packages/canva-editor/src/utils/minifier.ts). We hand-author in the readable
// shape, then pack with the SAME static mapping so unpack() restores it byte-for-byte. This also
// avoids a subtle collision: the readable keys `x`/`y` are themselves minified *values* in the
// mapping (family=`x`, url=`y`), so storing readable `position:{x,y}` would make unpack rewrite it
// to `{family,url}` and drop the coordinates. Keep this mapping in sync with minifier.ts dataMapping.
const DATA_MAPPING: Record<string, string> = {
  name: 'a', notes: 'b', layers: 'c', ROOT: 'd', type: 'e', resolvedName: 'f', props: 'g',
  boxSize: 'h', width: 'i', height: 'j', position: 'k', x: 'l', y: 'm', rotate: 'n', color: 'o',
  image: 'p', gradientBackground: 'q', locked: 'r', child: 's', parent: 't', scale: 'u', text: 'v',
  fonts: 'w', family: 'x', url: 'y', style: 'z', styles: 'aa', colors: 'ab', fontSizes: 'ac',
  effect: 'ad', settings: 'ae', thickness: 'af', transparency: 'ag', clipPath: 'ah', shapeSize: 'ai',
  thumb: 'aj', offset: 'ak', direction: 'al', blur: 'am', border: 'an', weight: 'ao', roundedCorners: 'ap'
};

// Deterministic inverse of unpack(): replace each known readable key with its short code, leaving
// layer ids and string values untouched. unpack() reverses it via the same dataMapping.
function packDesign(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(packDesign);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      out[DATA_MAPPING[key] ?? key] = packDesign(value);
    }
    return out;
  }
  return node;
}

const CANVAS = { width: 1414, height: 1000 };

// Full square in its own coordinate space; ShapeContent scales it to the layer boxSize (scale 1,
// shapeSize === boxSize → 1:1). Rectangles, frames and divider bars all reuse this path.
const squarePath = (w: number, h: number) => `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;

// 60-gon that reads as a circle (matches shapes.json "shape circle" #013), in a 256×256 space.
const CIRCLE_PATH =
  'M 128 0 L 140.418 10.5032 L 154.759 2.7971 L 164.71 15.6384 L 180.349 11.0662 L 187.397 25.6843 L 203.651 24.4458 L 207.489 40.202 L 223.646 42.3512 L 224.107 58.5568 L 239.462 64 L 236.524 79.9464 L 250.406 88.446 L 244.199 103.436 L 256 114.62 L 246.795 128 L 256 141.38 L 244.199 152.564 L 250.406 167.554 L 236.524 176.054 L 239.462 192 L 224.107 197.443 L 223.646 213.649 L 207.489 215.798 L 203.651 231.554 L 187.397 230.316 L 180.349 244.934 L 164.71 240.362 L 154.759 253.203 L 140.418 245.497 L 128 256 L 115.582 245.497 L 101.241 253.203 L 91.2904 240.362 L 75.6508 244.934 L 68.6028 230.316 L 52.3492 231.554 L 48.5108 215.798 L 32.3535 213.649 L 31.893 197.443 L 16.5382 192 L 19.4756 176.054 L 5.5942 167.554 L 11.8012 152.564 L 0 141.38 L 9.20524 128 L 0 114.62 L 11.8012 103.436 L 5.5942 88.446 L 19.4756 79.9464 L 16.5382 64 L 31.893 58.5568 L 32.3535 42.3512 L 48.5108 40.202 L 52.3492 24.4458 L 68.6028 25.6843 L 75.6508 11.0662 L 91.2904 15.6384 L 101.241 2.7971 L 115.582 10.5032 L 128 0 Z';

type FontSlug = 'playfair-display' | 'cormorant-garamond' | 'lora';
type FontFamily = 'Playfair Display' | 'Cormorant Garamond' | 'Lora';
type Weight = 'regular' | '700' | 'italic' | '700italic';

const FAMILY_BY_SLUG: Record<FontSlug, FontFamily> = {
  'playfair-display': 'Playfair Display',
  'cormorant-garamond': 'Cormorant Garamond',
  lora: 'Lora'
};

const styleName = (family: FontFamily, weight: Weight) => {
  switch (weight) {
    case '700':
      return `${family} Bold 700`;
    case 'italic':
      return `${family} Italic`;
    case '700italic':
      return `${family} Italic Bold 700`;
    default:
      return `${family} Regular`;
  }
};

// Build the `fonts` array entry the editor uses to load a face (mirrors TextContent simpleTxtLayer):
// primary weight drives name/url/style; `styles` lists the other faces so weight toggles still work.
function fontEntry(assetBase: string, slug: FontSlug, weight: Weight) {
  const family = FAMILY_BY_SLUG[slug];
  const url = (w: Weight) => `${assetBase}/api/editor/fonts/${slug}/${w}.woff2`;
  const allWeights: Weight[] = ['regular', '700', 'italic', '700italic'];
  const name = styleName(family, weight);
  return {
    name,
    entry: {
      family,
      name,
      url: url(weight),
      style: weight,
      styles: allWeights.map((w) => ({
        family,
        name: styleName(family, w),
        url: url(w),
        style: w
      }))
    }
  };
}

function textLayer(opts: {
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  font: ReturnType<typeof fontEntry>;
  letterSpacing?: string;
  lineHeight?: number;
}) {
  const letterSpacing = opts.letterSpacing ?? 'normal';
  const lineHeight = opts.lineHeight ?? 1.4;
  const text = `<p style="text-align: center;font-family: '${opts.font.name}';font-size: ${opts.fontSize}px;color: ${opts.color};line-height: ${lineHeight};letter-spacing: ${letterSpacing};">${opts.content}</p>`;
  return {
    type: { resolvedName: 'TextLayer' },
    props: {
      position: { x: opts.x, y: opts.y },
      boxSize: { width: opts.width, height: opts.height },
      scale: 1,
      rotate: 0,
      text,
      fonts: [opts.font.entry],
      colors: [opts.color],
      fontSizes: [opts.fontSize],
      effect: null
    },
    locked: false,
    child: [],
    parent: 'ROOT'
  };
}

// A filled rectangle bar — used for divider lines and signature/date rules.
function barLayer(opts: { x: number; y: number; width: number; height: number; color: string }) {
  return {
    type: { resolvedName: 'ShapeLayer' },
    props: {
      position: { x: opts.x, y: opts.y },
      boxSize: { width: opts.width, height: opts.height },
      rotate: 0,
      clipPath: squarePath(opts.width, opts.height),
      scale: 1,
      color: opts.color,
      shapeSize: { width: opts.width, height: opts.height },
      border: null,
      roundedCorners: 0,
      gradientBackground: null
    },
    locked: false,
    child: [],
    parent: 'ROOT'
  };
}

// An outline-only rectangle (transparent fill + border ring) — the decorative frame.
function frameLayer(opts: {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  weight: number;
}) {
  return {
    type: { resolvedName: 'ShapeLayer' },
    props: {
      position: { x: opts.x, y: opts.y },
      boxSize: { width: opts.width, height: opts.height },
      rotate: 0,
      clipPath: squarePath(opts.width, opts.height),
      scale: 1,
      color: 'rgba(0, 0, 0, 0)',
      shapeSize: { width: opts.width, height: opts.height },
      border: { style: 'solid', weight: opts.weight, color: opts.color },
      roundedCorners: 0,
      gradientBackground: null
    },
    locked: false,
    child: [],
    parent: 'ROOT'
  };
}

// A small filled seal circle.
function circleLayer(opts: { cx: number; cy: number; diameter: number; color: string }) {
  const d = opts.diameter;
  return {
    type: { resolvedName: 'ShapeLayer' },
    props: {
      position: { x: opts.cx - d / 2, y: opts.cy - d / 2 },
      boxSize: { width: d, height: d },
      rotate: 0,
      clipPath: CIRCLE_PATH,
      scale: d / 256,
      color: opts.color,
      shapeSize: { width: 256, height: 256 },
      border: null,
      roundedCorners: 0,
      gradientBackground: null
    },
    locked: false,
    child: [],
    parent: 'ROOT'
  };
}

const centeredX = (width: number) => Math.round((CANVAS.width - width) / 2);

type Palette = {
  background: string;
  ink: string;
  accent: string;
  titleSlug: FontSlug;
  nameSlug: FontSlug;
  bodySlug: FontSlug;
  doubleFrame: boolean;
};

const PALETTES: Record<string, Palette> = {
  'classic-navy': {
    background: '#F6F1E7',
    ink: '#12233F',
    accent: '#B08A4F',
    titleSlug: 'playfair-display',
    nameSlug: 'cormorant-garamond',
    bodySlug: 'lora',
    doubleFrame: true
  },
  'botanical-green': {
    background: '#F3F1E9',
    ink: '#20402E',
    accent: '#8A7B3F',
    titleSlug: 'cormorant-garamond',
    nameSlug: 'cormorant-garamond',
    bodySlug: 'lora',
    doubleFrame: true
  },
  'minimal-cream': {
    background: '#FBFAF7',
    ink: '#2B2B2B',
    accent: '#9A9A9A',
    titleSlug: 'lora',
    nameSlug: 'lora',
    bodySlug: 'lora',
    doubleFrame: false
  }
};

/**
 * Build the editable editor document (array of one page) for a stock design.
 * @param stockId one of the STOCK_TEMPLATES ids
 * @param assetBase absolute origin the browser reaches the API at (e.g. http://localhost:4000),
 *        used so embedded font URLs resolve regardless of host.
 * Returns null when the id has no editable design (caller falls back to background-only seeding).
 */
export function buildStockEditorDocument(stockId: string, assetBase: string): unknown[] | null {
  const palette = PALETTES[stockId];
  if (!palette) return null;

  const base = assetBase.replace(/\/+$/, '');
  const title = fontEntry(base, palette.titleSlug, '700');
  const nameFont = fontEntry(base, palette.nameSlug, '700');
  const bodyItalic = fontEntry(base, palette.bodySlug, 'italic');
  const bodyRegular = fontEntry(base, palette.bodySlug, 'regular');

  const layers: Record<string, unknown> = {};
  const order: string[] = [];
  const add = (id: string, layer: unknown) => {
    layers[id] = layer;
    order.push(id);
  };

  // Frame(s)
  add('frameOuter', frameLayer({ x: 48, y: 48, width: 1318, height: 904, color: palette.ink, weight: 3 }));
  if (palette.doubleFrame) {
    add('frameInner', frameLayer({ x: 70, y: 70, width: 1274, height: 860, color: palette.accent, weight: 1 }));
  }

  // Title
  add(
    'title',
    textLayer({
      content: 'CERTIFICATE OF ACHIEVEMENT',
      x: centeredX(1100),
      y: 200,
      width: 1100,
      height: 96,
      fontSize: 58,
      color: palette.ink,
      font: title,
      letterSpacing: '4px'
    })
  );

  // Presented-to line
  add(
    'presented',
    textLayer({
      content: 'This certificate is proudly presented to',
      x: centeredX(800),
      y: 336,
      width: 800,
      height: 34,
      fontSize: 24,
      color: palette.ink,
      font: bodyItalic
    })
  );

  // Recipient name placeholder (merge field — Task 11 will make these first-class)
  add(
    'name',
    textLayer({
      content: '{{recipient_name}}',
      x: centeredX(1000),
      y: 392,
      width: 1000,
      height: 108,
      fontSize: 72,
      color: palette.accent,
      font: nameFont
    })
  );

  // Underline beneath the name
  add('nameRule', barLayer({ x: centeredX(440), y: 520, width: 440, height: 3, color: palette.accent }));

  // Body copy
  add(
    'body',
    textLayer({
      content: 'in recognition of outstanding achievement and dedication.',
      x: centeredX(900),
      y: 556,
      width: 900,
      height: 40,
      fontSize: 26,
      color: palette.ink,
      font: bodyRegular
    })
  );

  // Seal
  add('seal', circleLayer({ cx: CANVAS.width / 2, cy: 700, diameter: 104, color: palette.accent }));

  // Signature (left) and date (right) rules + labels
  add('sigRule', barLayer({ x: 250, y: 838, width: 300, height: 2, color: palette.ink }));
  add(
    'sigLabel',
    textLayer({
      content: 'Signature',
      x: 250,
      y: 848,
      width: 300,
      height: 26,
      fontSize: 18,
      color: palette.ink,
      font: bodyRegular
    })
  );
  add('dateRule', barLayer({ x: 864, y: 838, width: 300, height: 2, color: palette.ink }));
  add(
    'dateLabel',
    textLayer({
      content: 'Date',
      x: 864,
      y: 848,
      width: 300,
      height: 26,
      fontSize: 18,
      color: palette.ink,
      font: bodyRegular
    })
  );

  const root = {
    type: { resolvedName: 'RootLayer' },
    props: {
      boxSize: { width: CANVAS.width, height: CANVAS.height },
      position: { x: 0, y: 0 },
      rotate: 0,
      color: palette.background
    },
    locked: false,
    child: order,
    parent: null
  };

  const readable = [
    {
      name: '',
      notes: '',
      layers: { ROOT: root, ...layers }
    }
  ];

  // Store packed so the editor's unpack() restores it correctly (see packDesign above).
  return packDesign(readable) as unknown[];
}

export function hasEditableStockDesign(stockId: string): boolean {
  return Boolean(PALETTES[stockId]);
}
