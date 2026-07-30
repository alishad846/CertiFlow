import shapesDataset from '../data/editor/shapes.json';
import framesDataset from '../data/editor/frames.json';
import textsDataset from '../data/editor/texts.json';
import fontsDataset from '../data/editor/fonts.json';

type EditorAssetKind = 'shapes' | 'frames' | 'texts' | 'fonts';

const datasets: Record<EditorAssetKind, { data: unknown[] }> = {
  shapes: shapesDataset,
  frames: framesDataset,
  texts: textsDataset,
  fonts: fontsDataset
};

export interface PageParams {
  ps?: number;
  pi?: number;
}

/** Paginates a curated editor-content dataset (`.data` array) by page size (ps) / page index (pi). */
export function paginateEditorAssets(kind: EditorAssetKind, { ps = 18, pi = 0 }: PageParams): unknown[] {
  const items = datasets[kind].data;
  const start = pi * ps;
  return items.slice(start, start + ps);
}
