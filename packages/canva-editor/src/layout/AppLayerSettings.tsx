import { useSelectedLayers } from 'canva-editor/hooks';
import { LayerSettings } from 'canva-editor/utils/settings';

const AppLayerSettings = () => {
    const { selectedLayerIds } = useSelectedLayers();
    // Nothing selected → no per-layer settings to show. Hide the bar entirely instead of rendering
    // an empty floating box (previously it always showed the lone "Position" button).
    if (selectedLayerIds.length === 0) {
        return null;
    }
    return (
        <div
            css={{
                background: '#FBF9F5',
                border: '1px solid rgba(180,138,90,.22)',
                boxShadow: '0 6px 20px rgba(11,27,58,.08)',
                height: 50,
                overflow: 'auto',
                flexShrink: 0,
                borderRadius: 12,
                margin: 'auto',
                width: 'fit-content',
                minWidth: 500,
                maxWidth: 'calc(100% - 12px)',
                position: 'absolute',
                left: 0,
                right: 0,
                zIndex: 2,

                '@media (max-width: 900px)': {
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: '#fff',
                    display: selectedLayerIds.length > 0 ? 'flex' : 'none',
                    justifyContent: 'center',
                    zIndex: 11,
                    height: 65,
                },
            }}
        >
            <LayerSettings />
        </div>
    );
};

export default AppLayerSettings;
