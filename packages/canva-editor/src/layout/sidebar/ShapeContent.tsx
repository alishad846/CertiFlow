import { FC, ReactNode, useMemo, useState } from 'react';
import { Delta } from 'canva-editor/types';
import { useEditor } from 'canva-editor/hooks';
import Draggable from 'canva-editor/layers/core/Dragable';
import CloseSidebarButton from './CloseButton';
import useMobileDetect from 'canva-editor/hooks/useMobileDetect';
import { useTranslate } from 'canva-editor/contexts/TranslationContext';
import { recommendPalette } from 'canva-editor/utils/settings/sidebar/recommendedColors';
import {
  SHAPE_CATALOG,
  searchCatalogShapes,
  previewDashArray,
  CatalogShape,
} from './shapeCatalog';

// Fallback fill when the template has no colours to draw from yet.
const FALLBACK_SHAPE_COLOR = '#0B1B3A';
// Colour used to draw the small preview swatches in the panel.
const SWATCH_COLOR = '#0B1B3A';

const lineDash = (style: string | undefined, t: number): string | undefined =>
  style === 'dashed' ? `${t * 3}, ${t * 2}` : style === 'dotted' ? `0.1, ${t * 2}` : undefined;

/** SVG preview of a catalog shape, mirroring how it renders on the canvas. */
const ShapeSwatch: FC<{ shape: CatalogShape }> = ({ shape }) => {
  if (shape.kind === 'line') {
    const t = shape.lineThickness ?? 4;
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="xMidYMid meet" css={{ maxWidth: '82%' }}>
        <line
          x1={6}
          y1={20}
          x2={shape.lineArrow ? 82 : 94}
          y2={20}
          stroke={SWATCH_COLOR}
          strokeWidth={t}
          strokeDasharray={lineDash(shape.lineStyle, t)}
          strokeLinecap={shape.lineStyle === 'dotted' ? 'round' : 'butt'}
        />
        {shape.lineArrow && <polygon points="94,20 82,13 82,27" fill={SWATCH_COLOR} />}
      </svg>
    );
  }
  const { width, height } = shape.shapeSize!;
  const isStroke = shape.render === 'stroke';
  const weight = shape.borderWeight ?? 6;
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      css={{ maxWidth: '78%', maxHeight: '78%' }}
    >
      <path
        d={shape.clipPath}
        fill={isStroke ? 'none' : SWATCH_COLOR}
        stroke={isStroke ? SWATCH_COLOR : 'none'}
        strokeWidth={isStroke ? weight * 2 : 0}
        strokeDasharray={isStroke ? previewDashArray(shape.borderStyle, weight) : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const ShapeContent: FC<{ onClose: () => void }> = ({ onClose }) => {
  const { actions, state, query: editorQuery } = useEditor();
  const isMobile = useMobileDetect();
  const t = useTranslate();
  const [query, setQuery] = useState('');

  // Default new shapes to the template's most relatable colour (from its existing palette) so inserts
  // blend in immersively instead of dropping in as flat black. Falls back to CertiFlow navy.
  const defaultColor = useMemo(() => {
    const colors: string[] = [];
    state.pages.forEach((page: any) =>
      Object.values(page.layers).forEach((layer: any) => {
        const p = layer?.data?.props;
        if (p?.color && typeof p.color === 'string') colors.push(p.color);
        if (Array.isArray(p?.colors)) colors.push(...p.colors);
      })
    );
    return recommendPalette(colors)[0] || FALLBACK_SHAPE_COLOR;
  }, [state.pages]);

  // Insert a real LineLayer (two draggable ends) for line-kind catalog entries.
  const insertLine = (shape: CatalogShape, position?: Delta) => {
    const page = (() => {
      try {
        return editorQuery.getPageSize();
      } catch {
        return { width: 1414, height: 1000 };
      }
    })();
    const thickness = shape.lineThickness ?? 4;
    const hit = Math.max(18, thickness * 2);
    const length = page.width * 0.4;
    const pos = position
      ? { x: position.x - length / 2, y: position.y - hit / 2 }
      : { x: (page.width - length) / 2, y: page.height / 2 - hit / 2 };
    const id = `line_${Math.floor(Math.random() * 1e9).toString(36)}`;
    actions.addLayerTree({
      rootId: id,
      layers: {
        [id]: {
          type: { resolvedName: 'LineLayer' },
          props: {
            position: pos,
            boxSize: { width: length, height: hit },
            rotate: 0,
            scale: 1,
            color: defaultColor,
            thickness,
            style: shape.lineStyle ?? 'solid',
            arrow: !!shape.lineArrow,
          },
          locked: false,
          child: [],
          parent: 'ROOT',
        },
      },
    });
    if (isMobile) onClose();
  };

  const insertShape = (shape: CatalogShape, position?: Delta) => {
    if (shape.kind === 'line') {
      insertLine(shape, position);
      return;
    }
    const border =
      shape.render === 'stroke'
        ? { style: shape.borderStyle ?? 'solid', weight: shape.borderWeight ?? 6, color: defaultColor }
        : null;
    actions.addShapeLayer({
      type: { resolvedName: 'ShapeLayer' },
      props: {
        position,
        boxSize: shape.boxSize,
        rotate: 0,
        clipPath: shape.clipPath,
        scale: 1,
        color: shape.render === 'stroke' ? 'transparent' : defaultColor,
        shapeSize: shape.shapeSize,
        roundedCorners: shape.roundedCorners ?? 0,
        ...(border ? { border } : {}),
      },
    });
    if (isMobile) {
      onClose();
    }
  };

  const results = searchCatalogShapes(query);
  const searching = query.trim().length > 0;

  const renderGrid = (shapes: CatalogShape[]) => (
    <div
      css={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 8,
      }}
    >
      {shapes.map((shape) => (
        <Draggable
          key={shape.id}
          onDrop={(pos) => pos && insertShape(shape, pos)}
          onClick={() => insertShape(shape)}
        >
          <div
            title={shape.label}
            css={{
              aspectRatio: '1 / 1',
              borderRadius: 10,
              border: '1px solid rgba(11,27,58,.12)',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'border-color .15s ease, transform .1s ease',
              ':hover': {
                borderColor: 'rgba(180,138,90,.7)',
                transform: 'translateY(-1px)',
              },
            }}
          >
            <ShapeSwatch shape={shape} />
          </div>
        </Draggable>
      ))}
    </div>
  );

  return (
    <div
      css={{
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        overflowY: 'auto',
        display: 'flex',
        padding: 16,
      }}
    >
      {!isMobile && <CloseSidebarButton onClose={onClose} />}

      {/* Search — filters across every section by keyword (e.g. "dotted lines", "ring", "star"). */}
      <div css={{ marginBottom: 16 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={!isMobile}
          placeholder={t('sidebar.searchShape', 'Search shapes — try "dotted lines"')}
          css={{
            width: '100%',
            boxSizing: 'border-box',
            height: 40,
            padding: '0 14px',
            borderRadius: 999,
            border: '1px solid rgba(11,27,58,.15)',
            background: '#fff',
            fontSize: 14,
            outline: 'none',
            fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
            ':focus': {
              borderColor: 'rgba(180,138,90,.7)',
              boxShadow: '0 0 0 3px rgba(180,138,90,.15)',
            },
          }}
        />
      </div>

      <div css={{ flexGrow: 1, overflowY: 'auto' }}>
        {searching ? (
          results.length > 0 ? (
            <>
              <SectionHeader>
                {t('sidebar.results', 'Results')} ({results.length})
              </SectionHeader>
              {renderGrid(results)}
            </>
          ) : (
            <div css={{ fontSize: 13, color: '#8A8578', padding: '8px 2px' }}>
              {t('sidebar.noShapes', 'No shapes match')} “{query.trim()}”.
            </div>
          )
        ) : (
          SHAPE_CATALOG.map((category) => (
            <div key={category.id} css={{ marginBottom: 20 }}>
              <SectionHeader>{category.label}</SectionHeader>
              {renderGrid(category.shapes)}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/** Small uppercase section label, styled to the CertiFlow luxury system. */
const SectionHeader: FC<{ children: ReactNode }> = ({ children }) => (
  <div
    css={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: '#8A6A43',
      margin: '2px 0 10px',
      fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
    }}
  >
    {children}
  </div>
);

export default ShapeContent;
