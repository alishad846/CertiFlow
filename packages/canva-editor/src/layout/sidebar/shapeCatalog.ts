// Curated shape catalog for the CertiFlow editor.
//
// Every shape is expressed purely as ShapeLayer props (clipPath + fill, or clipPath + a dashed/dotted
// border), so shapes are vector-crisp at any size and fully recolourable — no image assets. Shapes are
// grouped into named sections (Lines, Circles, …) and each carries keywords so the search box can match
// natural queries like "dotted lines" or "ring".

export type ShapeRender = 'fill' | 'stroke';
export type ShapeBorderStyle = 'solid' | 'dots' | 'shortDashes' | 'longDashes';

export type CatalogShape = {
  id: string;
  label: string;
  /** Space-joined search terms (matched together with the label). */
  keywords: string;
  /** 'shape' inserts a ShapeLayer; 'line' inserts a proper LineLayer with draggable ends. */
  kind?: 'shape' | 'line';
  // Shape fields (kind === 'shape')
  clipPath?: string;
  shapeSize?: { width: number; height: number };
  boxSize?: { width: number; height: number };
  /** 'fill' → solid filled shape; 'stroke' → outline drawn via a coloured border over a transparent fill. */
  render?: ShapeRender;
  borderStyle?: ShapeBorderStyle;
  borderWeight?: number;
  roundedCorners?: number;
  // Line fields (kind === 'line')
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  lineThickness?: number;
  lineArrow?: boolean;
};

export type CatalogCategory = {
  id: string;
  label: string;
  shapes: CatalogShape[];
};

const P = (n: number) => Math.round(n * 100) / 100;

/** Regular n-gon inscribed in a circle, default pointing up, in a 256×256 box. */
function regularPolygonPath(sides: number, r = 128, cx = 128, cy = 128, rotationDeg = -90): string {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < sides; i++) {
    const a = ((rotationDeg + (360 / sides) * i) * Math.PI) / 180;
    pts.push([P(cx + r * Math.cos(a)), P(cy + r * Math.sin(a))]);
  }
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
}

/** Star / rosette: `points` outer spikes alternating between outerR and innerR. */
function starPath(points: number, outerR: number, innerR: number, cx = 128, cy = 128, rotationDeg = -90): string {
  const pts: Array<[number, number]> = [];
  const step = 180 / points;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = ((rotationDeg + step * i) * Math.PI) / 180;
    pts.push([P(cx + r * Math.cos(a)), P(cy + r * Math.sin(a))]);
  }
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z';
}

// ── A smooth 60-gon "circle" (all straight segments so the path parser stays happy) ───────────────
const CIRCLE_PATH = regularPolygonPath(60);

// Reusable rectangle
const rect = (w: number, h: number) => `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;

export const SHAPE_CATALOG: CatalogCategory[] = [
  {
    id: 'lines',
    label: 'Lines',
    shapes: [
      {
        id: 'line-solid',
        label: 'Solid line',
        keywords: 'line solid rule divider straight underline',
        kind: 'line',
        lineStyle: 'solid',
        lineThickness: 4,
      },
      {
        id: 'line-thick',
        label: 'Thick line',
        keywords: 'line thick bold bar rule heavy',
        kind: 'line',
        lineStyle: 'solid',
        lineThickness: 10,
      },
      {
        id: 'line-dashed',
        label: 'Dashed line',
        keywords: 'line dashed dash dashes broken rule divider',
        kind: 'line',
        lineStyle: 'dashed',
        lineThickness: 4,
      },
      {
        id: 'line-dotted',
        label: 'Dotted line',
        keywords: 'line dotted dots dot rule divider perforated',
        kind: 'line',
        lineStyle: 'dotted',
        lineThickness: 4,
      },
      {
        id: 'line-arrow',
        label: 'Arrow line',
        keywords: 'line arrow pointer direction rule',
        kind: 'line',
        lineStyle: 'solid',
        lineThickness: 5,
        lineArrow: true,
      },
    ],
  },
  {
    id: 'circles',
    label: 'Circles',
    shapes: [
      {
        id: 'circle-filled',
        label: 'Circle',
        keywords: 'circle round filled disc ellipse oval',
        clipPath: CIRCLE_PATH,
        shapeSize: { width: 256, height: 256 },
        boxSize: { width: 160, height: 160 },
        render: 'fill',
      },
      {
        id: 'circle-dot',
        label: 'Dot',
        keywords: 'dot circle point bullet small round',
        clipPath: CIRCLE_PATH,
        shapeSize: { width: 256, height: 256 },
        boxSize: { width: 56, height: 56 },
        render: 'fill',
      },
      {
        id: 'circle-ring',
        label: 'Ring',
        keywords: 'circle ring outline hollow round o',
        clipPath: CIRCLE_PATH,
        shapeSize: { width: 256, height: 256 },
        boxSize: { width: 160, height: 160 },
        render: 'stroke',
        borderStyle: 'solid',
        borderWeight: 6,
      },
      {
        id: 'circle-ring-dotted',
        label: 'Dotted ring',
        keywords: 'circle ring dotted dots outline round',
        clipPath: CIRCLE_PATH,
        shapeSize: { width: 256, height: 256 },
        boxSize: { width: 160, height: 160 },
        render: 'stroke',
        borderStyle: 'dots',
        borderWeight: 6,
      },
      {
        id: 'circle-ring-dashed',
        label: 'Dashed ring',
        keywords: 'circle ring dashed dashes outline round',
        clipPath: CIRCLE_PATH,
        shapeSize: { width: 256, height: 256 },
        boxSize: { width: 160, height: 160 },
        render: 'stroke',
        borderStyle: 'shortDashes',
        borderWeight: 6,
      },
    ],
  },
  {
    id: 'squares',
    label: 'Squares & Rectangles',
    shapes: [
      {
        id: 'square',
        label: 'Square',
        keywords: 'square box block filled',
        clipPath: rect(200, 200),
        shapeSize: { width: 200, height: 200 },
        boxSize: { width: 150, height: 150 },
        render: 'fill',
      },
      {
        id: 'square-rounded',
        label: 'Rounded square',
        keywords: 'square rounded box soft corners',
        clipPath: rect(200, 200),
        shapeSize: { width: 200, height: 200 },
        boxSize: { width: 150, height: 150 },
        render: 'fill',
        roundedCorners: 28,
      },
      {
        id: 'rectangle',
        label: 'Rectangle',
        keywords: 'rectangle rect bar box block panel',
        clipPath: rect(256, 160),
        shapeSize: { width: 256, height: 160 },
        boxSize: { width: 260, height: 163 },
        render: 'fill',
      },
      {
        id: 'square-outline',
        label: 'Outline square',
        keywords: 'square outline hollow frame border box',
        clipPath: rect(200, 200),
        shapeSize: { width: 200, height: 200 },
        boxSize: { width: 150, height: 150 },
        render: 'stroke',
        borderStyle: 'solid',
        borderWeight: 6,
      },
      {
        id: 'square-dashed',
        label: 'Dashed square',
        keywords: 'square dashed dashes outline frame border box',
        clipPath: rect(200, 200),
        shapeSize: { width: 200, height: 200 },
        boxSize: { width: 150, height: 150 },
        render: 'stroke',
        borderStyle: 'shortDashes',
        borderWeight: 6,
      },
    ],
  },
  {
    id: 'arrows',
    label: 'Arrows',
    shapes: [
      {
        id: 'arrow-right',
        label: 'Arrow right',
        keywords: 'arrow right pointer direction next',
        clipPath: 'M 0 48 L 150 48 L 150 16 L 256 80 L 150 144 L 150 112 L 0 112 Z',
        shapeSize: { width: 256, height: 160 },
        boxSize: { width: 230, height: 144 },
        render: 'fill',
      },
      {
        id: 'arrow-left',
        label: 'Arrow left',
        keywords: 'arrow left pointer direction back previous',
        clipPath: 'M 256 48 L 106 48 L 106 16 L 0 80 L 106 144 L 106 112 L 256 112 Z',
        shapeSize: { width: 256, height: 160 },
        boxSize: { width: 230, height: 144 },
        render: 'fill',
      },
      {
        id: 'arrow-up',
        label: 'Arrow up',
        keywords: 'arrow up pointer direction top',
        clipPath: 'M 48 256 L 48 106 L 16 106 L 80 0 L 144 106 L 112 106 L 112 256 Z',
        shapeSize: { width: 160, height: 256 },
        boxSize: { width: 144, height: 230 },
        render: 'fill',
      },
      {
        id: 'arrow-down',
        label: 'Arrow down',
        keywords: 'arrow down pointer direction bottom',
        clipPath: 'M 48 0 L 48 150 L 16 150 L 80 256 L 144 150 L 112 150 L 112 0 Z',
        shapeSize: { width: 160, height: 256 },
        boxSize: { width: 144, height: 230 },
        render: 'fill',
      },
      {
        id: 'chevron',
        label: 'Chevron',
        keywords: 'chevron arrow angle pointer next',
        clipPath: 'M 40 0 L 128 88 L 216 0 L 256 40 L 128 168 L 0 40 Z',
        shapeSize: { width: 256, height: 168 },
        boxSize: { width: 220, height: 144 },
        render: 'fill',
      },
    ],
  },
  {
    id: 'stars',
    label: 'Stars & Seals',
    shapes: [
      {
        id: 'star-5',
        label: 'Star',
        keywords: 'star 5 five points rating award',
        clipPath: starPath(5, 128, 52),
        shapeSize: { width: 256, height: 256 },
        boxSize: { width: 160, height: 160 },
        render: 'fill',
      },
      {
        id: 'star-6',
        label: '6-point star',
        keywords: 'star 6 six points sparkle',
        clipPath: starPath(6, 128, 64),
        shapeSize: { width: 256, height: 256 },
        boxSize: { width: 160, height: 160 },
        render: 'fill',
      },
      {
        id: 'seal',
        label: 'Seal badge',
        keywords: 'seal badge rosette award certificate medal burst',
        clipPath: starPath(24, 128, 106),
        shapeSize: { width: 256, height: 256 },
        boxSize: { width: 170, height: 170 },
        render: 'fill',
      },
    ],
  },
  {
    id: 'polygons',
    label: 'Polygons',
    shapes: [
      {
        id: 'triangle',
        label: 'Triangle',
        keywords: 'triangle three sides polygon',
        clipPath: 'M 128 0 L 256 222 L 0 222 Z',
        shapeSize: { width: 256, height: 222 },
        boxSize: { width: 200, height: 173 },
        render: 'fill',
      },
      {
        id: 'diamond',
        label: 'Diamond',
        keywords: 'diamond rhombus polygon',
        clipPath: 'M 128 0 L 256 128 L 128 256 L 0 128 Z',
        shapeSize: { width: 256, height: 256 },
        boxSize: { width: 160, height: 160 },
        render: 'fill',
      },
      {
        id: 'pentagon',
        label: 'Pentagon',
        keywords: 'pentagon five sides polygon',
        clipPath: regularPolygonPath(5),
        shapeSize: { width: 256, height: 256 },
        boxSize: { width: 160, height: 160 },
        render: 'fill',
      },
      {
        id: 'hexagon',
        label: 'Hexagon',
        keywords: 'hexagon six sides polygon honeycomb',
        clipPath: regularPolygonPath(6, 128, 128, 128, 0),
        shapeSize: { width: 256, height: 256 },
        boxSize: { width: 160, height: 160 },
        render: 'fill',
      },
    ],
  },
];

/** Flat list of every catalog shape (for search). */
export const ALL_CATALOG_SHAPES: CatalogShape[] = SHAPE_CATALOG.flatMap((c) => c.shapes);

/** Case-insensitive keyword search across label + keywords. Empty query → []. */
export function searchCatalogShapes(query: string): CatalogShape[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  return ALL_CATALOG_SHAPES.filter((s) => {
    const haystack = `${s.label} ${s.keywords}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

/** Maps a border style to an SVG stroke-dasharray for preview swatches (weight-relative, like the renderer). */
export function previewDashArray(style: ShapeBorderStyle | undefined, weight: number): string | undefined {
  switch (style) {
    case 'longDashes':
      return `${weight * 6}, ${weight}`;
    case 'shortDashes':
      return `${weight * 3}, ${weight}`;
    case 'dots':
      return `${weight}, ${weight}`;
    default:
      return undefined;
  }
}
