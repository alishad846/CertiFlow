import path from 'path';

export type StockCategory = 'certificate' | 'offer-letter';
export type StockTemplateDef = { id: string; name: string; file: string; category: StockCategory };

// Ready-made designs shipped with the app. Cloning one copies its background into the company's
// uploads and opens the editor seeded with the editable design. `file` is the placeholder background
// (the editable design's coloured RootLayer covers it — offer letters reuse a neutral one).
export const STOCK_TEMPLATES: StockTemplateDef[] = [
  { id: 'classic-navy', name: 'Classic Navy', file: 'classic-navy.png', category: 'certificate' },
  { id: 'botanical-green', name: 'Botanical Green', file: 'botanical-green.png', category: 'certificate' },
  { id: 'minimal-cream', name: 'Minimal Cream', file: 'minimal-cream.png', category: 'certificate' },
  { id: 'offer-corporate', name: 'Corporate Offer', file: 'minimal-cream.png', category: 'offer-letter' },
  { id: 'offer-modern', name: 'Modern Offer', file: 'minimal-cream.png', category: 'offer-letter' },
  { id: 'offer-classic', name: 'Classic Offer', file: 'minimal-cream.png', category: 'offer-letter' }
];

export const STOCK_TEMPLATES_DIR = path.resolve(__dirname, '..', 'data', 'editor', 'stock-templates');

export function getStockTemplate(id: string): StockTemplateDef | null {
  return STOCK_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function stockImagePath(id: string): string | null {
  const t = getStockTemplate(id);
  return t ? path.join(STOCK_TEMPLATES_DIR, t.file) : null;
}
