import { describe, it, expect } from 'vitest';
import { updateCertificateTemplateDesign, getCertificateTemplateById } from '../certificate-templates';
// Assumes a test company + template fixture helper exists; if not, create one mirroring existing service tests.
import { seedTemplateFixture } from './helpers';

describe('updateCertificateTemplateDesign', () => {
  it('stores editor_document and flips render_engine to editor', async () => {
    const { templateId, companyId, userId } = await seedTemplateFixture();
    const design = { pages: [{ layers: [{ type: 'Text', text: 'Hello {{recipient_name}}' }] }] };
    const updated = await updateCertificateTemplateDesign({ templateId, companyId, updatedBy: userId, editorDocument: design });
    expect(updated.renderEngine).toBe('editor');
    const reloaded = await getCertificateTemplateById(templateId, companyId);
    expect(reloaded?.editorDocument).toEqual(design);
  });
});
