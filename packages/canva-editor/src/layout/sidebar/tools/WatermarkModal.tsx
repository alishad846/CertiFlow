import { FC, useRef, useState } from 'react';
import { useEditor } from 'canva-editor/hooks';
import { uploadAndInsertImage } from './insertImage';

/**
 * Company watermark: renders faint, tiled diagonal text (or an uploaded logo) onto a page-sized
 * canvas, then inserts it as an image layer. The opacity is baked in so it reads as a watermark.
 */
const WatermarkModal: FC<{ onClose: () => void }> = ({ onClose }) => {
  const { config, actions, query } = useEditor();
  const [text, setText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState(22);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const pageSize = (() => {
    try {
      return query.getPageSize();
    } catch {
      return { width: 1414, height: 1000 };
    }
  })();

  const buildTextCanvas = (): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = Math.round(pageSize.width);
    c.height = Math.round(pageSize.height);
    const ctx = c.getContext('2d')!;
    ctx.globalAlpha = opacity / 100;
    ctx.fillStyle = '#0B1B3A';
    const fontSize = Math.round(pageSize.width / 22);
    ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((-30 * Math.PI) / 180);
    const stepX = ctx.measureText(text || ' ').width + fontSize * 1.8;
    const stepY = fontSize * 2.6;
    // Cover the whole rotated canvas (use the diagonal extent so corners aren't left blank).
    const diag = Math.hypot(c.width, c.height);
    for (let y = -diag; y < diag; y += stepY) {
      for (let x = -diag; x < diag; x += stepX) {
        ctx.fillText(text, x, y);
      }
    }
    return c;
  };

  const insertText = async () => {
    setError('');
    if (!text.trim()) {
      setError('Enter watermark text.');
      return;
    }
    setBusy(true);
    try {
      const canvas = buildTextCanvas();
      const blob: Blob | null = await new Promise((r) => canvas.toBlob((b) => r(b), 'image/png'));
      if (!blob) throw new Error('render failed');
      await uploadAndInsertImage(config, actions, blob, 'watermark.png', { asBackground: true });
      onClose();
    } catch {
      setError('Could not add the watermark. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const insertLogo = async (file: File) => {
    setError('');
    setBusy(true);
    try {
      // Bake the chosen opacity into the logo so it reads as a watermark.
      const url = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.globalAlpha = opacity / 100;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const blob: Blob | null = await new Promise((r) => c.toBlob((b) => r(b), 'image/png'));
      if (!blob) throw new Error('render failed');
      await uploadAndInsertImage(config, actions, blob, 'watermark-logo.png', { asBackground: true });
      onClose();
    } catch {
      setError('Could not add the logo watermark. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      css={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(11,27,58,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        css={{ width: 'min(520px, 92vw)', background: '#FBF9F5', borderRadius: 16, border: '1px solid rgba(180,138,90,.28)', boxShadow: '0 24px 60px rgba(11,27,58,.35)', padding: 22 }}
      >
        <div css={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <h2 css={{ fontFamily: 'var(--font-serif, "Cormorant Garamond", Georgia, serif)', fontSize: 24, fontWeight: 600, color: '#0B1B3A', margin: 0 }}>Watermark</h2>
          <button onClick={onClose} css={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6559', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <p css={{ fontSize: 13, color: '#6B6559', margin: '0 0 16px' }}>Add a faint, tiled watermark across the certificate.</p>

        <label css={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B6559', marginBottom: 6 }}>Watermark text</label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Acme Institute"
          css={{ width: '100%', boxSizing: 'border-box', height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(11,27,58,.18)', fontSize: 14, marginBottom: 16 }}
        />

        <label css={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#6B6559', marginBottom: 6 }}>
          <span>Opacity</span>
          <span>{opacity}%</span>
        </label>
        <input type="range" min={4} max={40} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} css={{ width: '100%', marginBottom: 8 }} />

        {error && <p css={{ color: '#8A3A2E', fontSize: 13, margin: '6px 0 0' }}>{error}</p>}

        <div css={{ display: 'flex', gap: 10, marginTop: 18, alignItems: 'center' }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && insertLogo(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            css={{ background: 'transparent', border: '1px solid rgba(11,27,58,.2)', borderRadius: 8, padding: '9px 14px', fontSize: 13.5, cursor: 'pointer', color: '#0B1B3A' }}
          >
            Use a logo image
          </button>
          <button
            onClick={insertText}
            disabled={busy}
            css={{ marginLeft: 'auto', background: '#B48A5A', color: '#0B1B3A', border: 'none', borderRadius: 999, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, ':hover': { background: busy ? '#B48A5A' : '#c49968' } }}
          >
            {busy ? 'Adding…' : 'Add watermark'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WatermarkModal;
