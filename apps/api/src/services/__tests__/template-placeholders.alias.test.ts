import { describe, it, expect } from 'vitest';
import { renderTemplateString } from '../template-placeholders';
import { mergeEditorDocument } from '../editor-render';

// The certificate editor exposes friendly merge fields (`recipient_name`, `issue_date`, ...), but the
// runtime context produced by buildTemplateContext is keyed by the canonical field (`name`, plus a
// worker-supplied `issue_date`). These tests lock in that editor placeholders resolve against it.
describe('renderTemplateString reverse-alias resolution', () => {
  const workerContext = {
    name: 'Asha Verma',
    email: 'asha@example.com',
    course: 'Advanced Physics',
    issue_date: '29 July 2026',
    certificate_id: 'CF-ABC123-4567'
  };

  it('resolves {{recipient_name}} from the canonical name field', () => {
    expect(renderTemplateString('Awarded to {{recipient_name}}', workerContext)).toBe(
      'Awarded to Asha Verma'
    );
  });

  it('resolves {{recipient_email}} from email', () => {
    expect(renderTemplateString('{{recipient_email}}', workerContext)).toBe('asha@example.com');
  });

  it('resolves {{issue_date}} (alias of the canonical date family)', () => {
    expect(renderTemplateString('Issued {{issue_date}}', workerContext)).toBe('Issued 29 July 2026');
  });

  it('resolves {{certificate_id}} directly', () => {
    expect(renderTemplateString('ID {{certificate_id}}', workerContext)).toBe('ID CF-ABC123-4567');
  });

  it('still resolves canonical placeholders and leaves unknown tokens blank', () => {
    expect(renderTemplateString('{{name}} / {{course}} / {{missing}}', workerContext)).toBe(
      'Asha Verma / Advanced Physics / '
    );
  });

  it('merges a packed editor document against a worker-shaped context', () => {
    const packedDesign = [
      {
        a: '',
        c: {
          d: { e: { f: 'RootLayer' }, s: ['t1'], t: null },
          t1: {
            e: { f: 'TextLayer' },
            g: { v: '<p>{{recipient_name}} — {{issue_date}}</p>' },
            s: [],
            t: 'd'
          }
        }
      }
    ];
    const out: any = mergeEditorDocument(packedDesign, workerContext);
    expect(out[0].c.t1.g.v).toBe('<p>Asha Verma — 29 July 2026</p>');
  });
});
