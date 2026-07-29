'use client';

import { useEffect } from 'react';

/**
 * Casual-capture deterrents for the certificate editor route. These raise the effort of trivially
 * lifting the artwork out of the editor — right-click "Save image", drag-to-desktop, and the browser
 * print path. They are deterrents, NOT a guarantee: OS-level screenshots and screen recording cannot
 * be blocked from a web page, and that limitation is documented for the product team.
 *
 * Everything is attached on mount and removed on unmount so it only applies while the editor is open.
 */
export function useEditorLockdown() {
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const onDragStart = (event: DragEvent) => {
      const target = event.target as HTMLElement | null;
      // Block dragging images (and background layers) out of the canvas to the desktop.
      if (target?.tagName === 'IMG' || target?.getAttribute('draggable') === 'true') {
        event.preventDefault();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Neutralise the print shortcut, which would otherwise render the design to a printable page.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault();
      }
    };

    // Hide the design from the print pipeline entirely.
    const printStyle = document.createElement('style');
    printStyle.setAttribute('data-editor-lockdown', 'true');
    printStyle.textContent = '@media print { body { display: none !important; } }';

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('keydown', onKeyDown);
    document.head.appendChild(printStyle);

    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('keydown', onKeyDown);
      printStyle.remove();
    };
  }, []);
}
