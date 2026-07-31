// Geometry for line layers. A line's box is length (width) × thickness-box (height), rotated by its
// angle, with transform-origin at the top-left (0,0). The two visible ends are the box's left-mid
// (0, h/2) and right-mid (w, h/2). These helpers convert between that box and the two page-space ends.

export type Pt = { x: number; y: number };
export type LineBox = { position: Pt; boxSize: { width: number; height: number }; rotate: number };

const toRad = (deg: number) => (deg * Math.PI) / 180;

function localToPage(box: LineBox, lx: number, ly: number): Pt {
  const t = toRad(box.rotate || 0);
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  return {
    x: box.position.x + lx * cos - ly * sin,
    y: box.position.y + lx * sin + ly * cos,
  };
}

/** The two ends of a line in page coordinates (start = left-mid, end = right-mid). */
export function endpointsOf(box: LineBox): { start: Pt; end: Pt } {
  const h = box.boxSize.height;
  return {
    start: localToPage(box, 0, h / 2),
    end: localToPage(box, box.boxSize.width, h / 2),
  };
}

/** Build the box (position, width, rotate) for a line running start → end, keeping the given height. */
export function lineFromEndpoints(start: Pt, end: Pt, height: number): LineBox {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const t = Math.atan2(dy, dx);
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  // position maps local (0, h/2) back onto `start`:  position = start - R·(0, h/2)
  return {
    position: {
      x: start.x + sin * (height / 2),
      y: start.y - cos * (height / 2),
    },
    boxSize: { width: length, height },
    rotate: (t * 180) / Math.PI,
  };
}
