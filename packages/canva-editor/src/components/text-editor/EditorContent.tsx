import React, { FC, useEffect, useRef } from 'react';
import { createEditor } from './core/helper/createEditor';
import { useEditor } from '../../hooks';
import { TextEditor } from './interfaces';
import { selectText } from './core/command/selectText';

interface EditorContentProps {
    editor: TextEditor;
}
const EditorContent: FC<EditorContentProps> = ({ editor }) => {
    const ref = useRef<HTMLDivElement>(null);
    const { actions } = useEditor();
    useEffect(() => {
        // Guard against a stale editor already mounted in this node (e.g. React StrictMode's
        // double-invoke of effects in dev, or an effect re-run): without this, a second
        // ProseMirror EditorView is appended below the first, showing a duplicate text box.
        if (ref.current) {
            ref.current.innerHTML = '';
        }
        actions.history.new();
        const editingEditor = createEditor({
            content: editor.dom.innerHTML,
            ele: ref.current,
            handleDOMEvents: {
                blur: () => {
                    actions.closeTextEditor();
                },
            },
        });
        selectText({ from: editingEditor.state.doc.content.size, to: editingEditor.state.doc.content.size })(
            editingEditor.state,
            editingEditor.dispatch,
        );
        editingEditor.focus();
        actions.setOpeningEditor(editingEditor);
        return () => {
            editingEditor.destroy();
        };
    }, [actions]);
    return <div ref={ref} />;
};
export default React.memo(EditorContent);
