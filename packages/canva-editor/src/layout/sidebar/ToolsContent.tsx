import { FC, ReactNode, useState } from 'react';
import { useEditor } from 'canva-editor/hooks';
import CloseSidebarButton from './CloseButton';
import useMobileDetect from 'canva-editor/hooks/useMobileDetect';
import DrawPadModal from './tools/DrawPadModal';
import WatermarkModal from './tools/WatermarkModal';
import TableModal from './tools/TableModal';

type ToolKey = 'signature' | 'draw' | 'table' | 'watermark' | null;

const Icon: FC<{ path: ReactNode }> = ({ path }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

const TOOLS: Array<{ key: Exclude<ToolKey, null>; label: string; desc: string; icon: ReactNode }> = [
  {
    key: 'signature',
    label: 'Signature',
    desc: 'Draw or upload a signature',
    icon: <Icon path={<><path d="M3 17c3 0 3-8 6-8s2 6 4 6 3-4 5-4" /><path d="M3 21h18" /></>} />,
  },
  {
    key: 'draw',
    label: 'Draw',
    desc: 'Freehand drawing',
    icon: <Icon path={<><path d="M12 19l7-7a2.1 2.1 0 0 0-3-3l-7 7-1 4z" /><path d="M15 6l3 3" /></>} />,
  },
  {
    key: 'table',
    label: 'Table',
    desc: 'Insert an editable grid',
    icon: <Icon path={<><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 10h18M3 15h18M9 4v16M15 4v16" /></>} />,
  },
  {
    key: 'watermark',
    label: 'Watermark',
    desc: 'Add a company watermark',
    icon: <Icon path={<><circle cx="12" cy="12" r="9" /><path d="M5 13c2 1.5 4 1.5 7 0s5-1.5 7 0" /></>} />,
  },
];

const ToolsContent: FC<{ onClose: () => void }> = ({ onClose }) => {
  const { actions } = useEditor();
  const isMobile = useMobileDetect();
  const [active, setActive] = useState<ToolKey>(null);

  return (
    <div css={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 16, overflowY: 'auto' }}>
      {!isMobile && <CloseSidebarButton onClose={onClose} />}

      <div
        css={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: '#8A6A43',
          margin: '2px 0 12px',
          fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
        }}
      >
        Tools
      </div>

      <div css={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            onClick={() => setActive(tool.key)}
            css={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid rgba(11,27,58,.1)',
              background: '#fff',
              cursor: 'pointer',
              color: '#0B1B3A',
              transition: 'border-color .15s ease, transform .1s ease',
              ':hover': { borderColor: 'rgba(180,138,90,.7)', transform: 'translateY(-1px)' },
            }}
          >
            <span
              css={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(180,138,90,.12)',
                color: '#8A6A43',
                flexShrink: 0,
              }}
            >
              {tool.icon}
            </span>
            <span>
              <span css={{ display: 'block', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}>{tool.label}</span>
              <span css={{ display: 'block', fontSize: 12, color: '#6B6559' }}>{tool.desc}</span>
            </span>
          </button>
        ))}

        {/* Notes reuses the editor's built-in Notes panel. */}
        <button
          onClick={() => actions.setSidebarTab('Notes')}
          css={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textAlign: 'left',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(11,27,58,.1)',
            background: '#fff',
            cursor: 'pointer',
            color: '#0B1B3A',
            ':hover': { borderColor: 'rgba(180,138,90,.7)' },
          }}
        >
          <span css={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, background: 'rgba(180,138,90,.12)', color: '#8A6A43', flexShrink: 0 }}>
            <Icon path={<><path d="M4 4h16v12l-4 4H4z" /><path d="M16 20v-4h4" /></>} />
          </span>
          <span>
            <span css={{ display: 'block', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)' }}>Notes</span>
            <span css={{ display: 'block', fontSize: 12, color: '#6B6559' }}>Private notes for this design</span>
          </span>
        </button>
      </div>

      {active === 'signature' && (
        <DrawPadModal
          title="Add a signature"
          hint="Sign with your mouse or finger, then add it to the certificate."
          filename="signature.png"
          showBaseline
          onClose={() => setActive(null)}
        />
      )}
      {active === 'draw' && (
        <DrawPadModal
          title="Draw"
          hint="Draw freely, then add it to the certificate."
          filename="drawing.png"
          onClose={() => setActive(null)}
        />
      )}
      {active === 'watermark' && <WatermarkModal onClose={() => setActive(null)} />}
      {active === 'table' && <TableModal onClose={() => setActive(null)} />}
    </div>
  );
};

export default ToolsContent;
