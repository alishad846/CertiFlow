import { apiFetch } from './api';

export function getTemplate(id: string) {
  return apiFetch<{ template: any }>(`/certificate-templates/${id}`).then((r) => r.template);
}

export function saveDesign(id: string, payload: { name?: string; editorDocument: unknown }) {
  return apiFetch<{ template: any }>(`/certificate-templates/${id}/design`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export function cloneTemplate(id: string) {
  return apiFetch<{ template: any }>(`/certificate-templates/${id}/duplicate`, { method: 'POST' }).then(
    (r) => r.template
  );
}

export function createBlankTemplate() {
  return apiFetch<{ template: any }>('/certificate-templates/blank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  }).then((r) => r.template);
}
