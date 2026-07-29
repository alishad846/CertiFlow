import path from 'path';

export type StockTemplateDef = { id: string; name: string; file: string };

// Ready-made certificate backgrounds shipped with the app. Cloning one copies its background
// into the company's uploads and opens the editor with that background seeded on the canvas.
export const STOCK_TEMPLATES: StockTemplateDef[] = [
  { id: 'classic-navy', name: 'Classic Navy', file: 'classic-navy.png' },
  { id: 'botanical-green', name: 'Botanical Green', file: 'botanical-green.png' },
  { id: 'minimal-cream', name: 'Minimal Cream', file: 'minimal-cream.png' }
];

export const STOCK_TEMPLATES_DIR = path.resolve(__dirname, '..', 'data', 'editor', 'stock-templates');

export function getStockTemplate(id: string): StockTemplateDef | null {
  return STOCK_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function stockImagePath(id: string): string | null {
  const t = getStockTemplate(id);
  return t ? path.join(STOCK_TEMPLATES_DIR, t.file) : null;
}
