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
  align?: 'left' | 'center' | 'right';
}) {
  const letterSpacing = opts.letterSpacing ?? 'normal';
  const lineHeight = opts.lineHeight ?? 1.4;
  const align = opts.align ?? 'center';
  const text = `<p style="text-align: ${align};font-family: '${opts.font.name}';font-size: ${opts.fontSize}px;color: ${opts.color};line-height: ${lineHeight};letter-spacing: ${letterSpacing};">${opts.content}</p>`;
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

// A small diamond (rotated square) accent, used at the frame corners of some designs.
const DIAMOND_PATH = 'M 50 0 L 100 50 L 50 100 L 0 50 Z';
function diamondLayer(opts: { cx: number; cy: number; size: number; color: string }) {
  const s = opts.size;
  return {
    type: { resolvedName: 'ShapeLayer' },
    props: {
      position: { x: opts.cx - s / 2, y: opts.cy - s / 2 },
      boxSize: { width: s, height: s },
      rotate: 0,
      clipPath: DIAMOND_PATH,
      scale: s / 100,
      color: opts.color,
      shapeSize: { width: 100, height: 100 },
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
  corners: 'diamonds' | 'none';
  seal: boolean;
};

const PALETTES: Record<string, Palette> = {
  'classic-navy': {
    background: '#EEF1F7', // cool ivory-blue so it reads distinctly navy
    ink: '#12233F',
    accent: '#B08A4F',
    titleSlug: 'playfair-display',
    nameSlug: 'cormorant-garamond',
    bodySlug: 'lora',
    doubleFrame: true,
    corners: 'diamonds',
    seal: true
  },
  'botanical-green': {
    background: '#E9F0E4', // sage-tinted paper
    ink: '#20402E',
    accent: '#8A7B3F',
    titleSlug: 'cormorant-garamond',
    nameSlug: 'cormorant-garamond',
    bodySlug: 'lora',
    doubleFrame: false,
    corners: 'diamonds',
    seal: true
  },
  'minimal-cream': {
    background: '#FFFFFF', // pure white, ultra-minimal
    ink: '#2B2B2B',
    accent: '#9A9A9A',
    titleSlug: 'lora',
    nameSlug: 'lora',
    bodySlug: 'lora',
    doubleFrame: false,
    corners: 'none',
    seal: false
  },
  'royal-gold': {
    background: '#FFFDF8',
    ink: '#2F241B',
    accent: '#C39A4A',
    titleSlug: 'playfair-display',
    nameSlug: 'cormorant-garamond',
    bodySlug: 'lora',
    doubleFrame: true,
    corners: 'diamonds',
    seal: true
  },
  'modern-blue': {
  background: '#F5F9FF',
  ink: '#163A63',
  accent: '#3B82F6',
  titleSlug: 'lora',
  nameSlug: 'playfair-display',
  bodySlug: 'lora',
  doubleFrame: false,
  corners: 'none',
  seal: true
},

'executive-black': {
  background: '#111318',
  ink: '#F8F3E7',
  accent: '#D4AF57',
  titleSlug: 'playfair-display',
  nameSlug: 'cormorant-garamond',
  bodySlug: 'lora',
  doubleFrame: true,
  corners: 'diamonds',
  seal: true
},

'academic-emerald': {
  background: '#F4FAF6',
  ink: '#123C2F',
  accent: '#2D8A64',
  titleSlug: 'cormorant-garamond',
  nameSlug: 'playfair-display',
  bodySlug: 'lora',
  doubleFrame: true,
  corners: 'none',
  seal: true
},

'burgundy-prestige': {
  background: '#FFF8F7',
  ink: '#541C2D',
  accent: '#A56A43',
  titleSlug: 'playfair-display',
  nameSlug: 'cormorant-garamond',
  bodySlug: 'lora',
  doubleFrame: true,
  corners: 'diamonds',
  seal: false
},

'creative-coral': {
  background: '#FFF7F3',
  ink: '#45313A',
  accent: '#E76F51',
  titleSlug: 'lora',
  nameSlug: 'playfair-display',
  bodySlug: 'lora',
  doubleFrame: false,
  corners: 'diamonds',
  seal: true
},

'technology-silver': {
  background: '#F4F6F8',
  ink: '#202B38',
  accent: '#718096',
  titleSlug: 'lora',
  nameSlug: 'lora',
  bodySlug: 'lora',
  doubleFrame: true,
  corners: 'none',
  seal: false
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
  if (OFFER_PALETTES[stockId]) return buildOfferLetterDocument(stockId, assetBase);
  const palette = PALETTES[stockId];
  const isModern = stockId === 'modern-blue';
  const isExecutive = stockId === 'executive-black';
  const isAcademic = stockId === 'academic-emerald';
  const isBurgundy = stockId === 'burgundy-prestige';
  const isCreative = stockId === 'creative-coral';
  const isTechnology = stockId === 'technology-silver';
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
  if (isModern) {
  add('topBand', barLayer({
    x: 0,
    y: 0,
    width: CANVAS.width,
    height: 28,
    color: palette.accent
  }));

  add('bottomBand', barLayer({
    x: 0,
    y: CANVAS.height - 18,
    width: CANVAS.width,
    height: 18,
    color: palette.accent
  }));
}

if (isExecutive) {
  add('leftGoldBar', barLayer({
    x: 34,
    y: 34,
    width: 14,
    height: 932,
    color: palette.accent
  }));

  add('rightGoldBar', barLayer({
    x: CANVAS.width - 48,
    y: 34,
    width: 14,
    height: 932,
    color: palette.accent
  }));
}

if (isAcademic) {
  add('academicTop', barLayer({
    x: 180,
    y: 105,
    width: 1054,
    height: 7,
    color: palette.accent
  }));

  add('academicBottom', barLayer({
    x: 180,
    y: 895,
    width: 1054,
    height: 7,
    color: palette.accent
  }));
}

if (isBurgundy) {
  add('burgundyHeader', barLayer({
    x: 0,
    y: 0,
    width: CANVAS.width,
    height: 115,
    color: palette.ink
  }));
}

if (isCreative) {
  add('creativeLeft', barLayer({
    x: 0,
    y: 0,
    width: 80,
    height: CANVAS.height,
    color: palette.accent
  }));

  add('creativeTop', barLayer({
    x: 80,
    y: 0,
    width: 300,
    height: 28,
    color: palette.ink
  }));
}

if (isTechnology) {
  add('techTop', barLayer({
    x: 80,
    y: 70,
    width: 1254,
    height: 5,
    color: palette.accent
  }));

  add('techLeft', barLayer({
    x: 80,
    y: 70,
    width: 5,
    height: 860,
    color: palette.accent
  }));

  add('techBottom', barLayer({
    x: 80,
    y: 925,
    width: 1254,
    height: 5,
    color: palette.accent
  }));
}
 if (!isModern && !isCreative && !isTechnology) {
  add(
    'frameOuter',
    frameLayer({
      x: 48,
      y: 48,
      width: 1318,
      height: 904,
      color: palette.ink,
      weight: isExecutive ? 2 : 3
    })
  );
}

if (palette.doubleFrame && !isExecutive) {
  add(
    'frameInner',
    frameLayer({
      x: 70,
      y: 70,
      width: 1274,
      height: 860,
      color: palette.accent,
      weight: 1
    })
  );
}
  if (palette.doubleFrame) {
    add('frameInner', frameLayer({ x: 70, y: 70, width: 1274, height: 860, color: palette.accent, weight: 1 }));
  }

  // Corner diamond accents (distinguishes the classic/botanical designs from the minimal one).
  if (palette.corners === 'diamonds') {
    const inset = 92;
    const corners: Array<[number, number]> = [
      [inset, inset],
      [CANVAS.width - inset, inset],
      [inset, CANVAS.height - inset],
      [CANVAS.width - inset, CANVAS.height - inset]
    ];
    corners.forEach(([cx, cy], i) =>
      add(`corner${i}`, diamondLayer({ cx, cy, size: 22, color: palette.accent }))
    );
  }

  // Title
  add(
    'title',
    textLayer({
      content:
  stockId === 'modern-blue'
    ? 'CERTIFICATE OF EXCELLENCE'
    : stockId === 'executive-black'
      ? 'EXECUTIVE RECOGNITION'
      : stockId === 'academic-emerald'
        ? 'ACADEMIC ACHIEVEMENT'
        : stockId === 'burgundy-prestige'
          ? 'CERTIFICATE OF DISTINCTION'
          : stockId === 'creative-coral'
            ? 'CREATIVE ACHIEVEMENT'
            : stockId === 'technology-silver'
              ? 'CERTIFICATE OF INNOVATION'
              : 'CERTIFICATE OF ACHIEVEMENT',
      x: centeredX(1100),
     y: isBurgundy ? 145 : isModern ? 175 : isCreative ? 170 : 200,
      width: 1100,
      height: 96,
      fontSize: isTechnology ? 48 : isModern ? 54 : 58,
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

  // Seal (skipped on the minimal design)
  if (palette.seal) {
    add(
  'seal',
  circleLayer({
    cx: isModern
      ? 1120
      : isAcademic
        ? 290
        : isCreative
          ? 1080
          : CANVAS.width / 2,
    cy: isModern
      ? 730
      : isAcademic
        ? 730
        : isCreative
          ? 720
          : 700,
    diameter: isModern ? 86 : 104,
    color: palette.accent
  })
);
  }

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
  return Boolean(PALETTES[stockId] || OFFER_PALETTES[stockId]);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Offer letters — portrait (A4-ish) document designs with merge fields for the recipient, position,
// dates and compensation. Rendered as editable text/shape layers just like the certificates.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const LETTER = { width: 1000, height: 1414 };

type OfferPalette = {
  background: string;
  ink: string;
  muted: string;
  accent: string;
  headingSlug: FontSlug;
  bodySlug: FontSlug;
  headerBar: boolean;
  headerAlign: 'left' | 'center';
};

const OFFER_PALETTES: Record<string, OfferPalette> = {
  'offer-corporate': {
    background: '#FFFFFF',
    ink: '#13233A',
    muted: '#657184',
    accent: '#1F4E79',
    headingSlug: 'playfair-display',
    bodySlug: 'lora',
    headerBar: true,
    headerAlign: 'left'
  },

  'offer-modern': {
    background: '#FFFFFF',
    ink: '#242424',
    muted: '#747474',
    accent: '#B2875A',
    headingSlug: 'lora',
    bodySlug: 'lora',
    headerBar: false,
    headerAlign: 'left'
  },

  'offer-classic': {
    background: '#FBF7EE',
    ink: '#3B3026',
    muted: '#756858',
    accent: '#91714D',
    headingSlug: 'cormorant-garamond',
    bodySlug: 'lora',
    headerBar: false,
    headerAlign: 'center'
  },

  'offer-executive-blue': {
    background: '#F7FAFD',
    ink: '#102A43',
    muted: '#627D98',
    accent: '#245B8A',
    headingSlug: 'playfair-display',
    bodySlug: 'lora',
    headerBar: true,
    headerAlign: 'left'
  },

  'offer-startup-minimal': {
    background: '#FFFFFF',
    ink: '#1F2933',
    muted: '#6B7280',
    accent: '#6D5BD0',
    headingSlug: 'lora',
    bodySlug: 'lora',
    headerBar: false,
    headerAlign: 'left'
  },

  'offer-hr-professional': {
    background: '#F9FBFD',
    ink: '#243447',
    muted: '#697B8C',
    accent: '#2F6B9A',
    headingSlug: 'lora',
    bodySlug: 'lora',
    headerBar: true,
    headerAlign: 'left'
  },

  'offer-luxury-gold': {
    background: '#FFFDF7',
    ink: '#241F1A',
    muted: '#756B60',
    accent: '#B38A4A',
    headingSlug: 'playfair-display',
    bodySlug: 'lora',
    headerBar: false,
    headerAlign: 'center'
  },

  'offer-technology': {
    background: '#F5F7F9',
    ink: '#18232E',
    muted: '#687784',
    accent: '#138AA3',
    headingSlug: 'lora',
    bodySlug: 'lora',
    headerBar: false,
    headerAlign: 'left'
  },

  'offer-creative-agency': {
    background: '#FFF9F5',
    ink: '#3B2D36',
    muted: '#816F79',
    accent: '#E76F51',
    headingSlug: 'playfair-display',
    bodySlug: 'lora',
    headerBar: false,
    headerAlign: 'left'
  },

  'offer-green-corporate': {
    background: '#F7FBF8',
    ink: '#1D3B2E',
    muted: '#64786D',
    accent: '#3B7D5A',
    headingSlug: 'cormorant-garamond',
    bodySlug: 'lora',
    headerBar: true,
    headerAlign: 'left'
  }
};

function buildExecutiveBlueOfferDocument(
  assetBase: string
): unknown[] {
  const base = assetBase.replace(/\/+$/, '');

  const heading = fontEntry(base, 'playfair-display', '700');
  const headingRegular = fontEntry(base, 'playfair-display', 'regular');
  const body = fontEntry(base, 'lora', 'regular');
  const bodyBold = fontEntry(base, 'lora', '700');
  const bodyItalic = fontEntry(base, 'lora', 'italic');

  const NAVY = '#102A43';
  const BLUE = '#2F6FA3';
  const LIGHT_BLUE = '#EAF2F8';
  const PALE_BLUE = '#F5F9FC';
  const INK = '#172B3A';
  const MUTED = '#657786';
  const WHITE = '#FFFFFF';
  const BORDER = '#C7D7E4';

  const layers: Record<string, unknown> = {};
  const order: string[] = [];

  const add = (id: string, layer: unknown) => {
    layers[id] = layer;
    order.push(id);
  };

  const txt = (
    id: string,
    content: string,
    x: number,
    y: number,
    width: number,
    height: number,
    opts: Partial<{
      fontSize: number;
      color: string;
      font: ReturnType<typeof fontEntry>;
      align: 'left' | 'center' | 'right';
      lineHeight: number;
      letterSpacing: string;
    }> = {}
  ) => {
    add(
      id,
      textLayer({
        content,
        x,
        y,
        width,
        height,
        fontSize: opts.fontSize ?? 20,
        color: opts.color ?? INK,
        font: opts.font ?? body,
        align: opts.align ?? 'left',
        lineHeight: opts.lineHeight ?? 1.5,
        letterSpacing: opts.letterSpacing
      })
    );
  };

  // ─────────────────────────────────────────────
  // Premium corporate header
  // ─────────────────────────────────────────────

  add(
    'executiveHeaderBackground',
    barLayer({
      x: 0,
      y: 0,
      width: LETTER.width,
      height: 216,
      color: NAVY
    })
  );

  add(
    'executiveHeaderAccent',
    barLayer({
      x: 0,
      y: 216,
      width: LETTER.width,
      height: 12,
      color: BLUE
    })
  );

  // Logo / monogram block
  add(
    'executiveLogoBlock',
    barLayer({
      x: 72,
      y: 50,
      width: 112,
      height: 112,
      color: WHITE
    })
  );

  add(
    'executiveLogoInner',
    frameLayer({
      x: 82,
      y: 60,
      width: 92,
      height: 92,
      color: BLUE,
      weight: 3
    })
  );

  txt(
    'executiveLogoText',
    'CF',
    82,
    80,
    92,
    58,
    {
      fontSize: 36,
      color: NAVY,
      font: heading,
      align: 'center'
    }
  );

  // Company identity
  txt(
    'executiveCompanyName',
    '{{company_name}}',
    220,
    48,
    490,
    58,
    {
      fontSize: 39,
      color: WHITE,
      font: heading
    }
  );

  txt(
    'executiveDepartment',
    'PEOPLE &amp; CULTURE DIVISION',
    222,
    112,
    470,
    28,
    {
      fontSize: 15,
      color: '#BED3E5',
      font: bodyBold,
      letterSpacing: '2px'
    }
  );

  txt(
    'executiveCompanyTagline',
    'Building leadership. Creating impact.',
    222,
    147,
    470,
    30,
    {
      fontSize: 17,
      color: WHITE,
      font: bodyItalic
    }
  );

  // Contact information in header
  txt(
    'executiveHeaderContact',
    '{{company_email}}<br/>{{company_phone}}<br/>{{company_website}}',
    720,
    55,
    205,
    96,
    {
      fontSize: 15,
      color: WHITE,
      align: 'right',
      lineHeight: 1.7
    }
  );

  // ─────────────────────────────────────────────
  // Document information strip
  // ─────────────────────────────────────────────

  add(
    'executiveMetaBackground',
    barLayer({
      x: 0,
      y: 228,
      width: LETTER.width,
      height: 78,
      color: LIGHT_BLUE
    })
  );

  txt(
    'executiveReferenceLabel',
    'REFERENCE',
    72,
    246,
    145,
    22,
    {
      fontSize: 13,
      color: MUTED,
      font: bodyBold,
      letterSpacing: '1.5px'
    }
  );

  txt(
    'executiveReferenceValue',
    '{{offer_reference}}',
    72,
    270,
    200,
    25,
    {
      fontSize: 16,
      color: NAVY,
      font: bodyBold
    }
  );

  txt(
    'executiveDateLabel',
    'ISSUE DATE',
    390,
    246,
    130,
    22,
    {
      fontSize: 13,
      color: MUTED,
      font: bodyBold,
      letterSpacing: '1.5px'
    }
  );

  txt(
    'executiveDateValue',
    '{{issue_date}}',
    390,
    270,
    170,
    25,
    {
      fontSize: 16,
      color: NAVY,
      font: bodyBold
    }
  );

  txt(
    'executiveStatusLabel',
    'DOCUMENT',
    720,
    246,
    135,
    22,
    {
      fontSize: 13,
      color: MUTED,
      font: bodyBold,
      letterSpacing: '1.5px'
    }
  );

  txt(
    'executiveStatusValue',
    'CONFIDENTIAL',
    720,
    270,
    205,
    25,
    {
      fontSize: 16,
      color: NAVY,
      font: bodyBold,
      align: 'right'
    }
  );

  // ─────────────────────────────────────────────
  // Main title section
  // ─────────────────────────────────────────────

  txt(
    'executiveSmallHeading',
    'OFFICIAL COMMUNICATION',
    72,
    344,
    400,
    24,
    {
      fontSize: 14,
      color: BLUE,
      font: bodyBold,
      letterSpacing: '2.2px'
    }
  );

  txt(
    'executiveOfferTitle',
    'Executive Employment Offer',
    72,
    375,
    790,
    70,
    {
      fontSize: 45,
      color: NAVY,
      font: heading
    }
  );

  add(
    'executiveTitleRule',
    barLayer({
      x: 72,
      y: 455,
      width: 140,
      height: 6,
      color: BLUE
    })
  );

  txt(
    'executiveRecipient',
    'Dear {{recipient_name}},',
    72,
    492,
    856,
    38,
    {
      fontSize: 22,
      color: INK,
      font: bodyBold
    }
  );

  txt(
    'executiveOpening',
    'Following our discussions, we are pleased to formally offer you the position of <strong>{{position}}</strong> with <strong>{{company_name}}</strong>. We believe your leadership experience, professional judgement and strategic perspective will add significant value to our organisation.',
    72,
    540,
    856,
    108,
    {
      fontSize: 19,
      color: INK,
      lineHeight: 1.6
    }
  );

  // ─────────────────────────────────────────────
  // Employment summary panel
  // ─────────────────────────────────────────────

  add(
    'executiveDetailsPanel',
    barLayer({
      x: 72,
      y: 675,
      width: 856,
      height: 214,
      color: PALE_BLUE
    })
  );

  add(
    'executiveDetailsAccent',
    barLayer({
      x: 72,
      y: 675,
      width: 12,
      height: 214,
      color: BLUE
    })
  );

  txt(
    'executiveDetailsHeading',
    'EMPLOYMENT SUMMARY',
    112,
    700,
    430,
    28,
    {
      fontSize: 15,
      color: NAVY,
      font: bodyBold,
      letterSpacing: '1.8px'
    }
  );

  add(
    'executiveDetailsHeadingRule',
    barLayer({
      x: 112,
      y: 740,
      width: 775,
      height: 2,
      color: BORDER
    })
  );

  // Column one
  txt(
    'executivePositionLabel',
    'POSITION',
    112,
    765,
    150,
    22,
    {
      fontSize: 13,
      color: MUTED,
      font: bodyBold,
      letterSpacing: '1px'
    }
  );

  txt(
    'executivePositionValue',
    '{{position}}',
    112,
    792,
    330,
    30,
    {
      fontSize: 19,
      color: NAVY,
      font: bodyBold
    }
  );

  txt(
    'executiveStartLabel',
    'START DATE',
    112,
    835,
    150,
    22,
    {
      fontSize: 13,
      color: MUTED,
      font: bodyBold,
      letterSpacing: '1px'
    }
  );

  txt(
    'executiveStartValue',
    '{{start_date}}',
    112,
    860,
    330,
    28,
    {
      fontSize: 18,
      color: NAVY
    }
  );

  // Column two
  txt(
    'executiveSalaryLabel',
    'ANNUAL COMPENSATION',
    520,
    765,
    250,
    22,
    {
      fontSize: 13,
      color: MUTED,
      font: bodyBold,
      letterSpacing: '1px'
    }
  );

  txt(
    'executiveSalaryValue',
    '{{salary}}',
    520,
    792,
    320,
    30,
    {
      fontSize: 19,
      color: NAVY,
      font: bodyBold
    }
  );

  txt(
    'executiveLocationLabel',
    'WORK LOCATION',
    520,
    835,
    200,
    22,
    {
      fontSize: 13,
      color: MUTED,
      font: bodyBold,
      letterSpacing: '1px'
    }
  );

  txt(
    'executiveLocationValue',
    '{{work_location}}',
    520,
    860,
    320,
    28,
    {
      fontSize: 18,
      color: NAVY
    }
  );

  // ─────────────────────────────────────────────
  // Terms and confirmation
  // ─────────────────────────────────────────────

  txt(
    'executiveTerms',
    'Your employment will be governed by the policies, confidentiality requirements and professional standards of the organisation. Complete details regarding your benefits, responsibilities and onboarding formalities will be provided as part of your joining documentation.',
    72,
    925,
    856,
    106,
    {
      fontSize: 18,
      color: INK,
      lineHeight: 1.6
    }
  );

  txt(
    'executiveWelcome',
    'We look forward to welcoming you to our leadership team and to the contribution you will make toward our continued growth.',
    72,
    1038,
    856,
    75,
    {
      fontSize: 18,
      color: INK,
      lineHeight: 1.55
    }
  );

  // ─────────────────────────────────────────────
  // Authorised signature card
  // ─────────────────────────────────────────────

  add(
    'executiveSignaturePanel',
    barLayer({
      x: 72,
      y: 1132,
      width: 390,
      height: 145,
      color: NAVY
    })
  );

  txt(
    'executiveClosing',
    'Respectfully,',
    100,
    1153,
    320,
    26,
    {
      fontSize: 17,
      color: '#C9D9E6',
      font: bodyItalic
    }
  );

  txt(
    'executiveSignatory',
    '{{authorized_signatory}}',
    100,
    1190,
    320,
    34,
    {
      fontSize: 21,
      color: WHITE,
      font: headingRegular
    }
  );

  add(
    'executiveSignatoryRule',
    barLayer({
      x: 100,
      y: 1230,
      width: 225,
      height: 2,
      color: BLUE
    })
  );

  txt(
    'executiveSignatoryRole',
    '{{signatory_designation}}',
    100,
    1240,
    320,
    25,
    {
      fontSize: 14,
      color: '#C9D9E6',
      font: bodyBold
    }
  );

  // ─────────────────────────────────────────────
  // Candidate acceptance
  // ─────────────────────────────────────────────

  txt(
    'executiveAcceptanceHeading',
    'CANDIDATE ACCEPTANCE',
    520,
    1132,
    408,
    28,
    {
      fontSize: 14,
      color: NAVY,
      font: bodyBold,
      letterSpacing: '1.5px'
    }
  );

  txt(
    'executiveAcceptanceText',
    'I accept the terms of employment stated in this offer.',
    520,
    1170,
    408,
    42,
    {
      fontSize: 15,
      color: MUTED,
      lineHeight: 1.4
    }
  );

  add(
    'executiveCandidateSignatureRule',
    barLayer({
      x: 520,
      y: 1240,
      width: 230,
      height: 2,
      color: NAVY
    })
  );

  txt(
    'executiveCandidateSignatureLabel',
    'Candidate signature',
    520,
    1248,
    230,
    22,
    {
      fontSize: 13,
      color: MUTED
    }
  );

  add(
    'executiveAcceptanceDateRule',
    barLayer({
      x: 790,
      y: 1240,
      width: 138,
      height: 2,
      color: NAVY
    })
  );

  txt(
    'executiveAcceptanceDateLabel',
    'Date',
    790,
    1248,
    138,
    22,
    {
      fontSize: 13,
      color: MUTED
    }
  );

  // ─────────────────────────────────────────────
  // Footer
  // ─────────────────────────────────────────────

  add(
    'executiveFooter',
    barLayer({
      x: 0,
      y: 1332,
      width: LETTER.width,
      height: 82,
      color: NAVY
    })
  );

  add(
    'executiveFooterAccent',
    barLayer({
      x: 0,
      y: 1332,
      width: LETTER.width,
      height: 7,
      color: BLUE
    })
  );

  txt(
    'executiveFooterAddress',
    '{{company_address}}',
    72,
    1353,
    500,
    36,
    {
      fontSize: 13,
      color: WHITE
    }
  );

  txt(
    'executiveFooterConfidential',
    'PRIVATE &amp; CONFIDENTIAL',
    650,
    1353,
    278,
    36,
    {
      fontSize: 13,
      color: '#C9D9E6',
      font: bodyBold,
      align: 'right',
      letterSpacing: '1.2px'
    }
  );

  const root = {
    type: { resolvedName: 'RootLayer' },
    props: {
      boxSize: {
        width: LETTER.width,
        height: LETTER.height
      },
      position: {
        x: 0,
        y: 0
      },
      rotate: 0,
      color: WHITE
    },
    locked: false,
    child: order,
    parent: null
  };

  const readable = [
    {
      name: '',
      notes: '',
      layers: {
        ROOT: root,
        ...layers
      }
    }
  ];

  return packDesign(readable) as unknown[];
}

export function buildOfferLetterDocument(offerId: string, assetBase: string): unknown[] | null {
  if (offerId === 'offer-executive-blue') {
  return buildExecutiveBlueOfferDocument(assetBase);
}
  const p = OFFER_PALETTES[offerId];
  if (!p) return null;
  const isCorporate = offerId === 'offer-corporate';
  const isModern = offerId === 'offer-modern';
  const isClassic = offerId === 'offer-classic';
  const isExecutive = offerId === 'offer-executive-blue';
  const isStartup = offerId === 'offer-startup-minimal';
  const isHr = offerId === 'offer-hr-professional';
  const isLuxury = offerId === 'offer-luxury-gold';
  const isTechnology = offerId === 'offer-technology';
  const isCreative = offerId === 'offer-creative-agency';
  const isGreen = offerId === 'offer-green-corporate';
  const base = assetBase.replace(/\/+$/, '');
  const heading = fontEntry(base, p.headingSlug, '700');
  const body = fontEntry(base, p.bodySlug, 'regular');
  const bodyItalic = fontEntry(base, p.bodySlug, 'italic');

 const M = 96;

const contentX = isCreative
  ? 150
  : isExecutive
    ? 128
    : isGreen
      ? 112
      : M;

const W = LETTER.width - contentX - M;
  const layers: Record<string, unknown> = {};
  const order: string[] = [];
  const add = (id: string, layer: unknown) => {
    layers[id] = layer;
    order.push(id);
  };
  const para = (
  id: string,
  content: string,
  y: number,
  height: number,
  opts: Partial<{
    x: number;
    width: number;
    fontSize: number;
    color: string;
    font: ReturnType<typeof fontEntry>;
    align: 'left' | 'center' | 'right';
    lineHeight: number;
  }> = {}
) =>
  add(
    id,
    textLayer({
      content,
      x: opts.x ?? contentX,
      y,
      width: opts.width ?? W,
      height,
      fontSize: opts.fontSize ?? 22,
      color: opts.color ?? p.ink,
      font: opts.font ?? body,
      align: opts.align ?? 'left',
      lineHeight: opts.lineHeight ?? 1.6
    })
  );
  // Unique decorative layouts for each offer-letter design

if (isCorporate) {
  add(
    'corporateTopBar',
    barLayer({
      x: 0,
      y: 0,
      width: LETTER.width,
      height: 14,
      color: p.accent
    })
  );

  add(
    'corporateLeftRule',
    barLayer({
      x: 64,
      y: 150,
      width: 5,
      height: 1090,
      color: p.accent
    })
  );
}

if (isModern) {
  add(
    'modernShortRule',
    barLayer({
      x: 96,
      y: 92,
      width: 90,
      height: 7,
      color: p.accent
    })
  );

  add(
    'modernFooterRule',
    barLayer({
      x: 96,
      y: 1306,
      width: 808,
      height: 2,
      color: p.accent
    })
  );
}

if (isClassic) {
  add(
    'classicOuterFrame',
    frameLayer({
      x: 48,
      y: 48,
      width: 904,
      height: 1318,
      color: p.accent,
      weight: 2
    })
  );

  add(
    'classicInnerFrame',
    frameLayer({
      x: 67,
      y: 67,
      width: 866,
      height: 1280,
      color: p.muted,
      weight: 1
    })
  );

  add(
    'classicTopDiamond',
    diamondLayer({
      cx: LETTER.width / 2,
      cy: 92,
      size: 24,
      color: p.accent
    })
  );
}

if (isExecutive) {
  add(
    'executiveSidebar',
    barLayer({
      x: 0,
      y: 0,
      width: 56,
      height: LETTER.height,
      color: p.accent
    })
  );

  add(
    'executiveHeader',
    barLayer({
      x: 56,
      y: 0,
      width: 944,
      height: 78,
      color: p.ink
    })
  );

  add(
    'executiveFooter',
    barLayer({
      x: 56,
      y: 1362,
      width: 944,
      height: 52,
      color: p.ink
    })
  );
}

if (isStartup) {
  add(
    'startupTopRule',
    barLayer({
      x: 96,
      y: 78,
      width: 808,
      height: 4,
      color: p.accent
    })
  );

  add(
    'startupTitleAccent',
    barLayer({
      x: 96,
      y: 232,
      width: 12,
      height: 64,
      color: p.accent
    })
  );

  add(
    'startupBottomAccent',
    barLayer({
      x: 96,
      y: 1270,
      width: 280,
      height: 4,
      color: p.accent
    })
  );
}

if (isHr) {
  add(
    'hrHeader',
    barLayer({
      x: 0,
      y: 0,
      width: LETTER.width,
      height: 122,
      color: p.accent
    })
  );

  add(
    'hrHeaderDarkRule',
    barLayer({
      x: 0,
      y: 122,
      width: LETTER.width,
      height: 8,
      color: p.ink
    })
  );

  add(
    'hrFooter',
    barLayer({
      x: 0,
      y: 1368,
      width: LETTER.width,
      height: 46,
      color: p.accent
    })
  );
}

if (isLuxury) {
  add(
    'luxuryHeader',
    barLayer({
      x: 0,
      y: 0,
      width: LETTER.width,
      height: 188,
      color: p.ink
    })
  );

  add(
    'luxuryTopGoldRule',
    barLayer({
      x: 110,
      y: 212,
      width: 780,
      height: 3,
      color: p.accent
    })
  );

  add(
    'luxuryBottomGoldRule',
    barLayer({
      x: 110,
      y: 1290,
      width: 780,
      height: 3,
      color: p.accent
    })
  );

  add(
    'luxurySeal',
    circleLayer({
      cx: 820,
      cy: 1160,
      diameter: 86,
      color: p.accent
    })
  );
}

if (isTechnology) {
  add(
    'technologyTopBar',
    barLayer({
      x: 0,
      y: 0,
      width: LETTER.width,
      height: 24,
      color: p.accent
    })
  );

  add(
    'technologyRightBar',
    barLayer({
      x: 972,
      y: 24,
      width: 28,
      height: LETTER.height - 24,
      color: p.ink
    })
  );

  add(
    'technologySquare',
    barLayer({
      x: 828,
      y: 76,
      width: 76,
      height: 76,
      color: p.accent
    })
  );

  add(
    'technologyFooterRule',
    barLayer({
      x: 96,
      y: 1302,
      width: 808,
      height: 5,
      color: p.accent
    })
  );
}

if (isCreative) {
  add(
    'creativeSidebar',
    barLayer({
      x: 0,
      y: 0,
      width: 94,
      height: LETTER.height,
      color: p.accent
    })
  );

  add(
    'creativeTopBlock',
    barLayer({
      x: 94,
      y: 0,
      width: 330,
      height: 36,
      color: p.ink
    })
  );

  add(
    'creativeBottomBlock',
    barLayer({
      x: 94,
      y: 1368,
      width: 500,
      height: 46,
      color: p.ink
    })
  );

  add(
    'creativeDiamond',
    diamondLayer({
      cx: 826,
      cy: 108,
      size: 54,
      color: p.accent
    })
  );
}

if (isGreen) {
  add(
    'greenHeader',
    barLayer({
      x: 0,
      y: 0,
      width: LETTER.width,
      height: 138,
      color: p.ink
    })
  );

  add(
    'greenAccentRule',
    barLayer({
      x: 0,
      y: 138,
      width: LETTER.width,
      height: 10,
      color: p.accent
    })
  );

  add(
    'greenLeftRule',
    barLayer({
      x: 72,
      y: 194,
      width: 5,
      height: 1040,
      color: p.accent
    })
  );

  add(
    'greenFooter',
    barLayer({
      x: 0,
      y: 1350,
      width: LETTER.width,
      height: 64,
      color: p.ink
    })
  );
}
// ─────────────────────────────────────────────────────────────
// Header and company details
// ─────────────────────────────────────────────────────────────

const companyY =
  isHr || isGreen
    ? 38
    : isLuxury
      ? 52
      : isExecutive
        ? 100
        : isCreative
          ? 82
          : 88;

const companyColor =
  isHr || isGreen || isLuxury
    ? '#FFFFFF'
    : p.ink;

para(
  'company',
  '{{company_name}}',
  companyY,
  54,
  {
    fontSize: isLuxury ? 40 : isStartup ? 30 : 34,
    color: companyColor,
    font: heading,
    align:
      isClassic || isLuxury
        ? 'center'
        : 'left'
  }
);

// Header divider rules
if (
  !isHr &&
  !isGreen &&
  !isLuxury &&
  !isExecutive &&
  !isClassic
) {
  add(
    'headerRule',
    barLayer({
      x: contentX,
      y: 150,
      width: W,
      height: isModern ? 1 : 2,
      color: p.accent
    })
  );
}

// Issue date
const issueDateY =
  isHr || isGreen
    ? 166
    : isLuxury
      ? 230
      : isExecutive
        ? 176
        : 172;

para(
  'date',
  '{{issue_date}}',
  issueDateY,
  30,
  {
    fontSize: 18,
    color: p.muted,
    align:
      isClassic || isLuxury
        ? 'center'
        : 'left'
  }
);

// ─────────────────────────────────────────────────────────────
// Main offer title
// ─────────────────────────────────────────────────────────────

const offerTitle =
  isExecutive
    ? 'EXECUTIVE EMPLOYMENT OFFER'
    : isStartup
      ? 'Join Our Team'
      : isHr
        ? 'EMPLOYMENT OFFER'
        : isLuxury
          ? 'LETTER OF APPOINTMENT'
          : isTechnology
            ? 'CAREER OPPORTUNITY'
            : isCreative
              ? 'WELCOME ABOARD'
              : isGreen
                ? 'OFFICIAL OFFER OF EMPLOYMENT'
                : isCorporate
                  ? 'LETTER OF EMPLOYMENT OFFER'
                  : 'LETTER OF OFFER';

const titleY =
  isLuxury
    ? 286
    : isHr || isGreen
      ? 238
      : isExecutive
        ? 246
        : 244;

para(
  'title',
  offerTitle,
  titleY,
  isStartup ? 70 : 54,
  {
    fontSize:
      isStartup
        ? 38
        : isLuxury
          ? 34
          : isExecutive
            ? 31
            : 30,
    color: p.accent,
    font: heading,
    align:
      isClassic || isLuxury
        ? 'center'
        : 'left'
  }
);

// Small subtitle for selected designs
if (isStartup) {
  para(
    'startupSubtitle',
    'A new chapter begins here',
    titleY + 62,
    30,
    {
      fontSize: 18,
      color: p.muted,
      font: bodyItalic
    }
  );
}

if (isTechnology) {
  para(
    'technologySubtitle',
    'Innovation • Collaboration • Growth',
    titleY + 52,
    28,
    {
      fontSize: 17,
      color: p.muted
    }
  );
}

if (isCreative) {
  para(
    'creativeSubtitle',
    'Let us create something remarkable together',
    titleY + 54,
    30,
    {
      fontSize: 18,
      color: p.muted,
      font: bodyItalic
    }
  );
}

// ─────────────────────────────────────────────────────────────
// Recipient and letter content
// ─────────────────────────────────────────────────────────────

const recipientY =
  isLuxury
    ? 382
    : isStartup || isTechnology || isCreative
      ? 350
      : 330;

para(
  'to',
  'Dear {{recipient_name}},',
  recipientY,
  38,
  {
    fontSize: 22,
    color: p.ink,
    font: bodyItalic
  }
);

const paragraphOneY = recipientY + 68;

para(
  'p1',
  'We are pleased to offer you the position of <strong>{{position}}</strong> at <strong>{{company_name}}</strong>. Your experience, abilities and professional approach impressed our team, and we believe you will make a valuable contribution to our organisation.',
  paragraphOneY,
  130,
  {
    fontSize: 21,
    lineHeight: 1.65
  }
);

para(
  'p2',
  'Your employment will commence on <strong>{{start_date}}</strong>. You will receive an annual compensation of <strong>{{salary}}</strong>, subject to applicable deductions, company policies and the terms discussed during the selection process.',
  paragraphOneY + 148,
  124,
  {
    fontSize: 21,
    lineHeight: 1.65
  }
);

para(
  'p3',
  'This offer is subject to the completion of the organisation’s standard onboarding requirements. Additional information regarding your responsibilities, benefits and employment conditions will be shared during onboarding.',
  paragraphOneY + 290,
  124,
  {
    fontSize: 21,
    lineHeight: 1.65
  }
);

para(
  'p4',
  isCreative
    ? 'We are excited about the ideas, energy and perspective you will bring to our team. Please sign and return this letter as confirmation of your acceptance.'
    : isStartup
      ? 'We look forward to building, learning and growing together. Please sign and return this letter to confirm your acceptance of the offer.'
      : isTechnology
        ? 'We look forward to your contribution to our culture of innovation. Kindly sign and return this letter to confirm your acceptance.'
        : 'We look forward to welcoming you to our team. Kindly sign and return a copy of this letter as confirmation of your acceptance.',
  paragraphOneY + 432,
  100,
  {
    fontSize: 21,
    lineHeight: 1.65
  }
);

// ─────────────────────────────────────────────────────────────
// Closing and authorised signature
// ─────────────────────────────────────────────────────────────

const closingY =
  isLuxury
    ? 978
    : 930;

const closingText =
  isCreative
    ? 'With excitement,'
    : isLuxury
      ? 'Sincerely yours,'
      : isExecutive
        ? 'Respectfully,'
        : 'Warm regards,';

para(
  'closing',
  closingText,
  closingY,
  36,
  {
    fontSize: 22,
    color: p.ink,
    font: bodyItalic,
    align: isLuxury ? 'center' : 'left'
  }
);

const signatureX =
  isLuxury
    ? 340
    : contentX;

const signatureWidth =
  isLuxury
    ? 320
    : 330;

add(
  'sigRule',
  barLayer({
    x: signatureX,
    y: closingY + 104,
    width: signatureWidth,
    height: 2,
    color: p.accent
  })
);

para(
  'sigName',
  '{{authorized_signatory}}',
  closingY + 116,
  32,
  {
    x: signatureX,
    width: signatureWidth,
    fontSize: 19,
    color: p.ink,
    font: heading,
    align: isLuxury ? 'center' : 'left'
  }
);

para(
  'sigLabel',
  'Authorized Signatory',
  closingY + 150,
  28,
  {
    x: signatureX,
    width: signatureWidth,
    fontSize: 17,
    color: p.muted,
    align: isLuxury ? 'center' : 'left'
  }
);

para(
  'sigCompany',
  '{{company_name}}',
  closingY + 180,
  32,
  {
    x: signatureX,
    width: signatureWidth,
    fontSize: 18,
    color: p.ink,
    font: heading,
    align: isLuxury ? 'center' : 'left'
  }
);

  const root = {
    type: { resolvedName: 'RootLayer' },
    props: {
      boxSize: { width: LETTER.width, height: LETTER.height },
      position: { x: 0, y: 0 },
      rotate: 0,
      color: p.background
    },
    locked: false,
    child: order,
    parent: null
  };
  const readable = [{ name: '', notes: '', layers: { ROOT: root, ...layers } }];
  return packDesign(readable) as unknown[];
}
