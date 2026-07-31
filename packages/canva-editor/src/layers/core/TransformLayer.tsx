import { BoxSize, Delta } from 'canva-editor/types';
import React, { forwardRef, ForwardRefRenderFunction, PropsWithChildren } from 'react';
import { getTransformStyle } from '../index';

export interface TransformLayerProps {
    boxSize: BoxSize;
    rotate: number;
    position: Delta;
    transparency?: number;
}
const TransformLayer: ForwardRefRenderFunction<HTMLDivElement, PropsWithChildren<TransformLayerProps>> = (
    { boxSize, rotate, position, transparency, children },
    ref,
) => {
    return (
        <div
            ref={ref}
            css={{
                touchAction: 'pan-x pan-y pinch-zoom',
                pointerEvents: 'auto',
                position: 'absolute',
            }}
            style={{
                // Guard against non-finite sizes (e.g. a degenerate resize of a very thin line) —
                // React throws "NaN is an invalid value for the width css style property" otherwise.
                width: Number.isFinite(boxSize.width) ? boxSize.width : 0,
                height: Number.isFinite(boxSize.height) ? boxSize.height : 0,
                transform: getTransformStyle({ position, rotate }),
                opacity: transparency,
            }}
        >
            {children}
        </div>
    );
};

export default forwardRef<HTMLDivElement, PropsWithChildren<TransformLayerProps>>(TransformLayer);
