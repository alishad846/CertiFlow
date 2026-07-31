import { FC, useContext, useRef } from 'react';
import { useEditor } from 'canva-editor/hooks';
import { PageContext } from '../core/PageContext';
import { endpointsOf, lineFromEndpoints, LineBox, Pt } from '../lineGeometry';

const HANDLE = 14; // screen px
const POINT_SNAP = 10; // page units — attachment snap distance to other elements' points

/** Collect snap-target points (corners / edge mids / centre) from other layers + the page. */
function collectSnapPoints(layers: Record<string, any>, excludeId: string): Pt[] {
  const pts: Pt[] = [];
  const addBox = (pos: Pt, w: number, h: number) => {
    const xs = [pos.x, pos.x + w / 2, pos.x + w];
    const ys = [pos.y, pos.y + h / 2, pos.y + h];
    xs.forEach((x) => ys.forEach((y) => pts.push({ x, y })));
  };
  Object.entries(layers).forEach(([id, layer]) => {
    const p = layer?.data?.props;
    if (!p?.boxSize) return;
    if (id === 'ROOT') {
      addBox({ x: 0, y: 0 }, p.boxSize.width, p.boxSize.height); // page edges + centre
      return;
    }
    if (id === excludeId) return;
    // Only unrotated boxes give reliable axis-aligned targets; good enough for snapping.
    if (!p.rotate) addBox(p.position, p.boxSize.width, p.boxSize.height);
  });
  return pts;
}

/**
 * Renders two draggable end handles for a selected line. Dragging an end changes the line's length and
 * angle (the other end stays put). Ends snap to nearby element points, and the angle snaps to 45°
 * increments — hold Shift to disable snapping.
 */
const LineControl: FC<{ layerId: string }> = ({ layerId }) => {
  const { pageIndex } = useContext(PageContext);
  const { actions, state } = useEditor();
  const frameScale: number = state.scale || 1;
  const layer = state.pages[pageIndex]?.layers[layerId];
  const dragRef = useRef<{ which: 'start' | 'end'; fixed: Pt; height: number; startClient: Pt } | null>(null);

  if (!layer) return null;
  const props = layer.data.props;
  const box: LineBox = { position: props.position, boxSize: props.boxSize, rotate: props.rotate || 0 };
  const { start, end } = endpointsOf(box);

  const beginDrag = (which: 'start' | 'end') => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const ends = endpointsOf({ position: props.position, boxSize: props.boxSize, rotate: props.rotate || 0 });
    dragRef.current = {
      which,
      fixed: which === 'start' ? ends.end : ends.start,
      height: props.boxSize.height,
      startClient: { x: e.clientX, y: e.clientY },
    };
    const snapPts = collectSnapPoints(state.pages[pageIndex].layers, layerId);
    const draggedStartPage = which === 'start' ? ends.start : ends.end;
    actions.history.new();

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      let moved: Pt = {
        x: draggedStartPage.x + (ev.clientX - d.startClient.x) / frameScale,
        y: draggedStartPage.y + (ev.clientY - d.startClient.y) / frameScale,
      };
      // The end follows the cursor smoothly. The ONLY snapping is attachment: if the end lands very
      // near another element's point, it clicks onto it. No angle snapping (hold Shift to disable snap).
      const noSnap = ev.shiftKey;
      if (!noSnap) {
        let best: { p: Pt; dist: number } | null = null;
        snapPts.forEach((p) => {
          const dist = Math.hypot(p.x - moved.x, p.y - moved.y);
          if (dist <= POINT_SNAP && (!best || dist < best.dist)) best = { p, dist };
        });
        if (best) moved = best.p;
      }
      const next =
        d.which === 'start'
          ? lineFromEndpoints(moved, d.fixed, d.height)
          : lineFromEndpoints(d.fixed, moved, d.height);
      actions.history.merge().setProp(pageIndex, layerId, {
        position: next.position,
        boxSize: next.boxSize,
        rotate: next.rotate,
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleStyle = (pt: Pt): React.CSSProperties => ({
    position: 'absolute',
    left: pt.x * frameScale - HANDLE / 2,
    top: pt.y * frameScale - HANDLE / 2,
    width: HANDLE,
    height: HANDLE,
    borderRadius: '50%',
    background: '#fff',
    border: '2px solid #B48A5A',
    boxShadow: '0 1px 4px rgba(11,27,58,.3)',
    cursor: 'move',
    touchAction: 'none',
    zIndex: 2,
  });

  return (
    <div css={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
      <div style={{ pointerEvents: 'auto' }}>
        <div onMouseDown={beginDrag('start')} style={handleStyle(start)} />
        <div onMouseDown={beginDrag('end')} style={handleStyle(end)} />
      </div>
    </div>
  );
};

export default LineControl;
