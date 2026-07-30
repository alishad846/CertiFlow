import { FC, useState } from 'react';
import { useEditor } from 'canva-editor/hooks';

const clampInt = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

/**
 * Inserts a real table object (a single TableLayer rendered as an HTML table). It is one unit — there
 * is nothing to ungroup — and its rows grow automatically to fit their text. Double-click to edit cells.
 */
const TableModal: FC<{ onClose: () => void }> = ({ onClose }) => {
  const { actions, query } = useEditor();
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  const insert = () => {
    const page = (() => {
      try {
        return query.getPageSize();
      } catch {
        return { width: 1414, height: 1000 };
      }
    })();

    const tableW = page.width * 0.6;
    const estRowH = 46; // starting guess; the layer auto-measures its real height after render
    const boxH = rows * estRowH;
    const cells = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => (r === 0 ? `Column ${c + 1}` : ''))
    );
    const id = `table_${Math.floor(Math.random() * 1e9).toString(36)}`;
    actions.addLayerTree({
      rootId: id,
      layers: {
        [id]: {
          type: { resolvedName: 'TableLayer' },
          props: {
            position: { x: (page.width - tableW) / 2, y: (page.height - boxH) / 2 },
            boxSize: { width: tableW, height: boxH },
            rotate: 0,
            scale: 1,
            rows,
            cols,
            cells,
            borderColor: '#0B1B3A',
            textColor: '#0B1B3A',
            headerRow: true,
            fontSize: 18,
          },
          locked: false,
          child: [],
          parent: 'ROOT',
        },
      },
    });
    onClose();
  };

  const Stepper: FC<{ label: string; value: number; set: (n: number) => void }> = ({ label, value, set }) => (
    <div css={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <span css={{ fontSize: 13, color: '#6B6559', fontWeight: 600 }}>{label}</span>
      <div css={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => set(clampInt(value - 1, 1, 8))} css={btn}>−</button>
        <span css={{ minWidth: 22, textAlign: 'center', fontSize: 15, color: '#0B1B3A' }}>{value}</span>
        <button onClick={() => set(clampInt(value + 1, 1, 8))} css={btn}>+</button>
      </div>
    </div>
  );

  return (
    <div
      css={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(11,27,58,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        css={{ width: 'min(420px, 92vw)', background: '#FBF9F5', borderRadius: 16, border: '1px solid rgba(180,138,90,.28)', boxShadow: '0 24px 60px rgba(11,27,58,.35)', padding: 22 }}
      >
        <div css={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <h2 css={{ fontFamily: 'var(--font-serif, "Cormorant Garamond", Georgia, serif)', fontSize: 24, fontWeight: 600, color: '#0B1B3A', margin: 0 }}>Table</h2>
          <button onClick={onClose} css={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6559', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <p css={{ fontSize: 13, color: '#6B6559', margin: '0 0 18px' }}>Choose the size, then type into each cell.</p>

        <Stepper label="Rows" value={rows} set={setRows} />
        <Stepper label="Columns" value={cols} set={setCols} />

        <button
          onClick={insert}
          css={{ width: '100%', background: '#B48A5A', color: '#0B1B3A', border: 'none', borderRadius: 999, padding: '11px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 6, ':hover': { background: '#c49968' } }}
        >
          Insert {rows} × {cols} table
        </button>
      </div>
    </div>
  );
};

const btn = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: '1px solid rgba(11,27,58,.2)',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 16,
  color: '#0B1B3A',
  lineHeight: 1,
} as const;

export default TableModal;
