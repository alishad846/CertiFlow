import { apiUrl } from './api';

export function getTemplatePreviewSrc(template: { id: string; backgroundUrl: string }) {
  if (!template.backgroundUrl) {
    return '';
  }

  if (template.backgroundUrl.toLowerCase().endsWith('.pdf')) {
    return `${apiUrl}/certificate-templates/${template.id}/preview-image`;
  }

  return `${apiUrl}${template.backgroundUrl}`;
}
