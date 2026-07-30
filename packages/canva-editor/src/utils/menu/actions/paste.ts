import { EditorActions } from 'canva-editor/types/editor';
import { LayerComponentProps, SerializedLayerTree } from 'canva-editor/types';

export const paste = async ({ actions }: { actions: EditorActions }) => {
    if (typeof window === 'undefined') return;
    let data = '';
    try {
        data = await navigator.clipboard.readText();
    } catch {
        return; // clipboard blocked or empty
    }
    try {
        const serializedData = JSON.parse(data) as SerializedLayerTree[];
        // Only act on our own copied-layer payload; ignore anything else on the clipboard.
        if (!Array.isArray(serializedData)) return;
        serializedData.forEach((serializedLayers) => {
            if (!serializedLayers || !serializedLayers.rootId || !serializedLayers.layers) return;
            Object.entries(serializedLayers.layers).forEach(([layerId]) => {
                const props = serializedLayers.layers[layerId]?.props as LayerComponentProps | undefined;
                if (props?.position) {
                    props.position.x += 10;
                    props.position.y += 10;
                }
            });
            actions.addLayerTree(serializedLayers);
        });
    } catch {
        /* clipboard held non-JSON (plain text / image) — nothing to paste */
    }
};
