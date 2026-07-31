import { FC, useEffect, useRef, useState } from 'react';
import { getStroke } from 'perfect-freehand';
import { useEditor } from 'canva-editor/hooks';
import { uploadAndInsertImage } from './insertImage';

type StrokePt = [number, number, number]; // x, y, pressure
type Stroke = { color: string; size: number; points: StrokePt[] };

type Props = {
  title: string;
  hint: string;
  filename: string;
  /** Signature pads use a thin ruled baseline; freehand draw uses a plain surface. */
  showBaseline?: boolean;
  onClose: () => void;
};

const COLORS = ['#0B1B3A', '#111111', '#B48A5A', '#1E3A8A', '#8A3A2E', '#2E6E4E'];

/**
 * A drawing surface in a modal. The user draws with the mouse/touch; on insert the strokes are
 * exported to a trimmed PNG, uploaded, and placed on the canvas as an image layer.
 */
const DrawPadModal: FC<Props> = ({ title, hint, filename, showBaseline, onClose }) => {
  const { config, actions } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const dirty = useRef(false);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Fixed backing store; strokes are drawn at 2x for crisp export.
  const W = 900;
  const H = 380;

  const pos = (e: React.PointerEvent): StrokePt => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    return [x, y, pressure];
  };

  // Redraw every stroke as a smooth, pressure-tapered outline (perfect-freehand — the engine tldraw uses).
  const redraw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    const all = currentRef.current ? [...strokesRef.current, currentRef.current] : strokesRef.current;
    for (const s of all) {
      const outline = getStroke(s.points, {
        size: s.size * 2.4,
        thinning: 0.6,
        smoothing: 0.6,
        streamline: 0.5,
      });
      if (outline.length < 2) continue;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(outline[0][0], outline[0][1]);
      for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i][0], outline[i][1]);
      ctx.closePath();
      ctx.fill();
    }
  };

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = (e: React.PointerEvent) => {
    drawing.current = true;
    currentRef.current = { color, size, points: [pos(e)] };
    redraw();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !currentRef.current) return;
    currentRef.current.points.push(pos(e));
    dirty.current = true;
    redraw();
  };
  const end = () => {
    if (currentRef.current && currentRef.current.points.length) {
      strokesRef.current.push(currentRef.current);
    }
    currentRef.current = null;
    drawing.current = false;
    redraw();
  };

  const clear = () => {
    strokesRef.current = [];
    currentRef.current = null;
    dirty.current = false;
    const c = canvasRef.current;
    if (c) c.getContext('2d')!.clearRect(0, 0, W, H);
  };

  // Export only the drawn region (trimmed) so the inserted layer isn't a giant mostly-empty box.
  const exportTrimmed = (): Promise<Blob | null> => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, W, H);
    let minX = W, minY = H, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * 4 + 3] > 10) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) return Promise.resolve(null);
    const pad = 12;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(W, maxX + pad);
    maxY = Math.min(H, maxY + pad);
    const out = document.createElement('canvas');
    out.width = maxX - minX;
    out.height = maxY - minY;
    out.getContext('2d')!.drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return new Promise((resolve) => out.toBlob((b) => resolve(b), 'image/png'));
  };

  const insert = async () => {
    setError('');
    if (!dirty.current) {
      setError('Draw something first.');
      return;
    }
    setBusy(true);
    try {
      const blob = await exportTrimmed();
      if (!blob) {
        setError('Nothing to insert.');
        return;
      }
      await uploadAndInsertImage(config, actions, blob, filename);
      onClose();
    } catch (e) {
      setError('Could not add the drawing. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      css={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(11,27,58,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        css={{
          width: 'min(760px, 92vw)',
          background: '#FBF9F5',
          borderRadius: 16,
          border: '1px solid rgba(180,138,90,.28)',
          boxShadow: '0 24px 60px rgba(11,27,58,.35)',
          padding: 22,
        }}
      >
        <div css={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <h2 css={{ fontFamily: 'var(--font-serif, "Cormorant Garamond", Georgia, serif)', fontSize: 24, fontWeight: 600, color: '#0B1B3A', margin: 0 }}>
            {title}
          </h2>
          <button onClick={onClose} css={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6559', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <p css={{ fontSize: 13, color: '#6B6559', margin: '0 0 14px' }}>{hint}</p>

        {/* Controls */}
        <div css={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
          <div css={{ display: 'flex', gap: 6 }}>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={c}
                css={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: c,
                  cursor: 'pointer',
                  border: color === c ? '2px solid #B48A5A' : '2px solid transparent',
                  boxShadow: '0 0 0 1px rgba(11,27,58,.15)',
                }}
              />
            ))}
          </div>
          <label css={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6B6559' }}>
            Brush
            <input type="range" min={2} max={14} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </label>
          <button
            onClick={clear}
            css={{ marginLeft: 'auto', background: 'transparent', border: '1px solid rgba(11,27,58,.2)', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: '#0B1B3A' }}
          >
            Clear
          </button>
        </div>

        {/* Canvas */}
        <div css={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(11,27,58,.15)', background: '#fff' }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            css={{ width: '100%', height: 300, touchAction: 'none', cursor: 'crosshair', display: 'block' }}
          />
          {showBaseline && (
            <div css={{ position: 'absolute', left: '8%', right: '8%', bottom: 64, height: 1, background: 'rgba(11,27,58,.25)', pointerEvents: 'none' }} />
          )}
        </div>

        {error && <p css={{ color: '#8A3A2E', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}

        <div css={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} css={{ background: 'transparent', border: 'none', color: '#6B6559', fontSize: 14, cursor: 'pointer', padding: '9px 14px' }}>
            Cancel
          </button>
          <button
            onClick={insert}
            disabled={busy}
            css={{
              background: '#B48A5A',
              color: '#0B1B3A',
              border: 'none',
              borderRadius: 999,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.7 : 1,
              ':hover': { background: busy ? '#B48A5A' : '#c49968' },
            }}
          >
            {busy ? 'Adding…' : 'Add to certificate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrawPadModal;
