import CertificateRenderClient from '@/components/editor/CertificateRenderClient';

// Chromeless render surface used by the headless PDF pipeline. It carries no navigation, no auth
// shell, and no dashboard chrome — the design is injected onto the window by the render worker.
export const dynamic = 'force-dynamic';

export default function RenderPage() {
  return <CertificateRenderClient />;
}
