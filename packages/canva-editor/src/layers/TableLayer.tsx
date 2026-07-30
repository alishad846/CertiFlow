import { useEffect, useRef, useState } from 'react';
import { LayerComponent, LayerComponentProps } from 'canva-editor/types';
import { useEditor, useLayer } from 'canva-editor/hooks';

export interface TableLayerProps extends LayerComponentProps {
  rows: number;
  cols: number;
  /** Row-major cell text. */
  cells: string[][];
  borderColor: string;
  textColor: string;
  headerRow: boolean;
  fontSize: number;
}

/**
 * A real table object rendered as an HTML <table>, so rows grow to fit their text natively (no manual
 * sizing). It is a single layer — there is nothing to ungroup. Double-click to edit cells; the layer's
 * height auto-measures from the rendered table so the selection box always matches.
 */
const TableLayer: LayerComponent<TableLayerProps> = ({
  boxSize,
  scale = 1,
  cells,
  borderColor,
  textColor,
  headerRow,
  fontSize,
}) => {
  const { id, pageIndex } = useLayer();
  const { actions } = useEditor();
  const rootRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [editing, setEditing] = useState(false);

  // Leave edit mode when the user clicks outside the table.
  useEffect(() => {
    if (!editing) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setEditing(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [editing]);

  // Auto-measure the rendered table height and keep the layer box in sync (rows grow with content).
  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const measured = el.offsetHeight * (scale || 1);
    if (Math.abs(measured - boxSize.height) > 1) {
      actions.history.merge().setProp(pageIndex, id, {
        boxSize: { width: boxSize.width, height: measured },
      });
    }
    // Re-measure when width, content, or font changes (all affect wrapping/height).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxSize.width, JSON.stringify(cells), fontSize, scale]);

  const saveCell = (r: number, c: number, value: string) => {
    if ((cells[r]?.[c] ?? '') === value) return;
    const next = cells.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? value : cell)));
    actions.setProp(pageIndex, id, { cells: next } as any);
  };

  return (
    <div
      ref={rootRef}
      css={{ transformOrigin: '0 0' }}
      style={{ width: boxSize.width / (scale || 1), transform: `scale(${scale || 1})` }}
      onDoubleClick={() => setEditing(true)}
    >
      <table
        ref={tableRef}
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
        }}
      >
        <tbody>
          {cells.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td
                  key={c}
                  contentEditable={editing}
                  suppressContentEditableWarning
                  onBlur={(e) => saveCell(r, c, e.currentTarget.innerText.trim())}
                  style={{
                    border: `1px solid ${borderColor}`,
                    padding: '10px 12px',
                    color: textColor,
                    fontSize,
                    fontWeight: headerRow && r === 0 ? 600 : 400,
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    outline: editing ? '1px solid rgba(180,138,90,.5)' : 'none',
                    cursor: editing ? 'text' : 'inherit',
                    // Only intercept clicks while editing, so otherwise the whole table moves/selects as one.
                    pointerEvents: editing ? 'auto' : 'none',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

TableLayer.info = {
  name: 'Table',
  type: 'Table',
};

export default TableLayer;
