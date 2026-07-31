import { LayerComponent, LayerComponentProps } from 'canva-editor/types';

export interface LineLayerProps extends LayerComponentProps {
  /** Stroke colour. */
  color: string;
  /** Visible stroke thickness in px (the box height is a slightly larger click target). */
  thickness: number;
  /** Line style. */
  style: 'solid' | 'dashed' | 'dotted';
  /** Draw an arrow head at the end point. */
  arrow?: boolean;
}

const dashArray = (style: LineLayerProps['style'], t: number): string | undefined => {
  switch (style) {
    case 'dashed':
      return `${Math.max(6, t * 3)}, ${Math.max(4, t * 2)}`;
    case 'dotted':
      return `0.1, ${Math.max(4, t * 2)}`;
    default:
      return undefined;
  }
};

/**
 * A straight line drawn between the two mid-points of its box (left-mid → right-mid). The box width is
 * the line length and its rotation is the line angle, so the two ends are the box's left/right centres —
 * which the LineControl exposes as draggable end handles. The box height is a comfortable click target;
 * the visible stroke uses `thickness`.
 */
const LineLayer: LayerComponent<LineLayerProps> = ({ boxSize, scale = 1, color, thickness, style, arrow }) => {
  const w = boxSize.width / (scale || 1);
  const h = boxSize.height / (scale || 1);
  const y = h / 2;
  const head = thickness * 3.2; // arrow head length
  const x2 = arrow ? Math.max(0, w - head) : w;
  return (
    <div
      css={{ transformOrigin: '0 0' }}
      style={{ width: w, height: h, transform: `scale(${scale || 1})` }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: 'visible', display: 'block' }}>
        <line
          x1={0}
          y1={y}
          x2={x2}
          y2={y}
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={dashArray(style, thickness)}
          strokeLinecap={style === 'dotted' ? 'round' : 'butt'}
        />
        {arrow && (
          <polygon
            points={`${w},${y} ${x2},${y - head * 0.55} ${x2},${y + head * 0.55}`}
            fill={color}
          />
        )}
      </svg>
    </div>
  );
};

LineLayer.info = {
  name: 'Line',
  type: 'Line',
};

export default LineLayer;
