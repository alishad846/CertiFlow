import { useMemo } from 'react';
import { isFrameLayer, isGroupLayer, isTableLayer, isTextLayer } from 'canva-editor/utils/layer/layers';
import { useSelectedLayers } from '.';

export const useDisabledFeatures = () => {
    const { selectedLayers } = useSelectedLayers();
    // NOTE: shapes are intentionally NOT "scalable" so their corner handles resize the box freely
    // (following the cursor on both axes), instead of scaling proportionally. Hold Shift to lock the
    // aspect ratio. Text and groups stay scalable (a grouped table scales its cells + text together).
    const scalable = useMemo(
        () => !!selectedLayers.find((layer) => isTextLayer(layer) || isGroupLayer(layer)),
        [JSON.stringify(selectedLayers.map((l) => l.id))],
    );
    return useMemo(() => {
        const disable = {
            vertical: selectedLayers.length > 1,
            horizontal: selectedLayers.length > 1,
            corners: false,
            locked: false,
            rotate: false,
            scalable: !scalable,
        };
        selectedLayers.forEach((layer) => {
            if (layer.data.locked) {
                disable.locked = true;
                disable.vertical = true;
                disable.horizontal = true;
                disable.corners = true;
                disable.rotate = true;
            }
            if (isTextLayer(layer)) {
                disable.vertical = true;
            }

            // Tables resize width only (rows auto-grow to fit text); no vertical/corner handles.
            if (isTableLayer(layer)) {
                disable.vertical = true;
                disable.corners = true;
            }

            const isFrame = isFrameLayer(layer);
            if (isGroupLayer(layer) || isFrame) {
                disable.horizontal = true;
                disable.vertical = true;
                if (isFrame) disable.scalable = false;
            }
        });
        return disable;
    }, [selectedLayers]);
};
